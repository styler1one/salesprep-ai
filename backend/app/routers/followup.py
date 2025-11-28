"""
Follow-up Router - API endpoints for post-meeting follow-ups

Handles audio upload, transcription, summary generation, and email drafts.
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
import logging
import os
import uuid

from supabase import create_client
from app.deps import get_current_user
from app.services.transcription_service import get_transcription_service
from app.services.followup_generator import get_followup_generator
from app.services.transcript_parser import get_transcript_parser
from app.services.prospect_context_service import get_prospect_context_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/followup", tags=["followup"])

# Initialize Supabase client
supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)


# Request/Response models
class FollowupResponse(BaseModel):
    id: str
    status: str
    message: str


class FollowupDetail(BaseModel):
    id: str
    organization_id: str
    user_id: str
    meeting_prep_id: Optional[str]
    audio_url: Optional[str]
    audio_filename: Optional[str]
    transcription_text: Optional[str]
    transcription_segments: List[Dict[str, Any]]
    speaker_count: int
    executive_summary: Optional[str]
    key_points: List[str]
    concerns: List[str]
    decisions: List[str]
    next_steps: List[str]
    action_items: List[Dict[str, Any]]
    email_draft: Optional[str]
    email_tone: str
    meeting_date: Optional[str]
    prospect_company_name: Optional[str]
    status: str
    error_message: Optional[str]
    created_at: str
    completed_at: Optional[str]


class UpdateFollowupRequest(BaseModel):
    action_items: Optional[List[Dict[str, Any]]] = None
    email_draft: Optional[str] = None
    email_tone: Optional[str] = None
    meeting_subject: Optional[str] = None


class RegenerateEmailRequest(BaseModel):
    tone: str = "professional"


# Background task for processing
async def process_followup_background(
    followup_id: str,
    audio_data: bytes,
    filename: str,
    organization_id: str,
    user_id: str,
    meeting_prep_id: Optional[str] = None,
    prospect_company: Optional[str] = None
):
    """Background task to process audio and generate follow-up content"""
    
    try:
        # Update status to transcribing
        supabase.table("followups").update({
            "status": "transcribing"
        }).eq("id", followup_id).execute()
        
        # Step 1: Upload audio to Supabase Storage
        storage_path = f"{organization_id}/{followup_id}/{filename}"
        
        supabase.storage.from_("followup-audio").upload(
            storage_path,
            audio_data,
            {"content-type": _get_content_type(filename)}
        )
        
        # Get public URL (signed URL for private bucket)
        audio_url = supabase.storage.from_("followup-audio").create_signed_url(
            storage_path,
            expires_in=86400 * 7  # 7 days
        )
        audio_url = audio_url.get("signedURL", "")
        
        # Update with audio URL
        supabase.table("followups").update({
            "audio_url": audio_url,
            "audio_filename": filename,
            "audio_size_bytes": len(audio_data)
        }).eq("id", followup_id).execute()
        
        # Step 2: Transcribe audio
        transcription_service = get_transcription_service()
        transcription_result = await transcription_service.transcribe_audio_bytes(
            audio_data,
            filename,
            language="nl"
        )
        
        # Convert segments to dict format
        segments = [
            {
                "speaker": seg.speaker,
                "start": seg.start,
                "end": seg.end,
                "text": seg.text
            }
            for seg in transcription_result.segments
        ]
        
        # Update with transcription
        supabase.table("followups").update({
            "status": "summarizing",
            "transcription_text": transcription_result.full_text,
            "transcription_segments": segments,
            "speaker_count": transcription_result.speaker_count,
            "audio_duration_seconds": int(transcription_result.duration_seconds)
        }).eq("id", followup_id).execute()
        
        # Step 3: Get FULL prospect context using new unified service
        prospect_context = None
        
        try:
            context_service = get_prospect_context_service()
            prospect_context = await context_service.get_full_prospect_context(
                prospect_company=prospect_company or "Unknown",
                organization_id=organization_id,
                user_id=user_id,
                meeting_prep_id=meeting_prep_id,
                include_kb=True,
                max_kb_chunks=5
            )
            logger.info(
                f"Got full prospect context: {prospect_context.get('context_completeness', 0)}% complete, "
                f"sources: {prospect_context.get('available_sources', [])}"
            )
        except Exception as e:
            logger.warning(f"Could not get full prospect context: {e}")
            # Fall back to basic context
            prospect_context = None
        
        # Step 4: Generate summary with full context
        followup_generator = get_followup_generator()
        
        summary = await followup_generator.generate_summary(
            transcription=transcription_result.full_text,
            prospect_context=prospect_context,
            prospect_company=prospect_company
        )
        
        # Step 5: Extract action items
        action_items = await followup_generator.extract_action_items(
            transcription=transcription_result.full_text,
            summary=summary.get("executive_summary")
        )
        
        # Step 6: Generate email draft with full context
        email_draft = await followup_generator.generate_email_draft(
            summary=summary,
            action_items=action_items,
            prospect_context=prospect_context,
            prospect_company=prospect_company,
            tone="professional"
        )
        
        # Step 7: Save all results
        supabase.table("followups").update({
            "status": "completed",
            "executive_summary": summary.get("executive_summary", ""),
            "key_points": summary.get("key_points", []),
            "concerns": summary.get("concerns", []),
            "decisions": summary.get("decisions", []),
            "next_steps": summary.get("next_steps", []),
            "action_items": action_items,
            "email_draft": email_draft,
            "completed_at": datetime.utcnow().isoformat()
        }).eq("id", followup_id).execute()
        
        logger.info(f"Successfully processed followup {followup_id}")
        
    except Exception as e:
        logger.error(f"Error processing followup {followup_id}: {e}")
        supabase.table("followups").update({
            "status": "failed",
            "error_message": str(e)
        }).eq("id", followup_id).execute()


def _get_content_type(filename: str) -> str:
    """Get MIME type from filename"""
    ext = filename.lower().split(".")[-1]
    content_types = {
        "mp3": "audio/mpeg",
        "m4a": "audio/mp4",
        "wav": "audio/wav",
        "webm": "audio/webm",
    }
    return content_types.get(ext, "audio/mpeg")


# API Endpoints

@router.post("/upload", response_model=FollowupResponse, status_code=202)
async def upload_audio(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    meeting_prep_id: Optional[str] = Form(None),
    prospect_company_name: Optional[str] = Form(None),
    meeting_date: Optional[str] = Form(None),
    meeting_subject: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Upload audio file for transcription and follow-up generation
    
    Returns immediately with followup ID, processing happens in background
    """
    try:
        # Get user ID from JWT
        user_id = current_user.get("sub") or current_user.get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Could not get user ID")
        
        # Validate file type
        allowed_types = ["audio/mpeg", "audio/mp4", "audio/wav", "audio/webm", "audio/x-m4a"]
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Allowed: mp3, m4a, wav, webm"
            )
        
        # Get user's organization
        org_response = supabase.table("organization_members").select(
            "organization_id"
        ).eq("user_id", user_id).limit(1).execute()
        
        if not org_response.data:
            raise HTTPException(status_code=404, detail="User not in any organization")
        
        organization_id = org_response.data[0]["organization_id"]
        
        # Read file data
        audio_data = await file.read()
        
        # Check file size (50MB limit)
        if len(audio_data) > 50 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="File too large. Max 50MB.")
        
        # Create followup record
        followup_data = {
            "organization_id": organization_id,
            "user_id": user_id,
            "meeting_prep_id": meeting_prep_id,
            "prospect_company_name": prospect_company_name,
            "meeting_date": meeting_date,
            "meeting_subject": meeting_subject,
            "status": "uploading",
            "audio_filename": file.filename
        }
        
        response = supabase.table("followups").insert(followup_data).execute()
        
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to create followup")
        
        followup = response.data[0]
        followup_id = followup["id"]
        
        # Start background processing
        background_tasks.add_task(
            process_followup_background,
            followup_id,
            audio_data,
            file.filename,
            organization_id,
            user_id,
            meeting_prep_id,
            prospect_company_name
        )
        
        logger.info(f"Created followup {followup_id}, starting background processing")
        
        return FollowupResponse(
            id=followup_id,
            status="uploading",
            message="Audio uploaded, processing started"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading audio: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Background task for transcript processing
async def process_transcript_background(
    followup_id: str,
    transcription_text: str,
    segments: list,
    speaker_count: int,
    organization_id: str,
    user_id: str,
    meeting_prep_id: Optional[str] = None,
    prospect_company: Optional[str] = None,
    estimated_duration: Optional[float] = None
):
    """Background task to process transcript and generate follow-up content"""
    
    try:
        # Update status to summarizing
        supabase.table("followups").update({
            "status": "summarizing",
            "transcription_text": transcription_text,
            "transcription_segments": segments,
            "speaker_count": speaker_count,
            "audio_duration_seconds": int(estimated_duration) if estimated_duration else None
        }).eq("id", followup_id).execute()
        
        # Get FULL prospect context using new unified service
        prospect_context = None
        
        try:
            context_service = get_prospect_context_service()
            prospect_context = await context_service.get_full_prospect_context(
                prospect_company=prospect_company or "Unknown",
                organization_id=organization_id,
                user_id=user_id,
                meeting_prep_id=meeting_prep_id,
                include_kb=True,
                max_kb_chunks=5
            )
            logger.info(
                f"Got full prospect context for transcript: {prospect_context.get('context_completeness', 0)}% complete"
            )
        except Exception as e:
            logger.warning(f"Could not get full prospect context: {e}")
            prospect_context = None
        
        # Generate summary with full context
        followup_generator = get_followup_generator()
        
        summary = await followup_generator.generate_summary(
            transcription=transcription_text,
            prospect_context=prospect_context,
            prospect_company=prospect_company
        )
        
        # Extract action items
        action_items = await followup_generator.extract_action_items(
            transcription=transcription_text,
            summary=summary.get("executive_summary")
        )
        
        # Generate email draft with full context
        email_draft = await followup_generator.generate_email_draft(
            summary=summary,
            action_items=action_items,
            prospect_context=prospect_context,
            prospect_company=prospect_company,
            tone="professional"
        )
        
        # Save all results
        supabase.table("followups").update({
            "status": "completed",
            "executive_summary": summary.get("executive_summary", ""),
            "key_points": summary.get("key_points", []),
            "concerns": summary.get("concerns", []),
            "decisions": summary.get("decisions", []),
            "next_steps": summary.get("next_steps", []),
            "action_items": action_items,
            "email_draft": email_draft,
            "completed_at": datetime.utcnow().isoformat()
        }).eq("id", followup_id).execute()
        
        logger.info(f"Successfully processed transcript followup {followup_id}")
        
    except Exception as e:
        logger.error(f"Error processing transcript followup {followup_id}: {e}")
        supabase.table("followups").update({
            "status": "failed",
            "error_message": str(e)
        }).eq("id", followup_id).execute()


@router.post("/upload-transcript", response_model=FollowupResponse, status_code=202)
async def upload_transcript(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    meeting_prep_id: Optional[str] = Form(None),
    prospect_company_name: Optional[str] = Form(None),
    meeting_date: Optional[str] = Form(None),
    meeting_subject: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Upload transcript file for summary and follow-up generation
    
    Supports: .txt, .md, .docx, .srt files
    Returns immediately with followup ID, processing happens in background
    """
    try:
        # Get user ID from JWT
        user_id = current_user.get("sub") or current_user.get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Could not get user ID")
        
        # Validate file type
        allowed_extensions = ["txt", "md", "docx", "srt"]
        file_ext = file.filename.lower().split(".")[-1] if file.filename else ""
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"
            )
        
        # Get user's organization
        org_response = supabase.table("organization_members").select(
            "organization_id"
        ).eq("user_id", user_id).limit(1).execute()
        
        if not org_response.data:
            raise HTTPException(status_code=404, detail="User not in any organization")
        
        organization_id = org_response.data[0]["organization_id"]
        
        # Read file data
        file_data = await file.read()
        
        # Check file size (10MB limit for text files)
        if len(file_data) > 10 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="File too large. Max 10MB.")
        
        # Parse transcript
        parser = get_transcript_parser()
        parsed = parser.parse_file(file_data, file.filename)
        
        # Convert segments to dict format
        segments = [
            {
                "speaker": seg.speaker,
                "start": seg.start,
                "end": seg.end,
                "text": seg.text
            }
            for seg in parsed.segments
        ]
        
        # Create followup record
        followup_data = {
            "organization_id": organization_id,
            "user_id": user_id,
            "meeting_prep_id": meeting_prep_id,
            "prospect_company_name": prospect_company_name,
            "meeting_date": meeting_date,
            "meeting_subject": meeting_subject,
            "status": "summarizing",
            "audio_filename": file.filename  # Store transcript filename
        }
        
        response = supabase.table("followups").insert(followup_data).execute()
        
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to create followup")
        
        followup = response.data[0]
        followup_id = followup["id"]
        
        # Start background processing
        background_tasks.add_task(
            process_transcript_background,
            followup_id,
            parsed.full_text,
            segments,
            parsed.speaker_count,
            organization_id,
            user_id,
            meeting_prep_id,
            prospect_company_name,
            parsed.estimated_duration
        )
        
        logger.info(f"Created transcript followup {followup_id}, starting background processing")
        
        return FollowupResponse(
            id=followup_id,
            status="summarizing",
            message="Transcript uploaded, generating summary..."
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading transcript: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/list", response_model=List[Dict[str, Any]])
async def list_followups(
    limit: int = 20,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """List all follow-ups for the user's organization"""
    try:
        user_id = current_user.get("sub") or current_user.get("id")
        
        # Get organization
        org_response = supabase.table("organization_members").select(
            "organization_id"
        ).eq("user_id", user_id).limit(1).execute()
        
        if not org_response.data:
            raise HTTPException(status_code=404, detail="User not in any organization")
        
        organization_id = org_response.data[0]["organization_id"]
        
        # Get followups
        response = supabase.table("followups").select(
            "id, prospect_company_name, meeting_subject, meeting_date, status, "
            "executive_summary, audio_duration_seconds, created_at, completed_at"
        ).eq(
            "organization_id", organization_id
        ).order(
            "created_at", desc=True
        ).range(offset, offset + limit - 1).execute()
        
        return response.data or []
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing followups: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{followup_id}", response_model=Dict[str, Any])
async def get_followup(
    followup_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific follow-up by ID"""
    try:
        user_id = current_user.get("sub") or current_user.get("id")
        
        # Get organization
        org_response = supabase.table("organization_members").select(
            "organization_id"
        ).eq("user_id", user_id).limit(1).execute()
        
        if not org_response.data:
            raise HTTPException(status_code=404, detail="User not in any organization")
        
        organization_id = org_response.data[0]["organization_id"]
        
        # Get followup
        response = supabase.table("followups").select("*").eq(
            "id", followup_id
        ).eq(
            "organization_id", organization_id
        ).limit(1).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Follow-up not found")
        
        return response.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting followup: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{followup_id}", response_model=Dict[str, Any])
async def update_followup(
    followup_id: str,
    request: UpdateFollowupRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update a follow-up (action items, email draft, etc.)"""
    try:
        user_id = current_user.get("sub") or current_user.get("id")
        
        # Get organization
        org_response = supabase.table("organization_members").select(
            "organization_id"
        ).eq("user_id", user_id).limit(1).execute()
        
        if not org_response.data:
            raise HTTPException(status_code=404, detail="User not in any organization")
        
        organization_id = org_response.data[0]["organization_id"]
        
        # Build update data
        update_data = {}
        if request.action_items is not None:
            update_data["action_items"] = request.action_items
        if request.email_draft is not None:
            update_data["email_draft"] = request.email_draft
        if request.email_tone is not None:
            update_data["email_tone"] = request.email_tone
        if request.meeting_subject is not None:
            update_data["meeting_subject"] = request.meeting_subject
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        # Update
        response = supabase.table("followups").update(update_data).eq(
            "id", followup_id
        ).eq(
            "organization_id", organization_id
        ).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Follow-up not found")
        
        return response.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating followup: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{followup_id}")
async def delete_followup(
    followup_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a follow-up"""
    try:
        user_id = current_user.get("sub") or current_user.get("id")
        
        # Get organization
        org_response = supabase.table("organization_members").select(
            "organization_id"
        ).eq("user_id", user_id).limit(1).execute()
        
        if not org_response.data:
            raise HTTPException(status_code=404, detail="User not in any organization")
        
        organization_id = org_response.data[0]["organization_id"]
        
        # Get followup to delete audio file
        followup_response = supabase.table("followups").select(
            "audio_filename"
        ).eq("id", followup_id).eq("organization_id", organization_id).limit(1).execute()
        
        if followup_response.data and followup_response.data[0].get("audio_filename"):
            # Delete audio file from storage
            storage_path = f"{organization_id}/{followup_id}/{followup_response.data[0]['audio_filename']}"
            try:
                supabase.storage.from_("followup-audio").remove([storage_path])
            except Exception as e:
                logger.warning(f"Could not delete audio file: {e}")
        
        # Delete followup record
        response = supabase.table("followups").delete().eq(
            "id", followup_id
        ).eq(
            "organization_id", organization_id
        ).execute()
        
        return {"message": "Follow-up deleted"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting followup: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{followup_id}/regenerate-email", response_model=Dict[str, Any])
async def regenerate_email(
    followup_id: str,
    request: RegenerateEmailRequest,
    current_user: dict = Depends(get_current_user)
):
    """Regenerate the email draft with different tone"""
    try:
        user_id = current_user.get("sub") or current_user.get("id")
        
        # Get organization
        org_response = supabase.table("organization_members").select(
            "organization_id"
        ).eq("user_id", user_id).limit(1).execute()
        
        if not org_response.data:
            raise HTTPException(status_code=404, detail="User not in any organization")
        
        organization_id = org_response.data[0]["organization_id"]
        
        # Get followup
        followup_response = supabase.table("followups").select("*").eq(
            "id", followup_id
        ).eq(
            "organization_id", organization_id
        ).limit(1).execute()
        
        if not followup_response.data:
            raise HTTPException(status_code=404, detail="Follow-up not found")
        
        followup = followup_response.data[0]
        
        if followup["status"] != "completed":
            raise HTTPException(status_code=400, detail="Follow-up not yet completed")
        
        # Get full prospect context for regeneration
        prospect_context = None
        prospect_company = followup.get("prospect_company_name")
        
        try:
            context_service = get_prospect_context_service()
            prospect_context = await context_service.get_full_prospect_context(
                prospect_company=prospect_company or "Unknown",
                organization_id=organization_id,
                user_id=user_id,
                meeting_prep_id=followup.get("meeting_prep_id"),
                include_kb=True,
                max_kb_chunks=3
            )
        except Exception as e:
            logger.warning(f"Could not get prospect context for email regen: {e}")
        
        # Regenerate email with full context
        followup_generator = get_followup_generator()
        
        summary = {
            "executive_summary": followup.get("executive_summary", ""),
            "key_points": followup.get("key_points", []),
            "next_steps": followup.get("next_steps", [])
        }
        
        email_draft = await followup_generator.generate_email_draft(
            summary=summary,
            action_items=followup.get("action_items", []),
            prospect_context=prospect_context,
            prospect_company=prospect_company,
            tone=request.tone
        )
        
        # Update followup
        supabase.table("followups").update({
            "email_draft": email_draft,
            "email_tone": request.tone
        }).eq("id", followup_id).execute()
        
        return {
            "email_draft": email_draft,
            "email_tone": request.tone
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error regenerating email: {e}")
        raise HTTPException(status_code=500, detail=str(e))


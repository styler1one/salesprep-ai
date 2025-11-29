"""
Preparation Router

API endpoints for meeting preparation management.
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import logging
from app.deps import get_current_user
from app.services.rag_service import rag_service
from app.services.prep_generator import prep_generator
from app.services.prospect_service import get_prospect_service
from supabase import create_client
import os

logger = logging.getLogger(__name__)

router = APIRouter()

# Pydantic models
class PrepStartRequest(BaseModel):
    prospect_company_name: str = Field(..., min_length=1, max_length=255)
    meeting_type: str = Field(..., pattern="^(discovery|demo|closing|follow_up|other)$")
    custom_notes: Optional[str] = None
    contact_ids: Optional[List[str]] = None  # Selected contact persons for this meeting
    language: Optional[str] = "en"  # i18n: output language (default: English)


class PrepResponse(BaseModel):
    id: str
    prospect_company_name: str
    meeting_type: str
    status: str
    custom_notes: Optional[str]
    brief_content: Optional[str]
    talking_points: Optional[List[dict]]
    questions: Optional[List[str]]
    strategy: Optional[str]
    pdf_url: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]


class PrepListResponse(BaseModel):
    preps: List[dict]
    total: int


# Initialize Supabase client
supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)


async def generate_prep_background(
    prep_id: str,
    prospect_company: str,
    meeting_type: str,
    organization_id: str,
    user_id: str,
    custom_notes: Optional[str],
    contact_ids: Optional[List[str]] = None,
    language: str = "en"  # i18n: output language (default: English)
):
    """Background task to generate meeting prep"""
    try:
        # Update status to generating
        supabase.table("meeting_preps").update({
            "status": "generating"
        }).eq("id", prep_id).execute()
        
        logger.info(f"Starting prep generation for {prep_id}")
        
        # Build context using RAG (now includes profile context)
        context = await rag_service.build_context_for_ai(
            prospect_company=prospect_company,
            meeting_type=meeting_type,
            organization_id=organization_id,
            user_id=user_id,
            custom_notes=custom_notes
        )
        
        # Fetch contact persons if specified
        contacts_data = []
        if contact_ids:
            logger.info(f"Fetching {len(contact_ids)} contacts for prep")
            contacts_response = supabase.table("prospect_contacts")\
                .select("*")\
                .in_("id", contact_ids)\
                .eq("organization_id", organization_id)\
                .execute()
            
            if contacts_response.data:
                contacts_data = contacts_response.data
                logger.info(f"Found {len(contacts_data)} contacts with analysis")
        
        # Add contacts to context
        context["contacts"] = contacts_data
        context["has_contacts"] = len(contacts_data) > 0
        
        # Generate brief with AI
        result = await prep_generator.generate_meeting_brief(context, language=language)
        
        # Update database with results
        supabase.table("meeting_preps").update({
            "status": "completed",
            "brief_content": result["brief_content"],
            "talking_points": result["talking_points"],
            "questions": result["questions"],
            "strategy": result["strategy"],
            "rag_sources": result["rag_sources"],
            "completed_at": datetime.utcnow().isoformat()
        }).eq("id", prep_id).execute()
        
        logger.info(f"Successfully completed prep generation for {prep_id}")
        
    except Exception as e:
        logger.error(f"Error generating prep {prep_id}: {e}")
        
        # Update status to failed
        supabase.table("meeting_preps").update({
            "status": "failed",
            "error_message": str(e)
        }).eq("id", prep_id).execute()


@router.post("/start", response_model=dict, status_code=202)
async def start_prep(
    request: PrepStartRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    Start a new meeting prep generation
    
    Returns immediately with prep ID, generation happens in background
    """
    try:
        # Supabase JWT stores user id as 'sub' (subject)
        user_id = current_user.get("sub") or current_user.get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Could not get user ID from token")
        
        # Get user's organization
        org_response = supabase.table("organization_members").select(
            "organization_id"
        ).eq("user_id", user_id).limit(1).execute()
        
        if not org_response.data:
            raise HTTPException(status_code=404, detail="User not in any organization")
        
        organization_id = org_response.data[0]["organization_id"]
        
        # Get or create prospect (NEW!)
        prospect_service = get_prospect_service()
        prospect_id = prospect_service.get_or_create_prospect(
            organization_id=organization_id,
            company_name=request.prospect_company_name
        )
        
        # Check if research brief exists (now also by prospect_id)
        research_response = supabase.table("research_briefs").select("id").eq(
            "organization_id", organization_id
        ).eq(
            "status", "completed"
        )
        
        # Try to find by prospect_id first, then fallback to company name
        if prospect_id:
            research_response = research_response.eq("prospect_id", prospect_id)
        else:
            research_response = research_response.ilike(
                "company_name", f"%{request.prospect_company_name}%"
            )
        
        research_response = research_response.limit(1).execute()
        research_brief_id = research_response.data[0]["id"] if research_response.data else None
        
        # Create prep record with prospect_id
        prep_data = {
            "organization_id": organization_id,
            "user_id": user_id,
            "prospect_id": prospect_id,  # Link to prospect!
            "prospect_company_name": request.prospect_company_name,
            "meeting_type": request.meeting_type,
            "custom_notes": request.custom_notes,
            "status": "pending",
            "research_brief_id": research_brief_id
        }
        
        response = supabase.table("meeting_preps").insert(prep_data).execute()
        
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to create prep")
        
        prep = response.data[0]
        prep_id = prep["id"]
        
        # Start background generation (now includes user_id for profile context)
        background_tasks.add_task(
            generate_prep_background,
            prep_id,
            request.prospect_company_name,
            request.meeting_type,
            organization_id,
            user_id,  # Pass user_id for personalized briefs
            request.custom_notes,
            request.contact_ids,  # Pass selected contacts
            request.language or "nl"  # i18n: output language
        )
        
        contact_count = len(request.contact_ids) if request.contact_ids else 0
        logger.info(f"Created prep {prep_id} for {request.prospect_company_name} (prospect: {prospect_id}, contacts: {contact_count})")
        
        return {
            "id": prep_id,
            "prospect_id": prospect_id,
            "prospect_company_name": request.prospect_company_name,
            "meeting_type": request.meeting_type,
            "status": "pending",
            "created_at": prep["created_at"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting prep: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/briefs", response_model=PrepListResponse)
async def list_preps(
    meeting_type: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """List all meeting preps for user's organization"""
    try:
        user_id = current_user.get("sub") or current_user.get("id")
        
        # Get user's organization
        org_response = supabase.table("organization_members").select(
            "organization_id"
        ).eq("user_id", user_id).limit(1).execute()
        
        if not org_response.data:
            raise HTTPException(status_code=404, detail="User not in any organization")
        
        organization_id = org_response.data[0]["organization_id"]
        
        # Build query
        query = supabase.table("meeting_preps").select(
            "id, prospect_company_name, meeting_type, status, created_at, completed_at"
        ).eq("organization_id", organization_id)
        
        if meeting_type:
            query = query.eq("meeting_type", meeting_type)
        
        if status:
            query = query.eq("status", status)
        
        query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
        
        response = query.execute()
        
        # Get total count
        count_response = supabase.table("meeting_preps").select(
            "id", count="exact"
        ).eq("organization_id", organization_id).execute()
        
        total = count_response.count if hasattr(count_response, 'count') else len(response.data)
        
        return {
            "preps": response.data,
            "total": total
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing preps: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{prep_id}", response_model=dict)
async def get_prep(
    prep_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get specific meeting prep with full details"""
    try:
        user_id = current_user.get("sub") or current_user.get("id")
        
        # Get user's organization
        org_response = supabase.table("organization_members").select(
            "organization_id"
        ).eq("user_id", user_id).limit(1).execute()
        
        if not org_response.data:
            raise HTTPException(status_code=404, detail="User not in any organization")
        
        organization_id = org_response.data[0]["organization_id"]
        
        # Get prep
        response = supabase.table("meeting_preps").select("*").eq(
            "id", prep_id
        ).eq(
            "organization_id", organization_id
        ).limit(1).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Prep not found")
        
        return response.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting prep: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{prep_id}", response_model=dict)
async def update_prep(
    prep_id: str,
    custom_notes: str,
    current_user: dict = Depends(get_current_user)
):
    """Update meeting prep notes"""
    try:
        user_id = current_user.get("sub") or current_user.get("id")
        
        # Get user's organization
        org_response = supabase.table("organization_members").select(
            "organization_id"
        ).eq("user_id", user_id).limit(1).execute()
        
        if not org_response.data:
            raise HTTPException(status_code=404, detail="User not in any organization")
        
        organization_id = org_response.data[0]["organization_id"]
        
        # Update prep
        response = supabase.table("meeting_preps").update({
            "custom_notes": custom_notes
        }).eq("id", prep_id).eq("organization_id", organization_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Prep not found")
        
        return response.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating prep: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{prep_id}", status_code=204)
async def delete_prep(
    prep_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a meeting prep"""
    try:
        user_id = current_user.get("sub") or current_user.get("id")
        
        # Get user's organization
        org_response = supabase.table("organization_members").select(
            "organization_id"
        ).eq("user_id", user_id).limit(1).execute()
        
        if not org_response.data:
            raise HTTPException(status_code=404, detail="User not in any organization")
        
        organization_id = org_response.data[0]["organization_id"]
        
        # Delete prep
        response = supabase.table("meeting_preps").delete().eq(
            "id", prep_id
        ).eq(
            "organization_id", organization_id
        ).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Prep not found")
        
        return None
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting prep: {e}")
        raise HTTPException(status_code=500, detail=str(e))

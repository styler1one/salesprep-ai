"""
Research Agent API endpoints.
"""
import os
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from supabase import create_client, Client

from app.deps import get_current_user, get_auth_token


router = APIRouter()

# Initialize Supabase clients
supabase_url = os.getenv("SUPABASE_URL")
supabase_anon_key = os.getenv("SUPABASE_KEY")
supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", supabase_anon_key)

# Service role client for background tasks and storage (bypasses RLS)
supabase_service: Client = create_client(supabase_url, supabase_service_key)


def get_user_supabase_client(user_token: str) -> Client:
    """
    Create a Supabase client with user's JWT token for RLS.
    """
    client = create_client(supabase_url, supabase_anon_key)
    # Set auth for PostgREST operations
    client.postgrest.auth(user_token)
    return client


# Request/Response models
class ResearchRequest(BaseModel):
    company_name: str
    company_linkedin_url: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None


class ResearchResponse(BaseModel):
    id: str
    company_name: str
    status: str
    created_at: str


# Background processing function
def process_research_background(
    research_id: str,
    company_name: str,
    country: Optional[str],
    city: Optional[str],
    linkedin_url: Optional[str]
):
    """
    Background task to process research request.
    1. Execute parallel searches (Claude, Gemini, KVK)
    2. Merge results
    3. Generate PDF
    4. Update database
    """
    import asyncio
    from app.services.research_orchestrator import ResearchOrchestrator
    
    try:
        print(f"DEBUG: Starting research for {company_name}")
        
        # Update status to researching
        supabase_service.table("research_briefs").update({
            "status": "researching"
        }).eq("id", research_id).execute()
        
        print(f"DEBUG: Status updated to researching")
        
        # Execute research (run async function in sync context)
        orchestrator = ResearchOrchestrator()
        research_data = asyncio.run(orchestrator.research_company(
            company_name=company_name,
            country=country,
            city=city,
            linkedin_url=linkedin_url
        ))
        
        print(f"DEBUG: Research completed, got {len(research_data.get('sources', {}))} sources")
        print(f"DEBUG: Success count: {research_data.get('success_count', 0)}")
        
        # Store source data
        for source_name, source_result in research_data["sources"].items():
            success = source_result.get('success', False)
            error = source_result.get('error', 'No error message')
            print(f"DEBUG: Source {source_name} - Success: {success}")
            if not success:
                print(f"ERROR: Source {source_name} failed: {error}")
            
            supabase_service.table("research_sources").insert({
                "research_id": research_id,
                "source_type": source_name,
                "source_name": source_name,
                "data": source_result
            }).execute()
        
        # Get the unified brief
        brief_content = research_data.get("brief", "")
        print(f"DEBUG: Brief length: {len(brief_content)} characters")
        
        # TODO: Generate PDF (Phase 2.5)
        pdf_url = None
        
        # Update research status to completed
        supabase_service.table("research_briefs").update({
            "status": "completed",
            "research_data": research_data,
            "brief_content": brief_content,
            "pdf_url": pdf_url,
            "completed_at": "now()"
        }).eq("id", research_id).execute()
        
        print(f"DEBUG: Research {research_id} completed successfully")
        
    except Exception as e:
        print(f"ERROR: Research failed: {type(e).__name__}: {str(e)}")
        import traceback
        print(f"ERROR traceback: {traceback.format_exc()}")
        
        # Update status to failed
        supabase_service.table("research_briefs").update({
            "status": "failed",
            "error_message": str(e)
        }).eq("id", research_id).execute()


@router.post("/start", response_model=ResearchResponse)
async def start_research(
    request: ResearchRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    auth_token: str = Depends(get_auth_token)
):
    """
    Start a new research brief.
    """
    # Create user-specific client for RLS security
    user_supabase = get_user_supabase_client(auth_token)
    
    # Get user's organization
    user_id = current_user.get("sub")
    org_response = user_supabase.table("organization_members").select("organization_id").eq("user_id", user_id).execute()
    
    if not org_response.data:
        raise HTTPException(status_code=403, detail="User not in any organization")
    
    organization_id = org_response.data[0]["organization_id"]
    
    # Generate research ID
    research_id = str(uuid.uuid4())
    
    try:
        # Create database record
        db_record = {
            "id": research_id,
            "organization_id": organization_id,
            "user_id": user_id,
            "company_name": request.company_name,
            "company_linkedin_url": request.company_linkedin_url,
            "country": request.country,
            "city": request.city,
            "status": "pending"
        }
        
        result = supabase_service.table("research_briefs").insert(db_record).execute()
        
        # Start background processing
        background_tasks.add_task(
            process_research_background,
            research_id,
            request.company_name,
            request.country,
            request.city,
            request.company_linkedin_url
        )
        
        return ResearchResponse(
            id=research_id,
            company_name=request.company_name,
            status="pending",
            created_at=result.data[0]["created_at"]
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start research: {str(e)}")


@router.get("/briefs")
async def list_research_briefs(
    current_user: dict = Depends(get_current_user),
    auth_token: str = Depends(get_auth_token)
):
    """
    List all research briefs for user's organization.
    """
    # Create user-specific client for RLS security
    user_supabase = get_user_supabase_client(auth_token)
    
    # Get user's organization
    user_id = current_user.get("sub")
    org_response = user_supabase.table("organization_members").select("organization_id").eq("user_id", user_id).execute()
    
    if not org_response.data:
        raise HTTPException(status_code=403, detail="User not in any organization")
    
    organization_id = org_response.data[0]["organization_id"]
    
    # Get research briefs
    briefs_response = user_supabase.table("research_briefs").select("*").eq(
        "organization_id", organization_id
    ).order("created_at", desc=True).execute()
    
    return {"briefs": briefs_response.data}


@router.get("/{research_id}/status")
async def get_research_status(
    research_id: str,
    current_user: dict = Depends(get_current_user),
    auth_token: str = Depends(get_auth_token)
):
    """
    Get status of a specific research brief.
    """
    # Create user-specific client for RLS security
    user_supabase = get_user_supabase_client(auth_token)
    
    # Get research brief (RLS ensures user can only see their org's research)
    research_response = user_supabase.table("research_briefs").select("*").eq("id", research_id).execute()
    
    if not research_response.data:
        raise HTTPException(status_code=404, detail="Research not found")
    
    research = research_response.data[0]
    
    # Build progress info
    progress = {
        "status": research["status"],
        "created_at": research["created_at"],
        "completed_at": research.get("completed_at")
    }
    
    if research["status"] == "failed":
        progress["error"] = research.get("error_message")
    
    return progress


@router.delete("/{research_id}")
async def delete_research(
    research_id: str,
    current_user: dict = Depends(get_current_user),
    auth_token: str = Depends(get_auth_token)
):
    """
    Delete a research brief.
    """
    # Create user-specific client for RLS security
    user_supabase = get_user_supabase_client(auth_token)
    
    # Get research brief to check ownership and get PDF URL
    research_response = user_supabase.table("research_briefs").select("*").eq("id", research_id).execute()
    
    if not research_response.data:
        raise HTTPException(status_code=404, detail="Research not found")
    
    research = research_response.data[0]
    
    try:
        # Delete PDF from storage if exists
        if research.get("pdf_url"):
            # Extract path from URL
            # TODO: Implement PDF deletion from storage
            pass
        
        # Delete research sources (will cascade)
        # Delete research brief (RLS ensures user can only delete their org's research)
        supabase_service.table("research_briefs").delete().eq("id", research_id).execute()
        
        return Response(status_code=204)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")


@router.get("/{research_id}/brief")
async def get_research_brief(
    research_id: str,
    current_user: dict = Depends(get_current_user),
    auth_token: str = Depends(get_auth_token)
):
    """
    Get the full research brief content.
    """
    # Create user-specific client for RLS security
    user_supabase = get_user_supabase_client(auth_token)
    
    # Get research brief (RLS ensures user can only see their org's research)
    research_response = user_supabase.table("research_briefs").select("*").eq("id", research_id).execute()
    
    if not research_response.data:
        raise HTTPException(status_code=404, detail="Research not found")
    
    research = research_response.data[0]
    
    if research["status"] != "completed":
        raise HTTPException(status_code=400, detail=f"Research is {research['status']}, not completed")
    
    return {
        "id": research["id"],
        "company_name": research["company_name"],
        "brief_content": research["brief_content"],
        "pdf_url": research.get("pdf_url"),
        "created_at": research["created_at"],
        "completed_at": research["completed_at"]
    }

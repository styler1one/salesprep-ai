"""
Prospects Router - API endpoints for prospect management

Now uses the dedicated prospects table for proper data management.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging
import os

from supabase import create_client
from app.deps import get_current_user
from app.services.prospect_service import get_prospect_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/prospects", tags=["prospects"])

# Initialize Supabase client
supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)


# Request/Response models
class ProspectCreate(BaseModel):
    company_name: str = Field(..., min_length=1, max_length=255)
    website: Optional[str] = None
    linkedin_url: Optional[str] = None
    industry: Optional[str] = None
    company_size: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_role: Optional[str] = None
    contact_linkedin: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None


class ProspectUpdate(BaseModel):
    company_name: Optional[str] = None
    website: Optional[str] = None
    linkedin_url: Optional[str] = None
    industry: Optional[str] = None
    company_size: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_role: Optional[str] = None
    contact_linkedin: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None


class ProspectResponse(BaseModel):
    id: str
    company_name: str
    status: str
    website: Optional[str] = None
    linkedin_url: Optional[str] = None
    industry: Optional[str] = None
    company_size: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_role: Optional[str] = None
    tags: Optional[List[str]] = None
    created_at: datetime
    updated_at: datetime
    last_activity_at: datetime
    # Activity counts
    research_count: Optional[int] = 0
    prep_count: Optional[int] = 0
    followup_count: Optional[int] = 0


class ProspectListResponse(BaseModel):
    prospects: List[Dict[str, Any]]
    total: int


def get_organization_id(current_user: dict) -> str:
    """Helper to get user's organization ID."""
    user_id = current_user.get("sub") or current_user.get("id")
    
    org_response = supabase.table("organization_members").select(
        "organization_id"
    ).eq("user_id", user_id).limit(1).execute()
    
    if not org_response.data:
        raise HTTPException(status_code=404, detail="User not in any organization")
    
    return org_response.data[0]["organization_id"]


@router.get("", response_model=ProspectListResponse)
async def list_prospects(
    status: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(default=50, le=100),
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """
    List all prospects for the organization.
    
    Args:
        status: Filter by status (new, researching, qualified, etc.)
        search: Search by company name
        limit: Max results (default 50, max 100)
        offset: Pagination offset
    """
    try:
        organization_id = get_organization_id(current_user)
        
        # Build query
        query = supabase.table("prospects").select(
            "*, research_briefs(id), meeting_preps(id), followups(id)",
            count="exact"
        ).eq("organization_id", organization_id)
        
        if status:
            query = query.eq("status", status)
        
        if search and len(search) >= 2:
            query = query.ilike("company_name", f"%{search}%")
        
        query = query.order("last_activity_at", desc=True).range(offset, offset + limit - 1)
        
        response = query.execute()
        
        # Transform data to include activity counts
        prospects = []
        for p in response.data or []:
            prospect = {**p}
            prospect["research_count"] = len(p.get("research_briefs", []) or [])
            prospect["prep_count"] = len(p.get("meeting_preps", []) or [])
            prospect["followup_count"] = len(p.get("followups", []) or [])
            # Remove nested arrays
            prospect.pop("research_briefs", None)
            prospect.pop("meeting_preps", None)
            prospect.pop("followups", None)
            prospects.append(prospect)
        
        return {
            "prospects": prospects,
            "total": response.count if hasattr(response, 'count') and response.count else len(prospects)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing prospects: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search", response_model=List[Dict[str, Any]])
async def search_prospects(
    q: str,
    limit: int = 10,
    current_user: dict = Depends(get_current_user)
):
    """
    Search prospects by name (for autocomplete).
    
    Args:
        q: Search query (min 2 characters)
        limit: Max results to return
    """
    if len(q) < 2:
        return []
    
    try:
        organization_id = get_organization_id(current_user)
        
        # Search by normalized name
        response = supabase.table("prospects").select(
            "id, company_name, status, industry, last_activity_at"
        ).eq(
            "organization_id", organization_id
        ).ilike(
            "company_name", f"%{q}%"
        ).order(
            "last_activity_at", desc=True
        ).limit(limit).execute()
        
        return response.data or []
        
    except Exception as e:
        logger.error(f"Error searching prospects: {e}")
        return []


@router.post("", response_model=Dict[str, Any], status_code=201)
async def create_prospect(
    request: ProspectCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a new prospect.
    """
    try:
        organization_id = get_organization_id(current_user)
        
        # Use prospect service for proper handling
        prospect_service = get_prospect_service()
        
        # Check if prospect already exists
        existing = prospect_service.get_prospect_by_name(
            organization_id=organization_id,
            company_name=request.company_name
        )
        
        if existing:
            raise HTTPException(
                status_code=409, 
                detail=f"Prospect '{request.company_name}' already exists"
            )
        
        # Create prospect
        prospect_data = {
            "organization_id": organization_id,
            "company_name": request.company_name,
            "website": request.website,
            "linkedin_url": request.linkedin_url,
            "industry": request.industry,
            "company_size": request.company_size,
            "country": request.country,
            "city": request.city,
            "contact_name": request.contact_name,
            "contact_email": request.contact_email,
            "contact_role": request.contact_role,
            "contact_linkedin": request.contact_linkedin,
            "notes": request.notes,
            "tags": request.tags or [],
            "status": "new"
        }
        
        # Remove None values
        prospect_data = {k: v for k, v in prospect_data.items() if v is not None}
        
        response = supabase.table("prospects").insert(prospect_data).execute()
        
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to create prospect")
        
        logger.info(f"Created prospect: {request.company_name}")
        
        return response.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating prospect: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{prospect_id}", response_model=Dict[str, Any])
async def get_prospect(
    prospect_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get a specific prospect with activity details.
    """
    try:
        organization_id = get_organization_id(current_user)
        
        # Get prospect with related data
        response = supabase.table("prospects").select(
            "*, research_briefs(id, status, created_at), meeting_preps(id, status, meeting_type, created_at), followups(id, status, created_at)"
        ).eq(
            "id", prospect_id
        ).eq(
            "organization_id", organization_id
        ).limit(1).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Prospect not found")
        
        prospect = response.data[0]
        
        # Add activity counts
        prospect["research_count"] = len(prospect.get("research_briefs", []) or [])
        prospect["prep_count"] = len(prospect.get("meeting_preps", []) or [])
        prospect["followup_count"] = len(prospect.get("followups", []) or [])
        
        return prospect
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting prospect: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{prospect_id}", response_model=Dict[str, Any])
async def update_prospect(
    prospect_id: str,
    request: ProspectUpdate,
    current_user: dict = Depends(get_current_user)
):
    """
    Update a prospect.
    """
    try:
        organization_id = get_organization_id(current_user)
        
        # Build update data (only non-None values)
        update_data = request.model_dump(exclude_unset=True)
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        # Validate status if provided
        valid_statuses = ['new', 'researching', 'qualified', 'meeting_scheduled', 'proposal_sent', 'won', 'lost', 'inactive']
        if 'status' in update_data and update_data['status'] not in valid_statuses:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
            )
        
        response = supabase.table("prospects").update(update_data).eq(
            "id", prospect_id
        ).eq(
            "organization_id", organization_id
        ).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Prospect not found")
        
        logger.info(f"Updated prospect {prospect_id}")
        
        return response.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating prospect: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{prospect_id}", status_code=204)
async def delete_prospect(
    prospect_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a prospect.
    
    Note: This will NOT delete related research/preps/followups,
    but will set their prospect_id to NULL.
    """
    try:
        organization_id = get_organization_id(current_user)
        
        response = supabase.table("prospects").delete().eq(
            "id", prospect_id
        ).eq(
            "organization_id", organization_id
        ).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Prospect not found")
        
        logger.info(f"Deleted prospect {prospect_id}")
        
        return None
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting prospect: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{prospect_id}/timeline", response_model=List[Dict[str, Any]])
async def get_prospect_timeline(
    prospect_id: str,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """
    Get activity timeline for a prospect.
    
    Returns chronological list of all activities (research, preps, followups).
    """
    try:
        organization_id = get_organization_id(current_user)
        
        # Verify prospect exists and belongs to org
        prospect_response = supabase.table("prospects").select("id").eq(
            "id", prospect_id
        ).eq(
            "organization_id", organization_id
        ).limit(1).execute()
        
        if not prospect_response.data:
            raise HTTPException(status_code=404, detail="Prospect not found")
        
        timeline = []
        
        # Get research briefs
        research = supabase.table("research_briefs").select(
            "id, company_name, status, created_at, completed_at"
        ).eq("prospect_id", prospect_id).execute()
        
        for r in research.data or []:
            timeline.append({
                "type": "research",
                "id": r["id"],
                "title": f"Research: {r['company_name']}",
                "status": r["status"],
                "created_at": r["created_at"],
                "completed_at": r.get("completed_at")
            })
        
        # Get meeting preps
        preps = supabase.table("meeting_preps").select(
            "id, prospect_company_name, meeting_type, status, created_at, completed_at"
        ).eq("prospect_id", prospect_id).execute()
        
        for p in preps.data or []:
            timeline.append({
                "type": "preparation",
                "id": p["id"],
                "title": f"Prep ({p['meeting_type']}): {p['prospect_company_name']}",
                "status": p["status"],
                "created_at": p["created_at"],
                "completed_at": p.get("completed_at")
            })
        
        # Get followups
        followups = supabase.table("followups").select(
            "id, prospect_company_name, meeting_subject, status, created_at, completed_at"
        ).eq("prospect_id", prospect_id).execute()
        
        for f in followups.data or []:
            timeline.append({
                "type": "followup",
                "id": f["id"],
                "title": f"Follow-up: {f.get('meeting_subject') or f['prospect_company_name']}",
                "status": f["status"],
                "created_at": f["created_at"],
                "completed_at": f.get("completed_at")
            })
        
        # Sort by created_at descending
        timeline.sort(key=lambda x: x["created_at"], reverse=True)
        
        return timeline[:limit]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting prospect timeline: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Keep legacy endpoint for backwards compatibility
@router.get("/known", response_model=List[Dict[str, Any]], deprecated=True)
async def get_known_prospects_legacy(
    current_user: dict = Depends(get_current_user)
):
    """
    [DEPRECATED] Use GET /prospects instead.
    
    Returns prospects in legacy format for backwards compatibility.
    """
    try:
        organization_id = get_organization_id(current_user)
        
        # Get all prospects with activity counts
        response = supabase.table("prospects").select(
            "id, company_name, status, last_activity_at, research_briefs(id), meeting_preps(id), followups(id)"
        ).eq(
            "organization_id", organization_id
        ).order(
            "last_activity_at", desc=True
        ).execute()
        
        # Transform to legacy format
        result = []
        for p in response.data or []:
            has_research = len(p.get("research_briefs", []) or []) > 0
            has_prep = len(p.get("meeting_preps", []) or []) > 0
            has_followup = len(p.get("followups", []) or []) > 0
            
            context_score = sum([has_research, has_prep, has_followup])
            
            result.append({
                "id": p["id"],
                "name": p["company_name"],
                "has_research": has_research,
                "has_prep": has_prep,
                "has_followup": has_followup,
                "last_activity": p["last_activity_at"],
                "last_activity_type": "unknown",  # Legacy field
                "context_score": context_score
            })
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting known prospects: {e}")
        raise HTTPException(status_code=500, detail=str(e))

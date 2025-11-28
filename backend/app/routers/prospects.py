"""
Prospects Router - API endpoints for prospect management

Provides a unified view of all known prospects from:
- Research briefs
- Meeting preps
- Follow-ups
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging
import os

from supabase import create_client
from app.deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/prospects", tags=["prospects"])

# Initialize Supabase client
supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)


@router.get("/known", response_model=List[Dict[str, Any]])
async def get_known_prospects(
    current_user: dict = Depends(get_current_user)
):
    """
    Get all known prospects for the organization.
    
    Aggregates unique prospect names from:
    - Research briefs (company_name)
    - Meeting preps (prospect_company_name)
    - Follow-ups (prospect_company_name)
    
    Returns a list of prospects with their last activity and available context.
    """
    try:
        user_id = current_user.get("sub") or current_user.get("id")
        
        # Get organization
        org_response = supabase.table("organization_members").select(
            "organization_id"
        ).eq("user_id", user_id).limit(1).execute()
        
        if not org_response.data:
            raise HTTPException(status_code=404, detail="User not in any organization")
        
        organization_id = org_response.data[0]["organization_id"]
        
        # Dictionary to collect unique prospects
        prospects: Dict[str, Dict[str, Any]] = {}
        
        # 1. Get prospects from research briefs
        research_response = supabase.table("research_briefs").select(
            "company_name, created_at, status"
        ).eq(
            "organization_id", organization_id
        ).eq(
            "status", "completed"
        ).order("created_at", desc=True).execute()
        
        for item in research_response.data or []:
            name = item.get("company_name", "").strip()
            if name:
                key = name.lower()  # Normalize for deduplication
                if key not in prospects:
                    prospects[key] = {
                        "name": name,
                        "has_research": True,
                        "has_prep": False,
                        "has_followup": False,
                        "last_activity": item.get("created_at"),
                        "last_activity_type": "research"
                    }
                else:
                    prospects[key]["has_research"] = True
                    # Update last activity if more recent
                    if item.get("created_at") > prospects[key]["last_activity"]:
                        prospects[key]["last_activity"] = item.get("created_at")
                        prospects[key]["last_activity_type"] = "research"
        
        # 2. Get prospects from meeting preps
        prep_response = supabase.table("meeting_preps").select(
            "prospect_company_name, created_at, status"
        ).eq(
            "organization_id", organization_id
        ).eq(
            "status", "completed"
        ).order("created_at", desc=True).execute()
        
        for item in prep_response.data or []:
            name = item.get("prospect_company_name", "").strip()
            if name:
                key = name.lower()
                if key not in prospects:
                    prospects[key] = {
                        "name": name,
                        "has_research": False,
                        "has_prep": True,
                        "has_followup": False,
                        "last_activity": item.get("created_at"),
                        "last_activity_type": "preparation"
                    }
                else:
                    prospects[key]["has_prep"] = True
                    if item.get("created_at") > prospects[key]["last_activity"]:
                        prospects[key]["last_activity"] = item.get("created_at")
                        prospects[key]["last_activity_type"] = "preparation"
        
        # 3. Get prospects from follow-ups
        followup_response = supabase.table("followups").select(
            "prospect_company_name, created_at, status"
        ).eq(
            "organization_id", organization_id
        ).eq(
            "status", "completed"
        ).order("created_at", desc=True).execute()
        
        for item in followup_response.data or []:
            name = item.get("prospect_company_name", "").strip()
            if name:
                key = name.lower()
                if key not in prospects:
                    prospects[key] = {
                        "name": name,
                        "has_research": False,
                        "has_prep": False,
                        "has_followup": True,
                        "last_activity": item.get("created_at"),
                        "last_activity_type": "followup"
                    }
                else:
                    prospects[key]["has_followup"] = True
                    if item.get("created_at") > prospects[key]["last_activity"]:
                        prospects[key]["last_activity"] = item.get("created_at")
                        prospects[key]["last_activity_type"] = "followup"
        
        # Convert to list and sort by last activity
        result = list(prospects.values())
        result.sort(key=lambda x: x.get("last_activity", ""), reverse=True)
        
        # Calculate context score for each prospect
        for prospect in result:
            score = 0
            if prospect["has_research"]:
                score += 1
            if prospect["has_prep"]:
                score += 1
            if prospect["has_followup"]:
                score += 1
            prospect["context_score"] = score
        
        logger.info(f"Found {len(result)} known prospects for organization {organization_id}")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting known prospects: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search", response_model=List[Dict[str, Any]])
async def search_prospects(
    q: str,
    limit: int = 10,
    current_user: dict = Depends(get_current_user)
):
    """
    Search known prospects by name (for autocomplete).
    
    Args:
        q: Search query (min 2 characters)
        limit: Max results to return
    """
    if len(q) < 2:
        return []
    
    try:
        user_id = current_user.get("sub") or current_user.get("id")
        
        # Get organization
        org_response = supabase.table("organization_members").select(
            "organization_id"
        ).eq("user_id", user_id).limit(1).execute()
        
        if not org_response.data:
            return []
        
        organization_id = org_response.data[0]["organization_id"]
        
        # Get all known prospects first (we'll filter in Python for flexibility)
        all_prospects = await get_known_prospects(current_user)
        
        # Filter by search query (case-insensitive)
        query_lower = q.lower()
        matching = [
            p for p in all_prospects 
            if query_lower in p["name"].lower()
        ]
        
        # Sort: exact start match first, then by context score
        def sort_key(p):
            name_lower = p["name"].lower()
            starts_with = name_lower.startswith(query_lower)
            return (not starts_with, -p["context_score"], name_lower)
        
        matching.sort(key=sort_key)
        
        return matching[:limit]
        
    except Exception as e:
        logger.error(f"Error searching prospects: {e}")
        return []


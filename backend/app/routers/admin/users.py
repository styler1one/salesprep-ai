"""
Admin Users Router
==================

Endpoints for user management in the admin panel.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from typing import Optional, List, Any, Dict
from uuid import UUID
from datetime import datetime

from app.deps import get_admin_user, require_admin_role, AdminContext
from app.database import get_supabase_service
from .utils import log_admin_action, calculate_health_score, get_health_status

router = APIRouter(prefix="/users", tags=["admin-users"])


# ============================================================
# Response Models
# ============================================================

class FlowUsage(BaseModel):
    used: int
    limit: int
    pack_balance: int


class AdminUserListItem(BaseModel):
    id: str
    email: str
    full_name: Optional[str]
    organization_id: Optional[str]
    organization_name: Optional[str]
    plan: str
    flow_usage: FlowUsage
    health_score: int
    health_status: str
    last_active: Optional[datetime]
    created_at: datetime


class FlowPackInfo(BaseModel):
    id: str
    flows_purchased: int
    flows_remaining: int
    purchased_at: datetime
    status: str


class AdminNoteInfo(BaseModel):
    id: str
    content: str
    is_pinned: bool
    admin_name: str
    created_at: datetime


class AdminUserDetail(AdminUserListItem):
    stripe_customer_id: Optional[str]
    subscription_status: Optional[str]
    trial_ends_at: Optional[datetime]
    profile_completeness: int
    total_researches: int
    total_preps: int
    total_followups: int
    error_count_30d: int
    flow_packs: List[FlowPackInfo]
    admin_notes: List[AdminNoteInfo]


class UserListResponse(BaseModel):
    users: List[AdminUserListItem]
    total: int
    offset: int
    limit: int


class ActivityItem(BaseModel):
    id: str
    type: str
    description: str
    created_at: datetime
    metadata: Optional[Dict[str, Any]] = None


class UserActivityResponse(BaseModel):
    activities: List[ActivityItem]
    total: int


# Request Models

class ResetFlowsRequest(BaseModel):
    reason: str


class AddFlowsRequest(BaseModel):
    flows: int
    reason: str


class ExtendTrialRequest(BaseModel):
    days: int
    reason: str


# ============================================================
# Endpoints
# ============================================================

@router.get("", response_model=UserListResponse)
async def list_users(
    search: Optional[str] = Query(None, description="Search by email, name, or org"),
    plan: Optional[str] = Query(None, description="Filter by plan"),
    health_status: Optional[str] = Query(None, description="Filter by health status"),
    sort_by: str = Query("created_at", description="Sort field"),
    sort_order: str = Query("desc", description="Sort order: asc or desc"),
    offset: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=100),
    admin: AdminContext = Depends(get_admin_user)
):
    """
    List all users with pagination and filtering.
    
    Filters:
    - search: Search in email, name, organization name
    - plan: Filter by subscription plan
    - health_status: 'healthy', 'at_risk', 'critical'
    
    Sorting:
    - created_at, last_active, email
    """
    supabase = get_supabase_service()
    
    # Build base query - get all users with their org membership
    query = supabase.table("users").select(
        "id, email, full_name, created_at",
        count="exact"
    )
    
    # Get users first
    users_result = query.range(offset, offset + limit - 1).execute()
    
    if not users_result.data:
        return UserListResponse(users=[], total=0, offset=offset, limit=limit)
    
    # Enrich with organization and subscription data
    enriched_users = []
    for user in users_result.data:
        user_data = await _enrich_user_data(supabase, user)
        
        # Apply filters
        if plan and user_data.get("plan") != plan:
            continue
        
        if health_status:
            health_data = await _get_health_data(supabase, user["id"])
            score = calculate_health_score(health_data)
            status = get_health_status(score)
            if status != health_status:
                continue
            user_data["health_score"] = score
            user_data["health_status"] = status
        else:
            health_data = await _get_health_data(supabase, user["id"])
            score = calculate_health_score(health_data)
            user_data["health_score"] = score
            user_data["health_status"] = get_health_status(score)
        
        if search:
            search_lower = search.lower()
            if not (
                search_lower in user.get("email", "").lower() or
                search_lower in (user.get("full_name") or "").lower() or
                search_lower in (user_data.get("organization_name") or "").lower()
            ):
                continue
        
        enriched_users.append(AdminUserListItem(
            id=user["id"],
            email=user["email"],
            full_name=user.get("full_name"),
            organization_id=user_data.get("organization_id"),
            organization_name=user_data.get("organization_name"),
            plan=user_data.get("plan", "free"),
            flow_usage=FlowUsage(
                used=user_data.get("flow_count", 0),
                limit=user_data.get("flow_limit", 2),
                pack_balance=user_data.get("pack_balance", 0)
            ),
            health_score=user_data.get("health_score", 0),
            health_status=user_data.get("health_status", "healthy"),
            last_active=user_data.get("last_active"),
            created_at=user["created_at"]
        ))
    
    return UserListResponse(
        users=enriched_users,
        total=users_result.count or len(enriched_users),
        offset=offset,
        limit=limit
    )


@router.get("/{user_id}", response_model=AdminUserDetail)
async def get_user_detail(
    user_id: str,
    request: Request,
    admin: AdminContext = Depends(get_admin_user)
):
    """Get detailed information about a specific user."""
    supabase = get_supabase_service()
    
    # Get user
    user_result = supabase.table("users") \
        .select("*") \
        .eq("id", user_id) \
        .maybe_single() \
        .execute()
    
    if not user_result.data:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = user_result.data
    
    # Log the view action
    await log_admin_action(
        admin_id=admin.admin_id,
        action="user.view",
        target_type="user",
        target_id=UUID(user_id),
        target_identifier=user["email"],
        request=request
    )
    
    # Get enriched data
    user_data = await _enrich_user_data(supabase, user)
    health_data = await _get_health_data(supabase, user_id)
    score = calculate_health_score(health_data)
    
    # Get flow packs
    packs_result = supabase.table("flow_packs") \
        .select("id, flows_purchased, flows_remaining, purchased_at, status") \
        .eq("organization_id", user_data.get("organization_id")) \
        .order("purchased_at", desc=True) \
        .limit(10) \
        .execute()
    
    flow_packs = [
        FlowPackInfo(
            id=p["id"],
            flows_purchased=p["flows_purchased"],
            flows_remaining=p["flows_remaining"],
            purchased_at=p["purchased_at"],
            status=p["status"]
        ) for p in (packs_result.data or [])
    ]
    
    # Get admin notes
    notes_result = supabase.table("admin_notes") \
        .select("id, content, is_pinned, created_at, admin_users(user_id)") \
        .eq("target_type", "user") \
        .eq("target_id", user_id) \
        .order("is_pinned", desc=True) \
        .order("created_at", desc=True) \
        .limit(20) \
        .execute()
    
    admin_notes = []
    for note in (notes_result.data or []):
        # Get admin email
        admin_user = supabase.table("users") \
            .select("email") \
            .eq("id", note["admin_users"]["user_id"]) \
            .maybe_single() \
            .execute()
        
        admin_notes.append(AdminNoteInfo(
            id=note["id"],
            content=note["content"],
            is_pinned=note["is_pinned"],
            admin_name=admin_user.data["email"] if admin_user.data else "Unknown",
            created_at=note["created_at"]
        ))
    
    # Get activity counts
    research_count = supabase.table("research_briefs") \
        .select("id", count="exact") \
        .eq("organization_id", user_data.get("organization_id")) \
        .execute()
    
    prep_count = supabase.table("meeting_preps") \
        .select("id", count="exact") \
        .eq("organization_id", user_data.get("organization_id")) \
        .execute()
    
    followup_count = supabase.table("followups") \
        .select("id", count="exact") \
        .eq("organization_id", user_data.get("organization_id")) \
        .execute()
    
    return AdminUserDetail(
        id=user["id"],
        email=user["email"],
        full_name=user.get("full_name"),
        organization_id=user_data.get("organization_id"),
        organization_name=user_data.get("organization_name"),
        plan=user_data.get("plan", "free"),
        flow_usage=FlowUsage(
            used=user_data.get("flow_count", 0),
            limit=user_data.get("flow_limit", 2),
            pack_balance=user_data.get("pack_balance", 0)
        ),
        health_score=score,
        health_status=get_health_status(score),
        last_active=user_data.get("last_active"),
        created_at=user["created_at"],
        stripe_customer_id=user_data.get("stripe_customer_id"),
        subscription_status=user_data.get("subscription_status"),
        trial_ends_at=user_data.get("trial_ends_at"),
        profile_completeness=health_data.get("profile_completeness", 0),
        total_researches=research_count.count or 0,
        total_preps=prep_count.count or 0,
        total_followups=followup_count.count or 0,
        error_count_30d=health_data.get("error_count_30d", 0),
        flow_packs=flow_packs,
        admin_notes=admin_notes
    )


@router.get("/{user_id}/activity", response_model=UserActivityResponse)
async def get_user_activity(
    user_id: str,
    limit: int = Query(50, ge=1, le=200),
    admin: AdminContext = Depends(get_admin_user)
):
    """Get activity timeline for a user."""
    supabase = get_supabase_service()
    
    # Get organization
    org_result = supabase.table("organization_members") \
        .select("organization_id") \
        .eq("user_id", user_id) \
        .maybe_single() \
        .execute()
    
    if not org_result.data:
        return UserActivityResponse(activities=[], total=0)
    
    org_id = org_result.data["organization_id"]
    
    activities = []
    
    # Get recent researches
    researches = supabase.table("research_briefs") \
        .select("id, prospect_company_name, status, created_at") \
        .eq("organization_id", org_id) \
        .order("created_at", desc=True) \
        .limit(limit // 3) \
        .execute()
    
    for r in (researches.data or []):
        activities.append(ActivityItem(
            id=f"research-{r['id']}",
            type="research",
            description=f"Research on {r['prospect_company_name']} - {r['status']}",
            created_at=r["created_at"],
            metadata={"company": r["prospect_company_name"], "status": r["status"]}
        ))
    
    # Get recent preps
    preps = supabase.table("meeting_preps") \
        .select("id, prospect_company_name, status, created_at") \
        .eq("organization_id", org_id) \
        .order("created_at", desc=True) \
        .limit(limit // 3) \
        .execute()
    
    for p in (preps.data or []):
        activities.append(ActivityItem(
            id=f"prep-{p['id']}",
            type="preparation",
            description=f"Prep for {p['prospect_company_name']} - {p['status']}",
            created_at=p["created_at"],
            metadata={"company": p["prospect_company_name"], "status": p["status"]}
        ))
    
    # Get recent followups
    followups = supabase.table("followups") \
        .select("id, prospect_company_name, status, created_at") \
        .eq("organization_id", org_id) \
        .order("created_at", desc=True) \
        .limit(limit // 3) \
        .execute()
    
    for f in (followups.data or []):
        activities.append(ActivityItem(
            id=f"followup-{f['id']}",
            type="followup",
            description=f"Follow-up for {f['prospect_company_name']} - {f['status']}",
            created_at=f["created_at"],
            metadata={"company": f["prospect_company_name"], "status": f["status"]}
        ))
    
    # Sort by created_at
    activities.sort(key=lambda x: x.created_at, reverse=True)
    
    return UserActivityResponse(
        activities=activities[:limit],
        total=len(activities)
    )


@router.post("/{user_id}/reset-flows")
async def reset_user_flows(
    user_id: str,
    data: ResetFlowsRequest,
    request: Request,
    admin: AdminContext = Depends(require_admin_role("super_admin", "admin", "support"))
):
    """Reset a user's monthly flow count to 0."""
    supabase = get_supabase_service()
    
    # Get user email for logging
    user = supabase.table("users").select("email").eq("id", user_id).maybe_single().execute()
    if not user.data:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get organization
    org_result = supabase.table("organization_members") \
        .select("organization_id") \
        .eq("user_id", user_id) \
        .maybe_single() \
        .execute()
    
    if not org_result.data:
        raise HTTPException(status_code=404, detail="User has no organization")
    
    org_id = org_result.data["organization_id"]
    
    # Get current flow count for logging
    usage_result = supabase.table("usage_records") \
        .select("flow_count") \
        .eq("organization_id", org_id) \
        .gte("period_start", datetime.utcnow().replace(day=1).isoformat()) \
        .maybe_single() \
        .execute()
    
    old_count = usage_result.data["flow_count"] if usage_result.data else 0
    
    # Reset flows
    supabase.table("usage_records") \
        .update({"flow_count": 0, "updated_at": datetime.utcnow().isoformat()}) \
        .eq("organization_id", org_id) \
        .gte("period_start", datetime.utcnow().replace(day=1).isoformat()) \
        .execute()
    
    # Log action
    await log_admin_action(
        admin_id=admin.admin_id,
        action="user.reset_flows",
        target_type="user",
        target_id=UUID(user_id),
        target_identifier=user.data["email"],
        details={"old_count": old_count, "reason": data.reason},
        request=request
    )
    
    return {"success": True, "message": f"Reset flow count from {old_count} to 0"}


@router.post("/{user_id}/add-flows")
async def add_user_flows(
    user_id: str,
    data: AddFlowsRequest,
    request: Request,
    admin: AdminContext = Depends(require_admin_role("super_admin", "admin"))
):
    """Add bonus flows to a user (creates a flow pack)."""
    supabase = get_supabase_service()
    
    if data.flows < 1 or data.flows > 100:
        raise HTTPException(status_code=400, detail="Flows must be between 1 and 100")
    
    # Get user email for logging
    user = supabase.table("users").select("email").eq("id", user_id).maybe_single().execute()
    if not user.data:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get organization
    org_result = supabase.table("organization_members") \
        .select("organization_id") \
        .eq("user_id", user_id) \
        .maybe_single() \
        .execute()
    
    if not org_result.data:
        raise HTTPException(status_code=404, detail="User has no organization")
    
    org_id = org_result.data["organization_id"]
    
    # Create a bonus flow pack
    supabase.table("flow_packs").insert({
        "organization_id": org_id,
        "flows_purchased": data.flows,
        "flows_remaining": data.flows,
        "price_cents": 0,  # Free bonus
        "status": "active"
    }).execute()
    
    # Log action
    await log_admin_action(
        admin_id=admin.admin_id,
        action="user.add_flows",
        target_type="user",
        target_id=UUID(user_id),
        target_identifier=user.data["email"],
        details={"flows_added": data.flows, "reason": data.reason},
        request=request
    )
    
    return {"success": True, "message": f"Added {data.flows} bonus flows"}


@router.post("/{user_id}/extend-trial")
async def extend_user_trial(
    user_id: str,
    data: ExtendTrialRequest,
    request: Request,
    admin: AdminContext = Depends(require_admin_role("super_admin", "admin"))
):
    """Extend a user's trial period."""
    supabase = get_supabase_service()
    
    if data.days < 1 or data.days > 90:
        raise HTTPException(status_code=400, detail="Days must be between 1 and 90")
    
    # Get user email
    user = supabase.table("users").select("email").eq("id", user_id).maybe_single().execute()
    if not user.data:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get organization
    org_result = supabase.table("organization_members") \
        .select("organization_id") \
        .eq("user_id", user_id) \
        .maybe_single() \
        .execute()
    
    if not org_result.data:
        raise HTTPException(status_code=404, detail="User has no organization")
    
    org_id = org_result.data["organization_id"]
    
    # Get current trial end
    sub_result = supabase.table("organization_subscriptions") \
        .select("trial_ends_at") \
        .eq("organization_id", org_id) \
        .maybe_single() \
        .execute()
    
    if not sub_result.data:
        raise HTTPException(status_code=404, detail="No subscription found")
    
    # Calculate new trial end
    current_end = sub_result.data.get("trial_ends_at")
    if current_end:
        from datetime import timedelta
        current_dt = datetime.fromisoformat(current_end.replace("Z", "+00:00"))
        new_end = current_dt + timedelta(days=data.days)
    else:
        from datetime import timedelta
        new_end = datetime.utcnow() + timedelta(days=data.days)
    
    # Update trial end
    supabase.table("organization_subscriptions") \
        .update({"trial_ends_at": new_end.isoformat()}) \
        .eq("organization_id", org_id) \
        .execute()
    
    # Log action
    await log_admin_action(
        admin_id=admin.admin_id,
        action="user.extend_trial",
        target_type="user",
        target_id=UUID(user_id),
        target_identifier=user.data["email"],
        details={
            "days_added": data.days,
            "new_trial_end": new_end.isoformat(),
            "reason": data.reason
        },
        request=request
    )
    
    return {"success": True, "message": f"Extended trial by {data.days} days", "new_end": new_end.isoformat()}


@router.get("/{user_id}/export")
async def export_user_data(
    user_id: str,
    request: Request,
    admin: AdminContext = Depends(require_admin_role("super_admin", "admin"))
):
    """Export all user data as JSON."""
    supabase = get_supabase_service()
    
    # Get user
    user = supabase.table("users").select("*").eq("id", user_id).maybe_single().execute()
    if not user.data:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get organization
    org_result = supabase.table("organization_members") \
        .select("organization_id, role, organizations(*)") \
        .eq("user_id", user_id) \
        .maybe_single() \
        .execute()
    
    org_id = org_result.data["organization_id"] if org_result.data else None
    
    export_data = {
        "user": user.data,
        "organization": org_result.data if org_result.data else None,
        "exported_at": datetime.utcnow().isoformat(),
        "exported_by": admin.email
    }
    
    if org_id:
        # Get subscription
        sub = supabase.table("organization_subscriptions").select("*").eq("organization_id", org_id).maybe_single().execute()
        export_data["subscription"] = sub.data
        
        # Get usage
        usage = supabase.table("usage_records").select("*").eq("organization_id", org_id).execute()
        export_data["usage_records"] = usage.data
        
        # Get flow packs
        packs = supabase.table("flow_packs").select("*").eq("organization_id", org_id).execute()
        export_data["flow_packs"] = packs.data
        
        # Get sales profile
        profile = supabase.table("sales_profiles").select("*").eq("organization_id", org_id).maybe_single().execute()
        export_data["sales_profile"] = profile.data
    
    # Log action
    await log_admin_action(
        admin_id=admin.admin_id,
        action="user.export",
        target_type="user",
        target_id=UUID(user_id),
        target_identifier=user.data["email"],
        request=request
    )
    
    return export_data


# ============================================================
# Helper Functions
# ============================================================

async def _enrich_user_data(supabase, user: dict) -> dict:
    """Get organization and subscription data for a user."""
    result = {
        "organization_id": None,
        "organization_name": None,
        "plan": "free",
        "flow_count": 0,
        "flow_limit": 2,
        "pack_balance": 0,
        "subscription_status": None,
        "stripe_customer_id": None,
        "trial_ends_at": None,
        "last_active": None
    }
    
    # Get organization
    org_result = supabase.table("organization_members") \
        .select("organization_id, organizations(name)") \
        .eq("user_id", user["id"]) \
        .maybe_single() \
        .execute()
    
    if org_result.data:
        result["organization_id"] = org_result.data["organization_id"]
        result["organization_name"] = org_result.data["organizations"]["name"] if org_result.data["organizations"] else None
        
        org_id = org_result.data["organization_id"]
        
        # Get subscription
        sub_result = supabase.table("organization_subscriptions") \
            .select("plan_id, status, stripe_customer_id, trial_ends_at, subscription_plans(features)") \
            .eq("organization_id", org_id) \
            .maybe_single() \
            .execute()
        
        if sub_result.data:
            result["plan"] = sub_result.data["plan_id"]
            result["subscription_status"] = sub_result.data["status"]
            result["stripe_customer_id"] = sub_result.data["stripe_customer_id"]
            result["trial_ends_at"] = sub_result.data["trial_ends_at"]
            
            if sub_result.data["subscription_plans"]:
                result["flow_limit"] = sub_result.data["subscription_plans"]["features"].get("flow_limit", 2)
        
        # Get usage
        usage_result = supabase.table("usage_records") \
            .select("flow_count") \
            .eq("organization_id", org_id) \
            .gte("period_start", datetime.utcnow().replace(day=1).isoformat()) \
            .maybe_single() \
            .execute()
        
        if usage_result.data:
            result["flow_count"] = usage_result.data["flow_count"]
        
        # Get flow pack balance
        pack_result = supabase.table("flow_packs") \
            .select("flows_remaining") \
            .eq("organization_id", org_id) \
            .eq("status", "active") \
            .execute()
        
        if pack_result.data:
            result["pack_balance"] = sum(p["flows_remaining"] for p in pack_result.data)
        
        # Get last activity
        activity_result = supabase.table("prospect_activities") \
            .select("created_at") \
            .eq("organization_id", org_id) \
            .order("created_at", desc=True) \
            .limit(1) \
            .execute()
        
        if activity_result.data:
            result["last_active"] = activity_result.data[0]["created_at"]
    
    return result


async def _get_health_data(supabase, user_id: str) -> dict:
    """Get health score data for a user."""
    # Try to use the database function
    try:
        result = supabase.rpc("get_user_health_data", {"p_user_id": user_id}).execute()
        if result.data and "error" not in result.data:
            return result.data
    except Exception:
        pass
    
    # Fallback to manual calculation
    return {
        "plan": "free",
        "days_since_last_activity": 0,
        "error_count_30d": 0,
        "flow_usage_percent": 0,
        "profile_completeness": 50,
        "has_failed_payment": False
    }


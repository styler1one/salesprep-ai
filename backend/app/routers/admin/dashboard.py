"""
Admin Dashboard Router
======================

Endpoints for admin dashboard metrics and trends.
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Optional, List
from datetime import datetime, timedelta

from app.deps import get_admin_user, AdminContext
from app.database import get_supabase_service
from .models import CamelModel
from .utils import log_admin_action

router = APIRouter(prefix="/dashboard", tags=["admin-dashboard"])


# ============================================================
# Response Models (with camelCase serialization)
# ============================================================

class DashboardMetrics(CamelModel):
    total_users: int
    users_growth_week: int
    active_users_7d: int
    mrr_cents: int
    paid_users: int
    active_alerts: int
    error_rate_24h: Optional[float] = 0.0


class TrendDataPoint(CamelModel):
    date: str
    researches: int
    preps: int
    followups: int
    new_users: int


class DashboardTrends(CamelModel):
    trends: List[TrendDataPoint]
    period_days: int


class AdminCheckResponse(CamelModel):
    is_admin: bool
    role: str
    admin_id: str
    user_id: str


# ============================================================
# Endpoints
# ============================================================

@router.get("/check", response_model=AdminCheckResponse)
async def check_admin_access(
    admin: AdminContext = Depends(get_admin_user)
):
    """
    Verify admin access and return role information.
    
    This endpoint is called by the frontend to check if user has admin access.
    Also updates last_admin_login_at.
    """
    return AdminCheckResponse(
        is_admin=True,
        role=admin.role,
        admin_id=admin.admin_id,
        user_id=admin.user_id
    )


@router.get("/metrics", response_model=DashboardMetrics)
async def get_dashboard_metrics(
    admin: AdminContext = Depends(get_admin_user)
):
    """
    Get key metrics for the admin dashboard.
    
    Returns:
    - Total users count
    - New users this week
    - Active users (7 days)
    - MRR (Monthly Recurring Revenue)
    - Paid users count
    - Active alerts count
    - Error rate (24h)
    """
    supabase = get_supabase_service()
    
    try:
        # Use the database function for metrics
        result = supabase.rpc("get_admin_dashboard_metrics").execute()
        
        if result.data:
            metrics = result.data
            
            # Calculate error rate
            error_rate = 0.0
            research_stats = supabase.rpc("get_job_stats_24h", {"p_table_name": "research_briefs"}).execute()
            if research_stats.data and research_stats.data.get("total", 0) > 0:
                failed = research_stats.data.get("failed", 0)
                total = research_stats.data.get("total", 1)
                error_rate = round((failed / total) * 100, 1)
            
            return DashboardMetrics(
                total_users=metrics.get("total_users", 0),
                users_growth_week=metrics.get("users_growth_week", 0),
                active_users_7d=metrics.get("active_users_7d", 0),
                mrr_cents=metrics.get("mrr_cents", 0),
                paid_users=metrics.get("paid_users", 0),
                active_alerts=metrics.get("active_alerts", 0),
                error_rate_24h=error_rate
            )
        
        # Fallback to manual calculation if RPC fails
        return await _calculate_metrics_fallback(supabase)
        
    except Exception as e:
        print(f"Error getting dashboard metrics: {e}")
        return await _calculate_metrics_fallback(supabase)


async def _calculate_metrics_fallback(supabase) -> DashboardMetrics:
    """Fallback calculation if database function fails - uses REAL data."""
    
    # Total users
    users_result = supabase.table("users").select("id", count="exact").execute()
    total_users = users_result.count or 0
    
    # Users this week
    week_ago = datetime.utcnow() - timedelta(days=7)
    week_result = supabase.table("users") \
        .select("id", count="exact") \
        .gte("created_at", week_ago.isoformat()) \
        .execute()
    users_growth_week = week_result.count or 0
    
    # Active users (7 days) - count unique users with activity in last 7 days
    active_users_7d = 0
    try:
        # Get unique user_ids from research_briefs in last 7 days
        research_users = supabase.table("research_briefs") \
            .select("user_id") \
            .gte("created_at", week_ago.isoformat()) \
            .execute()
        
        unique_users = set()
        for r in (research_users.data or []):
            if r.get("user_id"):
                unique_users.add(r["user_id"])
        
        # Also check meeting_preps
        prep_users = supabase.table("meeting_preps") \
            .select("user_id") \
            .gte("created_at", week_ago.isoformat()) \
            .execute()
        for p in (prep_users.data or []):
            if p.get("user_id"):
                unique_users.add(p["user_id"])
        
        # Also check followups
        followup_users = supabase.table("followups") \
            .select("user_id") \
            .gte("created_at", week_ago.isoformat()) \
            .execute()
        for f in (followup_users.data or []):
            if f.get("user_id"):
                unique_users.add(f["user_id"])
        
        active_users_7d = len(unique_users)
    except Exception:
        pass
    
    # MRR (Monthly Recurring Revenue) - sum of active subscriptions
    mrr_cents = 0
    try:
        # Get active/trialing subscriptions with their plan prices
        subs_result = supabase.table("organization_subscriptions") \
            .select("plan_id, subscription_plans(price_monthly_cents)") \
            .in_("status", ["active", "trialing"]) \
            .execute()
        
        for sub in (subs_result.data or []):
            if sub.get("subscription_plans"):
                mrr_cents += sub["subscription_plans"].get("price_monthly_cents", 0) or 0
    except Exception:
        pass
    
    # Paid users - count of non-free active subscriptions
    paid_users = 0
    try:
        paid_result = supabase.table("organization_subscriptions") \
            .select("id", count="exact") \
            .in_("status", ["active", "trialing"]) \
            .neq("plan_id", "free") \
            .execute()
        paid_users = paid_result.count or 0
    except Exception:
        pass
    
    # Active alerts
    active_alerts = 0
    try:
        alerts_result = supabase.table("admin_alerts") \
            .select("id", count="exact") \
            .eq("status", "active") \
            .execute()
        active_alerts = alerts_result.count or 0
    except Exception:
        pass
    
    # Error rate (24h) - percentage of failed jobs
    error_rate_24h = 0.0
    try:
        day_ago = (datetime.utcnow() - timedelta(days=1)).isoformat()
        
        # Total research briefs in 24h
        total_result = supabase.table("research_briefs") \
            .select("id", count="exact") \
            .gte("created_at", day_ago) \
            .execute()
        total_24h = total_result.count or 0
        
        # Failed research briefs in 24h
        failed_result = supabase.table("research_briefs") \
            .select("id", count="exact") \
            .gte("created_at", day_ago) \
            .eq("status", "failed") \
            .execute()
        failed_24h = failed_result.count or 0
        
        if total_24h > 0:
            error_rate_24h = round((failed_24h / total_24h) * 100, 1)
    except Exception:
        pass
    
    return DashboardMetrics(
        total_users=total_users,
        users_growth_week=users_growth_week,
        active_users_7d=active_users_7d,
        mrr_cents=mrr_cents,
        paid_users=paid_users,
        active_alerts=active_alerts,
        error_rate_24h=error_rate_24h
    )


@router.get("/trends", response_model=DashboardTrends)
async def get_usage_trends(
    days: int = 7,
    admin: AdminContext = Depends(get_admin_user)
):
    """
    Get usage trends for the specified number of days.
    
    Args:
        days: Number of days to fetch (default 7, max 30)
    
    Returns:
        Daily counts of researches, preps, followups, new users
    """
    # Limit to max 30 days
    days = min(max(days, 1), 30)
    
    supabase = get_supabase_service()
    
    try:
        result = supabase.rpc("get_admin_usage_trends", {"p_days": days}).execute()
        
        if result.data:
            trends = [
                TrendDataPoint(
                    date=item["date"],
                    researches=item.get("researches", 0),
                    preps=item.get("preps", 0),
                    followups=item.get("followups", 0),
                    new_users=item.get("new_users", 0)
                )
                for item in result.data
            ]
            return DashboardTrends(trends=trends, period_days=days)
        
        # RPC returned empty, use fallback
        return await _calculate_trends_fallback(supabase, days)
        
    except Exception as e:
        print(f"Error getting usage trends: {e}")
        return await _calculate_trends_fallback(supabase, days)


async def _calculate_trends_fallback(supabase, days: int) -> DashboardTrends:
    """Fallback calculation for trends if database function fails - uses REAL data."""
    trends = []
    
    for i in range(days - 1, -1, -1):
        day_start = (datetime.utcnow() - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        date_str = day_start.strftime("%Y-%m-%d")
        
        researches = 0
        preps = 0
        followups = 0
        new_users = 0
        
        try:
            # Count researches for this day
            research_result = supabase.table("research_briefs") \
                .select("id", count="exact") \
                .gte("created_at", day_start.isoformat()) \
                .lt("created_at", day_end.isoformat()) \
                .execute()
            researches = research_result.count or 0
        except Exception:
            pass
        
        try:
            # Count meeting preps for this day
            prep_result = supabase.table("meeting_preps") \
                .select("id", count="exact") \
                .gte("created_at", day_start.isoformat()) \
                .lt("created_at", day_end.isoformat()) \
                .execute()
            preps = prep_result.count or 0
        except Exception:
            pass
        
        try:
            # Count followups for this day
            followup_result = supabase.table("followups") \
                .select("id", count="exact") \
                .gte("created_at", day_start.isoformat()) \
                .lt("created_at", day_end.isoformat()) \
                .execute()
            followups = followup_result.count or 0
        except Exception:
            pass
        
        try:
            # Count new users for this day
            users_result = supabase.table("users") \
                .select("id", count="exact") \
                .gte("created_at", day_start.isoformat()) \
                .lt("created_at", day_end.isoformat()) \
                .execute()
            new_users = users_result.count or 0
        except Exception:
            pass
        
        trends.append(TrendDataPoint(
            date=date_str,
            researches=researches,
            preps=preps,
            followups=followups,
            new_users=new_users
        ))
    
    return DashboardTrends(trends=trends, period_days=days)


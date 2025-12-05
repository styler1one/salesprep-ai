"""
Admin Dashboard Router
======================

Endpoints for admin dashboard metrics and trends.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.deps import get_admin_user, AdminContext
from app.database import get_supabase_service
from .utils import log_admin_action

router = APIRouter(prefix="/dashboard", tags=["admin-dashboard"])


# ============================================================
# Response Models
# ============================================================

class DashboardMetrics(BaseModel):
    total_users: int
    users_growth_week: int
    active_users_7d: int
    mrr_cents: int
    paid_users: int
    active_alerts: int
    error_rate_24h: Optional[float] = 0.0


class TrendDataPoint(BaseModel):
    date: str
    researches: int
    preps: int
    followups: int
    new_users: int


class DashboardTrends(BaseModel):
    trends: List[TrendDataPoint]
    period_days: int


class AdminCheckResponse(BaseModel):
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
    """Fallback calculation if database function fails."""
    
    # Total users
    users_result = supabase.table("users").select("id", count="exact").execute()
    total_users = users_result.count or 0
    
    # Users this week
    week_result = supabase.table("users") \
        .select("id", count="exact") \
        .gte("created_at", datetime.utcnow().replace(day=datetime.utcnow().day - 7).isoformat()) \
        .execute()
    users_growth_week = week_result.count or 0
    
    # Active alerts
    alerts_result = supabase.table("admin_alerts") \
        .select("id", count="exact") \
        .eq("status", "active") \
        .execute()
    active_alerts = alerts_result.count or 0
    
    return DashboardMetrics(
        total_users=total_users,
        users_growth_week=users_growth_week,
        active_users_7d=0,  # Complex query, skip in fallback
        mrr_cents=0,
        paid_users=0,
        active_alerts=active_alerts,
        error_rate_24h=0.0
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
        
        return DashboardTrends(trends=[], period_days=days)
        
    except Exception as e:
        print(f"Error getting usage trends: {e}")
        return DashboardTrends(trends=[], period_days=days)


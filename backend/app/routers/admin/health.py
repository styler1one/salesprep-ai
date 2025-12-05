"""
Admin Health Router
===================

Endpoints for system health monitoring.
"""

from fastapi import APIRouter, Depends
from typing import Optional, List, Dict, Any
from datetime import datetime
import os
import httpx

from app.deps import get_admin_user, AdminContext
from app.database import get_supabase_service
from .models import CamelModel

router = APIRouter(prefix="/health", tags=["admin-health"])


# ============================================================
# Models (with camelCase serialization)
# ============================================================

class ServiceStatus(CamelModel):
    name: str
    status: str  # 'healthy', 'degraded', 'down'
    response_time_ms: Optional[int] = None
    last_check: datetime
    details: Optional[str] = None


class JobStats(CamelModel):
    name: str
    total_24h: int
    completed: int
    failed: int
    success_rate: float


class HealthOverview(CamelModel):
    overall_status: str  # 'healthy', 'degraded', 'down'
    services: List[ServiceStatus]
    last_updated: datetime


class JobHealthResponse(CamelModel):
    jobs: List[JobStats]
    overall_success_rate: float


# ============================================================
# Endpoints
# ============================================================

@router.get("/overview", response_model=HealthOverview)
async def get_health_overview(
    admin: AdminContext = Depends(get_admin_user)
):
    """
    Get overall system health status.
    
    Checks:
    - API (this service)
    - Database (Supabase)
    - External services (Inngest, Stripe)
    """
    services = []
    now = datetime.utcnow()
    
    # API Health (always healthy if we got here)
    services.append(ServiceStatus(
        name="API",
        status="healthy",
        response_time_ms=1,
        last_check=now,
        details="DealMotion API is running"
    ))
    
    # Database Health
    db_status = await _check_database_health()
    services.append(db_status)
    
    # Inngest Health (via API call)
    inngest_status = await _check_inngest_health()
    services.append(inngest_status)
    
    # Stripe Health
    stripe_status = await _check_stripe_health()
    services.append(stripe_status)
    
    # Determine overall status
    statuses = [s.status for s in services]
    if all(s == "healthy" for s in statuses):
        overall = "healthy"
    elif any(s == "down" for s in statuses):
        overall = "down"
    else:
        overall = "degraded"
    
    return HealthOverview(
        overall_status=overall,
        services=services,
        last_updated=now
    )


@router.get("/jobs", response_model=JobHealthResponse)
async def get_job_health(
    admin: AdminContext = Depends(get_admin_user)
):
    """
    Get job success rates for the last 24 hours.
    
    Tracks:
    - Research jobs
    - Preparation jobs
    - Follow-up jobs
    - Knowledge base processing
    """
    supabase = get_supabase_service()
    
    job_configs = [
        ("research", "research_briefs"),
        ("preparation", "meeting_preps"),
        ("followup", "followups"),
        ("knowledge_base", "knowledge_base_files"),
    ]
    
    jobs = []
    total_success = 0
    total_count = 0
    
    for job_name, table_name in job_configs:
        try:
            result = supabase.rpc("get_job_stats_24h", {"p_table_name": table_name}).execute()
            
            if result.data:
                stats = result.data
                total = stats.get("total", 0)
                completed = stats.get("completed", 0)
                failed = stats.get("failed", 0)
                success_rate = stats.get("success_rate", 0)
                
                jobs.append(JobStats(
                    name=job_name,
                    total_24h=total,
                    completed=completed,
                    failed=failed,
                    success_rate=success_rate
                ))
                
                total_success += completed
                total_count += total
            else:
                jobs.append(JobStats(
                    name=job_name,
                    total_24h=0,
                    completed=0,
                    failed=0,
                    success_rate=100.0
                ))
        except Exception as e:
            print(f"Error getting job stats for {table_name}: {e}")
            jobs.append(JobStats(
                name=job_name,
                total_24h=0,
                completed=0,
                failed=0,
                success_rate=0.0
            ))
    
    overall_rate = (total_success / total_count * 100) if total_count > 0 else 100.0
    
    return JobHealthResponse(
        jobs=jobs,
        overall_success_rate=round(overall_rate, 1)
    )


# ============================================================
# Health Check Helpers
# ============================================================

async def _check_database_health() -> ServiceStatus:
    """Check database connectivity and performance."""
    now = datetime.utcnow()
    start_time = datetime.utcnow()
    
    try:
        supabase = get_supabase_service()
        
        # Simple query to test connectivity
        result = supabase.table("users").select("id").limit(1).execute()
        
        elapsed = (datetime.utcnow() - start_time).total_seconds() * 1000
        
        return ServiceStatus(
            name="Database",
            status="healthy" if elapsed < 1000 else "degraded",
            response_time_ms=int(elapsed),
            last_check=now,
            details=f"Supabase connected, {int(elapsed)}ms response"
        )
    except Exception as e:
        return ServiceStatus(
            name="Database",
            status="down",
            last_check=now,
            details=f"Error: {str(e)[:100]}"
        )


async def _check_inngest_health() -> ServiceStatus:
    """Check Inngest service status."""
    now = datetime.utcnow()
    
    inngest_event_key = os.getenv("INNGEST_EVENT_KEY")
    if not inngest_event_key:
        return ServiceStatus(
            name="Inngest",
            status="degraded",
            last_check=now,
            details="INNGEST_EVENT_KEY not configured"
        )
    
    # We can't easily check Inngest status, so we just verify config exists
    return ServiceStatus(
        name="Inngest",
        status="healthy",
        last_check=now,
        details="Inngest configured (check dashboard for details)"
    )


async def _check_stripe_health() -> ServiceStatus:
    """Check Stripe API status."""
    now = datetime.utcnow()
    start_time = datetime.utcnow()
    
    stripe_key = os.getenv("STRIPE_SECRET_KEY")
    if not stripe_key:
        return ServiceStatus(
            name="Stripe",
            status="degraded",
            last_check=now,
            details="STRIPE_SECRET_KEY not configured"
        )
    
    try:
        import stripe
        stripe.api_key = stripe_key
        
        # Quick API call to verify connectivity
        await _async_stripe_check()
        
        elapsed = (datetime.utcnow() - start_time).total_seconds() * 1000
        
        return ServiceStatus(
            name="Stripe",
            status="healthy",
            response_time_ms=int(elapsed),
            last_check=now,
            details="Stripe API connected"
        )
    except Exception as e:
        return ServiceStatus(
            name="Stripe",
            status="down",
            last_check=now,
            details=f"Error: {str(e)[:100]}"
        )


async def _async_stripe_check():
    """Make async Stripe balance check."""
    import stripe
    # This is a synchronous call but it's lightweight
    stripe.Balance.retrieve()


"""
Billing Router - API endpoints for subscription and billing management

Handles subscription retrieval, checkout, portal access, and usage tracking.
"""

import os
import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from supabase import create_client

from app.deps import get_current_user
from app.services.subscription_service import get_subscription_service
from app.services.usage_service import get_usage_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/billing", tags=["billing"])

# Initialize Supabase
supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)

# Frontend URLs (set via environment)
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


# ==========================================
# REQUEST/RESPONSE MODELS
# ==========================================

class CheckoutRequest(BaseModel):
    plan_id: str  # 'solo_monthly' or 'solo_yearly'
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None


class CheckoutResponse(BaseModel):
    checkout_url: str
    session_id: str


class PortalRequest(BaseModel):
    return_url: Optional[str] = None


class PortalResponse(BaseModel):
    portal_url: str


class CheckLimitRequest(BaseModel):
    metric: str  # 'research', 'preparation', 'followup', 'transcription_seconds', 'kb_document'
    additional_amount: Optional[int] = None  # For transcription_seconds


class UsageMetric(BaseModel):
    used: int
    limit: int
    unlimited: bool
    remaining: Optional[int] = None
    percentage: Optional[float] = None


class UsageResponse(BaseModel):
    period_start: str
    period_end: Optional[str] = None
    research: UsageMetric
    preparation: UsageMetric
    followup: UsageMetric
    transcription_seconds: Dict[str, Any]
    kb_documents: UsageMetric


class SubscriptionResponse(BaseModel):
    id: Optional[str]
    organization_id: str
    plan_id: str
    plan_name: str
    status: str
    features: Dict[str, Any]
    price_cents: Optional[int]
    billing_interval: Optional[str]
    current_period_start: Optional[str]
    current_period_end: Optional[str]
    cancel_at_period_end: bool
    trial_start: Optional[str]
    trial_end: Optional[str]
    is_trialing: bool
    is_active: bool
    is_paid: bool


class PlanResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    price_cents: Optional[int]
    billing_interval: Optional[str]
    features: Dict[str, Any]
    display_order: int


# ==========================================
# HELPER FUNCTIONS
# ==========================================

async def get_user_organization(user_id: str) -> str:
    """Get organization ID for a user"""
    response = supabase.table("organization_members").select(
        "organization_id"
    ).eq("user_id", user_id).limit(1).execute()
    
    if not response.data:
        raise HTTPException(status_code=404, detail="User not in any organization")
    
    return response.data[0]["organization_id"]


async def get_user_email(user_id: str) -> str:
    """Get user email from Supabase Auth"""
    try:
        response = supabase.auth.admin.get_user_by_id(user_id)
        return response.user.email if response.user else None
    except Exception:
        return None


# ==========================================
# SUBSCRIPTION ENDPOINTS
# ==========================================

@router.get("/subscription", response_model=SubscriptionResponse)
async def get_subscription(current_user: dict = Depends(get_current_user)):
    """
    Get current subscription for the user's organization
    
    Returns subscription details including plan, status, and features
    """
    try:
        user_id = current_user.get("sub") or current_user.get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid user")
        
        organization_id = await get_user_organization(user_id)
        
        subscription_service = get_subscription_service()
        subscription = await subscription_service.get_subscription(organization_id)
        
        return subscription
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting subscription: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/plans", response_model=List[PlanResponse])
async def get_plans(
    include_teams: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """
    Get available subscription plans
    
    Returns list of plans with features and pricing
    """
    try:
        subscription_service = get_subscription_service()
        plans = await subscription_service.get_plans(include_teams=include_teams)
        
        return plans
        
    except Exception as e:
        logger.error(f"Error getting plans: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# CHECKOUT & PORTAL ENDPOINTS
# ==========================================

@router.post("/checkout", response_model=CheckoutResponse)
async def create_checkout(
    request: CheckoutRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Create Stripe Checkout session for subscription
    
    Returns URL to redirect user to Stripe Checkout
    """
    try:
        user_id = current_user.get("sub") or current_user.get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid user")
        
        organization_id = await get_user_organization(user_id)
        user_email = await get_user_email(user_id)
        
        if not user_email:
            raise HTTPException(status_code=400, detail="User email not found")
        
        # Default URLs
        success_url = request.success_url or f"{FRONTEND_URL}/billing/success"
        cancel_url = request.cancel_url or f"{FRONTEND_URL}/pricing"
        
        subscription_service = get_subscription_service()
        result = await subscription_service.create_checkout_session(
            organization_id=organization_id,
            plan_id=request.plan_id,
            user_email=user_email,
            success_url=success_url,
            cancel_url=cancel_url,
        )
        
        return result
        
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating checkout: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/portal", response_model=PortalResponse)
async def create_portal(
    request: PortalRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Create Stripe Billing Portal session
    
    Returns URL to redirect user to manage their subscription
    """
    try:
        user_id = current_user.get("sub") or current_user.get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid user")
        
        organization_id = await get_user_organization(user_id)
        
        return_url = request.return_url or f"{FRONTEND_URL}/dashboard/settings"
        
        subscription_service = get_subscription_service()
        result = await subscription_service.create_portal_session(
            organization_id=organization_id,
            return_url=return_url,
        )
        
        return result
        
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating portal: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# SUBSCRIPTION MANAGEMENT ENDPOINTS
# ==========================================

@router.post("/cancel")
async def cancel_subscription(current_user: dict = Depends(get_current_user)):
    """
    Cancel subscription at end of billing period
    
    The subscription remains active until the current period ends
    """
    try:
        user_id = current_user.get("sub") or current_user.get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid user")
        
        organization_id = await get_user_organization(user_id)
        
        subscription_service = get_subscription_service()
        subscription = await subscription_service.cancel_subscription(organization_id)
        
        return {
            "status": "canceled",
            "message": "Subscription will be canceled at end of billing period",
            "subscription": subscription,
        }
        
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error canceling subscription: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reactivate")
async def reactivate_subscription(current_user: dict = Depends(get_current_user)):
    """
    Reactivate a canceled subscription
    
    Only works if subscription hasn't expired yet
    """
    try:
        user_id = current_user.get("sub") or current_user.get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid user")
        
        organization_id = await get_user_organization(user_id)
        
        subscription_service = get_subscription_service()
        subscription = await subscription_service.reactivate_subscription(organization_id)
        
        return {
            "status": "reactivated",
            "message": "Subscription has been reactivated",
            "subscription": subscription,
        }
        
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error reactivating subscription: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# USAGE ENDPOINTS
# ==========================================

@router.get("/usage", response_model=UsageResponse)
async def get_usage(current_user: dict = Depends(get_current_user)):
    """
    Get current usage statistics for the organization
    
    Returns usage counts and limits for all metrics
    """
    try:
        user_id = current_user.get("sub") or current_user.get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid user")
        
        organization_id = await get_user_organization(user_id)
        
        usage_service = get_usage_service()
        usage = await usage_service.get_usage(organization_id)
        
        # Add percentage calculations
        for key in ["research", "preparation", "followup", "kb_documents"]:
            if key in usage and not usage[key].get("unlimited"):
                limit = usage[key].get("limit", 0)
                used = usage[key].get("used", 0)
                if limit > 0:
                    usage[key]["percentage"] = round((used / limit) * 100, 1)
                    usage[key]["remaining"] = max(0, limit - used)
                else:
                    usage[key]["percentage"] = 100 if used > 0 else 0
                    usage[key]["remaining"] = 0
        
        return usage
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting usage: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/check-limit")
async def check_limit(
    request: CheckLimitRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Check if an action is allowed within subscription limits
    
    Returns whether the action is allowed and remaining quota
    """
    try:
        user_id = current_user.get("sub") or current_user.get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid user")
        
        organization_id = await get_user_organization(user_id)
        
        usage_service = get_usage_service()
        
        if request.metric == "transcription_seconds" and request.additional_amount:
            result = await usage_service.check_transcription_limit(
                organization_id,
                request.additional_amount
            )
        else:
            result = await usage_service.check_limit(organization_id, request.metric)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking limit: {e}")
        raise HTTPException(status_code=500, detail=str(e))


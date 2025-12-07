"""
Calendar Router - API endpoints for calendar integration
SPEC-038: Meetings & Calendar Integration
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import logging

from app.deps import get_current_user, get_organization_id
from app.database import get_supabase_service
from app.services.google_calendar import google_calendar_service

# Use centralized database module
supabase = get_supabase_service()

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/calendar", tags=["calendar"])


# ==========================================
# Pydantic Models
# ==========================================

class CalendarProviderStatus(BaseModel):
    """Status of a single calendar provider connection."""
    connected: bool = Field(description="Whether the provider is connected")
    email: Optional[str] = Field(None, description="Connected account email")
    last_sync: Optional[datetime] = Field(None, description="Last successful sync time")
    last_sync_status: Optional[str] = Field(None, description="Status of last sync: success, failed, partial")
    meeting_count: int = Field(default=0, description="Number of synced meetings")
    needs_reauth: bool = Field(default=False, description="Whether reconnection is required")
    sync_enabled: bool = Field(default=True, description="Whether sync is enabled")


class CalendarStatusResponse(BaseModel):
    """Response for calendar connection status."""
    google: CalendarProviderStatus
    microsoft: CalendarProviderStatus


class CalendarAuthUrlResponse(BaseModel):
    """Response containing OAuth authorization URL."""
    auth_url: str = Field(description="URL to redirect user for OAuth")
    state: str = Field(description="State parameter for CSRF protection")


class CalendarCallbackRequest(BaseModel):
    """Request for processing OAuth callback."""
    code: str = Field(description="Authorization code from OAuth provider")
    state: str = Field(description="State parameter for verification")


class CalendarCallbackResponse(BaseModel):
    """Response after successful OAuth callback."""
    success: bool
    email: Optional[str] = Field(None, description="Connected account email")
    provider: str = Field(description="Provider that was connected")


class CalendarSyncResponse(BaseModel):
    """Response after manual calendar sync."""
    synced_meetings: int = Field(description="Total meetings after sync")
    new_meetings: int = Field(description="New meetings added")
    updated_meetings: int = Field(description="Existing meetings updated")
    deleted_meetings: int = Field(description="Meetings removed (cancelled)")


class CalendarDisconnectResponse(BaseModel):
    """Response after disconnecting a calendar."""
    success: bool
    provider: str


# ==========================================
# Helper Functions
# ==========================================

async def get_provider_status(
    user_id: str, 
    organization_id: str, 
    provider: str
) -> CalendarProviderStatus:
    """Get connection status for a specific provider."""
    try:
        # Get connection record
        result = supabase.table("calendar_connections").select(
            "id, email, last_sync_at, last_sync_status, needs_reauth, sync_enabled"
        ).eq("user_id", user_id).eq("provider", provider).execute()
        
        if not result.data or len(result.data) == 0:
            return CalendarProviderStatus(connected=False)
        
        connection = result.data[0]
        
        # Count meetings for this connection
        meetings_result = supabase.table("calendar_meetings").select(
            "id", count="exact"
        ).eq("calendar_connection_id", connection["id"]).eq(
            "status", "confirmed"
        ).execute()
        
        meeting_count = meetings_result.count if meetings_result.count else 0
        
        return CalendarProviderStatus(
            connected=True,
            email=connection.get("email"),
            last_sync=connection.get("last_sync_at"),
            last_sync_status=connection.get("last_sync_status"),
            meeting_count=meeting_count,
            needs_reauth=connection.get("needs_reauth", False),
            sync_enabled=connection.get("sync_enabled", True)
        )
        
    except Exception as e:
        logger.error(f"Error getting provider status for {provider}: {str(e)}")
        return CalendarProviderStatus(connected=False)


# ==========================================
# Calendar Status Endpoints
# ==========================================

@router.get("/status", response_model=CalendarStatusResponse)
async def get_calendar_status(
    current_user: dict = Depends(get_current_user),
    organization_id: str = Depends(get_organization_id)
):
    """
    Get status of all calendar connections for the current user.
    
    Returns connection status for Google and Microsoft calendars,
    including sync status and meeting counts.
    """
    user_id = current_user["sub"]
    
    # Get status for each provider in parallel (could optimize with asyncio.gather)
    google_status = await get_provider_status(user_id, organization_id, "google")
    microsoft_status = await get_provider_status(user_id, organization_id, "microsoft")
    
    return CalendarStatusResponse(
        google=google_status,
        microsoft=microsoft_status
    )


# ==========================================
# OAuth Endpoints (Placeholder - to be implemented in Sprint 1.5-1.7)
# ==========================================

@router.get("/auth/google", response_model=CalendarAuthUrlResponse)
async def start_google_auth(
    current_user: dict = Depends(get_current_user)
):
    """
    Start Google Calendar OAuth flow.
    
    Returns the authorization URL to redirect the user to Google's consent screen.
    """
    # Check if Google OAuth is configured
    if not google_calendar_service.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google Calendar integration is not configured"
        )
    
    user_id = current_user["sub"]
    
    try:
        auth_url, state = google_calendar_service.generate_auth_url(user_id)
        
        return CalendarAuthUrlResponse(
            auth_url=auth_url,
            state=state
        )
    except Exception as e:
        logger.error(f"Failed to generate Google auth URL: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to start Google Calendar authorization"
        )


@router.post("/callback/google", response_model=CalendarCallbackResponse)
async def google_auth_callback(
    callback: CalendarCallbackRequest,
    current_user: dict = Depends(get_current_user),
    organization_id: str = Depends(get_organization_id)
):
    """
    Process Google OAuth callback.
    
    Exchanges the authorization code for tokens and stores the connection.
    """
    # TODO: Implement in Sprint 1.7
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Google OAuth callback not yet implemented. Coming in Sprint 1.7."
    )


@router.get("/auth/microsoft", response_model=CalendarAuthUrlResponse)
async def start_microsoft_auth(
    current_user: dict = Depends(get_current_user)
):
    """
    Start Microsoft 365 Calendar OAuth flow.
    
    Returns the authorization URL to redirect the user to Microsoft's consent screen.
    """
    # TODO: Implement in Phase 4
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Microsoft OAuth not yet implemented. Coming in Phase 4."
    )


@router.post("/callback/microsoft", response_model=CalendarCallbackResponse)
async def microsoft_auth_callback(
    callback: CalendarCallbackRequest,
    current_user: dict = Depends(get_current_user),
    organization_id: str = Depends(get_organization_id)
):
    """
    Process Microsoft OAuth callback.
    
    Exchanges the authorization code for tokens and stores the connection.
    """
    # TODO: Implement in Phase 4
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Microsoft OAuth callback not yet implemented. Coming in Phase 4."
    )


# ==========================================
# Sync Endpoints (Placeholder - to be implemented in Sprint 1.10)
# ==========================================

@router.post("/sync", response_model=CalendarSyncResponse)
async def trigger_calendar_sync(
    current_user: dict = Depends(get_current_user),
    organization_id: str = Depends(get_organization_id)
):
    """
    Trigger manual calendar sync for all connected providers.
    
    Fetches latest events from Google/Microsoft and updates local database.
    """
    # TODO: Implement in Sprint 1.10
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Calendar sync not yet implemented. Coming in Sprint 1.10."
    )


# ==========================================
# Disconnect Endpoints (Placeholder - to be implemented in Sprint 1.20)
# ==========================================

@router.delete("/disconnect/google", response_model=CalendarDisconnectResponse)
async def disconnect_google_calendar(
    current_user: dict = Depends(get_current_user)
):
    """
    Disconnect Google Calendar.
    
    Removes the connection and all synced meetings.
    """
    # TODO: Implement in Sprint 1.20
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Google disconnect not yet implemented. Coming in Sprint 1.20."
    )


@router.delete("/disconnect/microsoft", response_model=CalendarDisconnectResponse)
async def disconnect_microsoft_calendar(
    current_user: dict = Depends(get_current_user)
):
    """
    Disconnect Microsoft 365 Calendar.
    
    Removes the connection and all synced meetings.
    """
    # TODO: Implement in Phase 4
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Microsoft disconnect not yet implemented. Coming in Phase 4."
    )


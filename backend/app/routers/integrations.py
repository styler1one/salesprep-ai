"""
Integrations Router - API endpoints for recording integrations
SPEC-038: Meetings & Calendar Integration - Phase 3
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import logging
import httpx

from app.deps import get_current_user, get_user_org
from app.database import get_supabase_service

supabase = get_supabase_service()

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/integrations", tags=["integrations"])


# ==========================================
# Pydantic Models
# ==========================================

class IntegrationProviderStatus(BaseModel):
    """Status of a single recording integration."""
    connected: bool = Field(description="Whether the provider is connected")
    api_key_set: bool = Field(default=False, description="Whether API key is configured")
    account_email: Optional[str] = Field(None, description="Connected account email")
    account_name: Optional[str] = Field(None, description="Connected account name")
    last_sync: Optional[datetime] = Field(None, description="Last successful sync time")
    last_sync_status: Optional[str] = Field(None, description="Status of last sync")
    pending_recordings: int = Field(default=0, description="Number of pending recordings to import")
    auto_import: bool = Field(default=True, description="Whether auto-import is enabled")


class IntegrationsStatusResponse(BaseModel):
    """Response for all recording integration statuses."""
    fireflies: IntegrationProviderStatus
    zoom: IntegrationProviderStatus
    teams: IntegrationProviderStatus


class FirefliesConnectRequest(BaseModel):
    """Request to connect Fireflies with API key."""
    api_key: str = Field(description="Fireflies API key", min_length=10)


class FirefliesConnectResponse(BaseModel):
    """Response after connecting Fireflies."""
    success: bool
    account_email: Optional[str] = Field(None, description="Connected account email")
    account_name: Optional[str] = Field(None, description="Account name from Fireflies")


class IntegrationDisconnectResponse(BaseModel):
    """Response after disconnecting an integration."""
    success: bool
    provider: str


class ExternalRecordingResponse(BaseModel):
    """External recording from Fireflies/Zoom/Teams."""
    id: str
    provider: str
    external_id: str
    title: Optional[str]
    recording_date: datetime
    duration_seconds: Optional[int]
    participants: List[str] = []
    transcript_available: bool = False
    audio_url: Optional[str] = None
    matched_meeting_id: Optional[str] = None
    matched_prospect_id: Optional[str] = None
    import_status: str


class ExternalRecordingsListResponse(BaseModel):
    """List of external recordings."""
    recordings: List[ExternalRecordingResponse]
    total: int


# ==========================================
# Helper Functions
# ==========================================

async def validate_fireflies_api_key(api_key: str) -> dict:
    """
    Validate Fireflies API key by fetching user info.
    Returns user info if valid, raises exception if invalid.
    """
    url = "https://api.fireflies.ai/graphql"
    
    query = """
    query {
        user {
            email
            name
            user_id
        }
    }
    """
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                url,
                json={"query": query},
                headers=headers,
                timeout=10.0
            )
            
            if response.status_code != 200:
                logger.warning(f"Fireflies API returned status {response.status_code}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid Fireflies API key"
                )
            
            data = response.json()
            
            if "errors" in data:
                logger.warning(f"Fireflies API errors: {data['errors']}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid Fireflies API key"
                )
            
            user_data = data.get("data", {}).get("user")
            if not user_data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Could not retrieve Fireflies user info"
                )
            
            return user_data
            
        except httpx.RequestError as e:
            logger.error(f"Fireflies API request failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Could not connect to Fireflies API"
            )


def get_empty_provider_status() -> IntegrationProviderStatus:
    """Return empty status for a disconnected provider."""
    return IntegrationProviderStatus(
        connected=False,
        api_key_set=False,
        account_email=None,
        account_name=None,
        last_sync=None,
        last_sync_status=None,
        pending_recordings=0,
        auto_import=True
    )


# ==========================================
# Endpoints
# ==========================================

@router.get("/status", response_model=IntegrationsStatusResponse)
async def get_integrations_status(
    user: dict = Depends(get_current_user),
    org: dict = Depends(get_user_org)
):
    """
    Get status of all recording integrations for current user.
    """
    user_id = user.get("id")
    
    # Initialize empty status for all providers
    fireflies_status = get_empty_provider_status()
    zoom_status = get_empty_provider_status()
    teams_status = get_empty_provider_status()
    
    try:
        # Fetch all integrations for user
        result = supabase.table("recording_integrations").select("*").eq(
            "user_id", user_id
        ).execute()
        
        integrations = result.data or []
        
        for integration in integrations:
            provider = integration.get("provider")
            
            status_obj = IntegrationProviderStatus(
                connected=True,
                api_key_set=bool(integration.get("credentials")),
                account_email=integration.get("account_email"),
                account_name=integration.get("account_name"),
                last_sync=integration.get("last_sync_at"),
                last_sync_status=integration.get("last_sync_status"),
                pending_recordings=0,  # Will be updated below
                auto_import=integration.get("auto_import", True)
            )
            
            if provider == "fireflies":
                fireflies_status = status_obj
            elif provider == "zoom":
                zoom_status = status_obj
            elif provider == "teams":
                teams_status = status_obj
        
        # Count pending recordings per provider
        pending_result = supabase.table("external_recordings").select(
            "provider", count="exact"
        ).eq("user_id", user_id).eq("import_status", "pending").execute()
        
        # Note: Supabase doesn't support group by easily, so we'll do it in Python
        pending_recordings = supabase.table("external_recordings").select(
            "provider"
        ).eq("user_id", user_id).eq("import_status", "pending").execute()
        
        if pending_recordings.data:
            for rec in pending_recordings.data:
                provider = rec.get("provider")
                if provider == "fireflies":
                    fireflies_status.pending_recordings += 1
                elif provider == "zoom":
                    zoom_status.pending_recordings += 1
                elif provider == "teams":
                    teams_status.pending_recordings += 1
        
    except Exception as e:
        logger.error(f"Error fetching integrations status: {e}")
        # Return empty status on error
    
    return IntegrationsStatusResponse(
        fireflies=fireflies_status,
        zoom=zoom_status,
        teams=teams_status
    )


@router.post("/fireflies/connect", response_model=FirefliesConnectResponse)
async def connect_fireflies(
    request: FirefliesConnectRequest,
    user: dict = Depends(get_current_user),
    org: dict = Depends(get_user_org)
):
    """
    Connect Fireflies integration with API key.
    Validates the API key against Fireflies API before saving.
    """
    user_id = user.get("id")
    org_id = org.get("id")
    api_key = request.api_key
    
    # Validate API key with Fireflies
    logger.info(f"Validating Fireflies API key for user {user_id}")
    user_info = await validate_fireflies_api_key(api_key)
    
    account_email = user_info.get("email")
    account_name = user_info.get("name")
    
    # Store credentials (encrypted in production - TODO: use proper encryption)
    # For now, storing as JSON with basic obfuscation
    import base64
    encoded_key = base64.b64encode(api_key.encode()).decode()
    
    credentials = {
        "api_key": encoded_key,
        "key_type": "base64"
    }
    
    try:
        # Check if integration already exists
        existing = supabase.table("recording_integrations").select("id").eq(
            "user_id", user_id
        ).eq("provider", "fireflies").execute()
        
        integration_data = {
            "organization_id": org_id,
            "user_id": user_id,
            "provider": "fireflies",
            "credentials": credentials,
            "account_email": account_email,
            "account_name": account_name,
            "auto_import": True,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        if existing.data:
            # Update existing integration
            result = supabase.table("recording_integrations").update(
                integration_data
            ).eq("id", existing.data[0]["id"]).execute()
            logger.info(f"Updated Fireflies integration for user {user_id}")
        else:
            # Create new integration
            integration_data["created_at"] = datetime.utcnow().isoformat()
            result = supabase.table("recording_integrations").insert(
                integration_data
            ).execute()
            logger.info(f"Created Fireflies integration for user {user_id}")
        
        return FirefliesConnectResponse(
            success=True,
            account_email=account_email,
            account_name=account_name
        )
        
    except Exception as e:
        logger.error(f"Error saving Fireflies integration: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save Fireflies integration"
        )


@router.delete("/fireflies/disconnect", response_model=IntegrationDisconnectResponse)
async def disconnect_fireflies(
    user: dict = Depends(get_current_user)
):
    """
    Disconnect Fireflies integration.
    Removes the integration but keeps imported recordings.
    """
    user_id = user.get("id")
    
    try:
        # Delete integration record
        result = supabase.table("recording_integrations").delete().eq(
            "user_id", user_id
        ).eq("provider", "fireflies").execute()
        
        logger.info(f"Disconnected Fireflies for user {user_id}")
        
        return IntegrationDisconnectResponse(
            success=True,
            provider="fireflies"
        )
        
    except Exception as e:
        logger.error(f"Error disconnecting Fireflies: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to disconnect Fireflies"
        )


@router.get("/fireflies/recordings", response_model=ExternalRecordingsListResponse)
async def get_fireflies_recordings(
    user: dict = Depends(get_current_user),
    import_status: Optional[str] = None,
    limit: int = 50
):
    """
    Get external recordings from Fireflies.
    Optionally filter by import status (pending, imported, skipped, failed).
    """
    user_id = user.get("id")
    
    try:
        query = supabase.table("external_recordings").select("*").eq(
            "user_id", user_id
        ).eq("provider", "fireflies").order("recording_date", desc=True).limit(limit)
        
        if import_status:
            query = query.eq("import_status", import_status)
        
        result = query.execute()
        
        recordings = []
        for rec in result.data or []:
            recordings.append(ExternalRecordingResponse(
                id=rec["id"],
                provider=rec["provider"],
                external_id=rec["external_id"],
                title=rec.get("title"),
                recording_date=rec["recording_date"],
                duration_seconds=rec.get("duration_seconds"),
                participants=rec.get("participants") or [],
                transcript_available=bool(rec.get("transcript_text") or rec.get("transcript_url")),
                audio_url=rec.get("audio_url"),
                matched_meeting_id=rec.get("matched_meeting_id"),
                matched_prospect_id=rec.get("matched_prospect_id"),
                import_status=rec["import_status"]
            ))
        
        return ExternalRecordingsListResponse(
            recordings=recordings,
            total=len(recordings)
        )
        
    except Exception as e:
        logger.error(f"Error fetching Fireflies recordings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch recordings"
        )


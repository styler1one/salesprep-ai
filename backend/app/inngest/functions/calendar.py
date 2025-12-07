"""
Calendar Sync Inngest Functions.

Handles automated calendar synchronization.

Functions:
- sync_all_calendars: Cron job to sync all active calendar connections
- sync_single_calendar: Event-triggered sync for a specific connection
"""

import logging
from datetime import datetime
import inngest
from inngest import TriggerEvent, TriggerCron

from app.inngest.client import inngest_client
from app.database import get_supabase_service
from app.services.calendar_sync import CalendarSyncService

logger = logging.getLogger(__name__)

# Database client
supabase = get_supabase_service()


@inngest_client.create_function(
    fn_id="sync-all-calendars",
    trigger=TriggerCron(cron="*/15 * * * *"),  # Every 15 minutes
    retries=1,
)
async def sync_all_calendars_fn(ctx, step):
    """
    Scheduled job to sync all active calendar connections.
    
    Runs every 15 minutes to keep calendar data fresh.
    """
    logger.info("Starting scheduled calendar sync for all connections")
    
    # Step 1: Get all active connections
    connections = await step.run("get-active-connections", get_active_connections)
    
    if not connections:
        logger.info("No active calendar connections to sync")
        return {"synced": 0, "message": "No connections to sync"}
    
    logger.info(f"Found {len(connections)} active connections to sync")
    
    # Step 2: Sync each connection
    results = []
    for conn in connections:
        try:
            result = await step.run(
                f"sync-connection-{conn['id'][:8]}",
                sync_connection,
                conn["id"]
            )
            results.append({
                "connection_id": conn["id"],
                "provider": conn["provider"],
                "success": True,
                **result
            })
        except Exception as e:
            logger.error(f"Failed to sync connection {conn['id']}: {e}")
            results.append({
                "connection_id": conn["id"],
                "provider": conn["provider"],
                "success": False,
                "error": str(e)
            })
    
    # Summary
    successful = sum(1 for r in results if r["success"])
    logger.info(f"Calendar sync complete: {successful}/{len(results)} successful")
    
    return {
        "synced": len(results),
        "successful": successful,
        "results": results
    }


@inngest_client.create_function(
    fn_id="sync-calendar-connection",
    trigger=TriggerEvent(event="dealmotion/calendar.sync.requested"),
    retries=2,
)
async def sync_calendar_connection_fn(ctx, step):
    """
    Sync a specific calendar connection.
    
    Triggered when:
    - A new calendar connection is created
    - User manually requests a sync
    - Calendar needs re-authentication
    """
    event_data = ctx.event.data
    connection_id = event_data["connection_id"]
    
    logger.info(f"Syncing calendar connection {connection_id}")
    
    # Step 1: Get connection details
    connection = await step.run("get-connection", get_connection, connection_id)
    
    if not connection:
        logger.error(f"Connection {connection_id} not found")
        return {"success": False, "error": "Connection not found"}
    
    if not connection.get("sync_enabled"):
        logger.info(f"Sync disabled for connection {connection_id}")
        return {"success": False, "error": "Sync disabled"}
    
    # Step 2: Perform sync
    result = await step.run("sync-connection", sync_connection, connection_id)
    
    return {
        "success": True,
        "connection_id": connection_id,
        "provider": connection.get("provider"),
        **result
    }


# =============================================================================
# Step Functions
# =============================================================================

def get_active_connections() -> list:
    """Get all active calendar connections that need syncing."""
    try:
        result = supabase.table("calendar_connections").select(
            "id, provider, user_id, organization_id, last_sync_at"
        ).eq(
            "sync_enabled", True
        ).is_(
            "needs_reauth", False  # Skip connections that need re-authentication
        ).execute()
        
        return result.data or []
    except Exception as e:
        logger.error(f"Failed to get active connections: {e}")
        return []


def get_connection(connection_id: str) -> dict:
    """Get a specific calendar connection."""
    try:
        result = supabase.table("calendar_connections").select("*").eq(
            "id", connection_id
        ).execute()
        
        if result.data and len(result.data) > 0:
            return result.data[0]
        return None
    except Exception as e:
        logger.error(f"Failed to get connection {connection_id}: {e}")
        return None


def sync_connection(connection_id: str) -> dict:
    """Sync a calendar connection using the sync service."""
    try:
        sync_service = CalendarSyncService()
        result = sync_service.sync_connection(connection_id)
        
        return {
            "synced_meetings": result.synced_meetings,
            "new_meetings": result.new_meetings,
            "updated_meetings": result.updated_meetings,
            "deleted_meetings": result.deleted_meetings,
            "errors": result.errors if result.errors else []
        }
    except Exception as e:
        logger.error(f"Sync failed for connection {connection_id}: {e}")
        raise


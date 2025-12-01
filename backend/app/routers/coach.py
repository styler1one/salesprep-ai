"""
AI Sales Coach "Luna" - API Router
TASK-029 / SPEC-028

Endpoints for the AI Sales Coach widget.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
from datetime import datetime, timedelta
import logging
import uuid

from app.deps import get_current_user
from app.database import get_supabase_service
from app.models.coach import (
    CoachSettings,
    CoachSettingsUpdate,
    BehaviorEventCreate,
    BehaviorEvent,
    Suggestion,
    SuggestionActionRequest,
    SuggestionsResponse,
    PatternsResponse,
    CoachStatsResponse,
    TodayStats,
    UserContext,
)
from app.services.coach_rules import rule_engine, build_user_context

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/coach", tags=["coach"])


# =============================================================================
# SETTINGS ENDPOINTS
# =============================================================================

@router.get("/settings", response_model=CoachSettings)
async def get_settings(current_user: dict = Depends(get_current_user)):
    """Get the current user's coach settings."""
    supabase = get_supabase_service()
    user_id = current_user["sub"]
    
    try:
        result = supabase.table("coach_settings") \
            .select("*") \
            .eq("user_id", user_id) \
            .execute()
        
        if result.data:
            return CoachSettings(**result.data[0])
        
        # Create default settings if not exist
        org_result = supabase.table("organization_members") \
            .select("organization_id") \
            .eq("user_id", user_id) \
            .execute()
        
        if not org_result.data:
            # Return default settings for users without organization
            return CoachSettings(
                id=str(uuid.uuid4()),
                user_id=user_id,
                is_enabled=True,
                show_inline_tips=True,
                show_completion_modals=True,
                notification_frequency="normal",
                widget_state="minimized",
                dismissed_tip_ids=[],
                created_at=datetime.now(),
                updated_at=datetime.now(),
            )
        
        new_settings = {
            "user_id": user_id,
            "is_enabled": True,
            "show_inline_tips": True,
            "show_completion_modals": True,
            "notification_frequency": "normal",
            "widget_state": "minimized",
            "dismissed_tip_ids": [],
        }
        
        insert_result = supabase.table("coach_settings") \
            .insert(new_settings) \
            .execute()
        
        if insert_result.data:
            return CoachSettings(**insert_result.data[0])
        
        raise HTTPException(status_code=500, detail="Failed to create settings")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting coach settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/settings", response_model=CoachSettings)
async def update_settings(
    updates: CoachSettingsUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update the current user's coach settings."""
    supabase = get_supabase_service()
    user_id = current_user["sub"]
    
    try:
        # Get existing settings first
        existing = await get_settings(current_user)
        
        # Build update data (only non-None values)
        update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
        update_data["updated_at"] = datetime.now().isoformat()
        
        result = supabase.table("coach_settings") \
            .update(update_data) \
            .eq("user_id", user_id) \
            .execute()
        
        if result.data:
            return CoachSettings(**result.data[0])
        
        raise HTTPException(status_code=500, detail="Failed to update settings")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating coach settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# SUGGESTIONS ENDPOINTS
# =============================================================================

@router.get("/suggestions", response_model=SuggestionsResponse)
async def get_suggestions(
    limit: int = Query(10, ge=1, le=50),
    current_user: dict = Depends(get_current_user)
):
    """Get prioritized suggestions for the current user."""
    supabase = get_supabase_service()
    user_id = current_user["sub"]
    
    try:
        # Get organization ID
        org_result = supabase.table("organization_members") \
            .select("organization_id") \
            .eq("user_id", user_id) \
            .execute()
        
        # New user without organization - return onboarding suggestions
        if not org_result.data:
            logger.info(f"User {user_id} has no organization - returning onboarding suggestions")
            # Return basic profile completion suggestions
            from app.models.coach import SuggestionType
            onboarding_suggestion = Suggestion(
                id=str(uuid.uuid4()),
                user_id=user_id,
                organization_id="",
                suggestion_type=SuggestionType.COMPLETE_PROFILE,
                title="Complete your profile",
                description="Set up your sales profile and company to get started with personalized AI assistance.",
                reason="New account setup",
                priority=95,
                action_route="/onboarding",
                action_label="Start Setup",
                icon="🚀",
                related_entity_type=None,
                related_entity_id=None,
                shown_at=datetime.now(),
                expires_at=None,
                action_taken=None,
                action_taken_at=None,
                snooze_until=None,
                feedback_rating=None,
            )
            return SuggestionsResponse(
                suggestions=[onboarding_suggestion],
                count=1,
                has_priority=True,
            )
        
        organization_id = org_result.data[0]["organization_id"]
        logger.info(f"Building context for user {user_id} in org {organization_id}")
        
        # Build user context
        context = await build_user_context(supabase, user_id, organization_id)
        
        # Evaluate rules to get suggestions
        suggestions = rule_engine.evaluate_all(context)
        
        # Apply pattern-based adjustments
        if context.patterns:
            suggestions = [
                rule_engine.adjust_priority_with_patterns(s, context.patterns)
                for s in suggestions
            ]
            # Re-sort after adjustments
            suggestions.sort(key=lambda s: s.priority, reverse=True)
        
        # Limit results
        suggestions = suggestions[:limit]
        
        # Convert to response format
        response_suggestions = []
        for i, suggestion in enumerate(suggestions):
            # Create a Suggestion record in the database (for tracking)
            suggestion_data = {
                "user_id": user_id,
                "organization_id": organization_id,
                "suggestion_type": suggestion.suggestion_type.value,
                "suggestion_data": {
                    "title": suggestion.title,
                    "description": suggestion.description,
                    "reason": suggestion.reason,
                    "action_route": suggestion.action_route,
                    "action_label": suggestion.action_label,
                    "icon": suggestion.icon,
                },
                "priority": suggestion.priority,
                "related_entity_type": suggestion.related_entity_type.value if suggestion.related_entity_type else None,
                "related_entity_id": suggestion.related_entity_id,
                "shown_at": datetime.now().isoformat(),
            }
            
            insert_result = supabase.table("coach_suggestions") \
                .insert(suggestion_data) \
                .execute()
            
            if insert_result.data:
                db_suggestion = insert_result.data[0]
                response_suggestions.append(Suggestion(
                    id=db_suggestion["id"],
                    user_id=user_id,
                    organization_id=organization_id,
                    suggestion_type=suggestion.suggestion_type,
                    title=suggestion.title,
                    description=suggestion.description,
                    reason=suggestion.reason,
                    priority=suggestion.priority,
                    action_route=suggestion.action_route,
                    action_label=suggestion.action_label,
                    icon=suggestion.icon,
                    related_entity_type=suggestion.related_entity_type,
                    related_entity_id=suggestion.related_entity_id,
                    shown_at=datetime.fromisoformat(db_suggestion["shown_at"]),
                    expires_at=None,
                    action_taken=None,
                    action_taken_at=None,
                    snooze_until=None,
                    feedback_rating=None,
                ))
        
        return SuggestionsResponse(
            suggestions=response_suggestions,
            count=len(response_suggestions),
            has_priority=any(s.priority >= 80 for s in suggestions),
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting suggestions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/suggestions/{suggestion_id}/action")
async def record_suggestion_action(
    suggestion_id: str,
    action_request: SuggestionActionRequest,
    current_user: dict = Depends(get_current_user)
):
    """Record user action on a suggestion (clicked, dismissed, snoozed)."""
    supabase = get_supabase_service()
    user_id = current_user["sub"]
    
    try:
        # Verify ownership
        check_result = supabase.table("coach_suggestions") \
            .select("id") \
            .eq("id", suggestion_id) \
            .eq("user_id", user_id) \
            .execute()
        
        if not check_result.data:
            raise HTTPException(status_code=404, detail="Suggestion not found")
        
        # Update the suggestion
        update_data = {
            "action_taken": action_request.action.value,
            "action_taken_at": datetime.now().isoformat(),
        }
        
        if action_request.snooze_until:
            update_data["snooze_until"] = action_request.snooze_until.isoformat()
        
        if action_request.feedback_rating:
            update_data["feedback_rating"] = action_request.feedback_rating
        
        result = supabase.table("coach_suggestions") \
            .update(update_data) \
            .eq("id", suggestion_id) \
            .execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to update suggestion")
        
        # Also record as behavior event for pattern learning
        org_result = supabase.table("organization_members") \
            .select("organization_id") \
            .eq("user_id", user_id) \
            .execute()
        
        if org_result.data:
            event_type = f"suggestion_{action_request.action.value}"
            supabase.table("coach_behavior_events").insert({
                "user_id": user_id,
                "organization_id": org_result.data[0]["organization_id"],
                "event_type": event_type,
                "event_data": {"suggestion_id": suggestion_id},
            }).execute()
        
        return {"success": True, "action": action_request.action.value}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error recording suggestion action: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# BEHAVIOR EVENTS ENDPOINTS
# =============================================================================

@router.post("/events")
async def record_event(
    event: BehaviorEventCreate,
    current_user: dict = Depends(get_current_user)
):
    """Record a behavior event for pattern learning."""
    supabase = get_supabase_service()
    user_id = current_user["sub"]
    
    try:
        # Get organization ID
        org_result = supabase.table("organization_members") \
            .select("organization_id") \
            .eq("user_id", user_id) \
            .execute()
        
        # Silently skip if user has no organization (new users)
        if not org_result.data:
            return {"success": True, "event_id": None, "message": "Skipped - no organization"}
        
        event_data = {
            "user_id": user_id,
            "organization_id": org_result.data[0]["organization_id"],
            "event_type": event.event_type.value,
            "event_data": event.event_data,
            "page_context": event.page_context,
        }
        
        result = supabase.table("coach_behavior_events") \
            .insert(event_data) \
            .execute()
        
        if result.data:
            return {"success": True, "event_id": result.data[0]["id"]}
        
        raise HTTPException(status_code=500, detail="Failed to record event")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error recording event: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# PATTERNS ENDPOINTS
# =============================================================================

@router.get("/patterns", response_model=PatternsResponse)
async def get_patterns(current_user: dict = Depends(get_current_user)):
    """Get learned patterns for the current user."""
    supabase = get_supabase_service()
    user_id = current_user["sub"]
    
    try:
        result = supabase.table("coach_user_patterns") \
            .select("*") \
            .eq("user_id", user_id) \
            .execute()
        
        return PatternsResponse(patterns=result.data or [])
        
    except Exception as e:
        logger.error(f"Error getting patterns: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# STATS ENDPOINTS
# =============================================================================

@router.get("/stats", response_model=CoachStatsResponse)
async def get_stats(current_user: dict = Depends(get_current_user)):
    """Get today's progress stats for the current user."""
    supabase = get_supabase_service()
    user_id = current_user["sub"]
    
    try:
        # Get organization ID
        org_result = supabase.table("organization_members") \
            .select("organization_id") \
            .eq("user_id", user_id) \
            .execute()
        
        # Return empty stats for users without organization
        if not org_result.data:
            return CoachStatsResponse(
                today=TodayStats(),
                suggestions_pending=0,
                patterns_learned=0,
            )
        
        organization_id = org_result.data[0]["organization_id"]
        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        
        stats = TodayStats()
        
        # Count research completed today
        research_result = supabase.table("research_briefs") \
            .select("id", count="exact") \
            .eq("organization_id", organization_id) \
            .eq("status", "completed") \
            .gte("completed_at", today_start) \
            .execute()
        stats.research_completed = research_result.count or 0
        
        # Count preps completed today
        preps_result = supabase.table("meeting_preps") \
            .select("id", count="exact") \
            .eq("organization_id", organization_id) \
            .eq("status", "completed") \
            .gte("completed_at", today_start) \
            .execute()
        stats.preps_completed = preps_result.count or 0
        
        # Count follow-ups completed today
        followups_result = supabase.table("followups") \
            .select("id", count="exact") \
            .eq("organization_id", organization_id) \
            .eq("status", "completed") \
            .gte("completed_at", today_start) \
            .execute()
        stats.followups_completed = followups_result.count or 0
        
        # Count actions generated today
        actions_result = supabase.table("followup_actions") \
            .select("id", count="exact") \
            .eq("organization_id", organization_id) \
            .gte("created_at", today_start) \
            .execute()
        stats.actions_generated = actions_result.count or 0
        
        stats.total_completed = (
            stats.research_completed + 
            stats.preps_completed + 
            stats.followups_completed + 
            stats.actions_generated
        )
        
        # Count pending suggestions
        suggestions_result = supabase.table("coach_suggestions") \
            .select("id", count="exact") \
            .eq("user_id", user_id) \
            .is_("action_taken", "null") \
            .execute()
        
        # Count learned patterns
        patterns_result = supabase.table("coach_user_patterns") \
            .select("id", count="exact") \
            .eq("user_id", user_id) \
            .execute()
        
        return CoachStatsResponse(
            today=stats,
            suggestions_pending=suggestions_result.count or 0,
            patterns_learned=patterns_result.count or 0,
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# INLINE SUGGESTIONS ENDPOINT
# =============================================================================

@router.get("/suggestions/inline")
async def get_inline_suggestions(
    page: str = Query(..., description="Current page context"),
    current_user: dict = Depends(get_current_user)
):
    """Get contextual inline suggestions for a specific page."""
    supabase = get_supabase_service()
    user_id = current_user["sub"]
    
    try:
        # Check if user has inline tips enabled
        settings_result = supabase.table("coach_settings") \
            .select("show_inline_tips, dismissed_tip_ids") \
            .eq("user_id", user_id) \
            .execute()
        
        if settings_result.data:
            settings = settings_result.data[0]
            if not settings.get("show_inline_tips", True):
                return {"suggestions": [], "count": 0}
        
        # Page-specific inline tips
        inline_tips = {
            "/dashboard/research": [
                {
                    "id": "research-tip-1",
                    "title": "Add contacts after research",
                    "description": "Adding contacts helps personalize your meeting preparation",
                    "icon": "💡",
                }
            ],
            "/dashboard/preparation": [
                {
                    "id": "prep-tip-1",
                    "title": "Include custom notes",
                    "description": "Preps with custom notes generate 30% better results",
                    "icon": "📝",
                }
            ],
            "/dashboard/followup": [
                {
                    "id": "followup-tip-1",
                    "title": "Generate a Customer Report",
                    "description": "Share professional reports with your prospects",
                    "icon": "📄",
                }
            ],
        }
        
        # Get tips for current page
        page_tips = inline_tips.get(page, [])
        
        # Filter out dismissed tips
        if settings_result.data:
            dismissed = settings_result.data[0].get("dismissed_tip_ids", [])
            page_tips = [t for t in page_tips if t["id"] not in dismissed]
        
        return {"suggestions": page_tips, "count": len(page_tips)}
        
    except Exception as e:
        logger.error(f"Error getting inline suggestions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


"""
Calendar Meetings Router - API endpoints for viewing synced meetings
SPEC-038: Meetings & Calendar Integration
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timedelta, timezone
import logging

from app.deps import get_user_org
from app.database import get_supabase_service

logger = logging.getLogger(__name__)
supabase = get_supabase_service()

router = APIRouter(prefix="/api/v1/calendar-meetings", tags=["calendar-meetings"])


# ==========================================
# Pydantic Models
# ==========================================

class Attendee(BaseModel):
    """Meeting attendee."""
    email: str
    name: Optional[str] = None
    response_status: Optional[str] = None
    is_organizer: bool = False


class PrepStatus(BaseModel):
    """Preparation status for a meeting."""
    has_prep: bool = False
    prep_id: Optional[str] = None
    prep_created_at: Optional[datetime] = None


class CalendarMeetingResponse(BaseModel):
    """Response model for a calendar meeting."""
    id: str
    title: str
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    location: Optional[str] = None
    meeting_url: Optional[str] = None
    is_online: bool = False
    status: str = "confirmed"
    attendees: List[Attendee] = []
    organizer_email: Optional[str] = None
    
    # Computed fields
    is_now: bool = False
    is_today: bool = False
    is_tomorrow: bool = False
    
    # Linked data
    prospect_id: Optional[str] = None
    prospect_name: Optional[str] = None
    prep_status: Optional[PrepStatus] = None
    
    # Recurring
    is_recurring: bool = False


class MeetingsListResponse(BaseModel):
    """Response for meetings list."""
    meetings: List[CalendarMeetingResponse]
    total: int
    has_more: bool = False


# ==========================================
# Helper Functions
# ==========================================

def is_meeting_now(start_time: datetime, end_time: datetime) -> bool:
    """Check if a meeting is currently happening."""
    now = datetime.now(timezone.utc)
    return start_time <= now <= end_time


def is_meeting_today(start_time: datetime) -> bool:
    """Check if a meeting is today."""
    now = datetime.now(timezone.utc)
    return start_time.date() == now.date()


def is_meeting_tomorrow(start_time: datetime) -> bool:
    """Check if a meeting is tomorrow."""
    now = datetime.now(timezone.utc)
    tomorrow = now + timedelta(days=1)
    return start_time.date() == tomorrow.date()


# ==========================================
# Endpoints
# ==========================================

@router.get("", response_model=MeetingsListResponse)
async def list_meetings(
    user_org: tuple = Depends(get_user_org),
    from_date: Optional[datetime] = Query(None, description="Start date filter (ISO format)"),
    to_date: Optional[datetime] = Query(None, description="End date filter (ISO format)"),
    prospect_id: Optional[str] = Query(None, description="Filter by prospect"),
    unprepared_only: bool = Query(False, description="Only show meetings without preparation"),
    limit: int = Query(50, ge=1, le=100, description="Max results"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
):
    """
    List calendar meetings for the current user.
    
    Returns synced meetings with computed fields like is_now, is_today,
    and linked prospect/prep information.
    """
    user_id, organization_id = user_org
    
    try:
        # Build query
        query = supabase.table("calendar_meetings").select(
            """
            id, title, description, start_time, end_time,
            location, meeting_url, is_online, status,
            attendees, organizer_email, is_recurring,
            prospect_id, prospects(id, company_name)
            """
        ).eq(
            "organization_id", organization_id
        ).neq(
            "status", "cancelled"
        ).order("start_time", desc=False)
        
        # Apply date filters
        if from_date:
            query = query.gte("start_time", from_date.isoformat())
        else:
            # Default: from now
            query = query.gte("start_time", datetime.now(timezone.utc).isoformat())
        
        if to_date:
            query = query.lte("start_time", to_date.isoformat())
        else:
            # Default: next 14 days
            default_to = datetime.now(timezone.utc) + timedelta(days=14)
            query = query.lte("start_time", default_to.isoformat())
        
        if prospect_id:
            query = query.eq("prospect_id", prospect_id)
        
        # Execute with pagination
        query = query.range(offset, offset + limit - 1)
        result = query.execute()
        
        meetings = []
        for row in result.data or []:
            # Parse attendees
            attendees = []
            for att in row.get("attendees") or []:
                attendees.append(Attendee(
                    email=att.get("email", ""),
                    name=att.get("name"),
                    response_status=att.get("response_status"),
                    is_organizer=att.get("is_organizer", False),
                ))
            
            # Parse times
            start_time = datetime.fromisoformat(row["start_time"].replace("Z", "+00:00"))
            end_time = datetime.fromisoformat(row["end_time"].replace("Z", "+00:00"))
            
            # Get prospect info
            prospect = row.get("prospects")
            prospect_id_val = row.get("prospect_id")
            prospect_name = prospect.get("company_name") if prospect else None
            
            # Check for existing preparation
            prep_status = None
            if prospect_id_val:
                prep_result = supabase.table("meeting_preps").select(
                    "id, created_at"
                ).eq("prospect_id", prospect_id_val).order(
                    "created_at", desc=True
                ).limit(1).execute()
                
                if prep_result.data and len(prep_result.data) > 0:
                    prep = prep_result.data[0]
                    prep_status = PrepStatus(
                        has_prep=True,
                        prep_id=prep["id"],
                        prep_created_at=prep["created_at"],
                    )
            
            # Skip if unprepared_only filter and has prep
            if unprepared_only and prep_status and prep_status.has_prep:
                continue
            
            meetings.append(CalendarMeetingResponse(
                id=row["id"],
                title=row["title"],
                description=row.get("description"),
                start_time=start_time,
                end_time=end_time,
                location=row.get("location"),
                meeting_url=row.get("meeting_url"),
                is_online=row.get("is_online", False),
                status=row.get("status", "confirmed"),
                attendees=attendees,
                organizer_email=row.get("organizer_email"),
                is_now=is_meeting_now(start_time, end_time),
                is_today=is_meeting_today(start_time),
                is_tomorrow=is_meeting_tomorrow(start_time),
                prospect_id=prospect_id_val,
                prospect_name=prospect_name,
                prep_status=prep_status,
                is_recurring=row.get("is_recurring", False),
            ))
        
        return MeetingsListResponse(
            meetings=meetings,
            total=len(meetings),
            has_more=len(result.data or []) == limit,
        )
        
    except Exception as e:
        logger.error(f"Failed to list meetings: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load meetings: {str(e)}"
        )


@router.get("/{meeting_id}", response_model=CalendarMeetingResponse)
async def get_meeting(
    meeting_id: str,
    user_org: tuple = Depends(get_user_org),
):
    """Get a single calendar meeting by ID."""
    user_id, organization_id = user_org
    
    try:
        result = supabase.table("calendar_meetings").select(
            """
            id, title, description, start_time, end_time,
            location, meeting_url, is_online, status,
            attendees, organizer_email, is_recurring,
            prospect_id, prospects(id, company_name)
            """
        ).eq("id", meeting_id).eq("organization_id", organization_id).execute()
        
        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Meeting not found"
            )
        
        row = result.data[0]
        
        # Parse (same as list)
        attendees = []
        for att in row.get("attendees") or []:
            attendees.append(Attendee(
                email=att.get("email", ""),
                name=att.get("name"),
                response_status=att.get("response_status"),
                is_organizer=att.get("is_organizer", False),
            ))
        
        start_time = datetime.fromisoformat(row["start_time"].replace("Z", "+00:00"))
        end_time = datetime.fromisoformat(row["end_time"].replace("Z", "+00:00"))
        
        prospect = row.get("prospects")
        prospect_id_val = row.get("prospect_id")
        prospect_name = prospect.get("company_name") if prospect else None
        
        return CalendarMeetingResponse(
            id=row["id"],
            title=row["title"],
            description=row.get("description"),
            start_time=start_time,
            end_time=end_time,
            location=row.get("location"),
            meeting_url=row.get("meeting_url"),
            is_online=row.get("is_online", False),
            status=row.get("status", "confirmed"),
            attendees=attendees,
            organizer_email=row.get("organizer_email"),
            is_now=is_meeting_now(start_time, end_time),
            is_today=is_meeting_today(start_time),
            is_tomorrow=is_meeting_tomorrow(start_time),
            prospect_id=prospect_id_val,
            prospect_name=prospect_name,
            is_recurring=row.get("is_recurring", False),
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get meeting {meeting_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load meeting: {str(e)}"
        )


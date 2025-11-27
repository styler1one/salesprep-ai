"""
Sales Profile Router - API endpoints for sales rep profiles
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from app.deps import get_current_user
from app.services.profile_service import ProfileService
from app.services.interview_service import InterviewService


router = APIRouter(prefix="/api/v1/profile/sales", tags=["sales_profile"])


# ==========================================
# Pydantic Models
# ==========================================

class InterviewStartResponse(BaseModel):
    """Response for starting interview."""
    session_id: str
    question_id: int
    question: str
    progress: int
    total_questions: int


class InterviewAnswerRequest(BaseModel):
    """Request for submitting interview answer."""
    session_id: str
    question_id: int
    answer: str


class InterviewAnswerResponse(BaseModel):
    """Response after submitting answer."""
    question_id: Optional[int] = None
    question: Optional[str] = None
    progress: int
    total_questions: int
    completed: bool = False


class InterviewCompleteRequest(BaseModel):
    """Request for completing interview."""
    session_id: str
    responses: Dict[int, str] = Field(..., description="Map of question_id to answer")


class SalesProfileResponse(BaseModel):
    """Sales profile response."""
    id: str
    user_id: str
    organization_id: str
    full_name: str
    role: Optional[str] = None
    experience_years: Optional[int] = None
    sales_methodology: Optional[str] = None
    methodology_description: Optional[str] = None
    communication_style: Optional[str] = None
    style_notes: Optional[str] = None
    strengths: List[str] = []
    areas_to_improve: List[str] = []
    target_industries: List[str] = []
    target_regions: List[str] = []
    target_company_sizes: List[str] = []
    quarterly_goals: Optional[str] = None
    preferred_meeting_types: List[str] = []
    ai_summary: Optional[str] = None
    profile_completeness: int
    version: int
    created_at: str
    updated_at: str


class SalesProfileUpdateRequest(BaseModel):
    """Request for updating sales profile."""
    role: Optional[str] = None
    experience_years: Optional[int] = None
    sales_methodology: Optional[str] = None
    methodology_description: Optional[str] = None
    communication_style: Optional[str] = None
    style_notes: Optional[str] = None
    strengths: Optional[List[str]] = None
    areas_to_improve: Optional[List[str]] = None
    target_industries: Optional[List[str]] = None
    target_regions: Optional[List[str]] = None
    target_company_sizes: Optional[List[str]] = None
    quarterly_goals: Optional[str] = None
    preferred_meeting_types: Optional[List[str]] = None


# ==========================================
# Interview Endpoints
# ==========================================

@router.post("/interview/start", response_model=InterviewStartResponse)
async def start_interview(
    current_user: dict = Depends(get_current_user)
):
    """
    Start a new onboarding interview.
    
    Returns the first question and session ID.
    """
    try:
        interview_service = InterviewService()
        result = interview_service.start_interview()
        
        return InterviewStartResponse(**result)
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start interview: {str(e)}"
        )


@router.post("/interview/answer", response_model=InterviewAnswerResponse)
async def submit_answer(
    request: InterviewAnswerRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Submit an answer to an interview question.
    
    Returns the next question or completion status.
    """
    try:
        interview_service = InterviewService()
        
        # Store answer (in production, store in Redis/cache)
        # For now, we'll just get the next question
        
        next_question = interview_service.get_next_question(
            current_question_id=request.question_id,
            responses={}  # In production, retrieve from cache
        )
        
        if next_question is None:
            # Interview complete
            return InterviewAnswerResponse(
                progress=100,
                total_questions=15,
                completed=True
            )
        
        return InterviewAnswerResponse(
            question_id=next_question["question_id"],
            question=next_question["question"],
            progress=next_question["progress"],
            total_questions=next_question["total_questions"],
            completed=False
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit answer: {str(e)}"
        )


@router.post("/interview/complete", response_model=SalesProfileResponse)
async def complete_interview(
    request: InterviewCompleteRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Complete the interview and generate profile.
    
    Analyzes all responses with AI and creates structured profile.
    """
    try:
        interview_service = InterviewService()
        profile_service = ProfileService()
        
        # Analyze responses with AI
        print(f"DEBUG: Analyzing interview responses for user {current_user['sub']}")
        profile_data = interview_service.analyze_responses(request.responses)
        
        # Generate personalization settings
        personalization = interview_service.generate_personalization_settings(profile_data)
        profile_data["personalization_settings"] = personalization
        
        # Get user's organization
        # In production, get from organization_members table
        # For now, use a placeholder
        organization_id = current_user.get("organization_id")
        if not organization_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User must be part of an organization"
            )
        
        # Create profile
        print(f"DEBUG: Creating sales profile for user {current_user['sub']}")
        profile = profile_service.create_sales_profile(
            user_id=current_user["sub"],
            organization_id=organization_id,
            profile_data=profile_data
        )
        
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create profile"
            )
        
        print(f"DEBUG: Profile created successfully: {profile['id']}")
        return SalesProfileResponse(**profile)
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR: Failed to complete interview: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to complete interview: {str(e)}"
        )


# ==========================================
# Profile CRUD Endpoints
# ==========================================

@router.get("", response_model=SalesProfileResponse)
async def get_profile(
    current_user: dict = Depends(get_current_user)
):
    """
    Get current user's sales profile.
    """
    try:
        profile_service = ProfileService()
        profile = profile_service.get_sales_profile(current_user["sub"])
        
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Profile not found"
            )
        
        return SalesProfileResponse(**profile)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get profile: {str(e)}"
        )


@router.patch("", response_model=SalesProfileResponse)
async def update_profile(
    updates: SalesProfileUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Update current user's sales profile.
    """
    try:
        profile_service = ProfileService()
        
        # Convert to dict and remove None values
        update_data = {
            k: v for k, v in updates.dict().items()
            if v is not None
        }
        
        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update"
            )
        
        profile = profile_service.update_sales_profile(
            user_id=current_user["sub"],
            updates=update_data
        )
        
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Profile not found"
            )
        
        return SalesProfileResponse(**profile)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update profile: {str(e)}"
        )


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_profile(
    current_user: dict = Depends(get_current_user)
):
    """
    Delete current user's sales profile.
    """
    try:
        profile_service = ProfileService()
        success = profile_service.delete_sales_profile(current_user["sub"])
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Profile not found"
            )
        
        return None
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete profile: {str(e)}"
        )


# ==========================================
# Profile Check Endpoint
# ==========================================

@router.get("/check")
async def check_profile_exists(
    current_user: dict = Depends(get_current_user)
):
    """
    Check if user has a profile.
    
    Used for first-time user detection.
    """
    try:
        profile_service = ProfileService()
        profile = profile_service.get_sales_profile(current_user["sub"])
        
        return {
            "exists": profile is not None,
            "completeness": profile.get("profile_completeness", 0) if profile else 0
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check profile: {str(e)}"
        )

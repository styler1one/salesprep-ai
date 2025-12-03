from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Tuple
import jwt
import os
from dotenv import load_dotenv

load_dotenv()

security = HTTPBearer()

# Lazy import to avoid circular imports
_supabase_service = None

def _get_supabase():
    """Lazy load supabase service client."""
    global _supabase_service
    if _supabase_service is None:
        from app.database import get_supabase_service
        _supabase_service = get_supabase_service()
    return _supabase_service

def get_auth_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """
    Returns the raw JWT token from the Authorization header.
    """
    return credentials.credentials

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Verifies the Supabase JWT token and returns the user payload.
    """
    token = credentials.credentials
    
    try:
        # Supabase signs tokens with HS256 and the JWT secret
        # Note: This is NOT the service_role key, but the JWT secret from Supabase settings
        payload = jwt.decode(
            token, 
            os.getenv("SUPABASE_JWT_SECRET"), 
            algorithms=["HS256"],
            audience="authenticated",
            options={"verify_aud": False} # Audience might vary
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_user_org(current_user: dict = Depends(get_current_user)) -> Tuple[str, str]:
    """
    Get user_id and organization_id from authenticated user.
    
    Returns:
        Tuple of (user_id, organization_id)
        
    Raises:
        HTTPException 401: If user token is invalid
        HTTPException 403: If user has no organization
    """
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user token"
        )
    
    supabase = _get_supabase()
    org_result = supabase.table("organization_members").select("organization_id").eq("user_id", user_id).limit(1).execute()
    
    if not org_result.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User has no organization"
        )
    
    return user_id, org_result.data[0]["organization_id"]


def get_organization_id(user_id: str) -> str:
    """
    Get organization ID for a user. Synchronous version.
    
    Use this in background tasks where you already have the user_id.
    For route handlers, prefer get_user_org() dependency.
    """
    supabase = _get_supabase()
    response = supabase.table("organization_members").select("organization_id").eq("user_id", user_id).limit(1).execute()
    
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User not in any organization"
        )
    
    return response.data[0]["organization_id"]

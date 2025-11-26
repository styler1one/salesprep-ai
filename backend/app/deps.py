from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
import os
from dotenv import load_dotenv

load_dotenv()

security = HTTPBearer()

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

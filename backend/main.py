from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
from app.routers import users, knowledge_base, research, sales_profile, company_profile, context, preparation, followup, prospects

load_dotenv()

app = FastAPI(
    title="SalesPrep AI API",
    description="AI-powered sales enablement platform API",
    version="1.0.0"
)

# CORS configuration
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(knowledge_base.router, prefix="/api/v1/knowledge-base", tags=["knowledge-base"])
app.include_router(research.router, prefix="/api/v1/research", tags=["research"])
app.include_router(sales_profile.router)  # Already has prefix
app.include_router(company_profile.router)  # Already has prefix
app.include_router(context.router)  # Already has prefix
app.include_router(preparation.router, prefix="/api/v1/prep", tags=["preparation"])
app.include_router(followup.router, prefix="/api/v1", tags=["followup"])
app.include_router(prospects.router, prefix="/api/v1", tags=["prospects"])

@app.get("/")
def read_root():
    return {
        "message": "Welcome to SalesPrep AI API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "environment": os.getenv("ENVIRONMENT", "development")
    }

@app.get("/api/v1/test")
def test_endpoint():
    """Test endpoint to verify backend is working"""
    return {
        "message": "Backend is working!",
        "database": "connected" if os.getenv("DATABASE_URL") else "not configured",
        "supabase": "configured" if os.getenv("SUPABASE_URL") else "not configured"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

"""
Contacts Router - API endpoints for contact person management and analysis.

Endpoints:
- POST /research/{research_id}/contacts - Add and analyze contact for research
- GET /research/{research_id}/contacts - List contacts for research
- GET /prospects/{prospect_id}/contacts - List contacts for prospect
- GET /contacts/{contact_id} - Get single contact
- DELETE /contacts/{contact_id} - Delete contact
- POST /contacts/lookup - Lookup contact LinkedIn and role online
"""

import os
import logging
import asyncio
from typing import Optional, List
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from supabase import create_client, Client

from app.deps import get_current_user
from app.services.contact_analyzer import get_contact_analyzer

logger = logging.getLogger(__name__)

router = APIRouter()

# Service client for background tasks
supabase_service: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)


# ==================== Pydantic Models ====================

class ContactCreate(BaseModel):
    """Request model for creating a contact."""
    name: str
    role: Optional[str] = None
    linkedin_url: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    is_primary: bool = False


class ContactResponse(BaseModel):
    """Response model for a contact."""
    id: str
    prospect_id: str
    name: str
    role: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    linkedin_url: Optional[str]
    
    # Analysis results
    communication_style: Optional[str]
    decision_authority: Optional[str]
    probable_drivers: Optional[str]
    profile_brief: Optional[str]
    opening_suggestions: Optional[List[str]]
    questions_to_ask: Optional[List[str]]
    topics_to_avoid: Optional[List[str]]
    
    # Meta
    is_primary: bool
    analyzed_at: Optional[str]
    created_at: str


class ContactListResponse(BaseModel):
    """Response model for contact list."""
    contacts: List[ContactResponse]
    count: int


class ContactLookupRequest(BaseModel):
    """Request model for looking up contact info online."""
    name: str
    company_name: str
    country: Optional[str] = None


class ContactLookupResponse(BaseModel):
    """Response model for contact lookup."""
    name: str
    role: Optional[str] = None
    linkedin_url: Optional[str] = None
    headline: Optional[str] = None
    found: bool = False
    confidence: Optional[str] = None  # "high", "medium", "low"


# ==================== Helper Functions ====================

def get_organization_id(user_id: str) -> str:
    """Get organization ID for user."""
    response = supabase_service.table("organization_members")\
        .select("organization_id")\
        .eq("user_id", user_id)\
        .execute()
    
    if not response.data:
        raise HTTPException(status_code=403, detail="User not in any organization")
    
    return response.data[0]["organization_id"]


def get_prospect_id_from_research(research_id: str, organization_id: str) -> str:
    """Get prospect_id from a research brief."""
    response = supabase_service.table("research_briefs")\
        .select("prospect_id")\
        .eq("id", research_id)\
        .eq("organization_id", organization_id)\
        .single()\
        .execute()
    
    if not response.data:
        raise HTTPException(status_code=404, detail="Research not found")
    
    prospect_id = response.data.get("prospect_id")
    if not prospect_id:
        raise HTTPException(status_code=400, detail="Research has no linked prospect")
    
    return prospect_id


# ==================== Contact Lookup via Gemini ====================

async def lookup_contact_online(name: str, company_name: str, country: Optional[str] = None) -> dict:
    """
    Lookup contact information (LinkedIn URL, role) via Gemini with Google Search.
    
    Uses the same approach as company_lookup.py which works reliably.
    
    Returns a dict with:
    - name: str
    - role: Optional[str]
    - linkedin_url: Optional[str]
    - headline: Optional[str]
    - found: bool
    - confidence: str ("high", "medium", "low")
    """
    import json
    import re
    
    try:
        from google import genai
        from google.genai import types
        
        # Get API key
        api_key = os.getenv("GOOGLE_AI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not api_key:
            logger.warning("No Google AI API key available for contact lookup")
            return {"name": name, "found": False}
        
        client = genai.Client(api_key=api_key)
        
        # Build search context
        location_context = f" {country}" if country else ""
        
        # Create explicit search query like a human would type
        search_terms = f"{name} {company_name} linkedin"
        
        prompt = f"""Je bent een onderzoeker. Zoek het LinkedIn profiel van deze persoon.

ZOEK OP GOOGLE NAAR: {search_terms}

Persoon: {name}
Bedrijf: {company_name}
{f"Land: {country}" if country else ""}

Geef het LinkedIn profiel URL terug als je het vindt.

Antwoord ALLEEN met JSON (geen uitleg, geen markdown):
{{
  "found": true,
  "confidence": "high",
  "linkedin_url": "https://www.linkedin.com/in/de-echte-username",
  "role": "Functietitel bij {company_name}",
  "headline": "De LinkedIn headline van de persoon"
}}

Of als niet gevonden:
{{
  "found": false,
  "confidence": "low",
  "linkedin_url": null,
  "role": null,
  "headline": null
}}

LET OP:
- Zoek actief op Google naar "{search_terms}"
- LinkedIn URL moet beginnen met linkedin.com/in/ (persoonlijk profiel, NIET /company/)
- Als je de persoon vindt, geef dan found=true
"""
        
        # Use same config as company_lookup.py
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())],
                temperature=0.1,
                max_output_tokens=500
            )
        )
        
        if response and response.text:
            result_text = response.text.strip()
            logger.info(f"Contact lookup for '{name}' at '{company_name}' - Full response: {result_text}")
            
            # Remove markdown code blocks if present
            if result_text.startswith("```"):
                result_text = re.sub(r'^```\w*\n?', '', result_text)
                result_text = re.sub(r'\n?```$', '', result_text)
            
            # Parse JSON
            result = json.loads(result_text)
            result["name"] = name
            
            # Validate LinkedIn URL format
            linkedin_url = result.get("linkedin_url")
            if linkedin_url:
                if "linkedin.com/in/" not in linkedin_url.lower():
                    result["linkedin_url"] = None
                    result["confidence"] = "low"
            
            return result
        else:
            logger.warning("Empty response from Gemini")
            return {"name": name, "found": False, "confidence": "low"}
        
    except json.JSONDecodeError as e:
        logger.warning(f"Failed to parse contact lookup response: {e}")
        return {"name": name, "found": False, "confidence": "low"}
    except Exception as e:
        logger.error(f"Contact lookup failed: {e}")
        return {"name": name, "found": False, "confidence": "low", "error": str(e)}


# ==================== Background Tasks ====================

def analyze_contact_background(
    contact_id: str,
    contact_name: str,
    contact_role: Optional[str],
    linkedin_url: Optional[str],
    research_id: str,
    organization_id: str,
    user_id: str
):
    """Background task to analyze contact."""
    import asyncio
    
    try:
        logger.info(f"Starting contact analysis for {contact_name}")
        
        analyzer = get_contact_analyzer()
        
        # Get contexts
        company_context = asyncio.run(analyzer.get_company_context(research_id))
        seller_context = asyncio.run(analyzer.get_seller_context(organization_id, user_id))
        
        # Run analysis
        analysis = asyncio.run(analyzer.analyze_contact(
            contact_name=contact_name,
            contact_role=contact_role,
            linkedin_url=linkedin_url,
            company_context=company_context,
            seller_context=seller_context
        ))
        
        # Update contact with analysis results
        update_data = {
            "profile_brief": analysis.get("profile_brief"),
            "communication_style": analysis.get("communication_style"),
            "decision_authority": analysis.get("decision_authority"),
            "probable_drivers": analysis.get("probable_drivers"),
            "opening_suggestions": analysis.get("opening_suggestions"),
            "questions_to_ask": analysis.get("questions_to_ask"),
            "topics_to_avoid": analysis.get("topics_to_avoid"),
            "analyzed_at": datetime.utcnow().isoformat(),
            "analysis_source": "linkedin" if linkedin_url else "role_based"
        }
        
        supabase_service.table("prospect_contacts")\
            .update(update_data)\
            .eq("id", contact_id)\
            .execute()
        
        logger.info(f"Contact analysis completed for {contact_name}")
        
    except Exception as e:
        logger.error(f"Contact analysis failed: {e}")
        # Update with error
        supabase_service.table("prospect_contacts")\
            .update({
                "profile_brief": f"# {contact_name}\n\nAnalyse mislukt: {str(e)}",
                "analyzed_at": datetime.utcnow().isoformat()
            })\
            .eq("id", contact_id)\
            .execute()


# ==================== Endpoints ====================

@router.post("/contacts/lookup", response_model=ContactLookupResponse)
async def lookup_contact(
    request: ContactLookupRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Lookup contact information online (LinkedIn URL, role/title).
    
    Uses Gemini with Google Search to find the person's LinkedIn profile
    and current job title at the specified company.
    """
    logger.info(f"Looking up contact: {request.name} at {request.company_name}")
    
    result = await lookup_contact_online(
        name=request.name,
        company_name=request.company_name,
        country=request.country
    )
    
    return ContactLookupResponse(
        name=result.get("name", request.name),
        role=result.get("role"),
        linkedin_url=result.get("linkedin_url"),
        headline=result.get("headline"),
        found=result.get("found", False),
        confidence=result.get("confidence", "low")
    )


@router.post("/research/{research_id}/contacts", response_model=ContactResponse)
async def add_contact_to_research(
    research_id: str,
    contact: ContactCreate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    Add a contact person to a research and start analysis.
    
    The contact will be linked to the prospect associated with the research.
    Analysis runs in the background and updates the contact when complete.
    """
    user_id = current_user.get("sub")
    organization_id = get_organization_id(user_id)
    
    # Get prospect_id from research
    prospect_id = get_prospect_id_from_research(research_id, organization_id)
    
    # Create contact record
    contact_id = str(uuid4())
    
    contact_data = {
        "id": contact_id,
        "prospect_id": prospect_id,
        "organization_id": organization_id,
        "name": contact.name,
        "role": contact.role,
        "email": contact.email,
        "phone": contact.phone,
        "linkedin_url": contact.linkedin_url,
        "is_primary": contact.is_primary,
        "analysis_source": "pending"
    }
    
    try:
        result = supabase_service.table("prospect_contacts")\
            .insert(contact_data)\
            .execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create contact")
        
        created_contact = result.data[0]
        
        # Start background analysis
        background_tasks.add_task(
            analyze_contact_background,
            contact_id,
            contact.name,
            contact.role,
            contact.linkedin_url,
            research_id,
            organization_id,
            user_id
        )
        
        return ContactResponse(
            id=created_contact["id"],
            prospect_id=created_contact["prospect_id"],
            name=created_contact["name"],
            role=created_contact.get("role"),
            email=created_contact.get("email"),
            phone=created_contact.get("phone"),
            linkedin_url=created_contact.get("linkedin_url"),
            communication_style=None,
            decision_authority=None,
            probable_drivers=None,
            profile_brief="Analyse wordt uitgevoerd...",
            opening_suggestions=None,
            questions_to_ask=None,
            topics_to_avoid=None,
            is_primary=created_contact.get("is_primary", False),
            analyzed_at=None,
            created_at=created_contact["created_at"]
        )
        
    except Exception as e:
        logger.error(f"Error creating contact: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/research/{research_id}/contacts", response_model=ContactListResponse)
async def list_contacts_for_research(
    research_id: str,
    current_user: dict = Depends(get_current_user)
):
    """List all contacts for a research."""
    user_id = current_user.get("sub")
    organization_id = get_organization_id(user_id)
    
    # Get prospect_id from research
    prospect_id = get_prospect_id_from_research(research_id, organization_id)
    
    # Get contacts for prospect
    response = supabase_service.table("prospect_contacts")\
        .select("*")\
        .eq("prospect_id", prospect_id)\
        .eq("organization_id", organization_id)\
        .order("is_primary", desc=True)\
        .order("created_at", desc=True)\
        .execute()
    
    contacts = []
    for c in response.data or []:
        contacts.append(ContactResponse(
            id=c["id"],
            prospect_id=c["prospect_id"],
            name=c["name"],
            role=c.get("role"),
            email=c.get("email"),
            phone=c.get("phone"),
            linkedin_url=c.get("linkedin_url"),
            communication_style=c.get("communication_style"),
            decision_authority=c.get("decision_authority"),
            probable_drivers=c.get("probable_drivers"),
            profile_brief=c.get("profile_brief"),
            opening_suggestions=c.get("opening_suggestions"),
            questions_to_ask=c.get("questions_to_ask"),
            topics_to_avoid=c.get("topics_to_avoid"),
            is_primary=c.get("is_primary", False),
            analyzed_at=c.get("analyzed_at"),
            created_at=c["created_at"]
        ))
    
    return ContactListResponse(contacts=contacts, count=len(contacts))


@router.get("/prospects/{prospect_id}/contacts", response_model=ContactListResponse)
async def list_contacts_for_prospect(
    prospect_id: str,
    current_user: dict = Depends(get_current_user)
):
    """List all contacts for a prospect."""
    user_id = current_user.get("sub")
    organization_id = get_organization_id(user_id)
    
    # Verify prospect belongs to organization
    prospect_check = supabase_service.table("prospects")\
        .select("id")\
        .eq("id", prospect_id)\
        .eq("organization_id", organization_id)\
        .execute()
    
    if not prospect_check.data:
        raise HTTPException(status_code=404, detail="Prospect not found")
    
    # Get contacts
    response = supabase_service.table("prospect_contacts")\
        .select("*")\
        .eq("prospect_id", prospect_id)\
        .eq("organization_id", organization_id)\
        .order("is_primary", desc=True)\
        .order("created_at", desc=True)\
        .execute()
    
    contacts = []
    for c in response.data or []:
        contacts.append(ContactResponse(
            id=c["id"],
            prospect_id=c["prospect_id"],
            name=c["name"],
            role=c.get("role"),
            email=c.get("email"),
            phone=c.get("phone"),
            linkedin_url=c.get("linkedin_url"),
            communication_style=c.get("communication_style"),
            decision_authority=c.get("decision_authority"),
            probable_drivers=c.get("probable_drivers"),
            profile_brief=c.get("profile_brief"),
            opening_suggestions=c.get("opening_suggestions"),
            questions_to_ask=c.get("questions_to_ask"),
            topics_to_avoid=c.get("topics_to_avoid"),
            is_primary=c.get("is_primary", False),
            analyzed_at=c.get("analyzed_at"),
            created_at=c["created_at"]
        ))
    
    return ContactListResponse(contacts=contacts, count=len(contacts))


@router.get("/contacts/{contact_id}", response_model=ContactResponse)
async def get_contact(
    contact_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a single contact by ID."""
    user_id = current_user.get("sub")
    organization_id = get_organization_id(user_id)
    
    response = supabase_service.table("prospect_contacts")\
        .select("*")\
        .eq("id", contact_id)\
        .eq("organization_id", organization_id)\
        .single()\
        .execute()
    
    if not response.data:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    c = response.data
    return ContactResponse(
        id=c["id"],
        prospect_id=c["prospect_id"],
        name=c["name"],
        role=c.get("role"),
        email=c.get("email"),
        phone=c.get("phone"),
        linkedin_url=c.get("linkedin_url"),
        communication_style=c.get("communication_style"),
        decision_authority=c.get("decision_authority"),
        probable_drivers=c.get("probable_drivers"),
        profile_brief=c.get("profile_brief"),
        opening_suggestions=c.get("opening_suggestions"),
        questions_to_ask=c.get("questions_to_ask"),
        topics_to_avoid=c.get("topics_to_avoid"),
        is_primary=c.get("is_primary", False),
        analyzed_at=c.get("analyzed_at"),
        created_at=c["created_at"]
    )


@router.delete("/contacts/{contact_id}")
async def delete_contact(
    contact_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a contact."""
    user_id = current_user.get("sub")
    organization_id = get_organization_id(user_id)
    
    # Verify contact exists and belongs to org
    check = supabase_service.table("prospect_contacts")\
        .select("id")\
        .eq("id", contact_id)\
        .eq("organization_id", organization_id)\
        .execute()
    
    if not check.data:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    # Delete
    supabase_service.table("prospect_contacts")\
        .delete()\
        .eq("id", contact_id)\
        .execute()
    
    return {"message": "Contact deleted"}


@router.post("/contacts/{contact_id}/reanalyze", response_model=ContactResponse)
async def reanalyze_contact(
    contact_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Re-run analysis for a contact."""
    user_id = current_user.get("sub")
    organization_id = get_organization_id(user_id)
    
    # Get contact
    response = supabase_service.table("prospect_contacts")\
        .select("*, prospects(id)")\
        .eq("id", contact_id)\
        .eq("organization_id", organization_id)\
        .single()\
        .execute()
    
    if not response.data:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    contact = response.data
    
    # Find a research for this prospect to get company context
    research_response = supabase_service.table("research_briefs")\
        .select("id")\
        .eq("prospect_id", contact["prospect_id"])\
        .eq("organization_id", organization_id)\
        .order("created_at", desc=True)\
        .limit(1)\
        .execute()
    
    research_id = research_response.data[0]["id"] if research_response.data else None
    
    if not research_id:
        raise HTTPException(status_code=400, detail="No research found for this prospect")
    
    # Clear old analysis
    supabase_service.table("prospect_contacts")\
        .update({
            "profile_brief": "Analyse wordt opnieuw uitgevoerd...",
            "analyzed_at": None
        })\
        .eq("id", contact_id)\
        .execute()
    
    # Start background analysis
    background_tasks.add_task(
        analyze_contact_background,
        contact_id,
        contact["name"],
        contact.get("role"),
        contact.get("linkedin_url"),
        research_id,
        organization_id,
        user_id
    )
    
    return ContactResponse(
        id=contact["id"],
        prospect_id=contact["prospect_id"],
        name=contact["name"],
        role=contact.get("role"),
        email=contact.get("email"),
        phone=contact.get("phone"),
        linkedin_url=contact.get("linkedin_url"),
        communication_style=None,
        decision_authority=None,
        probable_drivers=None,
        profile_brief="Analyse wordt opnieuw uitgevoerd...",
        opening_suggestions=None,
        questions_to_ask=None,
        topics_to_avoid=None,
        is_primary=contact.get("is_primary", False),
        analyzed_at=None,
        created_at=contact["created_at"]
    )


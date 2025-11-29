"""
Gemini Google Search integration for research.
Uses the new Google GenAI SDK with Google Search grounding.
"""
import os
from typing import Dict, Any, Optional
from google import genai
from google.genai import types
from app.i18n.utils import get_language_instruction
from app.i18n.config import DEFAULT_LANGUAGE


class GeminiResearcher:
    """Research using Gemini with Google Search grounding."""
    
    def __init__(self):
        """Initialize Gemini API with new Google GenAI SDK."""
        api_key = os.getenv("GOOGLE_AI_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_AI_API_KEY environment variable not set")
        
        # Initialize client with explicit API key
        self.client = genai.Client(api_key=api_key)
        
        # Configure Google Search tool for grounding
        self.search_tool = types.Tool(
            google_search=types.GoogleSearch()
        )
        
        self.config = types.GenerateContentConfig(
            tools=[self.search_tool],
            temperature=0.3,  # Lower temperature for factual responses
        )
    
    async def search_company(
        self,
        company_name: str,
        country: Optional[str] = None,
        city: Optional[str] = None,
        linkedin_url: Optional[str] = None,
        seller_context: Optional[Dict[str, Any]] = None,
        language: str = DEFAULT_LANGUAGE
    ) -> Dict[str, Any]:
        """
        Search for company information using Gemini with Google Search.
        
        Enhanced with seller context for personalized research.
        
        Args:
            company_name: Name of the company
            country: Optional country for better search accuracy
            city: Optional city for better search accuracy
            linkedin_url: Optional LinkedIn URL
            seller_context: Context about what the user sells
            language: Output language code
            
        Returns:
            Dictionary with research data
        """
        lang_instruction = get_language_instruction(language)
        # Build search query with location context
        search_query = self._build_search_query(
            company_name, country, city, linkedin_url
        )
        
        # Build seller context section if available
        seller_section = ""
        if seller_context and seller_context.get("has_context"):
            products = ", ".join(seller_context.get("products_services", [])[:5]) or "not specified"
            seller_section = f"""

IMPORTANT - SELLER CONTEXT:
Selling company: {seller_context.get('company_name', 'Unknown')}
Products/services they sell: {products}
Target market: {seller_context.get('target_market', 'not specified')}

Specifically search for information relevant to selling the above products to {company_name}.
"""
        
        # Build prompt for Gemini
        prompt = f"""
You are a business research assistant with access to Google Search. {lang_instruction}

Research the following company and provide comprehensive information:

{search_query}
{seller_section}

Search for and provide:

1. COMPANY OVERVIEW
   - Industry and sector
   - Company size (employees, revenue if known)
   - Headquarters location
   - Founding date
   - Website

2. BUSINESS MODEL
   - Main products or services
   - Target market (B2B, B2C, etc.)
   - Key value propositions

3. RECENT NEWS (Last 30 days)
   - Latest announcements
   - Product launches
   - Funding or financial news
   - Leadership changes
   - Partnerships

4. KEY PEOPLE
   - CEO and leadership team
   - Notable team members
   - LinkedIn profiles

5. MARKET POSITION
   - Main competitors
   - Market share (if available)
   - Unique differentiating factors

{"6. SALES OPPORTUNITIES" + chr(10) + "   - Specific problems that " + company_name + " has that are relevant for " + ", ".join(seller_context.get('products_services', [])[:3]) + chr(10) + "   - Departments or roles most relevant" + chr(10) + "   - Timing factors or trigger events" if seller_context and seller_context.get("has_context") else ""}

Provide factual, verified information from reliable sources. If information is not available, state that clearly.
"""
        
        try:
            # Generate response with Google Search grounding using new SDK
            # Note: Use gemini-2.0-flash (stable, free tier available)
            response = self.client.models.generate_content(
                model='gemini-2.0-flash',
                contents=prompt,
                config=self.config
            )
            
            return {
                "source": "gemini",
                "query": search_query,
                "data": response.text,
                "success": True
            }
            
        except Exception as e:
            return {
                "source": "gemini",
                "query": search_query,
                "error": str(e),
                "success": False
            }
    
    def _build_search_query(
        self,
        company_name: str,
        country: Optional[str],
        city: Optional[str],
        linkedin_url: Optional[str]
    ) -> str:
        """Build search query with location context."""
        query_parts = [f"Company: {company_name}"]
        
        if city and country:
            query_parts.append(f"Location: {city}, {country}")
        elif city:
            query_parts.append(f"City: {city}")
        elif country:
            query_parts.append(f"Country: {country}")
        
        if linkedin_url:
            query_parts.append(f"LinkedIn: {linkedin_url}")
        
        return "\n".join(query_parts)

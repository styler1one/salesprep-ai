"""
Gemini Google Search integration for research.
Uses the new Google GenAI SDK with Google Search grounding.
"""
import os
from typing import Dict, Any, Optional
from google import genai
from google.genai import types


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
        linkedin_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Search for company information using Gemini with Google Search.
        
        Args:
            company_name: Name of the company
            country: Optional country for better search accuracy
            city: Optional city for better search accuracy
            linkedin_url: Optional LinkedIn URL
            
        Returns:
            Dictionary with research data
        """
        # Build search query with location context
        search_query = self._build_search_query(
            company_name, country, city, linkedin_url
        )
        
        # Build prompt for Gemini
        prompt = f"""
You are a business research assistant with access to Google Search.

Research the following company and provide comprehensive information:

{search_query}

Please search for and provide:

1. COMPANY OVERVIEW
   - Industry and sector
   - Company size (employees, revenue if available)
   - Headquarters location
   - Founded date
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
   - CEO and executive team
   - Notable team members

5. MARKET POSITION
   - Main competitors
   - Market share (if available)
   - Unique differentiators

Provide factual, verified information from reliable sources. If information is not available, clearly state that.
Format the response in clear sections.
"""
        
        try:
            # Generate response with Google Search grounding using new SDK
            # Note: Use full model path for v1beta API
            response = self.client.models.generate_content(
                model='models/gemini-1.5-flash-latest',
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

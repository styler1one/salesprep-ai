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
        linkedin_url: Optional[str] = None,
        seller_context: Optional[Dict[str, Any]] = None
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
            
        Returns:
            Dictionary with research data
        """
        # Build search query with location context
        search_query = self._build_search_query(
            company_name, country, city, linkedin_url
        )
        
        # Build seller context section if available
        seller_section = ""
        if seller_context and seller_context.get("has_context"):
            products = ", ".join(seller_context.get("products_services", [])[:5]) or "niet gespecificeerd"
            seller_section = f"""

BELANGRIJK - CONTEXT VAN DE VERKOPER:
Verkopend bedrijf: {seller_context.get('company_name', 'Onbekend')}
Producten/diensten die ze verkopen: {products}
Doelmarkt: {seller_context.get('target_market', 'niet gespecificeerd')}

Zoek specifiek naar informatie die relevant is voor het verkopen van bovenstaande producten aan {company_name}.
"""
        
        # Build prompt for Gemini - NOW IN DUTCH
        prompt = f"""
Je bent een business research assistent met toegang tot Google Search. Schrijf je output in het NEDERLANDS.

Onderzoek het volgende bedrijf en geef uitgebreide informatie:

{search_query}
{seller_section}

Zoek naar en geef:

1. BEDRIJFSOVERZICHT
   - Industrie en sector
   - Bedrijfsgrootte (medewerkers, omzet indien bekend)
   - Hoofdkantoor locatie
   - Oprichtingsdatum
   - Website

2. BUSINESS MODEL
   - Belangrijkste producten of diensten
   - Doelmarkt (B2B, B2C, etc.)
   - Belangrijkste value propositions

3. RECENT NIEUWS (Laatste 30 dagen)
   - Laatste aankondigingen
   - Product launches
   - Financiering of financieel nieuws
   - Leiderschapswijzigingen
   - Partnerships

4. KEY MENSEN
   - CEO en directie team
   - Notable team members
   - LinkedIn profielen

5. MARKTPOSITIE
   - Belangrijkste concurrenten
   - Marktaandeel (indien beschikbaar)
   - Unieke onderscheidende factoren

{"6. SALES KANSEN" + chr(10) + "   - Specifieke problemen die " + company_name + " heeft die relevant zijn voor " + ", ".join(seller_context.get('products_services', [])[:3]) + chr(10) + "   - Afdelingen of rollen die het meest relevant zijn" + chr(10) + "   - Timing factoren of trigger events" if seller_context and seller_context.get("has_context") else ""}

Geef feitelijke, geverifieerde informatie uit betrouwbare bronnen. Als informatie niet beschikbaar is, vermeld dat duidelijk.
Schrijf alles in het Nederlands.
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

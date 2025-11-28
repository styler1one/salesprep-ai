"""
Claude Web Search integration for research.

Enhanced with seller context for personalized research output.
"""
import os
from typing import Dict, Any, Optional, List
from anthropic import Anthropic


class ClaudeResearcher:
    """Research using Claude with web search capabilities."""
    
    def __init__(self):
        """Initialize Claude API."""
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable not set")
        
        self.client = Anthropic(api_key=api_key)
    
    async def search_company(
        self,
        company_name: str,
        country: Optional[str] = None,
        city: Optional[str] = None,
        linkedin_url: Optional[str] = None,
        seller_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Search for company information using Claude with web search.
        
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
        # Build search context
        search_context = self._build_search_context(
            company_name, country, city, linkedin_url
        )
        
        # Build seller context section if available
        seller_section = ""
        if seller_context and seller_context.get("has_context"):
            products = ", ".join(seller_context.get("products_services", [])[:5]) or "niet gespecificeerd"
            seller_section = f"""

## BELANGRIJK - WAT IK VERKOOP:
Mijn bedrijf: {seller_context.get('company_name', 'Onbekend')}
Onze producten/diensten: {products}
Onze doelmarkt: {seller_context.get('target_market', 'niet gespecificeerd')}

Focus je research op informatie die relevant is voor het verkopen van deze producten/diensten aan {company_name}.
"""
        
        # Build prompt for Claude - NOW IN DUTCH
        prompt = f"""Je bent een sales research assistent met toegang tot web search. Schrijf je output in het NEDERLANDS.

Onderzoek het volgende bedrijf:

{search_context}
{seller_section}

Gebruik web search om actuele informatie te verzamelen. Zoek naar:
1. Bedrijfswebsite en officiële bronnen
2. LinkedIn bedrijfsprofiel
3. Recent nieuws en persberichten
4. Zakelijke databases
5. Industrie rapporten

Geef een gestructureerd research rapport met deze secties:

## BEDRIJFSOVERZICHT
- Industrie en sector
- Bedrijfsgrootte (medewerkers, omzet indien bekend)
- Hoofdkantoor locatie
- Oprichtingsdatum
- Website URL

## BUSINESS MODEL
- Belangrijkste producten of diensten
- Doelmarkt en klanten
- Business model (B2B, B2C, SaaS, etc.)
- Belangrijkste value propositions

## RECENTE ONTWIKKELINGEN (Laatste 30 dagen)
- Laatste nieuws en aankondigingen
- Product launches of updates
- Financiering of financieel nieuws
- Leiderschapswijzigingen
- Strategische partnerships of overnames

## KEY MENSEN
- CEO en oprichter(s)
- Directie team
- Notable advisors of board members
- LinkedIn profielen (indien beschikbaar)

## MARKTPOSITIE
- Belangrijkste concurrenten
- Marktaandeel of positie
- Groeitraject
- Unieke onderscheidende factoren
- Awards of erkenning

{"## SALES RELEVANTIE" + chr(10) + "- Wat zijn specifieke pijnpunten van " + company_name + " die onze oplossing (" + ", ".join(seller_context.get('products_services', [])[:3]) + ") kan aanpakken?" + chr(10) + "- Welke afdelingen of rollen bij " + company_name + " zijn het meest relevant?" + chr(10) + "- Welke trigger events of timing factoren zijn er?" if seller_context and seller_context.get("has_context") else "## SALES TALKING POINTS" + chr(10) + "- Potentiële pijnpunten" + chr(10) + "- Relevante use cases" + chr(10) + "- Gespreksopeners"}

Wees grondig maar bondig. Focus op feitelijke, verifieerbare informatie. Als informatie niet beschikbaar is, vermeld dat duidelijk. Schrijf alles in het Nederlands."""

        try:
            # Call Claude with web search enabled
            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",  # Latest Claude Sonnet model
                max_tokens=4096,
                temperature=0.3,  # Lower temperature for factual responses
                messages=[{
                    "role": "user",
                    "content": prompt
                }]
            )
            
            return {
                "source": "claude",
                "query": search_context,
                "data": response.content[0].text,
                "success": True
            }
            
        except Exception as e:
            return {
                "source": "claude",
                "query": search_context,
                "error": str(e),
                "success": False
            }
    
    def _build_search_context(
        self,
        company_name: str,
        country: Optional[str],
        city: Optional[str],
        linkedin_url: Optional[str]
    ) -> str:
        """Build search context with location information."""
        context_parts = [f"Company Name: {company_name}"]
        
        if city and country:
            context_parts.append(f"Location: {city}, {country}")
        elif city:
            context_parts.append(f"City: {city}")
        elif country:
            context_parts.append(f"Country: {country}")
        
        if linkedin_url:
            context_parts.append(f"LinkedIn URL: {linkedin_url}")
        
        return "\n".join(context_parts)

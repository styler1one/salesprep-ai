"""
Claude Web Search integration for research.

Enhanced with seller context for personalized research output.
"""
import os
from typing import Dict, Any, Optional, List
from anthropic import Anthropic
from app.i18n.utils import get_language_instruction
from app.i18n.config import DEFAULT_LANGUAGE


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
        seller_context: Optional[Dict[str, Any]] = None,
        language: str = DEFAULT_LANGUAGE
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
            language: Output language code
            
        Returns:
            Dictionary with research data
        """
        lang_instruction = get_language_instruction(language)
        # Build search context
        search_context = self._build_search_context(
            company_name, country, city, linkedin_url
        )
        
        # Build seller context section if available
        seller_section = ""
        if seller_context and seller_context.get("has_context"):
            products = ", ".join(seller_context.get("products_services", [])[:5]) or "not specified"
            seller_section = f"""

## IMPORTANT - WHAT I SELL:
My company: {seller_context.get('company_name', 'Unknown')}
Our products/services: {products}
Our target market: {seller_context.get('target_market', 'not specified')}

Focus your research on information relevant to selling these products/services to {company_name}.
"""
        
        # Build prompt for Claude
        prompt = f"""You are a sales research assistant with access to web search. {lang_instruction}

Research the following company:

{search_context}
{seller_section}

Use web search to gather current information. Search for:
1. Company website and official sources
2. LinkedIn company profile
3. Recent news and press releases
4. Business databases
5. Industry reports

Provide a structured research report with these sections:

## COMPANY OVERVIEW
- Industry and sector
- Company size (employees, revenue if known)
- Headquarters location
- Founding date
- Website URL

## BUSINESS MODEL
- Main products or services
- Target market and customers
- Business model (B2B, B2C, SaaS, etc.)
- Key value propositions

## RECENT DEVELOPMENTS (Last 30 days)
- Latest news and announcements
- Product launches or updates
- Funding or financial news
- Leadership changes
- Strategic partnerships or acquisitions

## KEY PEOPLE
- CEO and founder(s)
- Leadership team
- Notable advisors or board members
- LinkedIn profiles (if available)

## MARKET POSITION
- Main competitors
- Market share or position
- Growth trajectory
- Unique differentiating factors
- Awards or recognition

{"## SALES RELEVANCE" + chr(10) + "- What are specific pain points of " + company_name + " that our solution (" + ", ".join(seller_context.get('products_services', [])[:3]) + ") can address?" + chr(10) + "- Which departments or roles at " + company_name + " are most relevant?" + chr(10) + "- What trigger events or timing factors are there?" if seller_context and seller_context.get("has_context") else "## SALES TALKING POINTS" + chr(10) + "- Potential pain points" + chr(10) + "- Relevant use cases" + chr(10) + "- Conversation openers"}

Be thorough but concise. Focus on factual, verifiable information. If information is not available, state that clearly."""

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

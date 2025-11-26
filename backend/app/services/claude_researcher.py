"""
Claude Web Search integration for research.
"""
import os
from typing import Dict, Any, Optional
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
        linkedin_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Search for company information using Claude with web search.
        
        Args:
            company_name: Name of the company
            country: Optional country for better search accuracy
            city: Optional city for better search accuracy
            linkedin_url: Optional LinkedIn URL
            
        Returns:
            Dictionary with research data
        """
        # Build search context
        search_context = self._build_search_context(
            company_name, country, city, linkedin_url
        )
        
        # Build prompt for Claude
        prompt = f"""You are a sales research assistant with access to web search tools.

Research the following company:

{search_context}

Use your web search capabilities to gather comprehensive, up-to-date information. Search for:
1. Company website and official sources
2. LinkedIn company profile
3. Recent news articles and press releases
4. Business directories and databases
5. Industry reports and market data

Provide a structured research brief with these sections:

## COMPANY OVERVIEW
- Industry and sector
- Company size (employees, revenue if available)
- Headquarters location
- Founded date
- Website URL

## BUSINESS MODEL
- Main products or services
- Target market and customers
- Business model (B2B, B2C, SaaS, etc.)
- Key value propositions

## RECENT DEVELOPMENTS (Last 30 days)
- Latest news and announcements
- Product launches or updates
- Funding rounds or financial news
- Leadership changes
- Strategic partnerships or acquisitions

## KEY PEOPLE
- CEO and founder(s)
- Executive team
- Notable advisors or board members
- LinkedIn profiles (if available)

## MARKET POSITION
- Main competitors
- Market share or position
- Growth trajectory
- Unique differentiators
- Awards or recognition

## SALES TALKING POINTS
- Potential pain points this company might have
- Relevant use cases for our solution
- Conversation starters
- Questions to ask in discovery

Be thorough but concise. Focus on factual, verifiable information. If information is not available, clearly state that. Include sources where possible."""

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

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
        
        # Build commercial timing section if seller context available
        commercial_timing_section = ""
        if seller_context and seller_context.get("has_context"):
            products_list = ", ".join(seller_context.get('products_services', [])[:3])
            commercial_timing_section = f"""
## 7. COMMERCIAL TIMING SIGNALS

Based on the news and signals found, assess:
- **Urgency indicators**: Why might NOW be a good/bad time?
- **Budget signals**: Any signs of investment or cost-cutting?
- **Pain point evidence**: What challenges are they publicly discussing?
- **Relevance to {products_list}**: Any mentions related to what you sell?
"""
        
        # Build prompt for Gemini
        prompt = f"""You are a business research analyst with access to Google Search. {lang_instruction}

Your task: Find current market intelligence and news about {company_name}.

{search_query}
{seller_section}

Focus your searches on:
1. Recent news articles and press coverage
2. Industry publications and analyst reports
3. Social media and LinkedIn updates
4. Job postings and hiring patterns
5. Regulatory filings and public records

---

Provide research findings in these sections:

## 1. COMPANY SNAPSHOT
- **Full Legal Name**: [As registered]
- **Industry**: [Sector]
- **Size**: [Employees / Revenue]
- **Location**: [HQ]
- **Website**: [URL]

## 2. BUSINESS OVERVIEW
### What They Do
[Brief description of core business]

### Market & Customers
- Target market type
- Key customer segments
- Industries served

## 3. NEWS & DEVELOPMENTS (Last 90 Days)

Search Google News specifically for recent coverage:

### Recent Headlines
| Date | Headline | Source | URL |
|------|----------|--------|-----|
| [Date] | [Title] | [Publication] | [URL] |

### Event Categories
Categorize findings as:
- 💰 **Funding/Financial**: [Any investment, revenue, or financial news]
- 📈 **Growth**: [Expansion, new markets, scaling]
- 👥 **People**: [Hiring sprees, leadership changes, layoffs]
- 🚀 **Product**: [Launches, updates, pivots]
- 🤝 **Partnerships**: [Strategic deals, integrations]
- ⚠️ **Challenges**: [Setbacks, competition, issues]

## 4. HIRING SIGNALS

Search job boards and LinkedIn for:
- Current open positions
- Departments that are hiring
- Seniority levels being recruited
- New roles that signal strategic shifts

### Active Job Postings
| Role | Department | Level | What It Signals |
|------|------------|-------|-----------------|
| [Title] | [Dept] | [Jr/Sr/Exec] | [Strategic implication] |

## 5. MARKET & COMPETITIVE CONTEXT

### Industry Trends
Search for trends affecting their sector:
- [Trend 1 and its impact]
- [Trend 2 and its impact]

### Competitor Mentions
- Who are they compared to in articles?
- What competitive dynamics are mentioned?

### Regulatory Environment
- Any regulatory changes affecting their industry?
- Compliance requirements they must address?

## 6. SOCIAL & PUBLIC SIGNALS

### LinkedIn Activity
- Company page updates
- Employee count changes
- Content themes they post about

### Sentiment Indicators
- How are they perceived in the market?
- Any reputation issues or praise?
{commercial_timing_section}
---

RULES:
- Focus on RECENT information (prioritize last 90 days)
- Always include source URLs for news items
- Note publication dates for all news
- If no recent news found, state that clearly
- Look for signals, not just facts
- Be thorough in news search - multiple queries if needed
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

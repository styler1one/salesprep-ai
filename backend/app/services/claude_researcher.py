"""
Claude Web Search integration for research.

Enhanced with seller context for personalized research output.
"""
import os
from typing import Dict, Any, Optional, List
from anthropic import AsyncAnthropic  # Use async client to not block event loop
from app.i18n.utils import get_language_instruction
from app.i18n.config import DEFAULT_LANGUAGE


class ClaudeResearcher:
    """Research using Claude with web search capabilities."""
    
    def __init__(self):
        """Initialize Claude API."""
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable not set")
        
        self.client = AsyncAnthropic(api_key=api_key)
    
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
        
        # Build seller context for sales opportunity section
        sales_opportunity_section = ""
        if seller_context and seller_context.get("has_context"):
            products_list = ", ".join(seller_context.get('products_services', [])[:3])
            sales_opportunity_section = f"""
## 7. SALES OPPORTUNITY SIGNALS

### Potential Pain Points
Based on their situation, what problems might {company_name} have that {products_list} can address?

### Entry Point Indicators
- Which departments are most likely to have budget?
- Who would be the ideal first contact?
- What would make NOW the right time to reach out?
"""
        
        # Build prompt for Claude
        prompt = f"""You are a senior sales intelligence analyst with access to web search. {lang_instruction}

Your task: Gather comprehensive, commercially relevant intelligence about {company_name}.

{search_context}
{seller_section}

Use web search to find current, verified information. Prioritize:
1. Official company website and About pages
2. LinkedIn company profile and employee pages
3. Press releases and official announcements
4. Business registries and databases
5. Industry analyst reports

---

Provide a structured research report with these sections:

## 1. COMPANY PROFILE
| Element | Details |
|---------|---------|
| **Industry** | [Sector and sub-sector] |
| **Size** | [Employee count, revenue if available] |
| **Headquarters** | [City, Country] |
| **Founded** | [Year] |
| **Website** | [URL] |
| **Company Registration** | [Chamber of Commerce / Company ID if found] |
| **Ownership** | [Private / Public / PE-backed / Family-owned] |

## 2. BUSINESS MODEL
### What They Do
[2-3 sentences describing core business]

### Revenue Streams
- [How they make money - subscription, services, products, etc.]

### Customer Profile
- **Market Type**: [B2B / B2C / Both]
- **Customer Segments**: [Enterprise / SMB / Consumer]
- **Key Verticals**: [Industries they serve]

### Value Proposition
- [What they promise customers]
- [How they differentiate from alternatives]

## 3. LEADERSHIP & DECISION STRUCTURE

### Key Executives
| Name | Title | Background | LinkedIn URL |
|------|-------|------------|--------------|
| [Name] | [Title] | [Relevant experience] | [Full LinkedIn URL] |

Search specifically for:
- CEO, CFO, CTO, COO, CMO
- VP/Director of relevant departments
- Recent executive hires or departures

### Decision-Making Indicators
Based on company size and structure, note:
- Likely decision style (top-down, consensus, committee)
- Departments with buying authority
- Reporting structure clues

## 4. RECENT DEVELOPMENTS (Last 90 Days)

### Trigger Events
Search for and categorize:

| Date | Event | Type | Source |
|------|-------|------|--------|
| [Date] | [What happened] | 💰 Funding / 📈 Growth / 👥 Hiring / 🚀 Product / 🤝 Partnership / ⚠️ Challenge | [Source] |

Look specifically for:
- Funding rounds or financial news
- Major product launches or pivots
- Leadership changes (new hires, departures)
- Office expansions or relocations
- Strategic partnerships or acquisitions
- Layoffs, restructuring, or challenges

### What These Events Signal
[Interpret what the developments suggest about their priorities and challenges]

## 5. COMPETITIVE LANDSCAPE

### Main Competitors
| Competitor | Their Position | How They Differ |
|------------|----------------|-----------------|
| [Competitor] | [Market position] | [Key difference] |

### Current Vendor Footprint
Search for mentions of:
- Technology vendors they use
- Consulting firms they work with
- Partners or integrations mentioned

### Market Position
- **Trajectory**: [Growing / Stable / Declining / Pivoting]
- **Evidence**: [Signals supporting this]

## 6. TIMING & COMMERCIAL SIGNALS

### Budget Cycle Clues
- Fiscal year end (if public or mentioned)
- Planning periods
- Known budget cycles in their industry

### External Pressures
Search for industry-specific factors:
- Regulatory changes affecting them
- Industry trends they must respond to
- Competitive threats they face
- Economic factors impacting their sector
{sales_opportunity_section}
---

RULES:
- Be factual and evidence-based
- Include source URLs where possible
- If information is not found, state "Not found" rather than guessing
- Prioritize recent information (last 90 days) for developments
- Always include full LinkedIn URLs when found
- Focus on commercially relevant intelligence, not general company descriptions"""

        try:
            # Call Claude with web search enabled
            response = await self.client.messages.create(
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

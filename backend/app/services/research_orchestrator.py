"""
Research orchestrator - coordinates multiple research sources.
"""
import asyncio
from typing import Dict, Any, Optional, List
from .claude_researcher import ClaudeResearcher
from .gemini_researcher import GeminiResearcher
from .kvk_api import KVKApi


class ResearchOrchestrator:
    """Orchestrate research from multiple sources."""
    
    def __init__(self):
        """Initialize all research services."""
        self.claude = ClaudeResearcher()
        self.gemini = GeminiResearcher()
        self.kvk = KVKApi()
    
    async def research_company(
        self,
        company_name: str,
        country: Optional[str] = None,
        city: Optional[str] = None,
        linkedin_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Research company using multiple sources in parallel.
        
        Args:
            company_name: Name of the company
            country: Optional country
            city: Optional city
            linkedin_url: Optional LinkedIn URL
            
        Returns:
            Dictionary with combined research data
        """
        # Determine which sources to use
        tasks = []
        source_names = []
        
        # Always use Claude and Gemini
        tasks.append(self.claude.search_company(
            company_name, country, city, linkedin_url
        ))
        source_names.append("claude")
        
        tasks.append(self.gemini.search_company(
            company_name, country, city, linkedin_url
        ))
        source_names.append("gemini")
        
        # Use KVK only for Dutch companies
        if self.kvk.is_dutch_company(country):
            tasks.append(self.kvk.search_company(company_name, city))
            source_names.append("kvk")
        
        # Execute all searches in parallel
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Combine results
        combined_data = {
            "sources": {},
            "success_count": 0,
            "total_sources": len(tasks)
        }
        
        for source_name, result in zip(source_names, results):
            if isinstance(result, Exception):
                combined_data["sources"][source_name] = {
                    "success": False,
                    "error": str(result)
                }
            else:
                combined_data["sources"][source_name] = result
                if result.get("success"):
                    combined_data["success_count"] += 1
        
        # Generate unified brief
        combined_data["brief"] = await self._generate_unified_brief(
            combined_data["sources"],
            company_name,
            country,
            city
        )
        
        return combined_data
    
    async def _generate_unified_brief(
        self,
        sources: Dict[str, Any],
        company_name: str,
        country: Optional[str],
        city: Optional[str]
    ) -> str:
        """
        Generate unified research brief from all sources.
        
        Uses Claude to merge and structure data from all sources.
        """
        # Collect successful source data
        source_data = []
        
        if sources.get("claude", {}).get("success"):
            source_data.append(f"## Claude Research:\n{sources['claude']['data']}")
        
        if sources.get("gemini", {}).get("success"):
            source_data.append(f"## Gemini Research:\n{sources['gemini']['data']}")
        
        if sources.get("kvk", {}).get("success"):
            kvk_data = sources['kvk']['data']
            kvk_text = f"""## KVK Official Data:
- KVK Number: {kvk_data.get('kvk_number')}
- Legal Form: {kvk_data.get('legal_form')}
- Trade Name: {kvk_data.get('trade_name')}
- Address: {kvk_data.get('address', {}).get('street')} {kvk_data.get('address', {}).get('house_number')}, {kvk_data.get('address', {}).get('postal_code')} {kvk_data.get('address', {}).get('city')}
- Established: {kvk_data.get('establishment_date')}
- Employees: {kvk_data.get('employees')}
- Website: {kvk_data.get('website')}
"""
            source_data.append(kvk_text)
        
        if not source_data:
            return "# Research Failed\n\nNo data could be gathered from any source."
        
        # Use Claude to merge the data
        merge_prompt = f"""You are a sales research assistant. I have gathered information about {company_name} from multiple sources. Please create a unified, comprehensive research brief.

{chr(10).join(source_data)}

Please create a single, well-structured research brief with these sections:

# Research Brief: {company_name}
{f"Location: {city}, {country}" if city and country else ""}

## 1. COMPANY OVERVIEW
Merge and verify information from all sources. Include:
- Industry and sector
- Company size
- Headquarters
- Founded date
- Official registration (if available)

## 2. BUSINESS MODEL
- Products and services
- Target market
- Value proposition

## 3. RECENT DEVELOPMENTS
- Latest news (last 30 days)
- Funding or growth
- Product launches
- Key changes

## 4. KEY PEOPLE
- Leadership team
- Notable executives

## 5. MARKET POSITION
- Competitors
- Market share
- Differentiators

## 6. SALES TALKING POINTS
- Potential pain points
- Relevant use cases
- Conversation starters
- Discovery questions

Cross-reference the data from different sources. If sources conflict, note the discrepancy. Prioritize official data (like KVK) over web sources. Be factual and concise."""

        try:
            response = self.claude.client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=4096,
                temperature=0.2,
                messages=[{
                    "role": "user",
                    "content": merge_prompt
                }]
            )
            
            return response.content[0].text
            
        except Exception as e:
            # Fallback: just concatenate the sources
            return f"# Research Brief: {company_name}\n\n" + "\n\n---\n\n".join(source_data)

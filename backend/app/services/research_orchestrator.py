"""
Research orchestrator - coordinates multiple research sources.

Enhanced with full context awareness:
- Sales profile context (who is selling)
- Company profile context (what are we selling)
- Knowledge Base integration (case studies, product info)
"""
import asyncio
import os
import logging
from typing import Dict, Any, Optional, List
from supabase import create_client, Client
from .claude_researcher import ClaudeResearcher
from .gemini_researcher import GeminiResearcher
from .kvk_api import KVKApi
from .website_scraper import get_website_scraper

logger = logging.getLogger(__name__)


class ResearchOrchestrator:
    """Orchestrate research from multiple sources with full context."""
    
    def __init__(self):
        """Initialize all research services."""
        self.claude = ClaudeResearcher()
        self.gemini = GeminiResearcher()
        self.kvk = KVKApi()
        self.website_scraper = get_website_scraper()
        
        # Initialize Supabase for context retrieval
        self.supabase: Client = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        )
    
    async def research_company(
        self,
        company_name: str,
        country: Optional[str] = None,
        city: Optional[str] = None,
        linkedin_url: Optional[str] = None,
        website_url: Optional[str] = None,
        organization_id: Optional[str] = None,  # NEW: For context
        user_id: Optional[str] = None  # NEW: For sales profile
    ) -> Dict[str, Any]:
        """
        Research company using multiple sources in parallel.
        
        Enhanced with full context awareness:
        - Sales profile (who is selling, their strengths)
        - Company profile (what we sell, value propositions)
        - Knowledge Base (case studies, product info)
        
        Args:
            company_name: Name of the company
            country: Optional country
            city: Optional city
            linkedin_url: Optional LinkedIn URL
            website_url: Optional website URL for direct scraping
            organization_id: Organization ID for context retrieval
            user_id: User ID for sales profile context
            
        Returns:
            Dictionary with combined research data
        """
        # Get seller context for personalized research
        seller_context = await self._get_seller_context(organization_id, user_id)
        
        # Determine which sources to use
        tasks = []
        source_names = []
        
        # Always use Claude and Gemini - now with seller context!
        tasks.append(self.claude.search_company(
            company_name, country, city, linkedin_url,
            seller_context=seller_context
        ))
        source_names.append("claude")
        
        tasks.append(self.gemini.search_company(
            company_name, country, city, linkedin_url,
            seller_context=seller_context
        ))
        source_names.append("gemini")
        
        # Use KVK only for Dutch companies
        if self.kvk.is_dutch_company(country):
            tasks.append(self.kvk.search_company(company_name, city))
            source_names.append("kvk")
        
        # NEW: Use website scraper if URL provided
        if website_url:
            tasks.append(self.website_scraper.scrape_website(website_url))
            source_names.append("website")
        
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
        
        # Get relevant KB chunks for case studies
        kb_chunks = []
        if organization_id:
            kb_chunks = await self._get_relevant_kb_chunks(
                company_name, organization_id, seller_context
            )
            if kb_chunks:
                combined_data["sources"]["knowledge_base"] = {
                    "success": True,
                    "data": kb_chunks
                }
                combined_data["success_count"] += 1
        
        # Generate unified brief with full context
        combined_data["brief"] = await self._generate_unified_brief(
            combined_data["sources"],
            company_name,
            country,
            city,
            seller_context=seller_context,
            kb_chunks=kb_chunks
        )
        
        return combined_data
    
    async def _get_seller_context(
        self,
        organization_id: Optional[str],
        user_id: Optional[str]
    ) -> Dict[str, Any]:
        """
        Get seller context: who is selling, what are they selling.
        
        This context makes research prompts highly personalized.
        """
        context = {
            "has_context": False,
            "company_name": None,
            "industry": None,
            "products_services": [],
            "value_propositions": [],
            "target_market": None,
            "differentiators": [],
            "sales_person": None,
            "sales_strengths": [],
            "company_narrative": None,
            "sales_narrative": None
        }
        
        if not organization_id:
            return context
        
        try:
            # Get company profile
            company_response = self.supabase.table("company_profiles")\
                .select("*")\
                .eq("organization_id", organization_id)\
                .limit(1)\
                .execute()
            
            if company_response.data:
                company = company_response.data[0]
                context["has_context"] = True
                context["company_name"] = company.get("company_name")
                context["industry"] = company.get("industry")
                context["products_services"] = company.get("products_services", [])
                context["value_propositions"] = company.get("value_propositions", [])
                context["target_market"] = company.get("target_market")
                context["differentiators"] = company.get("differentiators", [])
                context["company_narrative"] = company.get("company_narrative")
            
            # Get sales profile
            if user_id:
                sales_response = self.supabase.table("sales_profiles")\
                    .select("*")\
                    .eq("user_id", user_id)\
                    .limit(1)\
                    .execute()
                
                if sales_response.data:
                    sales = sales_response.data[0]
                    context["sales_person"] = sales.get("full_name")
                    context["sales_strengths"] = sales.get("strengths", [])
                    context["sales_narrative"] = sales.get("sales_narrative")
            
            logger.info(f"Loaded seller context: {context['company_name']}, has_context={context['has_context']}")
            
        except Exception as e:
            logger.warning(f"Could not load seller context: {e}")
        
        return context
    
    async def _get_relevant_kb_chunks(
        self,
        prospect_company: str,
        organization_id: str,
        seller_context: Dict[str, Any],
        max_chunks: int = 3
    ) -> List[Dict[str, str]]:
        """
        Get relevant KB chunks (case studies, product info) for the prospect.
        """
        try:
            from app.services.embeddings import EmbeddingsService
            from app.services.vector_store import VectorStore
            
            embeddings = EmbeddingsService()
            vector_store = VectorStore()
            
            # Build query based on prospect and what we sell
            products = ", ".join(seller_context.get("products_services", [])[:3])
            query = f"{prospect_company} case study success {products}"
            
            query_embedding = await embeddings.embed_text(query)
            
            results = vector_store.query(
                vector=query_embedding,
                filter={"organization_id": organization_id},
                top_k=max_chunks,
                include_metadata=True
            )
            
            chunks = []
            for match in results.matches:
                if match.score > 0.5:  # Only include relevant chunks
                    chunks.append({
                        "text": match.metadata.get("text", "")[:500],
                        "source": match.metadata.get("filename", "Document"),
                        "score": match.score
                    })
            
            logger.info(f"Found {len(chunks)} relevant KB chunks for {prospect_company}")
            return chunks
            
        except Exception as e:
            logger.warning(f"Error getting KB chunks: {e}")
            return []
    
    async def _generate_unified_brief(
        self,
        sources: Dict[str, Any],
        company_name: str,
        country: Optional[str],
        city: Optional[str],
        seller_context: Optional[Dict[str, Any]] = None,
        kb_chunks: Optional[List[Dict[str, str]]] = None
    ) -> str:
        """
        Generate unified research brief from all sources.
        
        Enhanced with seller context for personalized talking points.
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
        
        # Add website scraper data
        if sources.get("website", {}).get("success"):
            website_data = sources['website']
            website_text = f"""## Company Website Content:
**URL**: {website_data.get('url')}
**Pages Scraped**: {website_data.get('pages_scraped', 0)}

{website_data.get('summary', 'No summary available')}
"""
            source_data.append(website_text)
        
        if not source_data:
            return "# Research Mislukt\n\nGeen data gevonden van bronnen."
        
        # Build seller context section for the prompt
        seller_section = ""
        if seller_context and seller_context.get("has_context"):
            products = ", ".join(seller_context.get("products_services", [])[:5]) or "Niet gespecificeerd"
            values = ", ".join(seller_context.get("value_propositions", [])[:3]) or "Niet gespecificeerd"
            diffs = ", ".join(seller_context.get("differentiators", [])[:3]) or "Niet gespecificeerd"
            
            seller_section = f"""
## CONTEXT: WAT JIJ VERKOOPT
**Jouw bedrijf**: {seller_context.get('company_name', 'Onbekend')}
**Producten/Diensten**: {products}
**Value Propositions**: {values}
**Onderscheidende factoren**: {diffs}
**Doelmarkt**: {seller_context.get('target_market', 'Niet gespecificeerd')}
"""
        
        # Build KB context section
        kb_section = ""
        if kb_chunks:
            kb_texts = "\n".join([
                f"- **{chunk['source']}**: {chunk['text'][:200]}..."
                for chunk in kb_chunks
            ])
            kb_section = f"""
## RELEVANTE CASE STUDIES/DOCUMENTEN UIT JOUW KNOWLEDGE BASE:
{kb_texts}
"""
        
        # Use Claude to merge the data - NOW IN DUTCH with seller context!
        merge_prompt = f"""Je bent een sales research assistent die een prospect brief maakt in het NEDERLANDS.

{seller_section}
{kb_section}

Ik heb informatie verzameld over {company_name} uit meerdere bronnen:

{chr(10).join(source_data)}

Maak een gestructureerde research brief in het NEDERLANDS met deze secties:

# Research Brief: {company_name}
{f"Locatie: {city}, {country}" if city and country else ""}

## 1. BEDRIJFSOVERZICHT
- Industrie en sector
- Bedrijfsgrootte (medewerkers, omzet indien bekend)
- Hoofdkantoor
- Opgericht
- Officiële registratie (KVK indien beschikbaar)

## 2. BUSINESS MODEL
- Producten en diensten
- Doelmarkt
- Klanttypen

## 3. RECENTE ONTWIKKELINGEN
- Laatste nieuws (afgelopen 30 dagen)
- Groei of financiering
- Product launches
- Belangrijke veranderingen

## 4. KEY MENSEN
- Directie en management
- Beslissers (CEO, CFO, CTO, etc.)
- LinkedIn profielen indien gevonden

## 5. MARKTPOSITIE
- Concurrenten
- Marktaandeel
- Onderscheidende factoren

## 6. SALES STRATEGIE
{"Dit is cruciaal - baseer dit op wat JIJ verkoopt:" if seller_context and seller_context.get("has_context") else ""}

### Potentiële Pijnpunten
- Welke problemen heeft dit bedrijf die relevant zijn voor jouw oplossing?
{"- Focus op problemen die " + ", ".join(seller_context.get("products_services", [])[:3]) + " kan oplossen" if seller_context and seller_context.get("products_services") else ""}

### Relevante Use Cases
- Concrete toepassingen van jouw oplossing bij dit bedrijf
{"- Denk aan: " + ", ".join(seller_context.get("value_propositions", [])[:2]) if seller_context and seller_context.get("value_propositions") else ""}

### Gespreksopeners
- 3-5 specifieke openingszinnen voor dit prospect
- Refereer aan hun recente nieuws of specifieke situatie

### Discovery Vragen
- 5-7 slimme vragen om behoeften te ontdekken
- Vragen die jouw oplossing relevant maken

{"### Relevante Referenties" + chr(10) + "Op basis van je knowledge base, welke case studies of succesverhalen zijn relevant voor dit prospect?" if kb_chunks else ""}

Wees feitelijk en bondig. Prioriteer officiële data (KVK) boven webresultaten. Schrijf alles in het Nederlands."""

        try:
            response = self.claude.client.messages.create(
                model="claude-sonnet-4-20250514",
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
            logger.error(f"Error generating unified brief: {e}")
            return f"# Research Brief: {company_name}\n\n" + "\n\n---\n\n".join(source_data)

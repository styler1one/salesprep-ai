"""
Contact Person Analyzer - LinkedIn profile analysis for personalized sales approach.

Analyzes contact persons in the context of:
1. The company they work at (from research)
2. What the seller offers (from profiles)

Generates:
- Communication style assessment
- Decision authority classification
- Role-specific pain points
- Conversation suggestions
"""

import os
import logging
from typing import Dict, Any, Optional, List
from anthropic import Anthropic
from supabase import create_client, Client

logger = logging.getLogger(__name__)


class ContactAnalyzer:
    """Analyze contact persons using AI with company and seller context."""
    
    def __init__(self):
        """Initialize Claude API and Supabase."""
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY not set")
        
        self.client = Anthropic(api_key=api_key)
        self.supabase: Client = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        )
    
    async def analyze_contact(
        self,
        contact_name: str,
        contact_role: Optional[str],
        linkedin_url: Optional[str],
        company_context: Dict[str, Any],
        seller_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Analyze a contact person with full context.
        
        Args:
            contact_name: Name of the contact
            contact_role: Job title/function
            linkedin_url: LinkedIn profile URL (optional)
            company_context: Research data about the company
            seller_context: What the seller offers
            
        Returns:
            Analysis dict with all insights
        """
        # Build the analysis prompt
        prompt = self._build_analysis_prompt(
            contact_name,
            contact_role,
            linkedin_url,
            company_context,
            seller_context
        )
        
        try:
            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=3000,
                temperature=0.3,
                messages=[{
                    "role": "user",
                    "content": prompt
                }]
            )
            
            analysis_text = response.content[0].text
            
            # Parse the analysis into structured data
            return self._parse_analysis(analysis_text, contact_name, contact_role, linkedin_url)
            
        except Exception as e:
            logger.error(f"Contact analysis failed: {e}")
            # Return basic info without analysis
            return {
                "name": contact_name,
                "role": contact_role,
                "linkedin_url": linkedin_url,
                "profile_brief": f"# {contact_name}\n\nAnalyse kon niet worden uitgevoerd: {str(e)}",
                "analysis_failed": True
            }
    
    def _build_analysis_prompt(
        self,
        contact_name: str,
        contact_role: Optional[str],
        linkedin_url: Optional[str],
        company_context: Dict[str, Any],
        seller_context: Dict[str, Any]
    ) -> str:
        """Build the prompt for contact analysis."""
        
        # Company context section
        company_section = ""
        if company_context:
            company_name = company_context.get("company_name", "Onbekend")
            industry = company_context.get("industry", "")
            brief = company_context.get("brief_content", "")[:2000] if company_context.get("brief_content") else ""
            
            company_section = f"""
## BEDRIJFSCONTEXT
**Bedrijf**: {company_name}
**Industrie**: {industry}

**Research samenvatting**:
{brief}
"""
        
        # Seller context section
        seller_section = ""
        if seller_context and seller_context.get("has_context"):
            products = ", ".join(seller_context.get("products_services", [])[:5]) or "Niet gespecificeerd"
            values = ", ".join(seller_context.get("value_propositions", [])[:3]) or "Niet gespecificeerd"
            target = seller_context.get("target_market", "Niet gespecificeerd")
            
            seller_section = f"""
## WAT DE VERKOPER AANBIEDT
**Bedrijf**: {seller_context.get('company_name', 'Onbekend')}
**Producten/Diensten**: {products}
**Value Propositions**: {values}
**Doelmarkt**: {target}
"""
        
        # LinkedIn instruction
        linkedin_instruction = ""
        if linkedin_url:
            linkedin_instruction = f"""
**LinkedIn URL**: {linkedin_url}

Gebruik je web search capabilities om dit LinkedIn profiel te analyseren.
Zoek naar: "{contact_name} {contact_role or ''} linkedin" en analyseer:
- Hun carrière achtergrond
- Recente posts en activiteit
- Connecties en endorsements
- Toon en communicatiestijl in posts
"""
        else:
            linkedin_instruction = """
**Geen LinkedIn URL beschikbaar**

Baseer je analyse op:
- De functie/rol
- Typische verantwoordelijkheden voor deze rol
- Algemene patronen voor deze functie in deze industrie
"""
        
        prompt = f"""Je bent een sales research assistent die contactpersonen analyseert voor gepersonaliseerde verkoopgesprekken. Schrijf in het NEDERLANDS.

{company_section}

{seller_section}

## CONTACTPERSOON OM TE ANALYSEREN
**Naam**: {contact_name}
**Functie**: {contact_role or 'Niet gespecificeerd'}
{linkedin_instruction}

---

Geef een uitgebreide analyse met EXACT deze secties:

## 1. PROFIEL SAMENVATTING
- Carrière achtergrond (als beschikbaar)
- Huidige verantwoordelijkheden gebaseerd op de rol
- Expertise gebieden
- Opleiding/certificeringen (als beschikbaar)

## 2. COMMUNICATIESTIJL
Kies EN onderbouw één van:
- **Formeel**: Zakelijke toon, titels belangrijk, gestructureerde communicatie
- **Informeel**: Casual, first-name basis, directe aanpak
- **Technisch**: Detail-georiënteerd, data-driven, wil specs en bewijs
- **Strategisch**: Big-picture denker, ROI-focused, wil business impact

## 3. BESLISSINGSPOSITIE
Classificeer EN onderbouw:
- **Decision Maker**: Heeft budget en finale beslissingsbevoegdheid
- **Influencer**: Beïnvloedt beslissing, geen finale zeggenschap
- **Gatekeeper**: Controleert toegang tot decision makers
- **Gebruiker**: Eindgebruiker, geen beslissingsbevoegdheid

## 4. MOGELIJKE DRIJFVEREN
Wat motiveert deze persoon waarschijnlijk? Kies 1-2:
- **Vooruitgang boeken**: Wil innoveren, moderniseren, vooroplopen
- **Problemen oplossen**: Wil iets repareren dat niet werkt
- **Zich onderscheiden**: Wil presteren, erkenning, carrière maken
- **Risico vermijden**: Wil stabiliteit, geen gedoe, veilige keuzes

Onderbouw met concrete signalen (als beschikbaar).

## 5. ROL-SPECIFIEKE PIJNPUNTEN
Welke problemen heeft iemand in deze rol typisch?
- Lijst 3-5 specifieke pijnpunten
- Koppel aan wat de verkoper aanbiedt: {", ".join(seller_context.get("products_services", [])[:3]) if seller_context else "niet gespecificeerd"}

## 6. GESPREKSADVIES

### Benadering
Hoe deze persoon het beste te benaderen (1-2 zinnen)

### Openingszinnen
Geef EXACT 3 concrete openingszinnen die je kunt gebruiken:
1. [Zin gebaseerd op hun rol/verantwoordelijkheden]
2. [Zin gebaseerd op bedrijfssituatie of nieuws]
3. [Zin gebaseerd op wat de verkoper kan bieden]

### Discovery Vragen
Geef EXACT 5 slimme vragen om behoeften te ontdekken:
1. [Vraag over huidige situatie]
2. [Vraag over pijnpunten]
3. [Vraag over beslissingsproces]
4. [Vraag over timing/urgentie]
5. [Vraag over succes criteria]

### Te Vermijden
Wat moet je NIET doen bij deze persoon? (2-3 punten)

---

Wees concreet en actionable. Geen vage algemeenheden."""

        return prompt
    
    def _parse_analysis(
        self,
        analysis_text: str,
        contact_name: str,
        contact_role: Optional[str],
        linkedin_url: Optional[str]
    ) -> Dict[str, Any]:
        """Parse the AI analysis into structured data."""
        
        result = {
            "name": contact_name,
            "role": contact_role,
            "linkedin_url": linkedin_url,
            "profile_brief": analysis_text,
            "analysis_failed": False
        }
        
        # Extract communication style
        text_lower = analysis_text.lower()
        if "**formeel**" in text_lower or "formeel:" in text_lower:
            result["communication_style"] = "formal"
        elif "**informeel**" in text_lower or "informeel:" in text_lower:
            result["communication_style"] = "informal"
        elif "**technisch**" in text_lower or "technisch:" in text_lower:
            result["communication_style"] = "technical"
        elif "**strategisch**" in text_lower or "strategisch:" in text_lower:
            result["communication_style"] = "strategic"
        
        # Extract decision authority
        if "**decision maker**" in text_lower or "decision maker:" in text_lower:
            result["decision_authority"] = "decision_maker"
        elif "**influencer**" in text_lower or "influencer:" in text_lower:
            result["decision_authority"] = "influencer"
        elif "**gatekeeper**" in text_lower or "gatekeeper:" in text_lower:
            result["decision_authority"] = "gatekeeper"
        elif "**gebruiker**" in text_lower or "gebruiker:" in text_lower:
            result["decision_authority"] = "user"
        
        # Extract drivers
        drivers = []
        if "vooruitgang" in text_lower:
            drivers.append("progress")
        if "problemen oplossen" in text_lower or "repareren" in text_lower:
            drivers.append("fixing")
        if "onderscheiden" in text_lower or "presteren" in text_lower:
            drivers.append("standing_out")
        if "risico vermijden" in text_lower or "stabiliteit" in text_lower:
            drivers.append("risk_averse")
        result["probable_drivers"] = ", ".join(drivers) if drivers else None
        
        # Extract opening suggestions (simple extraction)
        result["opening_suggestions"] = self._extract_list_items(analysis_text, "Openingszinnen", 3)
        
        # Extract questions
        result["questions_to_ask"] = self._extract_list_items(analysis_text, "Discovery Vragen", 5)
        
        # Extract things to avoid
        result["topics_to_avoid"] = self._extract_list_items(analysis_text, "Te Vermijden", 3)
        
        return result
    
    def _extract_list_items(self, text: str, section_name: str, max_items: int) -> List[str]:
        """Extract list items from a section of the analysis."""
        items = []
        
        # Find the section
        section_lower = section_name.lower()
        text_lower = text.lower()
        
        start_idx = text_lower.find(section_lower)
        if start_idx == -1:
            return items
        
        # Find the next section (starts with ##)
        remaining = text[start_idx:]
        lines = remaining.split('\n')
        
        in_section = False
        for line in lines:
            line = line.strip()
            
            # Skip the section header
            if section_lower in line.lower():
                in_section = True
                continue
            
            # Stop at next section
            if line.startswith('##') or line.startswith('###'):
                if in_section:
                    break
            
            # Extract numbered or bulleted items
            if in_section and line:
                # Remove common prefixes
                cleaned = line
                for prefix in ['1.', '2.', '3.', '4.', '5.', '-', '*', '•']:
                    if cleaned.startswith(prefix):
                        cleaned = cleaned[len(prefix):].strip()
                        break
                
                # Remove brackets if present
                if cleaned.startswith('[') and ']' in cleaned:
                    cleaned = cleaned[1:cleaned.index(']')]
                
                if cleaned and len(cleaned) > 10:  # Minimum length
                    items.append(cleaned)
                    if len(items) >= max_items:
                        break
        
        return items
    
    async def get_company_context(self, research_id: str) -> Dict[str, Any]:
        """Get company context from a research brief."""
        try:
            response = self.supabase.table("research_briefs")\
                .select("company_name, country, city, brief_content, research_data")\
                .eq("id", research_id)\
                .single()\
                .execute()
            
            if response.data:
                data = response.data
                return {
                    "company_name": data.get("company_name"),
                    "country": data.get("country"),
                    "city": data.get("city"),
                    "brief_content": data.get("brief_content"),
                    "industry": data.get("research_data", {}).get("industry")
                }
            return {}
        except Exception as e:
            logger.error(f"Error getting company context: {e}")
            return {}
    
    async def get_seller_context(
        self,
        organization_id: str,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get seller context from profiles."""
        context = {
            "has_context": False,
            "company_name": None,
            "products_services": [],
            "value_propositions": [],
            "target_market": None
        }
        
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
                context["products_services"] = company.get("products_services", [])
                context["value_propositions"] = company.get("value_propositions", [])
                context["target_market"] = company.get("target_market")
            
            return context
        except Exception as e:
            logger.warning(f"Could not load seller context: {e}")
            return context


# Singleton instance
_contact_analyzer: Optional[ContactAnalyzer] = None


def get_contact_analyzer() -> ContactAnalyzer:
    """Get or create contact analyzer instance."""
    global _contact_analyzer
    if _contact_analyzer is None:
        _contact_analyzer = ContactAnalyzer()
    return _contact_analyzer


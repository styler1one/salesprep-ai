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
from supabase import Client
from app.database import get_supabase_service
from app.i18n.utils import get_language_instruction
from app.i18n.config import DEFAULT_LANGUAGE

logger = logging.getLogger(__name__)


class ContactAnalyzer:
    """Analyze contact persons using AI with company and seller context."""
    
    def __init__(self):
        """Initialize Claude API and Supabase."""
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY not set")
        
        self.client = Anthropic(api_key=api_key)
        self.supabase: Client = get_supabase_service()
    
    async def analyze_contact(
        self,
        contact_name: str,
        contact_role: Optional[str],
        linkedin_url: Optional[str],
        company_context: Dict[str, Any],
        seller_context: Dict[str, Any],
        language: str = DEFAULT_LANGUAGE,
        user_provided_context: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Analyze a contact person with full context.
        
        Args:
            contact_name: Name of the contact
            contact_role: Job title/function
            linkedin_url: LinkedIn profile URL (optional)
            company_context: Research data about the company
            seller_context: What the seller offers
            language: Output language code
            user_provided_context: User-provided LinkedIn info (about, experience, notes)
            
        Returns:
            Analysis dict with all insights
        """
        # Build the analysis prompt
        prompt = self._build_analysis_prompt(
            contact_name,
            contact_role,
            linkedin_url,
            company_context,
            seller_context,
            language,
            user_provided_context
        )
        
        try:
            # Build API call - ALWAYS enable web search for alternative sources
            api_params = {
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 3000,
                "temperature": 0.3,
                "messages": [{
                    "role": "user",
                    "content": prompt
                }],
                # Always enable web search to find info from alternative sources
                # (company websites, news, conferences, podcasts, etc.)
                "tools": [
                    {
                        "type": "web_search_20250305",
                        "name": "web_search",
                        "max_uses": 5  # Allow multiple searches for thorough research
                    }
                ]
            }
            
            has_user_info = bool(user_provided_context)
            logger.info(f"[CONTACT_ANALYZER] Analyzing {contact_name} - user-provided info: {has_user_info}")
            
            response = self.client.messages.create(**api_params)
            
            # Extract text from response (may have multiple content blocks with web search)
            analysis_text = ""
            for block in response.content:
                if hasattr(block, 'text'):
                    analysis_text += block.text
            
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
        seller_context: Dict[str, Any],
        language: str = DEFAULT_LANGUAGE,
        user_provided_context: Optional[Dict[str, str]] = None
    ) -> str:
        """Build the prompt for contact analysis."""
        lang_instruction = get_language_instruction(language)
        company_name = company_context.get("company_name", "Unknown") if company_context else "Unknown"
        
        # Company context section
        company_section = ""
        if company_context:
            industry = company_context.get("industry", "")
            brief = company_context.get("brief_content", "")[:2000] if company_context.get("brief_content") else ""
            
            company_section = f"""
## COMPANY CONTEXT
**Company**: {company_name}
**Industry**: {industry}

**Research summary**:
{brief}
"""
        
        # Seller context section
        seller_section = ""
        if seller_context and seller_context.get("has_context"):
            products = ", ".join(seller_context.get("products_services", [])[:5]) or "Not specified"
            values = ", ".join(seller_context.get("value_propositions", [])[:3]) or "Not specified"
            target = seller_context.get("target_market", "Not specified")
            
            seller_section = f"""
## WHAT THE SELLER OFFERS
**Company**: {seller_context.get('company_name', 'Unknown')}
**Products/Services**: {products}
**Value Propositions**: {values}
**Target Market**: {target}
"""
        
        # User-provided LinkedIn info section
        user_info_section = ""
        if user_provided_context:
            user_info_section = "\n## USER-PROVIDED PROFILE INFORMATION\n"
            if user_provided_context.get("about"):
                user_info_section += f"""
### LinkedIn About/Summary:
{user_provided_context.get('about')}
"""
            if user_provided_context.get("experience"):
                user_info_section += f"""
### Experience/Background:
{user_provided_context.get('experience')}
"""
            if user_provided_context.get("notes"):
                user_info_section += f"""
### Additional Notes:
{user_provided_context.get('notes')}
"""
            user_info_section += "\n**This is verified information directly from their profile. Use it as the primary source.**\n"
        
        # Research instruction - ALWAYS search for alternative sources
        research_instruction = f"""
## RESEARCH TASK

Use web search to find information about {contact_name}:

**IMPORTANT: LinkedIn profiles are mostly inaccessible. Search these ALTERNATIVE SOURCES instead:**

1. **Company website**: Search "{company_name} team" or "{company_name} about us" or "{company_name} leadership"
2. **News & press**: Search "{contact_name} {company_name}" for news articles, press releases, interviews
3. **Conference/events**: Search "{contact_name} speaker" or "{contact_name} conference" or "{contact_name} webinar"
4. **Podcasts**: Search "{contact_name} podcast" or "{contact_name} interview"
5. **Industry publications**: Search in relevant trade publications
6. **GitHub/technical**: For tech roles, search "{contact_name} github" or "{contact_name} developer"
7. **Twitter/X**: Search for their professional social media presence

**What to look for:**
- Career background and achievements
- Published articles or thought leadership
- Speaking engagements or podcast appearances
- Quotes in news articles
- Professional interests and expertise areas
- Communication style from public content
- Recent news or announcements

**LinkedIn URL for reference** (if available): {linkedin_url or 'Not provided'}
"""
        
        prompt = f"""You are a sales research assistant analyzing contact persons for personalized sales conversations. {lang_instruction}

{company_section}

{seller_section}
{user_info_section}
{research_instruction}

## CONTACT PERSON TO ANALYZE
**Name**: {contact_name}
**Role**: {contact_role or 'Not specified'}

---

Provide a comprehensive analysis with EXACTLY these sections:

## 1. PROFILE SUMMARY
- Career background (if available)
- Current responsibilities based on role
- Areas of expertise
- Education/certifications (if available)

## 2. COMMUNICATION STYLE
Choose AND justify one of:
- **Formal**: Business tone, titles important, structured communication
- **Informal**: Casual, first-name basis, direct approach
- **Technical**: Detail-oriented, data-driven, wants specs and proof
- **Strategic**: Big-picture thinker, ROI-focused, wants business impact

## 3. DECISION AUTHORITY
Classify AND justify:
- **Decision Maker**: Has budget and final decision authority
- **Influencer**: Influences decision, no final say
- **Gatekeeper**: Controls access to decision makers
- **User**: End user, no decision authority

## 4. PROBABLE DRIVERS
What likely motivates this person? Choose 1-2:
- **Making progress**: Wants to innovate, modernize, stay ahead
- **Solving problems**: Wants to fix something that's not working
- **Standing out**: Wants to perform, gain recognition, advance career
- **Avoiding risk**: Wants stability, no hassle, safe choices

Support with concrete signals (if available).

## 5. ROLE-SPECIFIC PAIN POINTS
What problems does someone in this role typically have?
- List 3-5 specific pain points
- Connect to what the seller offers: {", ".join(seller_context.get("products_services", [])[:3]) if seller_context else "not specified"}

## 6. CONVERSATION ADVICE

### Approach
How to best approach this person (1-2 sentences)

### Opening Lines
Provide EXACTLY 3 concrete opening lines you can use:
1. [Line based on their role/responsibilities]
2. [Line based on company situation or news]
3. [Line based on what the seller can offer]

### Discovery Questions
Provide EXACTLY 5 smart questions to uncover needs:
1. [Question about current situation]
2. [Question about pain points]
3. [Question about decision process]
4. [Question about timing/urgency]
5. [Question about success criteria]

### Things to Avoid
What should you NOT do with this person? (2-3 points)

---

Be concrete and actionable. No vague generalities."""

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


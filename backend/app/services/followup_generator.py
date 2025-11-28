"""
Follow-up Generator Service

Generates meeting summaries, action items, and follow-up emails
using AI based on transcription and FULL context including:
- Sales/Company profile narratives
- Research data (company info, key people, news)
- Meeting preparation (talking points, questions, strategy)
- Previous follow-ups
- Knowledge base (case studies, product info)
"""

import os
import json
import logging
from typing import Dict, Any, Optional, List
from anthropic import Anthropic

logger = logging.getLogger(__name__)


class FollowupGenerator:
    """Service for generating follow-up content from meeting transcriptions"""
    
    def __init__(self):
        self.client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        self.model = "claude-sonnet-4-20250514"
    
    async def generate_summary(
        self,
        transcription: str,
        prospect_context: Optional[Dict[str, Any]] = None,
        include_coaching: bool = False,  # NEW: opt-in coaching feedback
        # Legacy params for backwards compatibility
        meeting_prep_context: Optional[str] = None,
        profile_context: Optional[str] = None,
        prospect_company: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate a structured summary from meeting transcription
        
        Args:
            transcription: Full meeting transcription
            meeting_prep_context: Context from meeting prep (if linked)
            profile_context: Sales rep and company profile context
            prospect_company: Name of prospect company
            
        Returns:
            Dict with summary sections
        """
        
        prompt = self._build_summary_prompt(
            transcription,
            prospect_context=prospect_context,
            include_coaching=include_coaching,
            # Legacy fallback
            meeting_prep_context=meeting_prep_context,
            profile_context=profile_context,
            prospect_company=prospect_company
        )
        
        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4000,
                messages=[{"role": "user", "content": prompt}]
            )
            
            content = response.content[0].text
            return self._parse_summary_response(content)
            
        except Exception as e:
            logger.error(f"Error generating summary: {e}")
            raise
    
    async def extract_action_items(
        self,
        transcription: str,
        summary: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Extract action items from meeting transcription
        
        Args:
            transcription: Full meeting transcription
            summary: Optional summary for additional context
            
        Returns:
            List of action items with task, assignee, due_date, priority
        """
        
        prompt = f"""Analyseer deze meeting transcriptie en extraheer alle actie-items.

TRANSCRIPTIE:
{transcription[:8000]}

{f"SAMENVATTING: {summary}" if summary else ""}

Identificeer voor elk actie-item:
- task: Wat moet er gedaan worden
- assignee: Wie is verantwoordelijk (als genoemd, anders "TBD")
- due_date: Deadline (als genoemd, anders null)
- priority: high/medium/low (gebaseerd op urgentie in gesprek)

Retourneer ALLEEN een JSON array, geen andere tekst:
[
  {{"task": "...", "assignee": "...", "due_date": "...", "priority": "..."}}
]

Als er geen actie-items zijn, retourneer een lege array: []"""

        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=2000,
                messages=[{"role": "user", "content": prompt}]
            )
            
            content = response.content[0].text.strip()
            
            # Parse JSON response
            # Find JSON array in response
            start_idx = content.find("[")
            end_idx = content.rfind("]") + 1
            
            if start_idx != -1 and end_idx > start_idx:
                json_str = content[start_idx:end_idx]
                return json.loads(json_str)
            
            return []
            
        except Exception as e:
            logger.error(f"Error extracting action items: {e}")
            return []
    
    async def generate_email_draft(
        self,
        summary: Dict[str, Any],
        action_items: List[Dict[str, Any]],
        prospect_context: Optional[Dict[str, Any]] = None,
        # Legacy params for backwards compatibility
        profile_context: Optional[str] = None,
        prospect_company: Optional[str] = None,
        tone: str = "professional"
    ) -> str:
        """
        Generate a follow-up email draft
        
        Args:
            summary: Meeting summary dict
            action_items: List of action items
            profile_context: Sales rep profile for personalization
            prospect_company: Name of prospect company
            tone: Email tone (professional, casual, formal)
            
        Returns:
            Email draft text
        """
        
        prompt = self._build_email_prompt(
            summary,
            action_items,
            prospect_context=prospect_context,
            profile_context=profile_context,
            prospect_company=prospect_company,
            tone=tone
        )
        
        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=2000,
                messages=[{"role": "user", "content": prompt}]
            )
            
            return response.content[0].text.strip()
            
        except Exception as e:
            logger.error(f"Error generating email: {e}")
            raise
    
    def _build_summary_prompt(
        self,
        transcription: str,
        prospect_context: Optional[Dict[str, Any]] = None,
        include_coaching: bool = False,
        meeting_prep_context: Optional[str] = None,
        profile_context: Optional[str] = None,
        prospect_company: Optional[str] = None
    ) -> str:
        """Build the summary generation prompt with full context"""
        
        prompt = """Je bent een expert sales analist die een meeting transcriptie analyseert.
Je hebt toegang tot uitgebreide context over de sales rep, het bedrijf, de prospect, en voorbereiding.
Gebruik deze context om een diepgaande, gepersonaliseerde analyse te maken.

"""
        
        # Use new unified context if available
        if prospect_context:
            # Prospect company name
            company_name = prospect_context.get("prospect_company", prospect_company or "Onbekend")
            prompt += f"## PROSPECT BEDRIJF: {company_name}\n\n"
            
            # Sales Profile with narrative
            if prospect_context.get("sales_profile"):
                sales = prospect_context["sales_profile"]
                if sales.get("sales_narrative"):
                    prompt += f"""## OVER JOU (DE SALES REP):
{sales['sales_narrative'][:1000]}

"""
                else:
                    prompt += f"""## OVER JOU:
- Naam: {sales.get('full_name', 'N/A')}
- Stijl: {sales.get('sales_methodology', 'N/A')}

"""
            
            # Company Profile with narrative
            if prospect_context.get("company_profile"):
                company = prospect_context["company_profile"]
                if company.get("company_narrative"):
                    prompt += f"""## JE BEDRIJF:
{company['company_narrative'][:1000]}

"""
            
            # Research data - IMPORTANT for context
            if prospect_context.get("research"):
                research = prospect_context["research"]
                prompt += f"""## RESEARCH OVER DE PROSPECT:
**Bedrijfsinformatie:**
{research.get('brief_content', research.get('company_data', 'Niet beschikbaar'))[:1500]}

**Key People:**
{research.get('key_people', 'Niet beschikbaar')[:500]}

**Recent Nieuws:**
{research.get('recent_news', 'Niet beschikbaar')[:500]}

"""
            
            # Meeting Prep - what was prepared
            if prospect_context.get("meeting_preps"):
                prep = prospect_context["meeting_preps"][0]
                questions = prep.get("questions", [])
                questions_text = "\n".join([f"- {q}" for q in questions[:10]]) if questions else "Geen vragen voorbereid"
                
                prompt += f"""## MEETING VOORBEREIDING:
**Type meeting:** {prep.get('meeting_type', 'N/A')}

**Talking Points die je wilde bespreken:**
{prep.get('talking_points', 'Niet beschikbaar')[:500]}

**Vragen die je wilde stellen:**
{questions_text}

**Strategie:**
{prep.get('strategy', 'Niet beschikbaar')[:500]}

Analyseer of deze punten zijn besproken en de vragen beantwoord.

"""
            
            # Previous followups
            if prospect_context.get("previous_followups"):
                prev = prospect_context["previous_followups"][0]
                prompt += f"""## VORIGE MEETING MET DEZE PROSPECT:
**Samenvatting:** {prev.get('executive_summary', 'N/A')[:500]}

**Open actiepunten van vorige keer:**
{chr(10).join(['- ' + item.get('task', '') for item in prev.get('action_items', [])[:5]])}

Check of deze actiepunten zijn opgevolgd.

"""
            
            # KB chunks - case studies etc
            if prospect_context.get("kb_chunks"):
                kb_text = "\n".join([
                    f"- {chunk.get('source', 'Doc')}: {chunk.get('text', '')[:150]}..."
                    for chunk in prospect_context["kb_chunks"][:3]
                ])
                prompt += f"""## RELEVANTE BEDRIJFSINFORMATIE (Case studies/producten):
{kb_text}

"""
        else:
            # Legacy fallback - use old params
            if prospect_company:
                prompt += f"PROSPECT BEDRIJF: {prospect_company}\n\n"
            
            if meeting_prep_context:
                prompt += f"""MEETING PREP CONTEXT (doelen en voorbereiding):
{meeting_prep_context}

"""
            
            if profile_context:
                prompt += f"""SALES PROFIEL CONTEXT:
{profile_context}

"""
        
        prompt += f"""## MEETING TRANSCRIPTIE:
{transcription[:12000]}

---

Genereer een gestructureerde samenvatting met EXACT deze secties:

## Executive Summary
[2-3 zinnen die de essentie van de meeting vatten, refereer naar de context die je hebt]

## Key Discussion Points
- [Belangrijkste besproken onderwerpen als bullet points]

## Client Concerns
- [Bezwaren, zorgen of vragen van de klant - vergelijk met research insights]

## Decisions Made
- [Beslissingen die tijdens de meeting zijn genomen]

## Next Steps
- [Afgesproken vervolgstappen]

## Prep Evaluation
- [Welke voorbereide punten zijn besproken? Welke vragen beantwoord?]
- [Wat is niet aan bod gekomen maar nog relevant?]

## 💰 Commerciële Signalen

### Koopsignalen (BANT)
- **Budget**: [Zijn er indicaties van beschikbaar budget? Wat werd gezegd?]
- **Authority**: [Is deze persoon de beslisser? Wie moet er nog meer beslissen?]
- **Need**: [Hoe urgent is de behoefte? Urgentiescore 1-10]
- **Timeline**: [Is er een gewenste implementatiedatum genoemd?]

### Cross-sell & Upsell Kansen
- [Andere producten/diensten die relevant zijn op basis van het gesprek]
- [Mogelijkheden om scope uit te breiden]

### Deal Risico's
- [Bezwaren die zijn geuit]
- [Concurrenten die zijn genoemd]
- [Twijfels of vertragingssignalen]

## 🔎 Observaties & Signalen

### ⚠️ Twijfel Gedetecteerd
- [Waar aarzelde de klant? Bij welk onderwerp?]
- [Welke vragen werden ontweken of vaag beantwoord?]

### 💡 Onuitgesproken Behoeften
- [Wat werd niet gezegd maar speelt waarschijnlijk wel?]
- [Achterliggende problemen die je hebt waargenomen]

### 🎯 Vervolgkansen
- [Workshop, demo, pilot mogelijkheden]
- [Andere stakeholders om te betrekken]

### 🚩 Rode Vlaggen
- [Signalen van desinteresse of weerstand]
- [Zaken die zorgen baren]

## Sales Insights
- [Samenvattende inzichten voor sales follow-up]
- [Hoe past dit bij wat je in research hebt gevonden?]
- [Aanbevelingen voor volgende stappen gebaseerd op alle context]
"""

        # Add coaching section if requested
        if include_coaching:
            prompt += """

## 📈 Coaching Feedback

### ✅ Wat Ging Goed
- [Effectieve gesprekstechnieken die de verkoper gebruikte]
- [Sterke vaardigheden die werden getoond]
- [Goede vragen die werden gesteld]

### 🔧 Verbeterpunten
- [Gemiste kansen in het gesprek]
- [Vragen die niet gesteld werden maar relevant waren]
- [Momenten waar dieper doorgevraagd had kunnen worden]

### 💡 Tips voor Volgende Keer
- [Concrete, actionable suggesties voor verbetering]
- [Focus op 1-2 specifieke verbeterpunten]
"""

        prompt += """

Schrijf in het Nederlands. Focus op actionable insights en gebruik de volledige context die je hebt.
Wees eerlijk maar constructief in je analyse."""

        return prompt
    
    def _parse_summary_response(self, content: str) -> Dict[str, Any]:
        """Parse the summary response into structured sections"""
        
        sections = {
            "executive_summary": "",
            "key_points": [],
            "concerns": [],
            "decisions": [],
            "next_steps": [],
            "sales_insights": [],
            # NEW: Enhanced sections
            "commercial_signals": {},
            "observations": {},
            "coaching_feedback": {},
            "full_content": content  # Store full markdown for display
        }
        
        current_section = None
        current_content = []
        
        # Parse commercial signals
        commercial_signals = {
            "koopsignalen": [],
            "cross_sell": [],
            "risks": []
        }
        
        # Parse observations
        observations = {
            "doubts": [],
            "unspoken_needs": [],
            "opportunities": [],
            "red_flags": []
        }
        
        # Parse coaching
        coaching_feedback = {
            "strengths": [],
            "improvements": [],
            "tips": []
        }
        
        in_commercial = False
        in_observations = False
        in_coaching = False
        commercial_subsection = None
        observations_subsection = None
        coaching_subsection = None
        
        for line in content.split("\n"):
            line_stripped = line.strip()
            
            # Check for main section headers
            if "## Executive Summary" in line or "## Samenvatting" in line:
                current_section = "executive_summary"
                current_content = []
                in_commercial = False
                in_observations = False
                in_coaching = False
            elif "## Key Discussion" in line or "## Belangrijkste" in line:
                if current_section == "executive_summary":
                    sections["executive_summary"] = " ".join(current_content).strip()
                current_section = "key_points"
                current_content = []
            elif "## Client Concerns" in line or "## Bezwaren" in line or "## Zorgen" in line:
                current_section = "concerns"
            elif "## Decisions" in line or "## Beslissingen" in line:
                current_section = "decisions"
            elif "## Next Steps" in line or "## Vervolgstappen" in line:
                current_section = "next_steps"
            elif "## 💰 Commerciële Signalen" in line or "## Commerciële Signalen" in line:
                in_commercial = True
                in_observations = False
                in_coaching = False
                current_section = None
            elif "## 🔎 Observaties" in line or "## Observaties" in line:
                in_commercial = False
                in_observations = True
                in_coaching = False
                current_section = None
            elif "## 📈 Coaching" in line or "## Coaching Feedback" in line:
                in_commercial = False
                in_observations = False
                in_coaching = True
                current_section = None
            elif "## Sales Insights" in line or "## Sales" in line:
                current_section = "sales_insights"
                in_commercial = False
                in_observations = False
                in_coaching = False
            
            # Parse commercial subsections
            elif in_commercial:
                if "### Koopsignalen" in line or "**Budget**" in line_stripped:
                    commercial_subsection = "koopsignalen"
                elif "### Cross-sell" in line or "### Upsell" in line:
                    commercial_subsection = "cross_sell"
                elif "### Deal Risico" in line or "### Risico" in line:
                    commercial_subsection = "risks"
                elif line_stripped.startswith("-") and commercial_subsection:
                    item = line_stripped.lstrip("- ").strip()
                    if item:
                        commercial_signals[commercial_subsection].append(item)
                elif line_stripped.startswith("**") and commercial_subsection == "koopsignalen":
                    commercial_signals["koopsignalen"].append(line_stripped)
            
            # Parse observations subsections
            elif in_observations:
                if "### ⚠️ Twijfel" in line or "### Twijfel" in line:
                    observations_subsection = "doubts"
                elif "### 💡 Onuitgesproken" in line or "### Onuitgesproken" in line:
                    observations_subsection = "unspoken_needs"
                elif "### 🎯 Vervolg" in line or "### Kansen" in line:
                    observations_subsection = "opportunities"
                elif "### 🚩 Rode" in line or "### Rode Vlaggen" in line:
                    observations_subsection = "red_flags"
                elif line_stripped.startswith("-") and observations_subsection:
                    item = line_stripped.lstrip("- ").strip()
                    if item:
                        observations[observations_subsection].append(item)
            
            # Parse coaching subsections
            elif in_coaching:
                if "### ✅ Wat Ging Goed" in line or "### Wat Ging Goed" in line:
                    coaching_subsection = "strengths"
                elif "### 🔧 Verbeterpunten" in line or "### Verbeterpunten" in line:
                    coaching_subsection = "improvements"
                elif "### 💡 Tips" in line or "### Tips" in line:
                    coaching_subsection = "tips"
                elif line_stripped.startswith("-") and coaching_subsection:
                    item = line_stripped.lstrip("- ").strip()
                    if item:
                        coaching_feedback[coaching_subsection].append(item)
            
            # Regular section parsing
            elif line_stripped:
                if current_section == "executive_summary":
                    current_content.append(line_stripped)
                elif current_section and line_stripped.startswith("-"):
                    item = line_stripped.lstrip("- ").strip()
                    if item:
                        sections[current_section].append(item)
                elif current_section and current_section != "executive_summary":
                    if line_stripped and not line_stripped.startswith("#"):
                        sections[current_section].append(line_stripped)
        
        # Handle last section if executive_summary
        if current_section == "executive_summary" and current_content:
            sections["executive_summary"] = " ".join(current_content).strip()
        
        # Add parsed enhanced sections
        sections["commercial_signals"] = commercial_signals
        sections["observations"] = observations
        sections["coaching_feedback"] = coaching_feedback
        
        return sections
    
    def _build_email_prompt(
        self,
        summary: Dict[str, Any],
        action_items: List[Dict[str, Any]],
        prospect_context: Optional[Dict[str, Any]] = None,
        profile_context: Optional[str] = None,
        prospect_company: Optional[str] = None,
        tone: str = "professional"
    ) -> str:
        """Build the email generation prompt with full context"""
        
        tone_instructions = {
            "professional": "Schrijf professioneel maar warm en persoonlijk.",
            "casual": "Schrijf informeel en vriendelijk, alsof je een bekende mailt.",
            "formal": "Schrijf formeel en zakelijk.",
            "consultative": "Schrijf als een trusted advisor die waarde wil toevoegen."
        }
        
        prompt = f"""Je bent een sales professional die een follow-up email schrijft na een meeting.
Je hebt toegang tot uitgebreide context - gebruik dit voor een gepersonaliseerde, relevante email.

"""
        
        # Use new unified context if available
        if prospect_context:
            company_name = prospect_context.get("prospect_company", prospect_company or "de prospect")
            prompt += f"PROSPECT: {company_name}\n\n"
            
            # Sales profile for personalization
            if prospect_context.get("sales_profile"):
                sales = prospect_context["sales_profile"]
                prompt += f"""OVER JOU:
- Naam: {sales.get('full_name', 'N/A')}
- Communicatiestijl: {sales.get('communication_style', 'professional')}
- Sales methodologie: {sales.get('sales_methodology', 'consultative')}

"""
            
            # Company info for value props
            if prospect_context.get("company_profile"):
                company = prospect_context["company_profile"]
                prompt += f"""JE BEDRIJF:
- Bedrijf: {company.get('company_name', 'N/A')}
- Value props: {', '.join(company.get('value_propositions', [])[:3])}

"""
            
            # Research for personalization
            if prospect_context.get("research"):
                research = prospect_context["research"]
                prompt += f"""PROSPECT CONTEXT (uit research):
{research.get('brief_content', '')[:500]}

"""
            
            # KB for case studies to mention
            if prospect_context.get("kb_chunks"):
                kb_mentions = [chunk.get('source', '') for chunk in prospect_context["kb_chunks"][:2]]
                if kb_mentions:
                    prompt += f"""RELEVANTE MATERIALEN OM TE DELEN:
{', '.join(kb_mentions)}

"""
        else:
            # Legacy fallback
            if prospect_company:
                prompt += f"PROSPECT: {prospect_company}\n\n"
            
            if profile_context:
                prompt += f"""JOUW PROFIEL (voor personalisatie):
{profile_context}

"""
        
        prompt += f"""MEETING SAMENVATTING:
{summary.get('executive_summary', 'Geen samenvatting beschikbaar')}

KEY POINTS:
{chr(10).join('- ' + p for p in summary.get('key_points', [])[:5])}

NEXT STEPS:
{chr(10).join('- ' + s for s in summary.get('next_steps', [])[:5])}

ACTIE-ITEMS:
{chr(10).join('- ' + item.get('task', '') for item in action_items[:5])}

TONE: {tone_instructions.get(tone, tone_instructions['professional'])}

---

BELANGRIJK: Schrijf de email vanuit CUSTOMER-CENTRIC PERSPECTIEF.

Dit betekent:
- Begin met erkenning van HUN situatie, niet "bedankt voor je tijd"
- Focus op wat relevant is voor DE KLANT, niet voor jou als verkoper
- Vervolgstappen koppelen aan KLANT belang ("Dit sluit aan bij jullie wens om...")
- Geen verkooptaal of intern jargon
- Professioneel maar menselijk en toegankelijk

STRUCTUUR:
1. Opening: erkenning van gesprek en hun situatie/uitdaging
2. Kern: hun prioriteiten en hoe dat aansluit (niet: wat wij verkopen)
3. Vervolgstap: concreet, gekoppeld aan hun doel
4. Afsluiting: uitnodiging tot reactie

VOORBEELD OPENING (niet letterlijk overnemen):
"Goed dat we vandaag de tijd hebben genomen om te bespreken hoe [hun uitdaging] 
aangepakt kan worden. Wat mij opviel uit ons gesprek: [hun prioriteiten]."

VERMIJD:
- "Bedankt voor je tijd" als opening
- Te veel nadruk op jouw producten/diensten
- Lange opsommingen van features
- Jargon of afkortingen

Begin direct met de email (geen "Hier is de email:" of dergelijke intro).
Gebruik [NAAM] als placeholder voor de ontvanger naam.
Schrijf in het Nederlands."""

        return prompt


# Lazy singleton
_followup_generator: Optional[FollowupGenerator] = None

def get_followup_generator() -> FollowupGenerator:
    """Get or create followup generator instance"""
    global _followup_generator
    if _followup_generator is None:
        _followup_generator = FollowupGenerator()
    return _followup_generator


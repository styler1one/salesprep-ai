"""
Follow-up Generator Service

Generates meeting summaries, action items, and follow-up emails
using AI based on transcription and context.
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
            meeting_prep_context,
            profile_context,
            prospect_company
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
            profile_context,
            prospect_company,
            tone
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
        meeting_prep_context: Optional[str],
        profile_context: Optional[str],
        prospect_company: Optional[str]
    ) -> str:
        """Build the summary generation prompt"""
        
        prompt = """Je bent een expert sales analist die een meeting transcriptie analyseert.
Genereer een uitgebreide, gestructureerde samenvatting.

"""
        
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
        
        prompt += f"""MEETING TRANSCRIPTIE:
{transcription[:12000]}

Genereer een gestructureerde samenvatting met EXACT deze secties:

## Executive Summary
[2-3 zinnen die de essentie van de meeting vatten]

## Key Discussion Points
- [Belangrijkste besproken onderwerpen als bullet points]

## Client Concerns
- [Bezwaren, zorgen of vragen van de klant]

## Decisions Made
- [Beslissingen die tijdens de meeting zijn genomen]

## Next Steps
- [Afgesproken vervolgstappen]

## Sales Insights
- [Inzichten voor sales follow-up: koopsignalen, bezwaren, timing, etc.]

Schrijf in het Nederlands. Focus op actionable insights."""

        return prompt
    
    def _parse_summary_response(self, content: str) -> Dict[str, Any]:
        """Parse the summary response into structured sections"""
        
        sections = {
            "executive_summary": "",
            "key_points": [],
            "concerns": [],
            "decisions": [],
            "next_steps": [],
            "sales_insights": []
        }
        
        current_section = None
        current_content = []
        
        for line in content.split("\n"):
            line = line.strip()
            
            # Check for section headers
            if "## Executive Summary" in line or "## Samenvatting" in line:
                current_section = "executive_summary"
                current_content = []
            elif "## Key Discussion" in line or "## Belangrijkste" in line:
                if current_section == "executive_summary":
                    sections["executive_summary"] = " ".join(current_content).strip()
                current_section = "key_points"
                current_content = []
            elif "## Client Concerns" in line or "## Bezwaren" in line or "## Zorgen" in line:
                current_section = "concerns"
                current_content = []
            elif "## Decisions" in line or "## Beslissingen" in line:
                current_section = "decisions"
                current_content = []
            elif "## Next Steps" in line or "## Vervolgstappen" in line:
                current_section = "next_steps"
                current_content = []
            elif "## Sales Insights" in line or "## Sales" in line:
                current_section = "sales_insights"
                current_content = []
            elif line:
                # Add content to current section
                if current_section == "executive_summary":
                    current_content.append(line)
                elif current_section and line.startswith("-"):
                    # Bullet point
                    item = line.lstrip("- ").strip()
                    if item:
                        sections[current_section].append(item)
                elif current_section and current_section != "executive_summary":
                    # Non-bullet content in list section
                    if line and not line.startswith("#"):
                        sections[current_section].append(line)
        
        # Handle last section if executive_summary
        if current_section == "executive_summary" and current_content:
            sections["executive_summary"] = " ".join(current_content).strip()
        
        return sections
    
    def _build_email_prompt(
        self,
        summary: Dict[str, Any],
        action_items: List[Dict[str, Any]],
        profile_context: Optional[str],
        prospect_company: Optional[str],
        tone: str
    ) -> str:
        """Build the email generation prompt"""
        
        tone_instructions = {
            "professional": "Schrijf professioneel maar warm en persoonlijk.",
            "casual": "Schrijf informeel en vriendelijk, alsof je een bekende mailt.",
            "formal": "Schrijf formeel en zakelijk.",
            "consultative": "Schrijf als een trusted advisor die waarde wil toevoegen."
        }
        
        prompt = f"""Je bent een sales professional die een follow-up email schrijft na een meeting.

"""
        
        if prospect_company:
            prompt += f"PROSPECT: {prospect_company}\n\n"
        
        prompt += f"""MEETING SAMENVATTING:
{summary.get('executive_summary', 'Geen samenvatting beschikbaar')}

KEY POINTS:
{chr(10).join('- ' + p for p in summary.get('key_points', [])[:5])}

NEXT STEPS:
{chr(10).join('- ' + s for s in summary.get('next_steps', [])[:5])}

ACTIE-ITEMS:
{chr(10).join('- ' + item.get('task', '') for item in action_items[:5])}

"""
        
        if profile_context:
            prompt += f"""JOUW PROFIEL (voor personalisatie):
{profile_context}

"""
        
        prompt += f"""TONE: {tone_instructions.get(tone, tone_instructions['professional'])}

Schrijf een follow-up email die:
1. Bedankt voor hun tijd
2. De belangrijkste punten kort samenvat
3. De actie-items en vervolgstappen bevestigt
4. Eventueel een volgende meeting voorstelt
5. Professioneel en persoonlijk is

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


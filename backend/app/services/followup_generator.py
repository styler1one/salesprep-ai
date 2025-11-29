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
from app.i18n.utils import get_language_instruction
from app.i18n.config import DEFAULT_LANGUAGE

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
        language: str = DEFAULT_LANGUAGE,  # i18n: output language
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
            language=language,
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
        summary: Optional[str] = None,
        language: str = DEFAULT_LANGUAGE
    ) -> List[Dict[str, Any]]:
        """
        Extract action items from meeting transcription
        
        Args:
            transcription: Full meeting transcription
            summary: Optional summary for additional context
            
        Returns:
            List of action items with task, assignee, due_date, priority
        """
        
        lang_instruction = get_language_instruction(language)
        
        prompt = f"""Analyze this meeting transcription and extract all action items.

TRANSCRIPTION:
{transcription[:8000]}

{f"SUMMARY: {summary}" if summary else ""}

For each action item, identify:
- task: What needs to be done
- assignee: Who is responsible (if mentioned, otherwise "TBD")
- due_date: Deadline (if mentioned, otherwise null)
- priority: high/medium/low (based on urgency in conversation)

Return ONLY a JSON array, no other text:
[
  {{"task": "...", "assignee": "...", "due_date": "...", "priority": "..."}}
]

If there are no action items, return an empty array: []

{lang_instruction}"""

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
        language: str = DEFAULT_LANGUAGE,  # i18n: output language
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
            language=language,
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
        language: str = DEFAULT_LANGUAGE,
        meeting_prep_context: Optional[str] = None,
        profile_context: Optional[str] = None,
        prospect_company: Optional[str] = None
    ) -> str:
        """Build the summary generation prompt with full context"""
        
        prompt = """You are an expert sales analyst analyzing a meeting transcription.
You have access to extensive context about the sales rep, the company, the prospect, and preparation.
Use this context to create an in-depth, personalized analysis.

"""
        
        # Use new unified context if available
        if prospect_context:
            # Prospect company name
            company_name = prospect_context.get("prospect_company", prospect_company or "Unknown")
            prompt += f"## PROSPECT COMPANY: {company_name}\n\n"
            
            # Sales Profile with narrative
            if prospect_context.get("sales_profile"):
                sales = prospect_context["sales_profile"]
                if sales.get("sales_narrative"):
                    prompt += f"""## ABOUT YOU (THE SALES REP):
{sales['sales_narrative'][:1000]}

"""
                else:
                    prompt += f"""## ABOUT YOU:
- Name: {sales.get('full_name', 'N/A')}
- Style: {sales.get('sales_methodology', 'N/A')}

"""
            
            # Company Profile with narrative
            if prospect_context.get("company_profile"):
                company = prospect_context["company_profile"]
                if company.get("company_narrative"):
                    prompt += f"""## YOUR COMPANY:
{company['company_narrative'][:1000]}

"""
            
            # Research data - IMPORTANT for context
            if prospect_context.get("research"):
                research = prospect_context["research"]
                prompt += f"""## RESEARCH ON THE PROSPECT:
**Company Information:**
{research.get('brief_content', research.get('company_data', 'Not available'))[:1500]}

**Key People:**
{research.get('key_people', 'Not available')[:500]}

**Recent News:**
{research.get('recent_news', 'Not available')[:500]}

"""
            
            # Meeting Prep - what was prepared
            if prospect_context.get("meeting_preps"):
                prep = prospect_context["meeting_preps"][0]
                questions = prep.get("questions", [])
                questions_text = "\n".join([f"- {q}" for q in questions[:10]]) if questions else "No questions prepared"
                
                prompt += f"""## MEETING PREPARATION:
**Meeting type:** {prep.get('meeting_type', 'N/A')}

**Talking Points you wanted to discuss:**
{prep.get('talking_points', 'Not available')[:500]}

**Questions you wanted to ask:**
{questions_text}

**Strategy:**
{prep.get('strategy', 'Not available')[:500]}

Analyze whether these points were discussed and questions answered.

"""
            
            # Previous followups
            if prospect_context.get("previous_followups"):
                prev = prospect_context["previous_followups"][0]
                prompt += f"""## PREVIOUS MEETING WITH THIS PROSPECT:
**Summary:** {prev.get('executive_summary', 'N/A')[:500]}

**Open action items from last time:**
{chr(10).join(['- ' + item.get('task', '') for item in prev.get('action_items', [])[:5]])}

Check if these action items were followed up.

"""
            
            # KB chunks - case studies etc
            if prospect_context.get("kb_chunks"):
                kb_text = "\n".join([
                    f"- {chunk.get('source', 'Doc')}: {chunk.get('text', '')[:150]}..."
                    for chunk in prospect_context["kb_chunks"][:3]
                ])
                prompt += f"""## RELEVANT COMPANY INFORMATION (Case studies/products):
{kb_text}

"""
        else:
            # Legacy fallback - use old params
            if prospect_company:
                prompt += f"PROSPECT COMPANY: {prospect_company}\n\n"
            
            if meeting_prep_context:
                prompt += f"""MEETING PREP CONTEXT (goals and preparation):
{meeting_prep_context}

"""
            
            if profile_context:
                prompt += f"""SALES PROFILE CONTEXT:
{profile_context}

"""
        
        prompt += f"""## MEETING TRANSCRIPTION:
{transcription[:12000]}

---

Generate a structured summary with EXACTLY these sections:

## Executive Summary
[2-3 sentences capturing the essence of the meeting, refer to the context you have]

## Key Discussion Points
- [Main topics discussed as bullet points]

## Client Concerns
- [Objections, concerns or questions from the client - compare with research insights]

## Decisions Made
- [Decisions made during the meeting]

## Next Steps
- [Agreed follow-up steps]

## Prep Evaluation
- [Which prepared points were discussed? Which questions answered?]
- [What wasn't covered but is still relevant?]

## 💰 Commercial Signals

### Buying Signals (BANT)
- **Budget**: [Are there indications of available budget? What was said?]
- **Authority**: [Is this person the decision maker? Who else needs to decide?]
- **Need**: [How urgent is the need? Urgency score 1-10]
- **Timeline**: [Was a desired implementation date mentioned?]

### Cross-sell & Upsell Opportunities
- [Other products/services relevant based on the conversation]
- [Opportunities to expand scope]

### Deal Risks
- [Objections raised]
- [Competitors mentioned]
- [Doubts or delay signals]

## 🔎 Observations & Signals

### ⚠️ Doubt Detected
- [Where did the client hesitate? On which topic?]
- [Which questions were avoided or vaguely answered?]

### 💡 Unspoken Needs
- [What wasn't said but probably matters?]
- [Underlying problems you observed]

### 🎯 Follow-up Opportunities
- [Workshop, demo, pilot possibilities]
- [Other stakeholders to involve]

### 🚩 Red Flags
- [Signs of disinterest or resistance]
- [Things that cause concern]

## Sales Insights
- [Summary insights for sales follow-up]
- [How does this fit with what you found in research?]
- [Recommendations for next steps based on all context]
"""

        # Add coaching section if requested
        if include_coaching:
            prompt += """

## 📈 Coaching Feedback

### ✅ What Went Well
- [Effective conversation techniques the seller used]
- [Strong skills demonstrated]
- [Good questions asked]

### 🔧 Areas for Improvement
- [Missed opportunities in the conversation]
- [Questions not asked but relevant]
- [Moments where deeper probing could have been done]

### 💡 Tips for Next Time
- [Concrete, actionable suggestions for improvement]
- [Focus on 1-2 specific improvement areas]
"""

        lang_instruction = get_language_instruction(language)
        prompt += f"""

{lang_instruction} Focus on actionable insights and use the full context available.
Be honest but constructive in your analysis."""

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
        language: str = DEFAULT_LANGUAGE,
        profile_context: Optional[str] = None,
        prospect_company: Optional[str] = None,
        tone: str = "professional"
    ) -> str:
        """Build the email generation prompt with full context"""
        
        # Tone instructions - these are guidance for the AI, not user-facing text
        tone_instructions = {
            "professional": "Write professionally but warm and personal.",
            "casual": "Write informally and friendly, as if emailing someone you know.",
            "formal": "Write formally and business-like.",
            "consultative": "Write as a trusted advisor who wants to add value."
        }
        
        prompt = f"""You are a sales professional writing a follow-up email after a meeting.
You have access to extensive context - use this for a personalized, relevant email.

"""
        
        # Use new unified context if available
        if prospect_context:
            company_name = prospect_context.get("prospect_company", prospect_company or "the prospect")
            prompt += f"PROSPECT: {company_name}\n\n"
            
            # Sales profile for personalization
            if prospect_context.get("sales_profile"):
                sales = prospect_context["sales_profile"]
                prompt += f"""ABOUT YOU:
- Name: {sales.get('full_name', 'N/A')}
- Communication style: {sales.get('communication_style', 'professional')}
- Sales methodology: {sales.get('sales_methodology', 'consultative')}

"""
            
            # Company info for value props
            if prospect_context.get("company_profile"):
                company = prospect_context["company_profile"]
                prompt += f"""YOUR COMPANY:
- Company: {company.get('company_name', 'N/A')}
- Value props: {', '.join(company.get('value_propositions', [])[:3])}

"""
            
            # Research for personalization
            if prospect_context.get("research"):
                research = prospect_context["research"]
                prompt += f"""PROSPECT CONTEXT (from research):
{research.get('brief_content', '')[:500]}

"""
            
            # KB for case studies to mention
            if prospect_context.get("kb_chunks"):
                kb_mentions = [chunk.get('source', '') for chunk in prospect_context["kb_chunks"][:2]]
                if kb_mentions:
                    prompt += f"""RELEVANT MATERIALS TO SHARE:
{', '.join(kb_mentions)}

"""
        else:
            # Legacy fallback
            if prospect_company:
                prompt += f"PROSPECT: {prospect_company}\n\n"
            
            if profile_context:
                prompt += f"""YOUR PROFILE (for personalization):
{profile_context}

"""
        
        prompt += f"""MEETING SUMMARY:
{summary.get('executive_summary', 'No summary available')}

KEY POINTS:
{chr(10).join('- ' + p for p in summary.get('key_points', [])[:5])}

NEXT STEPS:
{chr(10).join('- ' + s for s in summary.get('next_steps', [])[:5])}

ACTION ITEMS:
{chr(10).join('- ' + item.get('task', '') for item in action_items[:5])}

TONE: {tone_instructions.get(tone, tone_instructions['professional'])}

---

IMPORTANT: Write the email from a CUSTOMER-CENTRIC PERSPECTIVE.

This means:
- Start by acknowledging THEIR situation, not "thank you for your time"
- Focus on what's relevant for THE CLIENT, not for you as seller
- Link next steps to CLIENT benefit ("This aligns with your goal to...")
- No sales language or internal jargon
- Professional but human and accessible

STRUCTURE:
1. Opening: acknowledge the conversation and their situation/challenge
2. Core: their priorities and how this aligns (not: what we sell)
3. Next step: concrete, linked to their goal
4. Closing: invitation to respond

AVOID:
- "Thank you for your time" as opening
- Too much emphasis on your products/services
- Long lists of features
- Jargon or abbreviations

Start directly with the email (no "Here is the email:" or similar intro).
Use [NAME] as placeholder for the recipient name.
{get_language_instruction(language)}"""

        return prompt


# Lazy singleton
_followup_generator: Optional[FollowupGenerator] = None

def get_followup_generator() -> FollowupGenerator:
    """Get or create followup generator instance"""
    global _followup_generator
    if _followup_generator is None:
        _followup_generator = FollowupGenerator()
    return _followup_generator


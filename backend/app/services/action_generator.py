"""
Action Generator Service

Generates content for follow-up actions using Claude AI with full context.
"""

import os
import logging
from typing import Tuple, Dict, Any, Optional
from anthropic import Anthropic

from app.database import get_supabase_service
from app.models.followup_actions import ActionType
from app.i18n.utils import get_language_instruction

logger = logging.getLogger(__name__)


class ActionGeneratorService:
    """Service for generating follow-up action content using AI"""
    
    def __init__(self):
        self.client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        self.model = "claude-sonnet-4-20250514"
    
    async def generate(
        self,
        action_id: str,
        followup_id: str,
        action_type: ActionType,
        user_id: str,
        language: str,
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Generate content for an action.
        
        Returns: (content, metadata)
        """
        # Gather all context
        context = await self._gather_context(followup_id, user_id)
        
        # Get the appropriate prompt
        prompt = self._build_prompt(action_type, context, language)
        
        # Generate content
        content = await self._generate_with_claude(prompt)
        
        # Build metadata
        metadata = self._build_metadata(action_type, content, context)
        
        return content, metadata
    
    async def _gather_context(self, followup_id: str, user_id: str) -> Dict[str, Any]:
        """Gather all relevant context for generation"""
        supabase = get_supabase_service()
        context = {}
        
        try:
            # Get followup data
            followup_result = supabase.table("followups").select("*").eq("id", followup_id).execute()
            if followup_result.data:
                context["followup"] = followup_result.data[0]
            
            # Get organization_id from followup
            org_id = context.get("followup", {}).get("organization_id")
            
            # Get sales profile
            sales_result = supabase.table("sales_profiles").select("*").eq("user_id", user_id).execute()
            if sales_result.data:
                context["sales_profile"] = sales_result.data[0]
            
            # Get company profile
            if org_id:
                company_result = supabase.table("company_profiles").select("*").eq("organization_id", org_id).execute()
                if company_result.data:
                    context["company_profile"] = company_result.data[0]
            
            # Get prospect/company name from followup
            company_name = context.get("followup", {}).get("prospect_company_name")
            
            # Try to find research brief for this company
            if company_name and org_id:
                research_result = supabase.table("research_briefs").select("*").eq("organization_id", org_id).ilike("company_name", company_name).eq("status", "completed").order("created_at", desc=True).limit(1).execute()
                if research_result.data:
                    context["research_brief"] = research_result.data[0]
                    
                    # Get contacts via prospect_id from research_brief
                    prospect_id = research_result.data[0].get("prospect_id")
                    if prospect_id:
                        contacts_result = supabase.table("prospect_contacts").select("*").eq("prospect_id", prospect_id).execute()
                        if contacts_result.data:
                            context["contacts"] = contacts_result.data
            
            # Try to find preparation brief for this company
            if company_name and org_id:
                prep_result = supabase.table("meeting_preps").select("*").eq("organization_id", org_id).ilike("prospect_company_name", company_name).eq("status", "completed").order("created_at", desc=True).limit(1).execute()
                if prep_result.data:
                    context["preparation"] = prep_result.data[0]
            
            # Get deal if linked
            deal_id = context.get("followup", {}).get("deal_id")
            if deal_id:
                deal_result = supabase.table("deals").select("*").eq("id", deal_id).execute()
                if deal_result.data:
                    context["deal"] = deal_result.data[0]
            
        except Exception as e:
            logger.error(f"Error gathering context: {e}")
        
        return context
    
    def _build_prompt(self, action_type: ActionType, context: Dict[str, Any], language: str) -> str:
        """Build the prompt for the specific action type"""
        
        # Get language instruction using the standard i18n utility
        lang_instruction = get_language_instruction(language)
        
        # Build context section
        context_text = self._format_context(context)
        
        # Get action-specific prompt
        if action_type == ActionType.CUSTOMER_REPORT:
            return self._prompt_customer_report(context_text, lang_instruction, context)
        elif action_type == ActionType.SHARE_EMAIL:
            return self._prompt_share_email(context_text, lang_instruction, context)
        elif action_type == ActionType.COMMERCIAL_ANALYSIS:
            return self._prompt_commercial_analysis(context_text, lang_instruction, context)
        elif action_type == ActionType.SALES_COACHING:
            return self._prompt_sales_coaching(context_text, lang_instruction, context)
        elif action_type == ActionType.ACTION_ITEMS:
            return self._prompt_action_items(context_text, lang_instruction, context)
        elif action_type == ActionType.INTERNAL_REPORT:
            return self._prompt_internal_report(context_text, lang_instruction, context)
        elif action_type == ActionType.DEAL_UPDATE:
            return self._prompt_deal_update(context_text, lang_instruction, context)
        else:
            raise ValueError(f"Unknown action type: {action_type}")
    
    def _format_context(self, context: Dict[str, Any]) -> str:
        """Format context into a readable string for the prompt"""
        parts = []
        
        # Followup/Transcript
        followup = context.get("followup", {})
        if followup:
            parts.append(f"""
## Meeting Information
- Company: {followup.get('prospect_company_name', 'Unknown')}
- Date: {followup.get('meeting_date', 'Unknown')}
- Subject: {followup.get('meeting_subject', 'Unknown')}

## Meeting Summary
{followup.get('executive_summary', 'No summary available')}

## Transcript
{followup.get('transcription_text', 'No transcript available')[:8000]}
""")
        
        # Sales Profile
        sales = context.get("sales_profile", {})
        if sales:
            parts.append(f"""
## Sales Representative Profile
- Name: {sales.get('full_name', 'Unknown')}
- Role: {sales.get('job_title', 'Sales Representative')}
- Experience: {sales.get('years_experience', 'Unknown')} years
- Communication Style: {sales.get('communication_style', 'Professional')}
- Selling Style: {sales.get('selling_style', 'Consultative')}
""")
        
        # Company Profile
        company = context.get("company_profile", {})
        if company:
            parts.append(f"""
## Company Profile (Seller)
- Company: {company.get('company_name', 'Unknown')}
- Industry: {company.get('industry', 'Unknown')}
- Value Proposition: {company.get('value_proposition', 'Unknown')}
""")
        
        # Research Brief
        research = context.get("research_brief", {})
        if research:
            brief = research.get('brief_content', '')
            parts.append(f"""
## Prospect Research
{brief[:3000] if brief else 'No research available'}
""")
        
        # Contacts
        contacts = context.get("contacts", [])
        if contacts:
            contact_info = "\n".join([
                f"- {c.get('name', 'Unknown')}: {c.get('role', 'Unknown role')} - {c.get('communication_style', 'Unknown style')}"
                for c in contacts[:3]
            ])
            parts.append(f"""
## Key Contacts
{contact_info}
""")
        
        # Preparation
        prep = context.get("preparation", {})
        if prep:
            parts.append(f"""
## Meeting Preparation Notes
{prep.get('brief_content', 'No preparation notes')[:2000]}
""")
        
        # Deal
        deal = context.get("deal", {})
        if deal:
            parts.append(f"""
## Deal Information
- Deal Name: {deal.get('name', 'Unknown')}
- Stage: {deal.get('stage', 'Unknown')}
- Value: {deal.get('value', 'Unknown')}
""")
        
        return "\n".join(parts)
    
    def _prompt_customer_report(self, context_text: str, lang_instruction: str, context: Dict) -> str:
        """Prompt for customer report generation"""
        company_name = context.get("followup", {}).get("prospect_company_name", "the company")
        meeting_date = context.get("followup", {}).get("meeting_date", "Unknown date")
        meeting_subject = context.get("followup", {}).get("meeting_subject", "Meeting")
        
        # Get sales rep info
        sales_profile = context.get("sales_profile", {})
        sales_name = sales_profile.get("full_name", "Sales Representative")
        sales_email = sales_profile.get("email", "")
        sales_phone = sales_profile.get("phone", "")
        sales_title = sales_profile.get("job_title", "")
        
        # Get seller company info
        seller_company = context.get("company_profile", {}).get("company_name", "")
        
        # Get attendees from contacts
        contacts = context.get("contacts", [])
        attendee_names = [c.get("name", "") for c in contacts if c.get("name")]
        
        return f"""You are creating a customer-facing meeting report.

{lang_instruction}

Write in clear, strategic and warm language.
Use a diplomatic and psychologically sharp tone.
Always write from the customer's perspective.
Never use salesy language.
Never emphasize what the seller did.
Focus on the client's context, goals and momentum.

Purpose: The report must feel as if written by a senior consultant who deeply understands the customer's world and supports them in gaining clarity and moving toward confident decision making.

Length: Adapt the total number of words to the depth and length of the actual conversation (typically 500-800 words for a 30-min meeting, 800-1200 for 60-min).
Style: Flowing prose, no bullet point lists unless explicitly requested.

{context_text}

STRUCTURE & INSTRUCTIONS:

# Customer Report – {company_name}

**Date:** {meeting_date}
**Subject:** {meeting_subject}
**Attendees:** {', '.join(attendee_names) if attendee_names else '[List the attendees from the transcript]'}
**Location:** [Extract from context or write "Virtual meeting" if online]

---

## Introduction
- Begin with a brief, warm and mature reflection on the conversation.
- Acknowledge the customer's current situation and their ambitions.
- Highlight the central thread of the discussion in a way that keeps their perspective at the center.

## Where the Organisation Stands Now
- Describe the customer's context, challenges and priorities as they expressed them.
- Keep it factual, empathetic and without judgement.
- Subtly connect their current situation to what is strategically important for them going forward.

## What We Discussed
- Capture the essence of the meeting in logically structured themes.
- For each theme, articulate what it means for the customer.
- Use compact paragraphs. Avoid long enumerations.
- Include only information that genuinely helps the customer make progress.

## Implications for the Customer
- Explain what the discussed themes imply for their direction, choices or risks.
- Highlight opportunities, dependencies and considerations.
- Keep the tone advisory rather than directive. Diplomatic yet sharp.

## Agreements and Next Steps

Use this exact table format:

| Action | Owner | Timeline | Relevance for the Customer |
|--------|-------|----------|----------------------------|
| [action] | [owner] | [when] | [why this matters to them] |

## Forward View
- Outline a possible path forward that logically builds on the customer's own goals.
- Avoid pushiness. Be guiding, professional and constructive.
- End with an inviting, open sentence that reinforces trust and partnership.

---

**Report prepared by:**
{sales_name}{f', {sales_title}' if sales_title else ''}
{seller_company}
{f'Email: {sales_email}' if sales_email else ''}
{f'Phone: {sales_phone}' if sales_phone else ''}

**Report date:** [Today's date]

---

GENERAL RULES:
- Always prioritise clarity over completeness.
- Avoid internal jargon, technical noise or sales-heavy framing.
- Maintain a confident, empathetic senior-consultant tone.
- Position next steps as measures that strengthen the customer's progress, not your pipeline.
- Reference specific moments or quotes from the conversation to show genuine understanding.

Generate the complete Customer Report now:"""
    
    def _prompt_share_email(self, context_text: str, lang_instruction: str, context: Dict) -> str:
        """Prompt for share email generation"""
        contact_name = "there"
        contacts = context.get("contacts", [])
        if contacts:
            contact_name = contacts[0].get("name", "there")
        
        return f"""You are an expert at writing professional follow-up emails.

{lang_instruction}

Based on the following context, create a short email to share the meeting summary with the customer.

{context_text}

## Requirements:

1. **Length**: 100-150 words maximum
2. **Tone**: Warm, professional, not salesy
3. **Purpose**: Share the meeting summary and confirm next steps

## Structure:

Subject: [Meeting summary - date]

Hi {contact_name},

[1-2 sentences thanking them for the meeting and a personal touch]

[1 sentence mentioning you're attaching/sharing the summary]

[1 sentence highlighting the most important next step]

[Call to action - confirm the next meeting or ask if they have questions]

Best regards,
[Name]

---

Generate the email now:"""
    
    def _prompt_commercial_analysis(self, context_text: str, lang_instruction: str, context: Dict) -> str:
        """Prompt for commercial analysis generation"""
        company_name = context.get("followup", {}).get("prospect_company_name", "the company")
        
        return f"""You are a seasoned commercial strategist analyzing a sales conversation.

Write in clear, direct and strategic language.
Be honest, pragmatic and psychologically sharp.
Your analysis is for internal use only.
It should reveal what is really going on in this deal.
Not the optimistic version, but the evidence-based one.

{lang_instruction}

Purpose: Provide actionable commercial intelligence that clarifies the true state of this opportunity, the political dynamics inside the customer organisation, and what the sales team should do next.

Every insight must be supported by concrete evidence from the conversation.

{context_text}

STRUCTURE & INSTRUCTIONS:

# Commercial Analysis – {company_name}

## Executive Summary
In 2-3 sentences, summarise the real situation:
Is this opportunity viable, fragile or misaligned?
What single factor will determine whether this deal moves forward or stalls?

## Momentum Assessment
Describe the current momentum of the deal.
Classify as: 🟢 Forward Momentum, 🟡 Neutral / Stalled, 🔴 Regressive.
Explain *why*, using evidence and behavioural signals from the prospect.

---

## BANT Analysis

Analyse each dimension using the structure below. Always separate:
- What the customer *explicitly said*
- What we *infer*
- What is still *unknown*

### Budget
- **Evidence**: [Direct quotes or statements]
- **Assessment**: 🟢 Confirmed / 🟡 Unclear / 🔴 Concern
- **Interpretation**: [What this means for deal viability]
- **Unknowns**: [What remains unverified]

### Authority
- **Decision Makers Identified**: [Names and roles]
- **Decision Process**: [How decisions are made, formal vs informal]
- **Assessment**: 🟢 Full access / 🟡 Partial access / 🔴 Missing key personas
- **Political Dynamics**: [Who influences whom]
- **Gap**: [Who we still need access to]

### Need
- **Stated Needs**: [Verbatim customer statements]
- **Underlying Drivers**: [Motivations, pain, pressure, risk avoidance]
- **Urgency Level**: 🔴 Urgent / 🟡 Important / 🟢 Nice-to-have
- **Strategic Fit**: [How well our solution aligns to their core goals]

### Timeline
- **Stated Timeline**: [Any explicit deadlines]
- **Trigger Events**: [Renewals, compliance deadlines, growth plans]
- **Assessment**: 🟢 Clear / 🟡 Vague / 🔴 No urgency
- **Implications**: [What accelerates or delays this deal]

---

## Buying Signals & Interest Indicators
List only signals grounded in evidence, not hope.

| Signal | Quote / Evidence | Strength |
|--------|------------------|----------|
| [type] | "[exact quote]" | 🟢 / 🟡 / 🔴 |

---

## Objections & Concerns
Identify both explicit and implicit objections.

| Concern | Quote / Evidence | Recommended Approach |
|---------|------------------|----------------------|
| [concern] | "[quote]" | [How to neutralise or reframe] |

---

## Competitive Landscape
- **Competitors Mentioned**: [Names or "None mentioned"]
- **Prospect's Comparison Criteria**: [What matters to them]
- **Our Position**: [Where we stand based on evidence]
- **Differentiation Angle**: [The sharpest lever we can use]

---

## Risk Assessment
Provide a sober view of actual deal risks.

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|---------------------|
| [risk] | High/Med/Low | High/Med/Low | [action] |

---

## Deal Health Score
Score each dimension 1-5 based strictly on evidence.

| Dimension | Score | Evidence |
|-----------|-------|----------|
| Need Fit | /5 | [why] |
| Stakeholder Access | /5 | [why] |
| Budget Alignment | /5 | [why] |
| Timeline Clarity | /5 | [why] |
| Competitive Position | /5 | [why] |

**Overall Deal Score**: X/25 → Strong / Moderate / At Risk

---

## Information Gaps
Consolidate all unknowns from the analysis above:

| Area | What We Don't Know | How to Find Out | Priority |
|------|-------------------|-----------------|----------|
| [BANT area] | [the unknown] | [discovery action] | 🔴 / 🟡 / 🟢 |

---

## Win Probability & Strategic Recommendation

- **Win Probability**: X%
- **Confidence Level**: High / Medium / Low
- **Reasoning**: In 2-3 sentences: what drives this probability? What could change it?

### Overall Strategy Guidance
Provide one sharp paragraph:
Should we push forward, nurture, requalify, escalate internally, or deprioritise?
Base this advice strictly on evidence, political dynamics and deal momentum.

---

## Recommended Actions

### Immediate (This Week)
The 1-3 most critical actions that influence deal momentum.

### Before Next Meeting
Information we need, stakeholders to involve, preparation needed.

### Deal Strategy
A concise advisory paragraph outlining the strategic playbook for this opportunity.

---

RULES:
- Every insight must be evidence-based.
- Distinguish facts from interpretation.
- Flag assumptions explicitly.
- Be concise but deep.
- Prioritise clarity over completeness.
- Deliver commercial intelligence that can change action, not just document reality.

Generate the complete Commercial Analysis now:"""
    
    def _prompt_sales_coaching(self, context_text: str, lang_instruction: str, context: Dict) -> str:
        """Prompt for sales coaching generation"""
        return f"""You are an expert sales coach who provides constructive feedback to help salespeople improve.

{lang_instruction}

Based on the following meeting transcript and context, provide detailed coaching feedback.

{context_text}

## Requirements:

Be specific with examples from the transcript. Be constructive, not harsh.

## Structure (use these exact headings):

# Sales Coaching Feedback

## ⭐ Overall Score: [X]/10

[1-2 sentences explaining the score]

## ✅ What You Did Well
[3-4 specific things done well, with quotes from the transcript as examples]

## 🔧 Areas for Improvement
[2-3 specific improvements needed]
- [Improvement 1]
  - **Example from call**: "[quote]"
  - **Better approach**: [suggestion]

## 💡 Missed Opportunities
[2-3 moments where a different approach could have been more effective]
- At "[quote]", you could have [suggestion]

## 📚 Techniques to Practice
[2-3 specific sales techniques relevant to this situation]
- **[Technique Name]**: [Brief explanation and when to use it]

## 🎯 Focus for Next Meeting
[One specific thing to focus on improving in the next conversation]

---

Generate the coaching feedback now:"""
    
    def _prompt_action_items(self, context_text: str, lang_instruction: str, context: Dict) -> str:
        """Prompt for action items extraction"""
        return f"""You are an expert at extracting clear, actionable tasks from meeting conversations.

{lang_instruction}

Based on the following meeting context, extract all action items.

{context_text}

## Requirements:

- Extract explicit AND implicit action items
- Assign clear ownership
- Suggest deadlines based on urgency discussed
- Prioritize items

## Structure (use these exact headings):

# Action Items

## Your Tasks (Sales Rep)
| # | Task | Deadline | Priority |
|---|------|----------|----------|
[List tasks for the sales rep with 🔴 High, 🟡 Medium, 🟢 Low priority]

## Customer Tasks
| # | Task | Deadline | How to Follow Up |
|---|------|----------|------------------|
[List tasks the customer committed to, with follow-up strategy]

## Shared / Collaborative
| # | Task | Deadline | Owner |
|---|------|----------|-------|
[Tasks requiring both parties]

## Summary
- Total items: [X]
- High priority: [X]
- Next follow-up date: [suggested date]

---

Generate the action items now:"""
    
    def _prompt_internal_report(self, context_text: str, lang_instruction: str, context: Dict) -> str:
        """Prompt for internal report generation"""
        return f"""You are an expert at writing concise internal sales reports.

{lang_instruction}

Based on the following meeting context, create a short internal report suitable for CRM notes or team updates.

{context_text}

## Requirements:

- **Length**: 150-200 words maximum
- **Format**: Scannable, bullet points preferred
- **Focus**: Key takeaways, decisions, next steps

## Structure (use these exact headings):

# Meeting Update: [Company Name]

**Date**: [date]
**Attendees**: [names]
**Type**: [meeting type]

## Key Takeaways
- [Point 1]
- [Point 2]
- [Point 3]

## Decisions Made
- [Decision 1]

## Next Steps
- [ ] [Action 1] - [deadline]
- [ ] [Action 2] - [deadline]

## Deal Update
- **Stage**: [current] → [recommended]
- **Probability**: [X]%
- **Blocker**: [if any]

---

Generate the internal report now:"""
    
    def _prompt_deal_update(self, context_text: str, lang_instruction: str, context: Dict) -> str:
        """Prompt for deal update suggestions"""
        current_deal = context.get("deal", {})
        current_stage = current_deal.get("stage", "Unknown")
        
        return f"""You are an expert at assessing sales deal progress and recommending pipeline updates.

{lang_instruction}

Based on the following meeting context, provide deal update recommendations.

{context_text}

Current Deal Stage: {current_stage}

## Requirements:

Analyze the meeting to determine if the deal should be updated.

## Structure (use these exact headings):

# Deal Update Recommendation

## Current Status
- **Current Stage**: {current_stage}
- **Meeting Outcome**: [Positive/Neutral/Negative]

## Recommended Changes

### Stage Update
- **Recommended Stage**: [stage name]
- **Reasoning**: [Why this stage is appropriate based on the meeting]

### Probability Update
- **Current Probability**: [X]%
- **Recommended Probability**: [Y]%
- **Change Reasoning**: [What happened to change the probability]

### Deal Value
- **Should value be updated?**: [Yes/No]
- **Reasoning**: [If yes, explain based on what was discussed]

## Key Indicators
- 🟢 Positive signals: [list]
- 🔴 Risk factors: [list]

## Critical Next Action
[The one thing that must happen to advance this deal]

---

Generate the deal update now:"""
    
    async def _generate_with_claude(self, prompt: str) -> str:
        """Call Claude API to generate content"""
        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4000,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            
            return response.content[0].text
            
        except Exception as e:
            logger.error(f"Claude API error: {e}")
            raise
    
    def _build_metadata(self, action_type: ActionType, content: str, context: Dict) -> Dict[str, Any]:
        """Build metadata for the generated action"""
        metadata = {
            "status": "completed",
            "word_count": len(content.split()) if content else 0,
            "generated_with_context": [],
        }
        
        # Track which context was available
        if context.get("sales_profile"):
            metadata["generated_with_context"].append("sales_profile")
        if context.get("company_profile"):
            metadata["generated_with_context"].append("company_profile")
        if context.get("research_brief"):
            metadata["generated_with_context"].append("research_brief")
        if context.get("contacts"):
            metadata["generated_with_context"].append("contacts")
        if context.get("preparation"):
            metadata["generated_with_context"].append("preparation")
        if context.get("deal"):
            metadata["generated_with_context"].append("deal")
        
        # Action-specific metadata
        if action_type == ActionType.COMMERCIAL_ANALYSIS:
            # Try to extract probability from content
            import re
            prob_match = re.search(r'Win Probability[:\s]*(\d+)%', content)
            if prob_match:
                metadata["deal_probability"] = int(prob_match.group(1))
        
        elif action_type == ActionType.SALES_COACHING:
            # Try to extract score
            import re
            score_match = re.search(r'Overall Score[:\s]*(\d+(?:\.\d+)?)/10', content)
            if score_match:
                metadata["overall_score"] = float(score_match.group(1))
        
        return metadata


def get_action_generator() -> ActionGeneratorService:
    """Factory function for action generator service"""
    return ActionGeneratorService()


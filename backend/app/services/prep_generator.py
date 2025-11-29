"""
Meeting Prep Generator Service

Generates AI-powered meeting briefs using Claude/GPT-4 with context from RAG.
"""

from typing import Dict, Any, List, Optional
import logging
import os
import json
from anthropic import Anthropic
from app.i18n.utils import get_language_instruction
from app.i18n.config import DEFAULT_LANGUAGE

logger = logging.getLogger(__name__)


class PrepGeneratorService:
    """Service for generating meeting preparation briefs"""
    
    def __init__(self):
        self.anthropic = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        self.model = "claude-sonnet-4-20250514"
    
    async def generate_meeting_brief(
        self,
        context: Dict[str, Any],
        language: str = DEFAULT_LANGUAGE
    ) -> Dict[str, Any]:
        """
        Generate comprehensive meeting brief using AI
        
        Args:
            context: RAG context with KB and Research data
            language: Output language code (default: nl)
            
        Returns:
            Structured brief with talking points, questions, strategy
        """
        try:
            # Build prompt based on meeting type
            prompt = self._build_prompt(context, language)
            
            # Call Claude API
            logger.info(f"Generating brief for {context['prospect_company']} ({context['meeting_type']})")
            
            response = self.anthropic.messages.create(
                model=self.model,
                max_tokens=4096,
                temperature=0.7,
                messages=[{
                    "role": "user",
                    "content": prompt
                }]
            )
            
            # Extract content
            brief_text = response.content[0].text
            
            # Parse structured output
            parsed = self._parse_brief(brief_text, context['meeting_type'])
            
            logger.info(f"Successfully generated brief ({len(brief_text)} chars)")
            
            return {
                "brief_content": brief_text,
                "talking_points": parsed["talking_points"],
                "questions": parsed["questions"],
                "strategy": parsed["strategy"],
                "rag_sources": self._extract_sources(context)
            }
            
        except Exception as e:
            logger.error(f"Error generating brief: {e}")
            raise
    
    def _build_prompt(self, context: Dict[str, Any], language: str = DEFAULT_LANGUAGE) -> str:
        """Build AI prompt based on context and meeting type"""
        
        meeting_type = context["meeting_type"]
        prospect = context["prospect_company"]
        custom_notes = context.get("custom_notes", "")
        lang_instruction = get_language_instruction(language)
        
        # Base prompt
        meeting_type_labels = {
            "discovery": "Discovery Call",
            "demo": "Product Demo", 
            "closing": "Closing Call",
            "follow_up": "Follow-up Meeting",
            "other": "Meeting"
        }
        meeting_label = meeting_type_labels.get(meeting_type, meeting_type)
        
        prompt = f"""You are a smart, experienced sales preparation expert. You deliver commercial intelligence – not sales pitches.

Your goal: a sharp, strategically relevant and to-the-point briefing for an upcoming client meeting.

**Prospect Company**: {prospect}
**Meeting Type**: {meeting_label}

IMPORTANT:
- Translate technology into customer value: faster work, better insights, less manual work, higher quality, more control
- Focus on what's happening at the prospect AND how it's relevant to what we offer
- Make it personal: what's at stake for the specific contact persons?
- Be businesslike, concise and strategic
- {lang_instruction}
"""
        
        if custom_notes:
            prompt += f"**Custom Context**: {custom_notes}\n"
        
        prompt += "\n"
        
        # Add sales rep & company profile context (PERSONALIZATION)
        if context.get("has_profile_context") and context.get("formatted_profile_context"):
            prompt += "## PERSONALIZATION CONTEXT (Use this to tailor the brief):\n"
            prompt += context["formatted_profile_context"] + "\n\n"
            prompt += """**IMPORTANT**: Use the above profile context to:
- Match the sales rep's methodology and communication style
- Leverage their strengths in talking points
- Focus on industries and regions they target
- Include relevant value propositions from their company
- Reference case studies if available

"""
        
        # Add company context from KB
        if context["has_kb_data"]:
            prompt += context["company_info"]["formatted_context"] + "\n"
        else:
            prompt += "## Your Company Information:\nNo specific knowledge base data available. Use general sales best practices.\n\n"
        
        # Add prospect context from research
        if context["has_research_data"]:
            prompt += context["prospect_info"]["formatted_context"] + "\n"
        else:
            prompt += "## Prospect Intelligence:\nNo prior research available. Focus on discovery questions to learn about the prospect.\n\n"
        
        # Add contact persons context (NEW - personalized approach per person)
        if context.get("has_contacts") and context.get("contacts"):
            prompt += self._format_contacts_context(context["contacts"])
        
        # Add meeting type-specific instructions
        prompt += self._get_meeting_type_instructions(meeting_type, language)
        
        return prompt
    
    def _format_contacts_context(self, contacts: list) -> str:
        """Format contact persons into prompt context"""
        if not contacts:
            return ""
        
        context = "## Contact Persons for This Meeting\n\n"
        context += "**IMPORTANT**: Personalize the meeting brief for these specific people. "
        context += "Use their communication style, role-specific pain points, and suggested approach.\n\n"
        
        for i, contact in enumerate(contacts, 1):
            context += f"### Contact {i}: {contact.get('name', 'Unknown')}\n"
            
            if contact.get('role'):
                context += f"**Role**: {contact['role']}\n"
            
            if contact.get('decision_authority'):
                authority_labels = {
                    'decision_maker': '🟢 Decision Maker',
                    'influencer': '🔵 Influencer',
                    'gatekeeper': '🟡 Gatekeeper',
                    'user': '⚪ End User'
                }
                context += f"**Decision Authority**: {authority_labels.get(contact['decision_authority'], contact['decision_authority'])}\n"
            
            if contact.get('communication_style'):
                context += f"**Communication Style**: {contact['communication_style']}\n"
            
            if contact.get('probable_drivers'):
                context += f"**Motivations**: {contact['probable_drivers']}\n"
            
            if contact.get('profile_brief'):
                # Include a condensed version of the profile brief
                brief = contact['profile_brief']
                if len(brief) > 500:
                    brief = brief[:500] + "..."
                context += f"\n**Profile Summary**:\n{brief}\n"
            
            if contact.get('opening_suggestions') and len(contact['opening_suggestions']) > 0:
                context += "\n**Suggested Opening Lines**:\n"
                for suggestion in contact['opening_suggestions'][:3]:
                    context += f"- \"{suggestion}\"\n"
            
            if contact.get('questions_to_ask') and len(contact['questions_to_ask']) > 0:
                context += "\n**Recommended Questions**:\n"
                for question in contact['questions_to_ask'][:3]:
                    context += f"- {question}\n"
            
            if contact.get('topics_to_avoid') and len(contact['topics_to_avoid']) > 0:
                context += "\n**Topics to Avoid**:\n"
                for topic in contact['topics_to_avoid']:
                    context += f"- {topic}\n"
            
            context += "\n"
        
        context += """
When generating the meeting brief:
1. Tailor talking points to these specific people's roles and styles
2. Use their suggested opening lines in the Opening section
3. Include their recommended questions in the Discovery section
4. Mention their decision authority when discussing next steps
5. Avoid topics they might be sensitive about
6. Match communication style (formal/informal/technical)

"""
        return context
    
    def _get_meeting_type_instructions(self, meeting_type: str, language: str = DEFAULT_LANGUAGE) -> str:
        """Get specific instructions based on meeting type"""
        
        lang_instruction = get_language_instruction(language)
        
        instructions = {
            "discovery": f"""
Generate a comprehensive discovery call briefing with the following structure:

# Meeting Brief: Discovery Call

## 1. Meeting Overview
- Main objective of this meeting
- Key focus areas (2-3 main topics)

## 2. 🌍 Market Context & Relevance to Us
**IMPORTANT**: Analyze what's happening in the market from the prospect's perspective AND how this is relevant to what we offer.

### Market developments affecting this prospect
- [Trend 1 in their sector]
- [Trend 2 affecting them]
- [Change they're dealing with]

### How our solutions align with this
- [Our solution X helps with trend Y]
- [Our approach solves challenge Z]
- [Concrete value we can add]

## 3. 👤 Personal Relevance per Contact Person
**IMPORTANT**: For each contact person - what's happening for THEM personally and from their role where we can help?

[Per contact person if available:]
### [Name] - [Role]
**Personal situation**:
- What's going on for this person? (career, projects, pressure)
- What personal goals/ambitions are visible?

**Role-specific challenges**:
- What problems does someone in this role typically have?
- What are they responsible for?

**How we can help**:
- [Concrete way we can support this person]
- [What does it deliver for them personally?]

## 4. 👥 DMU Overview (Decision Making Unit)
**If there are multiple contact persons:**

| Name | Role | Position in DMU | Communication Style |
|------|------|-----------------|---------------------|
| [Name] | [Function] | 🟢 Decision Maker / 🔵 Influencer / 🟡 Gatekeeper | [Formal/Informal/Technical] |

**Decision-making analysis**:
- How does decision-making appear to be organized? (top-down, consensus, pragmatic)
- What are likely dominant decision criteria? (ROI, risk, adoption, ease)
- Who needs to be convinced and who ultimately decides?

## 5. ⏱️ Momentum & Timing

**Timing Score**: [🟢 NOW-OPPORTUNITY / 🟡 NURTURE / 🔴 NO FOCUS]

**Signals**:
- [Urgency signals from news or LinkedIn]
- [Project pressure or deadlines]
- [Budget cycles or changes]

**Why now is (or isn't) the right moment**:
- [Justification of timing]

## 6. ⚠️ Warnings & Sensitivities

**Be careful in this meeting**:
- [Sensitive topic 1 - why to avoid]
- [Sensitive topic 2 - why to avoid]
- [Possible objections or resistance]

**Risks**:
- [Ongoing contract with competitor?]
- [Internal conflict or changes?]
- [Budget or priority issues?]

## 7. Talking Points

### Opening (First 5 minutes)
- Personal opener (based on contact person profile)
- Meeting agenda
- Permission to ask questions

### Discovery (Next 20 minutes)
- Topic 1 to explore
- Topic 2 to explore
- Topic 3 to explore

### Value Proposition (Next 10 minutes)
- How we can help (specific to their situation)
- Relevant case study
- Differentiating capability

### Next Steps (Last 5 minutes)
- Concrete follow-up action
- Timeline
- Who do we involve?

## 8. Discovery Questions

### Situation Questions
1. [Question about current situation]
2. [Question about their process]
3. [Question about their team]

### Problem Questions
1. [Question about challenges]
2. [Question about pain points]
3. [Question about impact]

### Implication Questions
1. [Question about consequences]
2. [Question about costs]
3. [Question about risks]

### Need-Payoff Questions
1. [Question about ideal solution]
2. [Question about benefits]
3. [Question about value]

## 9. Meeting Strategy

### Primary Goal
[What you MUST achieve]

### Secondary Goals
- [Nice to have 1]
- [Nice to have 2]

### Potential Objections & Responses
- Objection: [Common objection]
  Response: [How to address]

### Recommended Next Step
- [Concrete suggestion: workshop, case sharing, proposal, demo]
- [Who from our team should join?]

---

Remember:
- Be specific and actionable
- Use information from the context
- Don't make up facts that aren't in the context
- Make everything relevant to this specific prospect
- Focus on THEIR needs, not our features
- {lang_instruction}
""",
            "demo": """
Generate a product demo briefing with the following structure:

# Meeting Brief: Product Demo

## 1. Demo Overview
- Demo objective
- Key features to show
- Time allocation

## 2. 🌍 Relevance to Their Situation
### Market developments
- [Trend affecting them that's relevant for the demo]

### Why our solution is relevant now
- [Concrete alignment with their challenges]

## 3. 👤 Per Contact Person
[For each attendee:]
### [Name] - [Role]
- **What's important to this person**: [their focus/interests]
- **Demo focus points**: [what to show that appeals to them]
- **Communication style**: [formal/technical/strategic]

## 4. 👥 DMU & Decision Making
| Name | Role | Position | Focus |
|------|------|----------|-------|
[Table with attendees]

**Who decides what**: [analysis of decision-making process]

## 5. ⚠️ Warnings
- [Sensitive topics to avoid]
- [Prepare for possible objections]

## 6. Demo Flow

### Introduction (5 min)
- Recap discovery insights
- Demo agenda
- Confirm their priorities

### Feature Showcase (30 min)
- Feature 1: [Addresses pain point X]
- Feature 2: [Solves challenge Y]
- Feature 3: [Enables result Z]

### Q&A (15 min)
- Expected questions
- Technical details
- Integration points

### Next Steps (10 min)
- Trial/POC proposal
- Timeline
- Required resources

## 7. Demo Talking Points
- [Key message 1]
- [Key message 2]
- [Key message 3]

## 8. Questions to Ask
1. [Validate understanding]
2. [Gauge interest]
3. [Identify blockers]

## 9. Recommended Next Step
- [Concrete next step after the demo]
- [Who to involve?]

{lang_instruction}
""",
            "closing": """
Generate a closing call briefing with the following structure:

# Meeting Brief: Closing Call

## 1. Deal Overview
- Deal size
- Timeline
- Decision makers

## 2. ⏱️ Momentum & Timing
**Timing Score**: [🟢 NOW-OPPORTUNITY / 🟡 NURTURE / 🔴 NO FOCUS]
- Why now is the moment to close
- Urgency signals

## 3. 👥 DMU & Decision Making
| Name | Role | Position | Status |
|------|------|----------|--------|
[Who needs to sign, who needs to approve]

**Decision-making process**: [How the decision is made]

## 4. 👤 Per Decision Maker - What's at Stake
[Per person involved in the decision:]
### [Name] - [Role]
- **Personal stake**: [What's in it for them?]
- **Possible concerns**: [What are they worried about?]
- **How to convince**: [What do they need to say yes?]

## 5. ⚠️ Risks & Blockers
- [Possible deal-killers]
- [Competition?]
- [Budget/timing issues?]
- [Internal resistance?]

## 6. Value Summary
- ROI demonstrated
- Key benefits
- Differentiating capability vs competition

## 7. Closing Talking Points

### Value Recap
- [Benefit 1 with proof]
- [Benefit 2 with proof]
- [Benefit 3 with proof]

### Address Concerns
- [Concern 1 and response]
- [Concern 2 and response]

### Create Urgency
- [Reason to close now]
- [Limited time/incentive]

## 8. Closing Questions
1. [Confirm decision criteria are met]
2. [Identify remaining blockers]
3. [Ask for the business]

## 9. Negotiation Strategy
- Walk-away point
- Concessions we can offer
- Must-haves vs nice-to-haves

## 10. Concrete Next Step
- [What needs to happen now?]
- [Contract review process]
- [Implementation timeline]

{lang_instruction}
""",
            "follow_up": """
Generate a follow-up meeting briefing with the following structure:

# Meeting Brief: Follow-up Meeting

## 1. Previous Meeting Recap
- What was discussed
- Agreements made
- Open items

## 2. 🌍 New Developments
### At the prospect
- [News or changes since last contact]
- [Relevant developments in their market]

### At our end
- [Updates relevant to them]
- [New features/capabilities]

## 3. 👤 Per Contact Person - Update
[Per person:]
### [Name] - [Role]
- **Status since previous meeting**: [What has changed?]
- **Current focus**: [What are they working on now?]
- **Focus points for this conversation**: [What to watch for?]

## 4. ⏱️ Momentum Check
**Current status**: [🟢 Hot / 🟡 Warm / 🔴 Cold]
- Signals of progress or stagnation
- What needs to happen to move forward?

## 5. ⚠️ Warnings
- [Sensitivities or changed circumstances]
- [Possible obstacles]

## 6. Follow-up Agenda
- Address open questions
- Present additional information
- Move deal forward

## 7. Talking Points
- [Update 1]
- [Update 2]
- [Answer to question X]

## 8. Questions to Ask
1. [Progress since last meeting]
2. [New developments on their end]
3. [Timeline update]

## 9. Recommended Next Step
- [Concrete next step]
- [Who should be involved?]

{lang_instruction}
""",
            "other": """
Generate a meeting briefing with the following structure:

# Meeting Brief

## 1. Meeting Overview
- Objective
- Context

## 2. 🌍 Relevance
- What's happening in their market?
- How does this connect to what we do?

## 3. 👤 Per Contact Person
[Per attendee:]
- **Name & Role**: [...]
- **What's going on for them**: [personally and from their role]
- **How we can help**: [concrete value]

## 4. ⚠️ Warnings
- [Sensitivities]
- [Points of attention]

## 5. Talking Points
- [Point 1]
- [Point 2]
- [Point 3]

## 6. Questions to Ask
1. [Question 1]
2. [Question 2]
3. [Question 3]

## 7. Strategy & Next Step
- Goal of this meeting
- Success criteria
- Recommended follow-up action

{lang_instruction}
"""
        }
        
        template = instructions.get(meeting_type, instructions["other"])
        # Replace placeholder with actual language instruction
        return template.replace("{lang_instruction}", lang_instruction)
    
    def _parse_brief(self, brief_text: str, meeting_type: str) -> Dict[str, Any]:
        """Parse structured data from brief text"""
        
        # Extract talking points
        talking_points = self._extract_section(brief_text, "Talking Points", "Questions")
        
        # Extract questions
        questions = self._extract_questions(brief_text)
        
        # Extract strategy
        strategy = self._extract_section(brief_text, "Strategy", "---")
        
        return {
            "talking_points": self._structure_talking_points(talking_points),
            "questions": questions,
            "strategy": strategy
        }
    
    def _extract_section(self, text: str, start_marker: str, end_marker: str) -> str:
        """Extract text between two markers"""
        try:
            start_idx = text.find(start_marker)
            if start_idx == -1:
                return ""
            
            end_idx = text.find(end_marker, start_idx)
            if end_idx == -1:
                end_idx = len(text)
            
            return text[start_idx:end_idx].strip()
        except:
            return ""
    
    def _extract_questions(self, text: str) -> List[str]:
        """Extract questions from brief"""
        questions = []
        lines = text.split("\n")
        
        in_questions_section = False
        for line in lines:
            if "Questions" in line or "Discovery Questions" in line:
                in_questions_section = True
                continue
            
            if in_questions_section:
                if line.startswith("#") and "Questions" not in line:
                    break
                
                # Extract numbered questions
                if line.strip() and (line.strip()[0].isdigit() or line.strip().startswith("-")):
                    question = line.strip().lstrip("0123456789.-) ").strip()
                    if question and "?" in question:
                        questions.append(question)
        
        return questions[:15]  # Limit to 15 questions
    
    def _structure_talking_points(self, talking_points_text: str) -> List[Dict[str, Any]]:
        """Structure talking points into categories"""
        # Simple parsing - can be enhanced
        return [{
            "category": "Talking Points",
            "points": [p.strip() for p in talking_points_text.split("\n") if p.strip() and not p.strip().startswith("#")][:10]
        }]
    
    def _extract_sources(self, context: Dict[str, Any]) -> List[Dict[str, str]]:
        """Extract sources used in RAG"""
        sources = []
        
        # Add KB sources
        for chunk in context.get("company_info", {}).get("kb_chunks", [])[:5]:
            sources.append({
                "type": "knowledge_base",
                "source": chunk.get("source", "Unknown"),
                "score": chunk.get("score", 0)
            })
        
        # Add research source
        if context.get("has_research_data"):
            research = context.get("prospect_info", {}).get("research_data", {})
            sources.append({
                "type": "research_brief",
                "source": research.get("company_name", "Unknown"),
                "created_at": research.get("created_at", "")
            })
        
        return sources


# Singleton instance
prep_generator = PrepGeneratorService()

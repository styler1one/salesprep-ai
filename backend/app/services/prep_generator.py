"""
Meeting Prep Generator Service

Generates AI-powered meeting briefs using Claude/GPT-4 with context from RAG.
"""

from typing import Dict, Any, List, Optional
import logging
import os
import json
from anthropic import Anthropic

logger = logging.getLogger(__name__)


class PrepGeneratorService:
    """Service for generating meeting preparation briefs"""
    
    def __init__(self):
        self.anthropic = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        self.model = "claude-sonnet-4-20250514"
    
    async def generate_meeting_brief(
        self,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate comprehensive meeting brief using AI
        
        Args:
            context: RAG context with KB and Research data
            
        Returns:
            Structured brief with talking points, questions, strategy
        """
        try:
            # Build prompt based on meeting type
            prompt = self._build_prompt(context)
            
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
    
    def _build_prompt(self, context: Dict[str, Any]) -> str:
        """Build AI prompt based on context and meeting type"""
        
        meeting_type = context["meeting_type"]
        prospect = context["prospect_company"]
        custom_notes = context.get("custom_notes", "")
        
        # Base prompt
        prompt = f"""You are a sales enablement AI helping a sales rep prepare for a {meeting_type} meeting.

**Prospect Company**: {prospect}
**Meeting Type**: {meeting_type}
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
        prompt += self._get_meeting_type_instructions(meeting_type)
        
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
    
    def _get_meeting_type_instructions(self, meeting_type: str) -> str:
        """Get specific instructions based on meeting type"""
        
        instructions = {
            "discovery": """
Generate a comprehensive discovery call brief with the following structure:

# Meeting Brief: Discovery Call

## 1. Meeting Overview
- Primary objective
- Key focus areas (2-3 main topics)

## 2. Company Context
- Relevant products/services that match their needs
- Value propositions
- Similar customers you've helped (case studies)

## 3. Prospect Intelligence
- Company overview
- Recent developments
- Potential pain points
- Key decision makers

## 4. Talking Points

### Opening (First 5 minutes)
- Icebreaker or congratulations
- Meeting agenda
- Permission to ask questions

### Discovery (Next 20 minutes)
- Topic 1 to explore
- Topic 2 to explore
- Topic 3 to explore

### Value Proposition (Next 10 minutes)
- How you can help
- Relevant case study
- Differentiation

### Next Steps (Last 5 minutes)
- What you're asking for
- Timeline
- Follow-up actions

## 5. Discovery Questions

### Situation Questions
1. [Question about their current situation]
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

## 6. Meeting Strategy

### Primary Objective
[What you must accomplish]

### Secondary Objectives
- [Nice to have 1]
- [Nice to have 2]

### Potential Objections & Responses
- Objection: [Common objection]
  Response: [How to address it]

### Success Criteria
- [How you'll know the call was successful]

---

Remember:
- Be specific and actionable
- Use information from the context provided
- Don't make up facts not in the context
- Tailor everything to this specific prospect
- Focus on their needs, not your features
""",
            "demo": """
Generate a product demo brief with the following structure:

# Meeting Brief: Product Demo

## 1. Demo Overview
- Demo objective
- Key features to showcase
- Time allocation

## 2. Prospect Context
- Their specific needs
- Pain points to address
- Decision criteria

## 3. Demo Flow

### Introduction (5 min)
- Recap discovery insights
- Set demo agenda
- Confirm their priorities

### Feature Showcase (30 min)
- Feature 1: [Addresses pain point X]
- Feature 2: [Solves challenge Y]
- Feature 3: [Enables outcome Z]

### Q&A (15 min)
- Anticipated questions
- Technical details
- Integration points

### Next Steps (10 min)
- Trial/POC proposal
- Timeline
- Required resources

## 4. Demo Talking Points
- [Key message 1]
- [Key message 2]
- [Key message 3]

## 5. Questions to Ask
1. [Validate understanding]
2. [Gauge interest]
3. [Identify blockers]

## 6. Demo Strategy
- Primary goal
- Success metrics
- Objection handling
""",
            "closing": """
Generate a closing call brief with the following structure:

# Meeting Brief: Closing Call

## 1. Deal Overview
- Deal size
- Timeline
- Decision makers

## 2. Value Summary
- ROI demonstrated
- Key benefits
- Competitive advantages

## 3. Closing Talking Points

### Value Recap
- [Benefit 1 with evidence]
- [Benefit 2 with evidence]
- [Benefit 3 with evidence]

### Address Concerns
- [Concern 1 and response]
- [Concern 2 and response]

### Create Urgency
- [Reason to close now]
- [Limited time offer/incentive]

## 4. Closing Questions
1. [Confirm decision criteria met]
2. [Identify remaining blockers]
3. [Ask for the business]

## 5. Negotiation Strategy
- Walk-away point
- Concessions to offer
- Must-haves vs nice-to-haves

## 6. Next Steps
- Contract review
- Implementation timeline
- Success planning
""",
            "follow_up": """
Generate a follow-up meeting brief with the following structure:

# Meeting Brief: Follow-up Meeting

## 1. Previous Meeting Recap
- What was discussed
- Commitments made
- Open items

## 2. Follow-up Agenda
- Address open questions
- Present additional information
- Move deal forward

## 3. Talking Points
- [Update 1]
- [Update 2]
- [Answer to question X]

## 4. Questions to Ask
1. [Progress since last meeting]
2. [New developments]
3. [Timeline update]

## 5. Strategy
- Primary objective
- Advance criteria
- Contingency plans
""",
            "other": """
Generate a meeting brief with the following structure:

# Meeting Brief

## 1. Meeting Overview
- Objective
- Context

## 2. Talking Points
- [Point 1]
- [Point 2]
- [Point 3]

## 3. Questions
1. [Question 1]
2. [Question 2]
3. [Question 3]

## 4. Strategy
- Goal
- Success criteria
"""
        }
        
        return instructions.get(meeting_type, instructions["other"])
    
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

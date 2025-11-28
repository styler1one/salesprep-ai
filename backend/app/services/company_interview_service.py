"""
Company Interview Service - AI-powered company profile onboarding
"""
import os
import json
import uuid
from typing import Dict, Any, Optional, List
from anthropic import Anthropic


class CompanyInterviewService:
    """
    Service for conducting company profile onboarding interviews.
    Uses AI to analyze responses and generate structured profiles.
    """
    
    # Company interview questions
    QUESTIONS = [
        {
            "id": 1,
            "question": "Wat is de naam van jullie bedrijf?",
            "field": "company_name",
            "required": True
        },
        {
            "id": 2,
            "question": "In welke industrie/sector zijn jullie actief?",
            "field": "industry",
            "required": True
        },
        {
            "id": 3,
            "question": "Wat zijn jullie belangrijkste producten of diensten? Beschrijf ze kort.",
            "field": "products_description",
            "required": True
        },
        {
            "id": 4,
            "question": "Wat zijn jullie kernwaarden en wat maakt jullie uniek ten opzichte van concurrenten?",
            "field": "differentiators",
            "required": True
        },
        {
            "id": 5,
            "question": "Wie is jullie ideale klant? (industrie, bedrijfsgrootte, regio, etc.)",
            "field": "ideal_customer",
            "required": True
        },
        {
            "id": 6,
            "question": "Welke problemen of pijnpunten lossen jullie op voor klanten?",
            "field": "pain_points_solved",
            "required": True
        },
        {
            "id": 7,
            "question": "Wie zijn jullie typische kopers? (functietitels, beslissers, beïnvloeders)",
            "field": "buyer_personas",
            "required": False
        },
        {
            "id": 8,
            "question": "Hebben jullie succesvolle case studies of referenties die je kunt delen?",
            "field": "case_studies",
            "required": False
        },
        {
            "id": 9,
            "question": "Wie zijn jullie belangrijkste concurrenten en hoe onderscheiden jullie je?",
            "field": "competitors",
            "required": False
        },
        {
            "id": 10,
            "question": "Wat is de gemiddelde grootte van jullie deals en typische sales cycle lengte?",
            "field": "deal_info",
            "required": False
        },
        {
            "id": 11,
            "question": "Waar is jullie bedrijf gevestigd en hoeveel medewerkers hebben jullie?",
            "field": "company_info",
            "required": False
        },
        {
            "id": 12,
            "question": "Hebben jullie belangrijke metrics, awards of erkenningen die je wilt delen?",
            "field": "achievements",
            "required": False
        }
    ]
    
    def __init__(self):
        """Initialize Anthropic client."""
        self.client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        self.model = "claude-sonnet-4-20250514"
    
    def start_interview(self) -> Dict[str, Any]:
        """
        Start a new company interview session.
        
        Returns:
            Dict with session_id and first question
        """
        session_id = str(uuid.uuid4())
        first_question = self.QUESTIONS[0]
        
        return {
            "session_id": session_id,
            "question_id": first_question["id"],
            "question": first_question["question"],
            "progress": 1,
            "total_questions": len(self.QUESTIONS)
        }
    
    def get_next_question(
        self,
        current_question_id: int,
        responses: Dict[int, str]
    ) -> Optional[Dict[str, Any]]:
        """
        Get the next question based on current progress.
        
        Args:
            current_question_id: Current question ID
            responses: Dict of question_id to answer
            
        Returns:
            Next question dict or None if complete
        """
        next_id = current_question_id + 1
        
        if next_id > len(self.QUESTIONS):
            return None
        
        question = self.QUESTIONS[next_id - 1]
        
        return {
            "question_id": question["id"],
            "question": question["question"],
            "progress": next_id,
            "total_questions": len(self.QUESTIONS)
        }
    
    def analyze_responses(self, responses: Dict[int, str]) -> Dict[str, Any]:
        """
        Analyze interview responses with AI to generate structured company profile.
        
        Args:
            responses: Dict of question_id to answer
            
        Returns:
            Structured company profile data
        """
        print(f"DEBUG: Analyzing company interview responses")
        
        # Build context from responses
        response_text = self._build_response_context(responses)
        
        # Use Claude to analyze and structure
        prompt = f"""Analyze these company interview responses and extract structured profile data.

INTERVIEW RESPONSES:
{response_text}

Extract and structure the information into JSON format. Be thorough but only include information that was actually provided.

Return ONLY valid JSON (no markdown, no explanation) with this structure:
{{
  "company_name": "Company name",
  "industry": "Industry/sector",
  "company_size": "Size description if mentioned",
  "headquarters": "Location if mentioned",
  "website": "Website if mentioned",
  "products": [
    {{
      "name": "Product name",
      "description": "Brief description",
      "value_proposition": "Key value",
      "target_persona": "Target buyer"
    }}
  ],
  "core_value_props": ["List of core value propositions"],
  "differentiators": ["List of key differentiators"],
  "unique_selling_points": "Summary of what makes them unique",
  "ideal_customer_profile": {{
    "industries": ["Target industries"],
    "company_sizes": ["Target company sizes"],
    "regions": ["Target regions"],
    "pain_points": ["Pain points addressed"],
    "buying_triggers": ["What triggers buying"]
  }},
  "buyer_personas": [
    {{
      "title": "Job title",
      "seniority": "Seniority level",
      "pain_points": ["Their pain points"],
      "goals": ["Their goals"],
      "objections": ["Common objections"]
    }}
  ],
  "case_studies": [
    {{
      "customer": "Customer name",
      "industry": "Industry",
      "challenge": "Challenge faced",
      "solution": "Solution provided",
      "results": "Results achieved"
    }}
  ],
  "competitors": ["List of competitors"],
  "competitive_advantages": "How they differentiate from competitors",
  "typical_sales_cycle": "Sales cycle length",
  "average_deal_size": "Deal size if mentioned",
  "metrics": {{"key": "value for any metrics mentioned"}},
  "ai_summary": "Write a 2-3 sentence summary of this company, highlighting their value proposition and target market.",
  "company_narrative": "Write a comprehensive 4-6 paragraph narrative about this company. Include: their mission and vision, what they do and why it matters, their unique approach, who they serve and the problems they solve, and their competitive advantages. Write in third person, making it professional and compelling. This narrative will be used as context for AI agents to personalize sales outputs."
}}"""

        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4000,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            
            # Parse response
            content = response.content[0].text
            print(f"DEBUG: Claude company response: {content[:200]}...")
            
            # Clean up response (remove markdown if present)
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            
            profile_data = json.loads(content)
            
            # Add interview responses for reference
            profile_data["interview_responses"] = responses
            
            return profile_data
            
        except json.JSONDecodeError as e:
            print(f"Error parsing Claude response: {e}")
            # Return basic profile from responses
            return self._build_basic_profile(responses)
            
        except Exception as e:
            print(f"Error analyzing company responses: {e}")
            return self._build_basic_profile(responses)
    
    def _build_response_context(self, responses: Dict[int, str]) -> str:
        """Build formatted context from responses."""
        lines = []
        for q in self.QUESTIONS:
            answer = responses.get(q["id"], responses.get(str(q["id"]), ""))
            if answer:
                lines.append(f"Q{q['id']}: {q['question']}")
                lines.append(f"A: {answer}\n")
        return "\n".join(lines)
    
    def _build_basic_profile(self, responses: Dict[int, str]) -> Dict[str, Any]:
        """Build basic profile from responses when AI analysis fails."""
        return {
            "company_name": responses.get(1, responses.get("1", "")),
            "industry": responses.get(2, responses.get("2", "")),
            "products": [],
            "core_value_props": [],
            "differentiators": [],
            "ideal_customer_profile": {},
            "buyer_personas": [],
            "case_studies": [],
            "competitors": [],
            "ai_summary": "Company profile created from interview responses.",
            "company_narrative": "This company is building their profile. More details will be available after completing the onboarding interview.",
            "interview_responses": responses
        }


# Singleton instance
_company_interview_service: Optional[CompanyInterviewService] = None

def get_company_interview_service() -> CompanyInterviewService:
    """Get or create singleton instance."""
    global _company_interview_service
    if _company_interview_service is None:
        _company_interview_service = CompanyInterviewService()
    return _company_interview_service


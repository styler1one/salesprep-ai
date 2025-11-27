"""
Interview Service - AI-powered sales rep onboarding interview
"""
import os
from typing import Dict, Any, List, Optional
from anthropic import Anthropic
import json


class InterviewService:
    """Service for conducting AI-powered onboarding interviews."""
    
    # Interview questions (15 total)
    QUESTIONS = [
        # Section 1: Background (3 questions)
        {
            "id": 1,
            "section": "background",
            "question": "Let's start by getting to know you! What's your full name and current role?",
            "field_mapping": ["full_name", "role"]
        },
        {
            "id": 2,
            "section": "background",
            "question": "How many years of sales experience do you have?",
            "field_mapping": ["experience_years"]
        },
        {
            "id": 3,
            "section": "background",
            "question": "What industries do you typically sell to? (e.g., SaaS, FinTech, Healthcare)",
            "field_mapping": ["target_industries"]
        },
        
        # Section 2: Sales Approach (3 questions)
        {
            "id": 4,
            "section": "approach",
            "question": "What sales methodology do you use? (e.g., SPIN Selling, Challenger, Consultative, Solution Selling)",
            "field_mapping": ["sales_methodology"]
        },
        {
            "id": 5,
            "section": "approach",
            "question": "Can you describe your typical sales process in a few sentences?",
            "field_mapping": ["methodology_description"]
        },
        {
            "id": 6,
            "section": "approach",
            "question": "What's your approach to discovery calls? What do you focus on?",
            "field_mapping": ["methodology_description"]
        },
        
        # Section 3: Strengths & Style (3 questions)
        {
            "id": 7,
            "section": "strengths",
            "question": "What are your top 3 strengths as a sales professional?",
            "field_mapping": ["strengths"]
        },
        {
            "id": 8,
            "section": "strengths",
            "question": "How would you describe your communication style? (e.g., Direct, Consultative, Relationship-focused, Data-driven)",
            "field_mapping": ["communication_style"]
        },
        {
            "id": 9,
            "section": "strengths",
            "question": "What types of prospects do you connect with best?",
            "field_mapping": ["style_notes"]
        },
        
        # Section 4: Development (2 questions)
        {
            "id": 10,
            "section": "development",
            "question": "What areas of your sales skills would you like to improve?",
            "field_mapping": ["areas_to_improve"]
        },
        {
            "id": 11,
            "section": "development",
            "question": "What challenges do you face most often in your sales process?",
            "field_mapping": ["style_notes"]
        },
        
        # Section 5: Goals & Preferences (3 questions)
        {
            "id": 12,
            "section": "goals",
            "question": "What are your goals for this quarter?",
            "field_mapping": ["quarterly_goals"]
        },
        {
            "id": 13,
            "section": "goals",
            "question": "What types of meetings do you do most often? (e.g., discovery, demo, closing)",
            "field_mapping": ["preferred_meeting_types"]
        },
        {
            "id": 14,
            "section": "goals",
            "question": "What company sizes do you typically target? (e.g., 1-50, 50-200, 200-1000, 1000+)",
            "field_mapping": ["target_company_sizes"]
        },
        
        # Section 6: Territory (1 question)
        {
            "id": 15,
            "section": "territory",
            "question": "What regions or markets do you focus on? (e.g., North America, Europe, APAC)",
            "field_mapping": ["target_regions"]
        }
    ]
    
    def __init__(self):
        """Initialize Anthropic client."""
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable not set")
        
        self.client = Anthropic(api_key=api_key)
    
    def start_interview(self) -> Dict[str, Any]:
        """
        Start a new interview session.
        
        Returns:
            Dict with session_id and first question
        """
        import uuid
        
        session_id = str(uuid.uuid4())
        first_question = self.QUESTIONS[0]
        
        return {
            "session_id": session_id,
            "question_id": first_question["id"],
            "question": first_question["question"],
            "progress": 1,  # First question is progress 1
            "total_questions": len(self.QUESTIONS)
        }
    
    def get_next_question(
        self,
        current_question_id: int,
        responses: Dict[int, str]
    ) -> Optional[Dict[str, Any]]:
        """
        Get the next question in the interview.
        
        Args:
            current_question_id: ID of current question
            responses: Dict of question_id -> response
            
        Returns:
            Next question dict or None if interview complete
        """
        next_id = current_question_id + 1
        
        if next_id > len(self.QUESTIONS):
            return None
        
        next_question = self.QUESTIONS[next_id - 1]
        # Progress is the question number (1-15), not percentage
        progress = next_id
        
        return {
            "question_id": next_question["id"],
            "question": next_question["question"],
            "progress": progress,
            "total_questions": len(self.QUESTIONS)
        }
    
    def analyze_responses(self, responses: Dict[int, str]) -> Dict[str, Any]:
        """
        Analyze interview responses and generate structured profile.
        
        Args:
            responses: Dict of question_id -> response
            
        Returns:
            Structured profile data
        """
        # Build context from responses
        responses_text = "\n\n".join([
            f"Q{qid}: {self.QUESTIONS[qid-1]['question']}\nA: {answer}"
            for qid, answer in responses.items()
        ])
        
        # AI prompt for analysis
        prompt = f"""You are analyzing a sales rep's onboarding interview responses to create a structured profile.

Interview Responses:
{responses_text}

Extract and structure the following information in JSON format:

{{
  "full_name": "Extract full name",
  "role": "Extract role/title",
  "experience_years": Extract years as integer,
  "sales_methodology": "Extract primary methodology",
  "methodology_description": "Summarize their sales process and approach",
  "communication_style": "Extract communication style",
  "style_notes": "Additional notes about their style and preferences",
  "strengths": ["List", "of", "strengths"],
  "areas_to_improve": ["List", "of", "development", "areas"],
  "target_industries": ["List", "of", "industries"],
  "target_regions": ["List", "of", "regions"],
  "target_company_sizes": ["List", "of", "company", "sizes"],
  "quarterly_goals": "Extract quarterly goals",
  "preferred_meeting_types": ["List", "of", "meeting", "types"],
  "ai_summary": "Write a 2-3 sentence summary of this sales rep's profile, highlighting their methodology, strengths, and focus areas."
}}

Important:
- Extract exact information from responses
- Don't make up information not provided
- Use empty arrays [] if information not provided
- Keep ai_summary concise and actionable
- Format company sizes as ranges (e.g., "50-200", "200-1000")

Return ONLY the JSON, no other text."""

        try:
            # Call Claude for analysis
            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=2000,
                messages=[{
                    "role": "user",
                    "content": prompt
                }]
            )
            
            # Extract JSON from response
            content = response.content[0].text
            
            # Parse JSON
            profile_data = json.loads(content)
            
            # Store raw interview responses
            profile_data["interview_responses"] = responses
            
            return profile_data
            
        except Exception as e:
            print(f"Error analyzing interview responses: {str(e)}")
            
            # Fallback: basic extraction
            return self._basic_extraction(responses)
    
    def _basic_extraction(self, responses: Dict[int, str]) -> Dict[str, Any]:
        """
        Basic extraction fallback if AI analysis fails.
        
        Args:
            responses: Dict of question_id -> response
            
        Returns:
            Basic profile data
        """
        profile_data = {
            "full_name": responses.get(1, "").split("\n")[0][:100],  # First line
            "role": "",
            "experience_years": 0,
            "sales_methodology": responses.get(4, "")[:100],
            "methodology_description": responses.get(5, "")[:500],
            "communication_style": responses.get(8, "")[:100],
            "style_notes": "",
            "strengths": [],
            "areas_to_improve": [],
            "target_industries": [],
            "target_regions": [],
            "target_company_sizes": [],
            "quarterly_goals": responses.get(12, "")[:500],
            "preferred_meeting_types": [],
            "ai_summary": "Profile created from interview responses.",
            "interview_responses": responses
        }
        
        return profile_data
    
    def generate_personalization_settings(
        self,
        profile_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate AI personalization settings based on profile.
        
        Args:
            profile_data: Structured profile data
            
        Returns:
            Personalization settings dict
        """
        prompt = f"""Based on this sales rep's profile, suggest personalization settings for AI agents.

Profile:
- Name: {profile_data.get('full_name')}
- Methodology: {profile_data.get('sales_methodology')}
- Style: {profile_data.get('communication_style')}
- Strengths: {', '.join(profile_data.get('strengths', []))}
- Focus: {', '.join(profile_data.get('target_industries', []))}

Generate personalization settings in JSON format:

{{
  "tone": "Suggested tone for AI outputs (e.g., 'professional', 'casual', 'technical')",
  "detail_level": "Suggested detail level (e.g., 'concise', 'detailed', 'comprehensive')",
  "focus_areas": ["List", "of", "areas", "to", "emphasize"],
  "avoid_topics": ["List", "of", "topics", "to", "avoid"],
  "preferred_frameworks": ["List", "of", "frameworks", "to", "use"],
  "output_style": "Suggested output style (e.g., 'bullet points', 'narrative', 'structured')"
}}

Return ONLY the JSON."""

        try:
            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=1000,
                messages=[{
                    "role": "user",
                    "content": prompt
                }]
            )
            
            content = response.content[0].text
            settings = json.loads(content)
            
            return settings
            
        except Exception as e:
            print(f"Error generating personalization settings: {str(e)}")
            
            # Fallback: default settings
            return {
                "tone": "professional",
                "detail_level": "detailed",
                "focus_areas": profile_data.get("strengths", []),
                "avoid_topics": [],
                "preferred_frameworks": [profile_data.get("sales_methodology", "")],
                "output_style": "structured"
            }

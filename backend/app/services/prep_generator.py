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
        meeting_type_labels = {
            "discovery": "Discovery Call",
            "demo": "Product Demo", 
            "closing": "Closing Call",
            "follow_up": "Follow-up Meeting",
            "other": "Meeting"
        }
        meeting_label = meeting_type_labels.get(meeting_type, meeting_type)
        
        prompt = f"""Je bent een slimme, ervaren salesvoorbereider. Jij levert commerciële intelligentie – geen verkooppraatjes.

Je doel: een scherpe, strategisch relevante en to-the-point briefing voor een aankomend klantgesprek.

**Prospect Bedrijf**: {prospect}
**Type Meeting**: {meeting_label}

BELANGRIJK:
- Vertaal technologie naar klantwaarde: sneller werken, betere inzichten, minder handwerk, hogere kwaliteit, meer grip
- Focus op wat er speelt bij de prospect EN hoe dat relevant is voor wat wij aanbieden
- Maak het persoonlijk: wat speelt er voor de specifieke contactpersonen?
- Wees zakelijk, bondig en strategisch
- Schrijf alles in het Nederlands
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
Genereer een uitgebreide discovery call briefing met de volgende structuur:

# Meeting Brief: Discovery Call

## 1. Meeting Overview
- Hoofddoel van dit gesprek
- Key focus gebieden (2-3 hoofdonderwerpen)

## 2. 🌍 Marktcontext & Relevantie voor Ons
**BELANGRIJK**: Analyseer wat er speelt in de markt vanuit het perspectief van de prospect EN hoe dit relevant is voor wat wij aanbieden.

### Marktontwikkelingen die deze prospect raken
- [Trend 1 in hun sector]
- [Trend 2 die hen beïnvloedt]
- [Verandering waar ze mee te maken hebben]

### Hoe onze oplossingen hierop aansluiten
- [Onze oplossing X helpt bij trend Y]
- [Onze aanpak lost uitdaging Z op]
- [Concrete waarde die wij kunnen toevoegen]

## 3. 👤 Persoonlijke Relevantie per Contactpersoon
**BELANGRIJK**: Voor elke contactpersoon - wat speelt er voor HEN persoonlijk en vanuit hun rol waar wij bij kunnen helpen?

[Per contactpersoon indien beschikbaar:]
### [Naam] - [Rol]
**Persoonlijke situatie**:
- Wat speelt er voor deze persoon? (carrière, projecten, druk)
- Welke persoonlijke doelen/ambities zijn zichtbaar?

**Rol-specifieke uitdagingen**:
- Welke problemen heeft iemand in deze rol typisch?
- Waar is hij/zij verantwoordelijk voor?

**Hoe wij kunnen helpen**:
- [Concrete manier waarop wij deze persoon kunnen ondersteunen]
- [Wat levert het hem/haar persoonlijk op?]

## 4. 👥 DMU Overview (Decision Making Unit)
**Als er meerdere contactpersonen zijn:**

| Naam | Rol | Positie in DMU | Communicatiestijl |
|------|-----|----------------|-------------------|
| [Naam] | [Functie] | 🟢 Decision Maker / 🔵 Influencer / 🟡 Gatekeeper | [Formeel/Informeel/Technisch] |

**Besluitvormingsanalyse**:
- Hoe lijkt besluitvorming georganiseerd? (top-down, consensus, pragmatisch)
- Wat zijn waarschijnlijk dominante besliscriteria? (ROI, risico, adoptie, gemak)
- Wie moet overtuigd worden en wie beslist uiteindelijk?

## 5. ⏱️ Momentum & Timing

**Timing Score**: [🟢 NU-KANS / 🟡 NURTURE / 🔴 GEEN FOCUS]

**Signalen**:
- [Urgentie-signalen uit nieuws of LinkedIn]
- [Project druk of deadlines]
- [Budget cycli of veranderingen]

**Waarom nu het juiste moment is (of niet)**:
- [Onderbouwing van de timing]

## 6. ⚠️ Waarschuwingen & Gevoeligheden

**Let op bij dit gesprek**:
- [Gevoelig onderwerp 1 - waarom vermijden]
- [Gevoelig onderwerp 2 - waarom vermijden]
- [Mogelijke bezwaren of weerstand]

**Risico's**:
- [Lopend contract met concurrent?]
- [Intern conflict of wisselingen?]
- [Budget of prioriteit issues?]

## 7. Talking Points

### Opening (Eerste 5 minuten)
- Persoonlijke opener (gebaseerd op contactpersoon profiel)
- Meeting agenda
- Toestemming voor vragen

### Discovery (Volgende 20 minuten)
- Onderwerp 1 om te verkennen
- Onderwerp 2 om te verkennen
- Onderwerp 3 om te verkennen

### Value Proposition (Volgende 10 minuten)
- Hoe wij kunnen helpen (specifiek voor hun situatie)
- Relevante case study
- Onderscheidend vermogen

### Next Steps (Laatste 5 minuten)
- Concrete vervolgactie
- Timeline
- Wie betrekken we erbij?

## 8. Discovery Vragen

### Situatievragen
1. [Vraag over huidige situatie]
2. [Vraag over hun proces]
3. [Vraag over hun team]

### Probleemvragen
1. [Vraag over uitdagingen]
2. [Vraag over pijnpunten]
3. [Vraag over impact]

### Implicatievragen
1. [Vraag over consequenties]
2. [Vraag over kosten]
3. [Vraag over risico's]

### Need-Payoff Vragen
1. [Vraag over ideale oplossing]
2. [Vraag over voordelen]
3. [Vraag over waarde]

## 9. Meeting Strategie

### Primair Doel
[Wat je MOET bereiken]

### Secundaire Doelen
- [Nice to have 1]
- [Nice to have 2]

### Potentiële Bezwaren & Responses
- Bezwaar: [Veelvoorkomend bezwaar]
  Response: [Hoe te adresseren]

### Aanbevolen Vervolgstap
- [Concrete suggestie: workshop, case delen, voorstel, demo]
- [Wie vanuit ons team moet aanhaken?]

---

Onthoud:
- Wees specifiek en actionable
- Gebruik informatie uit de context
- Verzin geen feiten die niet in de context staan
- Maak alles relevant voor deze specifieke prospect
- Focus op HUN behoeften, niet onze features
- Schrijf in het Nederlands
""",
            "demo": """
Genereer een product demo briefing met de volgende structuur:

# Meeting Brief: Product Demo

## 1. Demo Overview
- Demo doelstelling
- Key features om te tonen
- Tijdsindeling

## 2. 🌍 Relevantie voor Hun Situatie
### Marktontwikkelingen
- [Trend die hen raakt en relevant is voor de demo]

### Waarom onze oplossing nu relevant is
- [Concrete aansluiting op hun uitdagingen]

## 3. 👤 Per Contactpersoon
[Voor elke aanwezige:]
### [Naam] - [Rol]
- **Wat belangrijk is voor deze persoon**: [hun focus/belangen]
- **Demo-aandachtspunten**: [wat laten zien dat hen aanspreekt]
- **Communicatiestijl**: [formeel/technisch/strategisch]

## 4. 👥 DMU & Besluitvorming
| Naam | Rol | Positie | Focus |
|------|-----|---------|-------|
[Tabel met aanwezigen]

**Wie beslist wat**: [analyse van besluitvormingsproces]

## 5. ⚠️ Waarschuwingen
- [Gevoelige onderwerpen om te vermijden]
- [Mogelijke bezwaren voorbereiden]

## 6. Demo Flow

### Introductie (5 min)
- Recap discovery inzichten
- Demo agenda
- Bevestig hun prioriteiten

### Feature Showcase (30 min)
- Feature 1: [Adresseert pijnpunt X]
- Feature 2: [Lost uitdaging Y op]
- Feature 3: [Maakt resultaat Z mogelijk]

### Q&A (15 min)
- Verwachte vragen
- Technische details
- Integratiepunten

### Volgende Stappen (10 min)
- Trial/POC voorstel
- Timeline
- Benodigde resources

## 7. Demo Talking Points
- [Key message 1]
- [Key message 2]
- [Key message 3]

## 8. Vragen om te Stellen
1. [Valideer begrip]
2. [Peil interesse]
3. [Identificeer blokkades]

## 9. Aanbevolen Vervolgstap
- [Concrete next step na de demo]
- [Wie betrekken?]

Schrijf in het Nederlands.
""",
            "closing": """
Genereer een closing call briefing met de volgende structuur:

# Meeting Brief: Closing Call

## 1. Deal Overview
- Deal omvang
- Timeline
- Beslissers

## 2. ⏱️ Momentum & Timing
**Timing Score**: [🟢 NU-KANS / 🟡 NURTURE / 🔴 GEEN FOCUS]
- Waarom nu het moment is om te closen
- Urgentie-signalen

## 3. 👥 DMU & Besluitvorming
| Naam | Rol | Positie | Status |
|------|-----|---------|--------|
[Wie moet tekenen, wie moet akkoord geven]

**Besluitvormingsproces**: [Hoe de beslissing wordt genomen]

## 4. 👤 Per Beslisser - Wat Speelt Er
[Per persoon die betrokken is bij de beslissing:]
### [Naam] - [Rol]
- **Persoonlijke stake**: [Wat levert het hen op?]
- **Mogelijke zorgen**: [Waar zijn ze bezorgd over?]
- **Hoe overtuigen**: [Wat hebben ze nodig om ja te zeggen?]

## 5. ⚠️ Risico's & Blokkades
- [Mogelijke deal-killers]
- [Concurrentie?]
- [Budget/timing issues?]
- [Interne weerstand?]

## 6. Value Summary
- ROI aangetoond
- Key benefits
- Onderscheidend vermogen vs concurrentie

## 7. Closing Talking Points

### Value Recap
- [Benefit 1 met bewijs]
- [Benefit 2 met bewijs]
- [Benefit 3 met bewijs]

### Zorgen Adresseren
- [Zorg 1 en response]
- [Zorg 2 en response]

### Urgentie Creëren
- [Reden om nu te closen]
- [Beperkte tijd/incentive]

## 8. Closing Vragen
1. [Bevestig dat besliscriteria zijn voldaan]
2. [Identificeer resterende blokkades]
3. [Vraag om de business]

## 9. Onderhandelingsstrategie
- Walk-away punt
- Concessies die we kunnen bieden
- Must-haves vs nice-to-haves

## 10. Concrete Vervolgstap
- [Wat moet er nu gebeuren?]
- [Contract review proces]
- [Implementatie timeline]

Schrijf in het Nederlands.
""",
            "follow_up": """
Genereer een follow-up meeting briefing met de volgende structuur:

# Meeting Brief: Follow-up Meeting

## 1. Vorige Meeting Recap
- Wat is besproken
- Gemaakte afspraken
- Open punten

## 2. 🌍 Nieuwe Ontwikkelingen
### Bij de prospect
- [Nieuws of veranderingen sinds laatste contact]
- [Relevante ontwikkelingen in hun markt]

### Bij ons
- [Updates die relevant zijn voor hen]
- [Nieuwe features/mogelijkheden]

## 3. 👤 Per Contactpersoon - Update
[Per persoon:]
### [Naam] - [Rol]
- **Status sinds vorige meeting**: [Wat is er veranderd?]
- **Huidige focus**: [Waar zijn ze nu mee bezig?]
- **Aandachtspunten voor dit gesprek**: [Waar op letten?]

## 4. ⏱️ Momentum Check
**Huidige status**: [🟢 Warm / 🟡 Lauw / 🔴 Koud]
- Signalen van voortgang of stagnatie
- Wat moet er gebeuren om vooruit te komen?

## 5. ⚠️ Waarschuwingen
- [Gevoeligheden of veranderde omstandigheden]
- [Mogelijke obstakels]

## 6. Follow-up Agenda
- Open vragen adresseren
- Aanvullende informatie presenteren
- Deal vooruit bewegen

## 7. Talking Points
- [Update 1]
- [Update 2]
- [Antwoord op vraag X]

## 8. Vragen om te Stellen
1. [Voortgang sinds laatste meeting]
2. [Nieuwe ontwikkelingen aan hun kant]
3. [Timeline update]

## 9. Aanbevolen Vervolgstap
- [Concrete next step]
- [Wie moet erbij betrokken worden?]

Schrijf in het Nederlands.
""",
            "other": """
Genereer een meeting briefing met de volgende structuur:

# Meeting Brief

## 1. Meeting Overview
- Doelstelling
- Context

## 2. 🌍 Relevantie
- Wat speelt er in hun markt?
- Hoe sluit dit aan bij wat wij doen?

## 3. 👤 Per Contactpersoon
[Per aanwezige:]
- **Naam & Rol**: [...]
- **Wat speelt er voor hen**: [persoonlijk en vanuit rol]
- **Hoe kunnen wij helpen**: [concrete waarde]

## 4. ⚠️ Waarschuwingen
- [Gevoeligheden]
- [Aandachtspunten]

## 5. Talking Points
- [Punt 1]
- [Punt 2]
- [Punt 3]

## 6. Vragen om te Stellen
1. [Vraag 1]
2. [Vraag 2]
3. [Vraag 3]

## 7. Strategie & Vervolgstap
- Doel van dit gesprek
- Succescriteria
- Aanbevolen vervolgactie

Schrijf in het Nederlands.
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

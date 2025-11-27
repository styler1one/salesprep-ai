"""
RAG Service for Meeting Preparation

Retrieves relevant context from Knowledge Base (Pinecone) and Research Briefs
to build comprehensive meeting preparation context.

Enhanced with Profile Context for personalized outputs.
"""

from typing import List, Dict, Any, Optional
import logging
from app.services.vector_store import VectorStore
from app.services.embeddings import EmbeddingsService
from app.services.context_service import ContextService
from supabase import create_client
import os

logger = logging.getLogger(__name__)

# Initialize services
embeddings_service = EmbeddingsService()
vector_store = VectorStore()
context_service = ContextService()


class RAGService:
    """Service for Retrieval-Augmented Generation queries"""
    
    def __init__(self):
        self.supabase = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        )
    
    async def query_knowledge_base(
        self,
        query: str,
        organization_id: str,
        top_k: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Query Knowledge Base (Pinecone) for relevant chunks
        
        Args:
            query: Search query (company name + context)
            organization_id: Filter by organization
            top_k: Number of results to return
            
        Returns:
            List of relevant KB chunks with metadata
        """
        try:
            # Generate embedding for query
            query_embedding = await embeddings_service.embed_text(query)
            
            # Query Pinecone with organization filter
            results = vector_store.query(
                vector=query_embedding,
                filter={"organization_id": organization_id},
                top_k=top_k,
                include_metadata=True
            )
            
            # Extract and format results
            kb_chunks = []
            for match in results.matches:
                kb_chunks.append({
                    "text": match.metadata.get("text", ""),
                    "source": match.metadata.get("filename", "Unknown"),
                    "score": match.score,
                    "chunk_id": match.id
                })
            
            logger.info(f"Found {len(kb_chunks)} KB chunks for query: {query[:50]}...")
            return kb_chunks
            
        except Exception as e:
            logger.error(f"Error querying knowledge base: {e}")
            return []
    
    async def query_research_brief(
        self,
        company_name: str,
        organization_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Find existing research brief for company
        
        Args:
            company_name: Prospect company name
            organization_id: Filter by organization
            
        Returns:
            Research brief data if found, None otherwise
        """
        try:
            # Query research_briefs table
            response = self.supabase.table("research_briefs").select(
                "id, company_name, brief_content, company_data, key_people, recent_news, created_at"
            ).eq(
                "organization_id", organization_id
            ).ilike(
                "company_name", f"%{company_name}%"
            ).eq(
                "status", "completed"
            ).order(
                "created_at", desc=True
            ).limit(1).execute()
            
            if response.data and len(response.data) > 0:
                research = response.data[0]
                logger.info(f"Found research brief for {company_name}")
                return research
            else:
                logger.info(f"No research brief found for {company_name}")
                return None
                
        except Exception as e:
            logger.error(f"Error querying research brief: {e}")
            return None
    
    async def combine_results(
        self,
        kb_chunks: List[Dict[str, Any]],
        research_data: Optional[Dict[str, Any]],
        prospect_company: str,
        meeting_type: str,
        custom_notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Combine KB and Research data into structured context
        
        Args:
            kb_chunks: Knowledge Base chunks
            research_data: Research brief data
            prospect_company: Prospect company name
            meeting_type: Type of meeting
            custom_notes: Optional custom notes
            
        Returns:
            Structured context for AI generation
        """
        # Build company context from KB
        company_context = self._format_kb_chunks(kb_chunks)
        
        # Build prospect context from research
        prospect_context = self._format_research_data(research_data) if research_data else None
        
        # Combine into final context
        context = {
            "prospect_company": prospect_company,
            "meeting_type": meeting_type,
            "custom_notes": custom_notes or "",
            "company_info": {
                "kb_chunks": kb_chunks,
                "formatted_context": company_context
            },
            "prospect_info": {
                "research_data": research_data,
                "formatted_context": prospect_context
            },
            "has_kb_data": len(kb_chunks) > 0,
            "has_research_data": research_data is not None
        }
        
        logger.info(
            f"Combined context: {len(kb_chunks)} KB chunks, "
            f"{'with' if research_data else 'without'} research data"
        )
        
        return context
    
    def _format_kb_chunks(self, chunks: List[Dict[str, Any]]) -> str:
        """Format KB chunks into readable text"""
        if not chunks:
            return "No company knowledge base data available."
        
        formatted = "## Your Company Information (from Knowledge Base):\n\n"
        for i, chunk in enumerate(chunks[:10], 1):  # Limit to top 10
            formatted += f"{i}. **{chunk['source']}** (relevance: {chunk['score']:.2f})\n"
            formatted += f"   {chunk['text'][:300]}...\n\n"
        
        return formatted
    
    def _format_research_data(self, research: Dict[str, Any]) -> str:
        """Format research data into readable text"""
        formatted = f"## Prospect Intelligence (from Research):\n\n"
        formatted += f"**Company**: {research.get('company_name', 'Unknown')}\n\n"
        
        if research.get('company_data'):
            formatted += f"**Overview**: {research['company_data'][:500]}...\n\n"
        
        if research.get('key_people'):
            formatted += f"**Key People**: {research['key_people'][:300]}...\n\n"
        
        if research.get('recent_news'):
            formatted += f"**Recent News**: {research['recent_news'][:300]}...\n\n"
        
        if research.get('brief_content'):
            formatted += f"**Full Brief**: {research['brief_content'][:500]}...\n\n"
        
        return formatted
    
    async def build_context_for_ai(
        self,
        prospect_company: str,
        meeting_type: str,
        organization_id: str,
        user_id: Optional[str] = None,
        custom_notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Main method to build complete context for AI generation
        
        Args:
            prospect_company: Prospect company name
            meeting_type: Type of meeting
            organization_id: Organization ID
            user_id: Optional user ID for profile context
            custom_notes: Optional custom notes
            
        Returns:
            Complete context for AI prompt
        """
        # Build search query
        query = f"{prospect_company} {meeting_type} meeting"
        if custom_notes:
            query += f" {custom_notes}"
        
        # Query KB and Research in parallel
        kb_chunks = await self.query_knowledge_base(query, organization_id)
        research_data = await self.query_research_brief(prospect_company, organization_id)
        
        # Combine results
        context = await self.combine_results(
            kb_chunks,
            research_data,
            prospect_company,
            meeting_type,
            custom_notes
        )
        
        # Add profile context if user_id provided
        if user_id:
            try:
                profile_context = context_service.get_user_context(user_id, organization_id)
                context["profile_context"] = profile_context
                context["has_profile_context"] = True
                
                # Add formatted profile context for prompt
                formatted_profile = context_service.get_context_for_prompt(
                    user_id, organization_id, max_tokens=1500
                )
                context["formatted_profile_context"] = formatted_profile
                
                logger.info(f"Added profile context for user {user_id}")
            except Exception as e:
                logger.warning(f"Could not load profile context: {e}")
                context["has_profile_context"] = False
                context["formatted_profile_context"] = ""
        else:
            context["has_profile_context"] = False
            context["formatted_profile_context"] = ""
        
        return context


# Singleton instance
rag_service = RAGService()

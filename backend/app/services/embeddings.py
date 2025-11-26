"""
Embeddings service using Voyage AI.
Generates vector embeddings for text chunks.
"""

import os
from typing import List
import voyageai


class EmbeddingsService:
    """Generate embeddings using Voyage AI."""
    
    def __init__(self):
        """Initialize Voyage AI client."""
        api_key = os.getenv("VOYAGE_API_KEY")
        if not api_key:
            raise ValueError("VOYAGE_API_KEY environment variable not set")
        
        self.client = voyageai.Client(api_key=api_key)
        self.model = "voyage-2"
    
    def generate_embeddings(
        self,
        texts: List[str],
        input_type: str = "document"
    ) -> List[List[float]]:
        """
        Generate embeddings for a list of texts.
        
        Args:
            texts: List of text strings to embed
            input_type: "document" for knowledge base, "query" for search
            
        Returns:
            List of embedding vectors (1024 dimensions each)
        """
        if not texts:
            return []
        
        try:
            response = self.client.embed(
                texts=texts,
                model=self.model,
                input_type=input_type
            )
            return response.embeddings
        except Exception as e:
            raise ValueError(f"Failed to generate embeddings: {str(e)}")
    
    def generate_embedding(self, text: str, input_type: str = "document") -> List[float]:
        """
        Generate embedding for a single text.
        
        Args:
            text: Text string to embed
            input_type: "document" for knowledge base, "query" for search
            
        Returns:
            Embedding vector (1024 dimensions)
        """
        embeddings = self.generate_embeddings([text], input_type)
        return embeddings[0] if embeddings else []

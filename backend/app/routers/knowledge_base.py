"""
Knowledge Base API endpoints.
Handles file uploads, processing, and retrieval.
"""

import os
import uuid
from typing import List
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from app.deps import get_current_user
from supabase import create_client, Client
from app.services.file_processor import FileProcessor
from app.services.text_chunker import TextChunker
from app.services.embeddings import EmbeddingsService
from app.services.vector_store import VectorStore

router = APIRouter()

# Initialize Supabase client
supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

# File upload configuration
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_MIME_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/markdown"
]
ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md"]


async def process_file_background(
    file_id: str,
    file_path: str,
    file_type: str,
    organization_id: str
):
    """
    Background task to process uploaded file.
    1. Download from storage
    2. Extract text
    3. Chunk text
    4. Generate embeddings
    5. Store in Pinecone
    6. Update database
    """
    try:
        # Update status to processing
        supabase.table("knowledge_base_files").update({
            "status": "processing"
        }).eq("id", file_id).execute()
        
        # Download file from storage
        file_data = supabase.storage.from_("knowledge-base-files").download(file_path)
        
        # Extract text
        file_processor = FileProcessor()
        import io
        text = file_processor.extract_text(io.BytesIO(file_data), file_type)
        
        if not text or not text.strip():
            raise ValueError("No text could be extracted from file")
        
        # Chunk text
        chunker = TextChunker(chunk_size=500, chunk_overlap=50)
        chunks = chunker.chunk_text(text)
        
        if not chunks:
            raise ValueError("No chunks created from text")
        
        # Generate embeddings
        embeddings_service = EmbeddingsService()
        chunk_texts = [chunk["content"] for chunk in chunks]
        embeddings = embeddings_service.generate_embeddings(chunk_texts, input_type="document")
        
        # Prepare vectors for Pinecone
        vector_store = VectorStore()
        vectors = []
        chunk_records = []
        
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            vector_id = f"{file_id}:{i}"
            
            vectors.append({
                "id": vector_id,
                "values": embedding,
                "metadata": {
                    "file_id": file_id,
                    "chunk_index": i,
                    "organization_id": organization_id,
                    "content_preview": chunk["content"][:200]  # First 200 chars
                }
            })
            
            chunk_records.append({
                "file_id": file_id,
                "organization_id": organization_id,
                "chunk_index": i,
                "content": chunk["content"],
                "token_count": chunk["token_count"],
                "embedding_id": vector_id
            })
        
        # Store vectors in Pinecone
        vector_store.upsert_vectors(vectors)
        
        # Store chunks in database
        supabase.table("knowledge_base_chunks").insert(chunk_records).execute()
        
        # Update file status to completed
        supabase.table("knowledge_base_files").update({
            "status": "completed",
            "chunk_count": len(chunks)
        }).eq("id", file_id).execute()
        
    except Exception as e:
        # Update status to failed
        supabase.table("knowledge_base_files").update({
            "status": "failed",
            "error_message": str(e)
        }).eq("id", file_id).execute()
        
        # Clean up: delete file from storage
        try:
            supabase.storage.from_("knowledge-base-files").remove([file_path])
        except:
            pass


@router.post("/upload")
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Upload a file to the knowledge base.
    File is uploaded to storage and processed in the background.
    """
    # Get user's organization
    user_id = current_user.get("sub")
    org_response = supabase.table("organization_members").select("organization_id").eq("user_id", user_id).execute()
    
    if not org_response.data:
        raise HTTPException(status_code=403, detail="User not in any organization")
    
    organization_id = org_response.data[0]["organization_id"]
    
    # Get file extension
    file_extension = file.filename.split(".")[-1].lower() if "." in file.filename else ""
    file_extension_with_dot = f".{file_extension}" if file_extension else ""
    
    # Validate file type (check both MIME type and extension)
    has_valid_mime = file.content_type in ALLOWED_MIME_TYPES
    has_valid_extension = file_extension_with_dot in ALLOWED_EXTENSIONS
    
    if not has_valid_mime and not has_valid_extension:
        raise HTTPException(
            status_code=400,
            detail=f"File type not supported. Allowed types: PDF, DOCX, TXT, MD"
        )
    
    # Read file content
    file_content = await file.read()
    file_size = len(file_content)
    
    # Validate file size
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size: {MAX_FILE_SIZE / 1024 / 1024}MB"
        )
    
    if file_size == 0:
        raise HTTPException(status_code=400, detail="File is empty")
    
    # Generate unique file ID
    file_id = str(uuid.uuid4())
    
    # Use extension from earlier validation, or default to "bin"
    if not file_extension:
        file_extension = "bin"
    
    # Storage path: {organization_id}/{file_id}.{extension}
    storage_path = f"{organization_id}/{file_id}.{file_extension}"
    
    try:
        # Upload to Supabase Storage
        supabase.storage.from_("knowledge-base-files").upload(
            path=storage_path,
            file=file_content,
            file_options={"content-type": file.content_type}
        )
        
        # Create database record
        db_record = {
            "id": file_id,
            "organization_id": organization_id,
            "user_id": user_id,
            "filename": file.filename,
            "file_size": file_size,
            "file_type": file.content_type,
            "storage_path": storage_path,
            "status": "uploading"
        }
        
        result = supabase.table("knowledge_base_files").insert(db_record).execute()
        
        # Start background processing
        background_tasks.add_task(
            process_file_background,
            file_id,
            storage_path,
            file.content_type,
            organization_id
        )
        
        return JSONResponse(
            status_code=201,
            content={
                "id": file_id,
                "filename": file.filename,
                "file_size": file_size,
                "file_type": file.content_type,
                "status": "uploading",
                "created_at": result.data[0]["created_at"]
            }
        )
        
    except Exception as e:
        # Clean up: try to delete uploaded file
        try:
            supabase.storage.from_("knowledge-base-files").remove([storage_path])
        except:
            pass
        
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.get("/files")
async def list_files(current_user: dict = Depends(get_current_user)):
    """
    List all knowledge base files for the user's organization.
    """
    # Get user's organization
    user_id = current_user.get("sub")
    org_response = supabase.table("organization_members").select("organization_id").eq("user_id", user_id).execute()
    
    if not org_response.data:
        raise HTTPException(status_code=403, detail="User not in any organization")
    
    organization_id = org_response.data[0]["organization_id"]
    
    # Get files
    files_response = supabase.table("knowledge_base_files").select("*").eq("organization_id", organization_id).order("created_at", desc=True).execute()
    
    return {"files": files_response.data}


@router.delete("/files/{file_id}")
async def delete_file(
    file_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a knowledge base file and all its chunks.
    """
    # Get user's organization
    user_id = current_user.get("sub")
    org_response = supabase.table("organization_members").select("organization_id").eq("user_id", user_id).execute()
    
    if not org_response.data:
        raise HTTPException(status_code=403, detail="User not in any organization")
    
    organization_id = org_response.data[0]["organization_id"]
    
    # Get file
    file_response = supabase.table("knowledge_base_files").select("*").eq("id", file_id).eq("organization_id", organization_id).execute()
    
    if not file_response.data:
        raise HTTPException(status_code=404, detail="File not found")
    
    file_data = file_response.data[0]
    
    try:
        # Delete vectors from Pinecone
        vector_store = VectorStore()
        vector_store.delete_by_filter({"file_id": file_id})
        
        # Delete from storage
        supabase.storage.from_("knowledge-base-files").remove([file_data["storage_path"]])
        
        # Delete chunks (will cascade from file deletion)
        # Delete file record (will cascade delete chunks due to ON DELETE CASCADE)
        supabase.table("knowledge_base_files").delete().eq("id", file_id).execute()
        
        return JSONResponse(status_code=204, content=None)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")


@router.get("/files/{file_id}/status")
async def get_file_status(
    file_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get processing status of a file.
    """
    # Get user's organization
    user_id = current_user.get("sub")
    org_response = supabase.table("organization_members").select("organization_id").eq("user_id", user_id).execute()
    
    if not org_response.data:
        raise HTTPException(status_code=403, detail="User not in any organization")
    
    organization_id = org_response.data[0]["organization_id"]
    
    # Get file
    file_response = supabase.table("knowledge_base_files").select("*").eq("id", file_id).eq("organization_id", organization_id).execute()
    
    if not file_response.data:
        raise HTTPException(status_code=404, detail="File not found")
    
    file_data = file_response.data[0]
    
    # Calculate progress
    progress = 0
    message = ""
    
    if file_data["status"] == "uploading":
        progress = 10
        message = "Uploading file..."
    elif file_data["status"] == "processing":
        progress = 50
        message = f"Processing file... ({file_data.get('chunk_count', 0)} chunks)"
    elif file_data["status"] == "completed":
        progress = 100
        message = f"Completed ({file_data['chunk_count']} chunks)"
    elif file_data["status"] == "failed":
        progress = 0
        message = f"Failed: {file_data.get('error_message', 'Unknown error')}"
    
    return {
        "id": file_id,
        "status": file_data["status"],
        "progress": progress,
        "message": message,
        "chunk_count": file_data.get("chunk_count", 0)
    }

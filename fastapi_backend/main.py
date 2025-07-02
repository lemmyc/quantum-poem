from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
from quantum_poetry_generator import QuantumPoetryGenerator

import os
from typing import List, Dict, Any, Optional, Literal # Thêm Optional và Literal
from pathlib import Path
from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
from langchain_openai import OpenAIEmbeddings
from langchain_chroma import Chroma

from contextlib import asynccontextmanager

# Load environment variables
load_dotenv()

# Pydantic models for request/response
class SearchRequest(BaseModel):
    query: str
    top_k: int = 3
    language: Optional[Literal["vn", "jp", "en", "kr", "cn"]] = None

class SearchResult(BaseModel):
    content: str
    score: float
    metadata: Dict[str, Any]

class SearchResponse(BaseModel):
    query: str
    results: List[SearchResult]
    total_results: int
    language_filter: Optional[str] = None # Thêm thông tin filter vào response (tùy chọn)

class TextSearchServer:
    def __init__(self, persist_directory: str = "./chroma_db"):
        """
        Initialize the search server
        
        Args:
            persist_directory: Directory where ChromaDB is persisted
        """
        self.persist_directory = persist_directory
        
        if not os.getenv("OPENAI_API_KEY"):
            raise ValueError("OPENAI_API_KEY not found in environment variables")
        
        self.embeddings = OpenAIEmbeddings(
            openai_api_key=os.getenv("OPENAI_API_KEY"),
            model="text-embedding-3-small"
        )
        
        self.vectorstore = self.load_vectorstore()
    
    def load_vectorstore(self) -> Chroma:
        """
        Load existing ChromaDB vectorstore
        
        Returns:
            ChromaDB vectorstore
        """
        persist_path = Path(self.persist_directory)
        
        if not persist_path.exists():
            raise FileNotFoundError(f"ChromaDB not found at {self.persist_directory}. Please run vectorization first.")
        
        print(f"Loading vectorstore from {self.persist_directory}")
        
        try:
            vectorstore = Chroma(
                persist_directory=self.persist_directory,
                embedding_function=self.embeddings
            )
            
            collection = vectorstore._collection
            count = collection.count()
            
            if count == 0:
                raise ValueError("Vectorstore is empty. Please run vectorization first.")
            
            print(f"Loaded vectorstore with {count} documents")
            return vectorstore
            
        except Exception as e:
            raise Exception(f"Failed to load vectorstore: {str(e)}")
    
    def search_similar_texts(
        self, 
        query: str, 
        top_k: int = 3, 
        language: Optional[str] = None # Thêm tham số language
    ) -> List[SearchResult]:
        """
        Search for similar texts using vector similarity
        
        Args:
            query: Search query
            top_k: Number of top results to return
            language: Optional language code (vn, jp, en, kr) to filter by
            
        Returns:
            List of search results
        """
        try:
            
            # Build filter based on language parameter
            filter_dict = {}
            if language:
                filter_dict["source_file"] = f"{language.lower()}.csv"
            
            results = self.vectorstore.similarity_search_with_score(
                query=query,
                k=top_k,
                filter=filter_dict if filter_dict else None
            )
            
            search_results = []
            for doc, score in results:
                result = SearchResult(
                    content=doc.page_content,
                    score=float(score),
                    metadata=doc.metadata
                )
                search_results.append(result)
            
            return search_results
            
        except Exception as e:
            # Log lỗi chi tiết hơn
            print(f"Error during similarity search: {e}")
            import traceback
            traceback.print_exc()
            raise Exception(f"Search failed: {str(e)}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize the search server on startup"""
    global search_server
    try:
        search_server = TextSearchServer()
        print("✅ Search server initialized successfully!")
    except Exception as e:
        print(f"❌ Failed to initialize search server: {str(e)}")
    yield

app = FastAPI(title="Quantum Poetry Generator API", lifespan=lifespan)

class ShuffleRequest(BaseModel):
    data: List[str]


# Initialize search server
search_server = None

@app.post("/api/shuffle")
async def shuffle_data(request: ShuffleRequest):
    try:
        # Kiểm tra format dữ liệu
        if not isinstance(request.data, list) or not all(isinstance(item, str) for item in request.data):
            raise HTTPException(status_code=404, detail="Sai format: data phải là mảng chuỗi")
        
        poet = QuantumPoetryGenerator(data=request.data)
        distribution = poet.shuffle_data()
        return {"distribution": distribution}
    
    except ValueError as ve:
        # Lỗi mảng rỗng hoặc dữ liệu quá lớn
        raise HTTPException(status_code=404, detail=str(ve))
    except RuntimeError as re:
        # Lỗi mô phỏng
        raise HTTPException(status_code=404, detail=str(re))
    except Exception as e:
        # Các lỗi khác
        raise HTTPException(status_code=404, detail=f"Lỗi không xác định: {str(e)}")

@app.post("/api/search-poem", response_model=SearchResponse)
async def search_texts(request: SearchRequest):
    """
    Search for similar texts using POST method
    
    Args:
        request: SearchRequest containing query, top_k, and optional language
        
    Returns:
        SearchResponse with results
    """
    if not search_server:
        raise HTTPException(status_code=503, detail="Search server not initialized or failed to initialize.")
    
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    
    if request.top_k < 1 or request.top_k > 20: # Giới hạn top_k hợp lý
        raise HTTPException(status_code=400, detail="top_k must be between 1 and 20")
    
    try:
        # Truyền language vào search_similar_texts
        results = search_server.search_similar_texts(
            request.query, 
            request.top_k, 
            request.language
        )
        
        return SearchResponse(
            query=request.query,
            results=results,
            total_results=len(results),
            language_filter=request.language 
        )
        
    except Exception as e:
        print(f"Error in /search endpoint: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

@app.get("/health")
async def health_check():
    """
    Health check endpoint to verify if the search server is running properly
    
    Returns:
        dict: Status of the search server
    """
    if not search_server:
        return {
            "status": "unhealthy",
            "message": "Search server not initialized",
            "search_server_status": "not_initialized"
        }
    
    try:
        
        
        return {
            "status": "healthy",
            "message": "Search server is running properly",
            "search_server_status": "initialized"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "message": f"Search server error: {str(e)}",
            "search_server_status": "error"
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
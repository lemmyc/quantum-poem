# vectorize_csv.py
import os
import pandas as pd
from pathlib import Path
from typing import List
from dotenv import load_dotenv

from langchain_openai import OpenAIEmbeddings
from langchain_chroma import Chroma
from langchain.schema import Document

# Load environment variables
load_dotenv()

class CSVVectorizer:
    def __init__(self, csv_folder_path: str, persist_directory: str = "./chroma_db"):
        """
        Initialize the CSV vectorizer
        
        Args:
            csv_folder_path: Path to folder containing CSV files
            persist_directory: Directory to persist ChromaDB
        """
        self.csv_folder_path = Path(csv_folder_path)
        self.persist_directory = persist_directory
        
        # Initialize OpenAI embeddings
        self.embeddings = OpenAIEmbeddings(
            model="text-embedding-3-small",
            openai_api_key=os.getenv("OPENAI_API_KEY")
        )
        
        # Check if API key is provided
        if not os.getenv("OPENAI_API_KEY"):
            raise ValueError("OPENAI_API_KEY not found in environment variables")
    
    def read_csv_files(self) -> List[Document]:
        """
        Read all CSV files from the specified folder and convert to Document objects
        
        Returns:
            List of Document objects containing poem content
        """
        documents = []
        
        # Check if folder exists
        if not self.csv_folder_path.exists():
            raise FileNotFoundError(f"Folder {self.csv_folder_path} does not exist")
        
        # Get all CSV files
        csv_files = list(self.csv_folder_path.glob("*.csv"))
        
        if not csv_files:
            raise ValueError(f"No CSV files found in {self.csv_folder_path}")
        
        print(f"Found {len(csv_files)} CSV files")
        
        for csv_file in csv_files:
            print(f"Processing: {csv_file.name}")
            
            try:
                # Read CSV file
                df = pd.read_csv(csv_file)
                
                # Check if 'poem' column exists
                if 'poem' not in df.columns:
                    print(f"Warning: 'poem' column not found in {csv_file.name}. Skipping...")
                    continue
                
                # Create Document objects for each poem
                for idx, row in df.iterrows():
                    poem_content = str(row['poem']).strip()
                    
                    # Skip empty or NaN poems
                    if pd.isna(row['poem']) or not poem_content:
                        continue
                    
                    # Create document with metadata
                    doc = Document(
                        page_content=poem_content,
                        metadata={
                            'source_file': csv_file.name,
                            'row_index': idx,
                            'file_path': str(csv_file)
                        }
                    )
                    documents.append(doc)
                
                print(f"Loaded {len(df)} poems from {csv_file.name}")
                
            except Exception as e:
                print(f"Error processing {csv_file.name}: {str(e)}")
                continue
        
        print(f"Total documents loaded: {len(documents)}")
        return documents
    
    def create_vectorstore(self, documents: List[Document]) -> Chroma:
        """
        Create ChromaDB vectorstore from documents
        
        Args:
            documents: List of Document objects
            
        Returns:
            ChromaDB vectorstore
        """
        print("Creating vector embeddings...")
        
        # Create ChromaDB vectorstore
        vectorstore = Chroma.from_documents(
            documents=documents,
            embedding=self.embeddings,
            persist_directory=self.persist_directory
        )
        
        print(f"Created vectorstore with {len(documents)} documents")
        return vectorstore
    
    def persist_vectorstore(self, vectorstore: Chroma):
        """
        Persist the vectorstore to disk
        
        Args:
            vectorstore: ChromaDB vectorstore to persist
        """
        print(f"Persisting vectorstore to {self.persist_directory}")
        vectorstore.persist()
        print("Vectorstore persisted successfully!")
    
    def vectorize_csv_folder(self):
        """
        Complete process: read CSVs, create vectorstore, and persist
        """
        try:
            # Read CSV files
            documents = self.read_csv_files()
            
            if not documents:
                print("No documents to vectorize. Exiting...")
                return
            
            # Create vectorstore
            vectorstore = self.create_vectorstore(documents)
            
            # Persist vectorstore
            self.persist_vectorstore(vectorstore)
            
            print("\n✅ Vectorization completed successfully!")
            print(f"📁 Database saved to: {self.persist_directory}")
            print(f"📊 Total documents: {len(documents)}")
            
        except Exception as e:
            print(f"❌ Error during vectorization: {str(e)}")
            raise

def main():
    """
    Main function to vectorize CSV files
    """
    # Configuration
    CSV_FOLDER = ""  # Change this to your CSV folder path
    PERSIST_DIR = "./chroma_db"
    
    print("🚀 Starting CSV vectorization process...")
    
    # Create vectorizer
    vectorizer = CSVVectorizer(CSV_FOLDER, PERSIST_DIR)
    
    # Run vectorization
    vectorizer.vectorize_csv_folder()

if __name__ == "__main__":
    main()
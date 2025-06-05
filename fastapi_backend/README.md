# Quantum Poetry Generator API

A **FastAPI** app that shuffles words using **Qiskit's quantum-inspired randomness** and provides semantic search over poetry using OpenAI embeddings and ChromaDB.

---

## 🚀 Features

* **Endpoint**: `POST /api/shuffle`
  - Quantum-inspired shuffling of input words, returns a frequency distribution.
* **Endpoint**: `POST /api/search-poem`
  - Semantic search for similar poems using vector embeddings (OpenAI + ChromaDB).
* **Error Handling**:
  - Returns appropriate HTTP errors for invalid input, missing data, or server issues.
* **Local Simulation**:
  - Runs entirely locally for shuffling – no IBM Quantum account required.
  - For semantic search, requires an OpenAI API key for embeddings.

---

## ⚙️ Setup

### 1. Clone or Prepare Files

Create or clone a directory with the following files:

* `quantum_poetry_generator.py` — Quantum shuffling logic
* `main.py` — FastAPI app entry point
* `vectorize_csv.py` — Script to vectorize CSVs for semantic search
* `requirements.txt` — List of dependencies
* `data/` — Folder containing CSV files (e.g., `vn.csv`, `jp.csv`, `en.csv`, `kr.csv`)

### 2. Create and Activate Virtual Environment

> **Note:** You only need to create the virtual environment (`venv`) once. For future sessions, just activate it (skip the creation step).

#### **Windows**
```bash
python -m venv venv   # (THIS IS CREATION STEP, only run once)
venv\Scripts\activate # (Run this every time you start a new terminal)
```
#### **Linux/Mac**
```bash
python3 -m venv venv  # (THIS IS CREATION STEP, only run once)
source venv/bin/activate # (Run this every time you start a new terminal)
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Prepare Environment Variables

Create a `.env` file in `fastapi_backend/` with your OpenAI API key:
```
OPENAI_API_KEY=sk-...
```

### 5. Run the Server

```bash
python main.py
```

Server will start at: [http://localhost:8000](http://localhost:8000)
Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🧪 Test the Endpoints

### 1. Quantum Shuffle
Send a POST request to `/api/shuffle`:
```bash
curl -X POST "http://localhost:8000/api/shuffle" \
     -H "Content-Type: application/json" \
     -d '{"data": ["vui", "sướng", "đã"]}'
```
**Sample Response (randomized):**
```json
{
  "distribution": {
    "vui": 18000,
    "sướng": 16000,
    "đã": 16000
  }
}
```

### 2. Semantic Search
Send a POST request to `/api/search-poem`:
```bash
curl -X POST "http://localhost:8000/api/search-poem" \
     -H "Content-Type: application/json" \
     -d '{"query": "tình yêu", "top_k": 3, "language": "vn"}'
```
**Sample Response:**
```json
{
  "query": "tình yêu",
  "results": [
    {
      "content": "Ánh trăng tình yêu...",
      "score": 0.92,
      "metadata": {"source_file": "vn.csv", "row_index": 123, ...}
    },
    ...
  ],
  "total_results": 3,
  "language_filter": "vn"
}
```

---

## ❌ Error Examples

* **Non-string array for shuffle:**
  ```json
  { "detail": "Sai format: data phải là mảng chuỗi" }
  ```
* **Empty array for shuffle:**
  ```json
  { "detail": "Danh sách dữ liệu không được rỗng" }
  ```
* **Missing or empty query for search:**
  ```json
  { "detail": "Query cannot be empty" }
  ```
* **top_k out of range for search:**
  ```json
  { "detail": "top_k must be between 1 and 20" }
  ```
* **Vectorstore not found or not vectorized:**
  ```json
  { "detail": "ChromaDB not found at ./chroma_db. Please run vectorization first." }
  ```
* **OPENAI_API_KEY missing:**
  ```json
  { "detail": "OPENAI_API_KEY not found in environment variables" }
  ```

---

## 📁 Data Format
- Place your CSV files in the `data/` folder. Each file should have a `poem` column.
- Supported language codes for search: `vn`, `jp`, `en`, `kr` (corresponding to `vn.csv`, `jp.csv`, etc.)

---

## 🛠️ Requirements
- Python 3.8+
- See `requirements.txt` for all dependencies.

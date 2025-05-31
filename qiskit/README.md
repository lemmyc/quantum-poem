# Quantum Poetry Generator API

A **FastAPI** app that shuffles words using **Qiskit’s quantum-inspired randomness**.
The `/shuffle` endpoint accepts an array of strings (e.g., `["vui", "sướng", "đã"]`) and returns a probability distribution via a quantum circuit simulated with `AerSimulator`.

---

## 🚀 Features

* **Endpoint**: `POST /shuffle`
  Returns a frequency distribution of shuffled words.

* **Error Handling**:
  Returns `HTTP 404` for invalid inputs (e.g., non-string arrays, empty arrays).

* **Local Simulation**:
  Runs entirely locally – no IBM Quantum account required.

---

## ⚙️ Setup

### 1. Clone or Prepare Files

Create or clone a directory with the following files:

* `quantum_poetry_generator.py` — Quantum shuffling logic
* `main.py` — FastAPI app entry point
* `requirements.txt` — List of dependencies

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Run the Server

```bash
python main.py
```

Server will start at: [http://localhost:8000](http://localhost:8000)
Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🧪 Test the Endpoint

Send a POST request to `/shuffle`:

```bash
curl -X POST "http://localhost:8000/shuffle" \
     -H "Content-Type: application/json" \
     -d '{"data": ["vui", "sướng", "đã"]}'
```

### ✅ Sample Response (randomized):

```json
{
  "distribution": {
    "vui": 18000,
    "sướng": 16000,
    "đã": 16000
  }
}
```

### ❌ Error Examples (404):

* **Non-string array:**

  ```json
  { "detail": "Sai format: data phải là mảng chuỗi" }
  ```

* **Empty array:**

  ```json
  { "detail": "Danh sách dữ liệu không được rỗng" }
  ```

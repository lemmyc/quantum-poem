from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
from quantum_poetry_generator import QuantumPoetryGenerator

app = FastAPI(title="Quantum Poetry Generator API")

class ShuffleRequest(BaseModel):
    data: List[str]

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
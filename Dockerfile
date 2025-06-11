FROM python:3.10

WORKDIR /app

COPY . .

ENV PYTHONPATH="${PYTHONPATH}:/app/fastapi_backend"

RUN pip install --no-cache-dir -r requirements.txt

CMD ["uvicorn", "fastapi_backend.main:app", "--host", "0.0.0.0", "--port", "8000"]

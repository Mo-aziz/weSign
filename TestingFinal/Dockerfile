FROM python:3.11-slim-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY sign_server.py sign_inference.py sign_paths.py session_manager.py lstm_model.py ./
COPY mediapipeModels ./mediapipeModels
COPY best_model.pt ./best_model.pt

ENV HOST=0.0.0.0
ENV PORT=8001
ENV PYTHONUNBUFFERED=1

EXPOSE 8001

CMD ["sh", "-c", "uvicorn sign_server:app --host 0.0.0.0 --port ${PORT:-8001}"]

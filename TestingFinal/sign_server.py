"""
Sign-language recognition API for local dev and cloud (Railway).
"""

from __future__ import annotations

import base64
import os
import re
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from session_manager import SessionManager
from sign_inference import SignInferenceEngine

engine: SignInferenceEngine | None = None
sessions: SessionManager | None = None

DATA_URL_RE = re.compile(r"^data:image/[a-zA-Z+]+;base64,")

DEV_CORS_ORIGINS = [
    "http://localhost:1420",
    "http://localhost:4173",
    "http://localhost:5173",
    "http://127.0.0.1:1420",
    "http://127.0.0.1:4173",
    "http://127.0.0.1:5173",
    "https://localhost:1420",
    "https://localhost:4173",
    "https://127.0.0.1:1420",
    "https://127.0.0.1:4173",
    "tauri://localhost",
]

# Local dev + Railway-hosted web frontends (when ALLOWED_ORIGINS is not set).
DEFAULT_ORIGIN_REGEX = (
    r"https?://(localhost|127\.0\.0\.1)(:\d+)?"
    r"|https://[a-z0-9-]+\.up\.railway\.app"
)


def _parse_allowed_origins() -> list[str]:
    raw = os.getenv("ALLOWED_ORIGINS", "")
    configured = [part.strip() for part in raw.split(",") if part.strip()]
    return list(dict.fromkeys([*DEV_CORS_ORIGINS, *configured]))


def _parse_origin_regex() -> str | None:
    custom = os.getenv("CORS_ORIGIN_REGEX", "").strip()
    if custom:
        return custom
    if os.getenv("ALLOWED_ORIGINS", "").strip():
        # Explicit origin list only — no broad regex.
        return None
    return DEFAULT_ORIGIN_REGEX


class FrameRequest(BaseModel):
    sessionId: str = Field(..., min_length=1, max_length=128)
    image: str = Field(..., min_length=32, description="Base64-encoded JPEG or PNG frame")


class ResetRequest(BaseModel):
    sessionId: str = Field(..., min_length=1, max_length=128)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global engine, sessions
    engine = SignInferenceEngine()
    ttl = int(os.getenv("SESSION_TTL_SECONDS", "900"))
    sessions = SessionManager(engine, ttl_seconds=ttl)
    yield
    if sessions is not None:
        sessions.shutdown()
        sessions = None
    if engine is not None:
        engine.close()
        engine = None


app = FastAPI(title="WeSign Sign Recognition", lifespan=lifespan)

_allowed_origins = _parse_allowed_origins()
_allow_origin_regex = _parse_origin_regex()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_origin_regex=_allow_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _decode_image_payload(payload: str) -> bytes:
    cleaned = DATA_URL_RE.sub("", payload.strip())
    try:
        return base64.b64decode(cleaned, validate=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid base64 image data") from exc


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "model_loaded": engine is not None,
        "active_sessions": sessions.active_session_count() if sessions else 0,
    }


@app.post("/reset")
def reset(body: ResetRequest) -> dict[str, str]:
    if sessions is None:
        raise HTTPException(status_code=503, detail="Recognition service not initialized")
    sessions.reset(body.sessionId.strip())
    return {"status": "reset", "sessionId": body.sessionId}


@app.post("/frame")
def process_frame(body: FrameRequest) -> dict[str, Any]:
    if sessions is None:
        raise HTTPException(status_code=503, detail="Recognition service not initialized")
    session_id = body.sessionId.strip()
    image_bytes = _decode_image_payload(body.image)
    try:
        result = sessions.process_image_bytes(session_id, image_bytes)
        result["sessionId"] = session_id
        return result
    except ValueError as exc:
        # Single bad frame (camera warming up, corrupt JPEG) — keep session alive.
        return {
            "ready": False,
            "text": None,
            "confidence": 0.0,
            "state": "skipped_frame",
            "recorded_frames": 0,
            "hands_detected": False,
            "sessionId": session_id,
            "warning": str(exc),
        }


def _server_port() -> int:
    return int(os.getenv("PORT", "8001"))


def _server_host() -> str:
    return os.getenv("HOST", "0.0.0.0" if os.getenv("PORT") else "127.0.0.1")


if __name__ == "__main__":
    import multiprocessing

    import uvicorn

    multiprocessing.freeze_support()
    uvicorn.run(
        "sign_server:app",
        host=_server_host(),
        port=_server_port(),
        reload=False,
        log_level="info",
    )

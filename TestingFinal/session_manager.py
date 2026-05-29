"""Per-client sign recognition sessions with TTL cleanup."""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field

from sign_inference import SignInferenceEngine, SignRecognitionState


@dataclass
class TrackedSession:
    state: SignRecognitionState
    last_access: float = field(default_factory=time.time)


class SessionManager:
    def __init__(
        self,
        engine: SignInferenceEngine,
        *,
        ttl_seconds: int = 900,
        cleanup_interval_seconds: int = 60,
    ) -> None:
        self.engine = engine
        self.ttl_seconds = ttl_seconds
        self.cleanup_interval_seconds = cleanup_interval_seconds
        self._sessions: dict[str, TrackedSession] = {}
        self._lock = threading.Lock()
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._cleanup_loop, daemon=True)
        self._thread.start()

    def shutdown(self) -> None:
        self._stop.set()
        self._thread.join(timeout=2)

    def _cleanup_loop(self) -> None:
        while not self._stop.wait(self.cleanup_interval_seconds):
            self.cleanup_expired()

    def cleanup_expired(self) -> int:
        now = time.time()
        removed = 0
        with self._lock:
            expired = [
                session_id
                for session_id, tracked in self._sessions.items()
                if now - tracked.last_access > self.ttl_seconds
            ]
            for session_id in expired:
                del self._sessions[session_id]
                removed += 1
        return removed

    def _get_or_create(self, session_id: str) -> TrackedSession:
        tracked = self._sessions.get(session_id)
        if tracked is None:
            tracked = TrackedSession(state=SignRecognitionState())
            self._sessions[session_id] = tracked
        tracked.last_access = time.time()
        return tracked

    def reset(self, session_id: str) -> None:
        with self._lock:
            tracked = self._get_or_create(session_id)
            tracked.state.reset()

    def process_image_bytes(self, session_id: str, image_bytes: bytes) -> dict:
        with self._lock:
            tracked = self._get_or_create(session_id)
            tracked.last_access = time.time()
            state = tracked.state

        return self.engine.process_image_bytes(state, image_bytes)

    def active_session_count(self) -> int:
        with self._lock:
            return len(self._sessions)

"""
Reusable sign-language inference: MediaPipe landmarks + LSTM classifier.
Paths are resolved from this file's directory so Windows paths with spaces work.
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import Any

import cv2
import mediapipe as mp
import numpy as np
import torch
from mediapipe.tasks.python import vision
from mediapipe.tasks.python.core.base_options import BaseOptions

from lstm_model import SignLSTM
from sign_paths import resource_base

# ── Paths (dev source tree or PyInstaller bundle) ─────────────────────────────

BASE_DIR = resource_base()
CHECKPOINT_PATH = BASE_DIR / "best_model.pt"
MODEL_POSE_PATH = BASE_DIR / "mediapipeModels" / "pose_landmarker_lite.task"
MODEL_HAND_PATH = BASE_DIR / "mediapipeModels" / "hand_landmarker (3).task"
MODEL_FACE_PATH = BASE_DIR / "mediapipeModels" / "face_landmarker.task"

# ── Config (matches livetesting.py) ──────────────────────────────────────────

MAX_FRAMES = 40
INPUT_SIZE = 190
NUM_CLASSES = 17
CLASS_NAMES = [
    "A",
    "D",
    "F",
    "H",
    "O",
    "U",
    "Y",
    "another",
    "book",
    "brother",
    "can",
    "hello",
    "i",
    "my",
    "now",
    "see",
    "you",
]
CONFIDENCE_THRESHOLD = 0.50
CALIBRATION_FRAMES = 15
MIN_SIGN_FRAMES = 10
RECORDING_START_SKIP = 5
AUTO_START_HOLD_FRAMES = 1

FACE_KEY_LANDMARKS = [1, 33, 133, 263, 362, 70, 107, 300, 336, 61, 291, 0, 17, 234, 454, 10, 152, 93, 323, 168]

POSE_LEFT_SHOULDER_IDX = 11
POSE_RIGHT_SHOULDER_IDX = 12
POSE_LEFT_HIP_IDX = 23
POSE_RIGHT_HIP_IDX = 24
FACE_NOSE_IDX = 1
HAND_WRIST_IDX = 0

FRAME_WIDTH = 640
FRAME_HEIGHT = 480


# ── Detectors ────────────────────────────────────────────────────────────────


def build_detectors() -> tuple[vision.PoseLandmarker, vision.HandLandmarker, vision.FaceLandmarker]:
    pose_detector = vision.PoseLandmarker.create_from_options(
        vision.PoseLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=str(MODEL_POSE_PATH)),
            running_mode=vision.RunningMode.VIDEO,
            num_poses=1,
            min_pose_detection_confidence=0.5,
            min_pose_presence_confidence=0.5,
            min_tracking_confidence=0.5,
        )
    )
    hand_detector = vision.HandLandmarker.create_from_options(
        vision.HandLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=str(MODEL_HAND_PATH)),
            running_mode=vision.RunningMode.VIDEO,
            num_hands=2,
            min_hand_detection_confidence=0.4,
            min_hand_presence_confidence=0.4,
            min_tracking_confidence=0.4,
        )
    )
    face_detector = vision.FaceLandmarker.create_from_options(
        vision.FaceLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=str(MODEL_FACE_PATH)),
            running_mode=vision.RunningMode.VIDEO,
            num_faces=1,
            min_face_detection_confidence=0.5,
            min_face_presence_confidence=0.5,
            min_tracking_confidence=0.5,
        )
    )
    return pose_detector, hand_detector, face_detector


# ── Extraction ───────────────────────────────────────────────────────────────


def extract_pose(result: vision.PoseLandmarkerResult) -> tuple[np.ndarray, bool]:
    if not result.pose_landmarks:
        return np.zeros(33 * 3, dtype=np.float32), False
    lms = result.pose_landmarks[0]
    return np.array([[lm.x, lm.y, lm.z] for lm in lms], dtype=np.float32).flatten(), True


def extract_hands(result: vision.HandLandmarkerResult) -> tuple[np.ndarray, np.ndarray, bool, bool]:
    left = np.zeros(21 * 3, dtype=np.float32)
    right = np.zeros(21 * 3, dtype=np.float32)
    left_detected = False
    right_detected = False
    for i, handedness in enumerate(result.handedness):
        label = handedness[0].category_name
        lms = result.hand_landmarks[i]
        flat = np.array([[lm.x, lm.y, lm.z] for lm in lms], dtype=np.float32).flatten()
        if label == "Left":
            left = flat
            left_detected = True
        else:
            right = flat
            right_detected = True
    return left, right, left_detected, right_detected


def extract_face(result: vision.FaceLandmarkerResult) -> tuple[np.ndarray, bool]:
    if not result.face_landmarks:
        return np.zeros(20 * 3, dtype=np.float32), False
    lms = result.face_landmarks[0]
    return (
        np.array(
            [[lms[i].x, lms[i].y, lms[i].z] for i in FACE_KEY_LANDMARKS],
            dtype=np.float32,
        ).flatten(),
        True,
    )


# ── Normalization ────────────────────────────────────────────────────────────


def get_xy(section: np.ndarray, landmark_idx: int) -> np.ndarray:
    start = landmark_idx * 3
    return section[start : start + 2].copy()


def normalize_section_xy(section: np.ndarray, anchor_xy: np.ndarray, scale: float) -> np.ndarray:
    coords = section.reshape(-1, 3)
    coords_xy = coords[:, :2].copy()
    coords_xy = coords_xy - anchor_xy
    if scale > 1e-6:
        coords_xy = coords_xy / scale
    return coords_xy.flatten()


def normalize_frame_live(
    pose: np.ndarray,
    face: np.ndarray,
    lhand: np.ndarray,
    rhand: np.ndarray,
    lhand_detected: bool,
    rhand_detected: bool,
) -> np.ndarray:
    left_shoulder = get_xy(pose, POSE_LEFT_SHOULDER_IDX)
    right_shoulder = get_xy(pose, POSE_RIGHT_SHOULDER_IDX)
    shoulder_dist = np.linalg.norm(left_shoulder - right_shoulder)
    scale = shoulder_dist if shoulder_dist > 1e-6 else 1.0

    shoulder_center = (left_shoulder + right_shoulder) / 2.0
    pose_norm = normalize_section_xy(pose, shoulder_center, scale)

    nose = get_xy(face, FACE_NOSE_IDX)
    face_norm = normalize_section_xy(face, nose, scale)

    if lhand_detected:
        lhand_wrist = get_xy(lhand, HAND_WRIST_IDX)
        lhand_norm = normalize_section_xy(lhand, lhand_wrist, scale)
    else:
        lhand_norm = np.zeros(21 * 2, dtype=np.float32)

    if rhand_detected:
        rhand_wrist = get_xy(rhand, HAND_WRIST_IDX)
        rhand_norm = normalize_section_xy(rhand, rhand_wrist, scale)
    else:
        rhand_norm = np.zeros(21 * 2, dtype=np.float32)

    return np.concatenate([pose_norm, face_norm, lhand_norm, rhand_norm])


# ── Model input ──────────────────────────────────────────────────────────────


def prepare_sequence(frames: list[np.ndarray]) -> tuple[torch.Tensor, torch.Tensor]:
    t_len = len(frames)
    arr = np.array(frames, dtype=np.float32)

    if t_len < MAX_FRAMES:
        pad = np.zeros((MAX_FRAMES - t_len, INPUT_SIZE), dtype=np.float32)
        arr = np.concatenate([arr, pad], axis=0)
    else:
        arr = arr[:MAX_FRAMES]
        t_len = MAX_FRAMES

    mask = np.zeros(MAX_FRAMES, dtype=np.float32)
    mask[:t_len] = 1.0

    x = torch.tensor(arr, dtype=torch.float32).unsqueeze(0)
    mask_t = torch.tensor(mask, dtype=torch.float32).unsqueeze(0)
    return x, mask_t


def classify_with_tta(
    model: SignLSTM,
    frames: list[np.ndarray],
    device: torch.device,
) -> tuple[int, float, torch.Tensor]:
    results: list[torch.Tensor] = []

    x, mask = prepare_sequence(frames)
    x = x.to(device)
    mask = mask.to(device)
    with torch.no_grad():
        probs = torch.softmax(model(x, mask), dim=1)
    results.append(probs)

    if len(frames) > 10:
        x, mask = prepare_sequence(frames[3:])
        x = x.to(device)
        mask = mask.to(device)
        with torch.no_grad():
            probs = torch.softmax(model(x, mask), dim=1)
        results.append(probs)

    if len(frames) > 10:
        x, mask = prepare_sequence(frames[:-3])
        x = x.to(device)
        mask = mask.to(device)
        with torch.no_grad():
            probs = torch.softmax(model(x, mask), dim=1)
        results.append(probs)

    avg_probs = torch.stack(results).mean(dim=0)
    conf, pred = avg_probs.max(dim=1)
    return pred.item(), conf.item(), avg_probs


# ── Frame preprocessing (matches livetesting.py) ─────────────────────────────


def preprocess_bgr_frame(frame: np.ndarray, clahe: cv2.CLAHE) -> np.ndarray:
    frame = cv2.flip(frame, 1)
    frame = cv2.resize(frame, (FRAME_WIDTH, FRAME_HEIGHT))
    lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
    l_channel, a, b = cv2.split(lab)
    frame = cv2.cvtColor(cv2.merge([clahe.apply(l_channel), a, b]), cv2.COLOR_LAB2BGR)
    return frame


# ── Per-user state + shared inference engine ───────────────────────────────────


class SignRecognitionState:
    """Frame-sequence state for one client session."""

    def __init__(self) -> None:
        self._timestamp_ms = 0
        self._last_hands_detected = False
        self.reset()

    def reset(self) -> None:
        self.state = "calibrating"
        self.calibration_counter = 0
        self.recorded_frames: list[np.ndarray] = []
        self.prediction: str | None = None
        self.confidence = 0.0
        self.hand_visible_frames = 0
        self.auto_trigger_armed = True
        self._timestamp_ms = int(time.time() * 1000)
        self._last_hands_detected = False

    def next_timestamp_ms(self) -> int:
        self._timestamp_ms += 33
        return self._timestamp_ms


class SignInferenceEngine:
    """Loads the model once and processes frames for many session states."""

    def __init__(self) -> None:
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = SignLSTM(num_classes=NUM_CLASSES).to(self.device)
        try:
            ckpt = torch.load(CHECKPOINT_PATH, map_location=self.device, weights_only=False)
        except TypeError:
            ckpt = torch.load(CHECKPOINT_PATH, map_location=self.device)
        self.model.load_state_dict(ckpt["model_state"])
        self.model.eval()

        self.pose_detector, self.hand_detector, self.face_detector = build_detectors()
        self.clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))

    def close(self) -> None:
        self.pose_detector.close()
        self.hand_detector.close()
        self.face_detector.close()

    @staticmethod
    def _response(
        session: SignRecognitionState,
        *,
        ready: bool,
        text: str | None,
        confidence: float,
        state: str,
        recorded_count: int = 0,
    ) -> dict[str, Any]:
        return {
            "ready": ready,
            "text": text,
            "confidence": confidence,
            "state": state,
            "recorded_frames": recorded_count,
            "hands_detected": session._last_hands_detected,
        }

    def process_bgr_frame(self, session: SignRecognitionState, frame: np.ndarray) -> dict[str, Any]:
        frame = preprocess_bgr_frame(frame, self.clahe)

        timestamp_ms = session.next_timestamp_ms()
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)

        pose_result = self.pose_detector.detect_for_video(mp_image, timestamp_ms)
        hand_result = self.hand_detector.detect_for_video(mp_image, timestamp_ms)
        face_result = self.face_detector.detect_for_video(mp_image, timestamp_ms)

        pose, _pose_detected = extract_pose(pose_result)
        lhand, rhand, ldet, rdet = extract_hands(hand_result)
        face, _face_detected = extract_face(face_result)

        hands_detected = ldet or rdet
        session._last_hands_detected = hands_detected

        if hands_detected:
            session.hand_visible_frames += 1
        else:
            session.hand_visible_frames = 0
            session.auto_trigger_armed = True

        frame_vec = normalize_frame_live(pose, face, lhand, rhand, ldet, rdet)

        if session.state == "calibrating":
            if hands_detected:
                session.calibration_counter += 1
            else:
                session.calibration_counter = 0
            if session.calibration_counter >= CALIBRATION_FRAMES:
                session.state = "ready"
                session.calibration_counter = 0

        elif session.state == "ready":
            if (
                session.auto_trigger_armed
                and hands_detected
                and session.hand_visible_frames >= AUTO_START_HOLD_FRAMES
            ):
                session.state = "recording"
                session.recorded_frames = []
                session.auto_trigger_armed = False

        elif session.state == "idle":
            if (
                session.auto_trigger_armed
                and hands_detected
                and session.hand_visible_frames >= AUTO_START_HOLD_FRAMES
            ):
                session.state = "recording"
                session.recorded_frames = []
                session.auto_trigger_armed = False

        elif session.state == "recording":
            session.recorded_frames.append(frame_vec)
            if len(session.recorded_frames) >= MAX_FRAMES:
                session.state = "classifying"

        if session.state == "classifying":
            return self._run_classification(session)

        if (
            session.state == "idle"
            and session.prediction
            and session.confidence >= CONFIDENCE_THRESHOLD
        ):
            return self._response(
                session,
                ready=True,
                text=session.prediction,
                confidence=session.confidence,
                state="idle",
                recorded_count=0,
            )

        return self._response(
            session,
            ready=False,
            text=None,
            confidence=0.0,
            state=session.state,
            recorded_count=len(session.recorded_frames),
        )

    def _run_classification(self, session: SignRecognitionState) -> dict[str, Any]:
        recorded_count = len(session.recorded_frames)
        if recorded_count >= MIN_SIGN_FRAMES:
            pred_idx, confidence, _probs = classify_with_tta(
                self.model, session.recorded_frames, self.device
            )
            session.prediction = CLASS_NAMES[pred_idx]
            session.confidence = confidence
        else:
            session.prediction = None
            session.confidence = 0.0

        session.state = "idle"
        session.recorded_frames = []

        if session.prediction and session.confidence >= CONFIDENCE_THRESHOLD:
            return self._response(
                session,
                ready=True,
                text=session.prediction,
                confidence=session.confidence,
                state="idle",
                recorded_count=recorded_count,
            )

        return self._response(
            session,
            ready=False,
            text=None,
            confidence=session.confidence,
            state="idle",
            recorded_count=recorded_count,
        )

    def process_image_bytes(self, session: SignRecognitionState, image_bytes: bytes) -> dict[str, Any]:
        if not image_bytes:
            raise ValueError("Empty image payload")
        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if frame is None:
            frame = cv2.imdecode(np.asarray(bytearray(image_bytes), dtype=np.uint8), cv2.IMREAD_COLOR)
        if frame is None:
            raise ValueError("Could not decode image bytes")
        return self.process_bgr_frame(session, frame)



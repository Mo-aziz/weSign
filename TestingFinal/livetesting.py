import cv2
import numpy as np
import torch
import time
import mediapipe as mp
from mediapipe.tasks.python import vision
from mediapipe.tasks.python.core.base_options import BaseOptions

from lstm_model import SignLSTM

# ── Config ───────────────────────────────────────────────────────────────────
CHECKPOINT     = "best_model.pt" 
#CHECKPOINT     = "checkpointsAugment\\best_model.pt"

MODEL_POSE     = "mediapipeModels\pose_landmarker_lite.task"
MODEL_HAND     = "mediapipeModels\hand_landmarker (3).task"
MODEL_FACE     = "mediapipeModels\\face_landmarker.task"


MAX_FRAMES           = 40
INPUT_SIZE           = 190   # 95 nodes * 2 coords 
NUM_CLASSES = 37
CLASS_NAMES = ['and', 'any', 'book', 'can', 'class', 'finish', 'go', 'good',
               'have', 'hear', 'help', 'i', 'later', 'me', 'morning', 'my',
               'name', 'now', 'open', 'paper', 'please', 'question', 'see',
               'start', 'study', 'test', 'time', 'tomorrow', 'wait', 'want',
               'we', 'what', 'work', 'write', 'yes', 'you', 'your']
CONFIDENCE_THRESHOLD = 0.50
CALIBRATION_FRAMES   = 15
MIN_SIGN_FRAMES      = 10
RECORDING_START_SKIP = 5   # skip first N frames after S pressed  

FACE_KEY_LANDMARKS = [1,33,133,263,362,70,107,300,336,61,291,0,17,234,454,10,152,93,323,168]

POSE_LEFT_SHOULDER_IDX  = 11
POSE_RIGHT_SHOULDER_IDX = 12
POSE_LEFT_HIP_IDX       = 23
POSE_RIGHT_HIP_IDX      = 24
FACE_NOSE_IDX           = 1
HAND_WRIST_IDX          = 0  


# ── Detectors ────────────────────────────────────────────────────────────────

def build_detectors():
    pose_detector = vision.PoseLandmarker.create_from_options(
        vision.PoseLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=MODEL_POSE),
            running_mode=vision.RunningMode.VIDEO,
            num_poses=1,
            min_pose_detection_confidence=0.5,
            min_pose_presence_confidence=0.5,
            min_tracking_confidence=0.5,
        )
    )
    hand_detector = vision.HandLandmarker.create_from_options(
        vision.HandLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=MODEL_HAND),
            running_mode=vision.RunningMode.VIDEO,
            num_hands=2,
            min_hand_detection_confidence=0.4,
            min_hand_presence_confidence=0.4,
            min_tracking_confidence=0.4,
        )
    )
    face_detector = vision.FaceLandmarker.create_from_options(
        vision.FaceLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=MODEL_FACE),
            running_mode=vision.RunningMode.VIDEO,
            num_faces=1,
            min_face_detection_confidence=0.5,
            min_face_presence_confidence=0.5,
            min_tracking_confidence=0.5,
        )
    )
    return pose_detector, hand_detector, face_detector


# ── Extraction ───────────────────────────────────────────────────────────────

def extract_pose(result):
    if not result.pose_landmarks:
        return np.zeros(33 * 3, dtype=np.float32), False
    lms = result.pose_landmarks[0]
    return np.array([[lm.x, lm.y, lm.z] for lm in lms], dtype=np.float32).flatten(), True


def extract_hands(result):
    left           = np.zeros(21 * 3, dtype=np.float32)
    right          = np.zeros(21 * 3, dtype=np.float32)
    left_detected  = False
    right_detected = False
    for i, handedness in enumerate(result.handedness):
        label = handedness[0].category_name
        lms   = result.hand_landmarks[i]
        flat  = np.array([[lm.x, lm.y, lm.z] for lm in lms], dtype=np.float32).flatten()
        if label == "Left":
            left          = flat
            left_detected = True
        else:
            right          = flat
            right_detected = True
    return left, right, left_detected, right_detected


def extract_face(result):
    if not result.face_landmarks:
        return np.zeros(20 * 3, dtype=np.float32), False
    lms = result.face_landmarks[0]
    return np.array(
        [[lms[i].x, lms[i].y, lms[i].z] for i in FACE_KEY_LANDMARKS],
        dtype=np.float32
    ).flatten(), True


# ── Normalization (x,y only — matches normalize_keypoints.py) ────────────────

def get_xy(section, landmark_idx):
    start = landmark_idx * 3
    return section[start: start + 2].copy()


def normalize_section_xy(section, anchor_xy, scale):
    coords    = section.reshape(-1, 3)
    coords_xy = coords[:, :2].copy()
    coords_xy = coords_xy - anchor_xy
    if scale > 1e-6:
        coords_xy = coords_xy / scale
    return coords_xy.flatten()


def normalize_frame_live(pose, face, lhand, rhand, lhand_detected, rhand_detected):
    left_shoulder  = get_xy(pose, POSE_LEFT_SHOULDER_IDX)
    right_shoulder = get_xy(pose, POSE_RIGHT_SHOULDER_IDX)
    shoulder_dist  = np.linalg.norm(left_shoulder - right_shoulder)
    scale          = shoulder_dist if shoulder_dist > 1e-6 else 1.0 

    shoulder_center = (left_shoulder + right_shoulder) / 2.0
    pose_norm       = normalize_section_xy(pose, shoulder_center, scale)

    nose      = get_xy(face, FACE_NOSE_IDX)
    face_norm = normalize_section_xy(face, nose, scale)

    if lhand_detected:
        lhand_wrist = get_xy(lhand, HAND_WRIST_IDX)
        lhand_norm  = normalize_section_xy(lhand, lhand_wrist, scale)
    else:
        lhand_norm  = np.zeros(21 * 2, dtype=np.float32)

    if rhand_detected:
        rhand_wrist = get_xy(rhand, HAND_WRIST_IDX)
        rhand_norm  = normalize_section_xy(rhand, rhand_wrist, scale)
    else:
        rhand_norm  = np.zeros(21 * 2, dtype=np.float32)

    return np.concatenate([pose_norm, face_norm, lhand_norm, rhand_norm])


# ── Prepare sequence for model ───────────────────────────────────────────────

def prepare_sequence(frames):
    T   = len(frames)
    arr = np.array(frames, dtype=np.float32)   # (T, 190)

    if T < MAX_FRAMES:
        pad = np.zeros((MAX_FRAMES - T, 190), dtype=np.float32)
        arr = np.concatenate([arr, pad], axis=0)
    else:
        arr = arr[:MAX_FRAMES]
        T   = MAX_FRAMES

    mask     = np.zeros(MAX_FRAMES, dtype=np.float32)
    mask[:T] = 1.0

    x    = torch.tensor(arr,  dtype=torch.float32).unsqueeze(0)
    mask = torch.tensor(mask, dtype=torch.float32).unsqueeze(0)

    return x, mask


# ── Landmark drawing ─────────────────────────────────────────────────────────

def draw_landmarks(frame, pose_result, hand_result, face_result):
    h, w = frame.shape[:2]

    POSE_CONNECTIONS = [
        (11,12),(11,13),(13,15),(12,14),(14,16),
        (11,23),(12,24),(23,24),(23,25),(24,26),
        (25,27),(26,28)
    ]
    HAND_CONNECTIONS = [
        (0,1),(1,2),(2,3),(3,4),
        (0,5),(5,6),(6,7),(7,8),
        (0,9),(9,10),(10,11),(11,12),
        (0,13),(13,14),(14,15),(15,16),
        (0,17),(17,18),(18,19),(19,20),
        (5,9),(9,13),(13,17)
    ]

    if pose_result.pose_landmarks:
        lms = pose_result.pose_landmarks[0]
        for i, j in POSE_CONNECTIONS:
            x1, y1 = int(lms[i].x * w), int(lms[i].y * h)
            x2, y2 = int(lms[j].x * w), int(lms[j].y * h)
            cv2.line(frame, (x1, y1), (x2, y2), (0, 255, 255), 1)
        for lm in lms:
            cv2.circle(frame, (int(lm.x * w), int(lm.y * h)), 3, (0, 255, 255), -1)

    for i, handedness in enumerate(hand_result.handedness):
        label = handedness[0].category_name
        color = (255, 180, 0) if label == "Left" else (180, 0, 255)
        lms   = hand_result.hand_landmarks[i]
        for a, b in HAND_CONNECTIONS:
            x1, y1 = int(lms[a].x * w), int(lms[a].y * h)
            x2, y2 = int(lms[b].x * w), int(lms[b].y * h)
            cv2.line(frame, (x1, y1), (x2, y2), color, 2)
        for lm in lms:
            cv2.circle(frame, (int(lm.x * w), int(lm.y * h)), 4, color, -1)
        wrist = lms[0]
        cv2.putText(frame, label,
                    (int(wrist.x * w), int(wrist.y * h) - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)

    if face_result.face_landmarks:
        lms = face_result.face_landmarks[0]
        for i in FACE_KEY_LANDMARKS:
            cv2.circle(frame,
                       (int(lms[i].x * w), int(lms[i].y * h)),
                       2, (200, 200, 200), -1)

    return frame


# ── HUD ──────────────────────────────────────────────────────────────────────

def draw_hud(frame, state, prediction, confidence,
             recorded_frames, hands_detected, calibration_counter):
    h, w = frame.shape[:2]

    state_color = {
        "calibrating": (0, 165, 255),
        "ready"      : (255, 255, 0),
        "idle"       : (180, 180, 180),
        "recording"  : (0, 255, 0),
        "classifying": (0, 200, 255),
    }

    cv2.putText(frame, f"State: {state.upper()}",
                (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8,
                state_color.get(state, (255, 255, 255)), 2)

    if state == "calibrating":
        bar_width = min(int(calibration_counter / CALIBRATION_FRAMES * 200), 200)
        cv2.rectangle(frame, (10, 45), (210, 62), (50, 50, 50), -1)
        cv2.rectangle(frame, (10, 45), (10 + bar_width, 62), (0, 165, 255), -1)
        cv2.putText(frame, "Show both hands to camera",
                    (10, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 165, 255), 1)

    elif state == "ready":
        cv2.putText(frame, "Hands locked!  Press S to start",
                    (10, 65), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)

    elif state == "idle":
        if prediction:
            cv2.putText(frame, "Show hand to make a new sign",
                        (10, 65), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (180, 180, 180), 1)
        else:
            cv2.putText(frame, "Show your hand to start",
                        (10, 65), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (180, 180, 180), 1)

    elif state == "recording":
        cv2.circle(frame, (20, 65), 8, (0, 0, 255), -1)   # red dot
        cv2.putText(frame, f"Recording...  {recorded_frames} frames",
                    (35, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        cv2.putText(frame, "Remove hand to finish",
                    (35, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)

    if not hands_detected and state not in ("calibrating", "ready"):
        cv2.putText(frame, "NO HANDS DETECTED",
                    (10, 100), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)

    
    if prediction is not None and state == "idle":
        if confidence >= CONFIDENCE_THRESHOLD:
            color = (0, 255, 100)    # green — confident
        elif confidence >= 0.35:
            color = (0, 165, 255)    # orange — low confidence but showing
        else:
            color = (0, 0, 255)      # red — very uncertain

        cv2.putText(frame, f"Sign: {prediction}",
                    (10, h - 60), cv2.FONT_HERSHEY_SIMPLEX, 1.2, color, 3)
        #cv2.putText(frame, f"Conf: {confidence:.0%}",
                  #  (10, h - 25), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)

    cv2.putText(frame, "S=record/stop  R=reset  Q=quit",
                (w - 280, h - 15), cv2.FONT_HERSHEY_SIMPLEX, 0.5,
                (180, 180, 180), 1)

    return frame   

def classify_with_tta(model, frames, device):
    results = []

    # Version 1 — original
    x, mask = prepare_sequence(frames)
    x       = x.to(device)
    mask    = mask.to(device)
    with torch.no_grad():
        probs = torch.softmax(model(x, mask), dim=1)
    results.append(probs)

    # Version 2 — slight time shift (drop first 3 frames)
    if len(frames) > 10:
        x, mask = prepare_sequence(frames[3:])
        x       = x.to(device)
        mask    = mask.to(device)
        with torch.no_grad():
            probs = torch.softmax(model(x, mask), dim=1)
        results.append(probs)

    # Version 3 — drop last 3 frames
    if len(frames) > 10:
        x, mask = prepare_sequence(frames[:-3])
        x       = x.to(device)
        mask    = mask.to(device)
        with torch.no_grad():
            probs = torch.softmax(model(x, mask), dim=1)
        results.append(probs)

    # Average all versions
    avg_probs  = torch.stack(results).mean(dim=0)
    conf, pred = avg_probs.max(dim=1)
    return pred.item(), conf.item(), avg_probs


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")

    model = SignLSTM(num_classes=NUM_CLASSES).to(device)
    ckpt  = torch.load(CHECKPOINT, map_location=device)
    model.load_state_dict(ckpt["model_state"])
    model.eval()
    print(f"Loaded checkpoint — epoch {ckpt['epoch']}  "
          f"val_acc={ckpt['val_acc']:.4f}")

    pose_detector, hand_detector, face_detector = build_detectors()

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        raise RuntimeError("Cannot open webcam")

    cap.set(cv2.CAP_PROP_FPS, 30)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)   #640x480 is a good balance of detail vs performance for this task  
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))

    # ── State ────────────────────────────────────────────────────────────────
    state               = "idle"
    calibration_counter = 0
    recorded_frames     = []
    prediction          = None
    confidence          = 0.0

    print("\n1. Just show your hand to camera — recording starts automatically")
    print("2. Remove hand when done — classification happens automatically")
    print("3. The word will be displayed on screen")
    print("4. R=reset  Q=quit\n")

    while True:
        ret, frame = cap.read()
        if not ret:
            raise RuntimeError("Failed to read from webcam")

        frame = cv2.flip(frame, 1)
        frame = cv2.resize(frame, (640, 480))
        lab     = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        frame   = cv2.cvtColor(cv2.merge([clahe.apply(l), a, b]), cv2.COLOR_LAB2BGR)

        # ── Extract ───────────────────────────────────────────────────────────
        timestamp_ms = int(time.time() * 1000)
        rgb          = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image     = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)

        pose_result = pose_detector.detect_for_video(mp_image, timestamp_ms)
        hand_result = hand_detector.detect_for_video(mp_image, timestamp_ms)
        face_result = face_detector.detect_for_video(mp_image, timestamp_ms)

        pose,  pose_detected     = extract_pose(pose_result)
        lhand, rhand, ldet, rdet = extract_hands(hand_result)
        face,  face_detected     = extract_face(face_result)

        # ── Last known good lock ──────────────────────────────────────────────
        # no lock — use zeros when hand not detected
        pass

        hands_detected = ldet or rdet

        # ── Normalize ─────────────────────────────────────────────────────────
        frame_vec = normalize_frame_live(pose, face, lhand, rhand, ldet, rdet) 
        # after normalize_frame_live call, add:
        left_shoulder  = pose[POSE_LEFT_SHOULDER_IDX*3 : POSE_LEFT_SHOULDER_IDX*3+2]
        right_shoulder = pose[POSE_RIGHT_SHOULDER_IDX*3: POSE_RIGHT_SHOULDER_IDX*3+2]
        shoulder_dist  = np.linalg.norm(left_shoulder - right_shoulder)
        print(f"shoulder_dist={shoulder_dist:.4f}", flush=True)

        # ── State machine ─────────────────────────────────────────────────────
        # Auto-start recording when hands detected, auto-stop when lost
        if state == "idle":
            if hands_detected:
                state = "recording"
                recorded_frames = []
                prediction = None
                confidence = 0.0
                print("Hand detected — recording started...", flush=True)

        elif state == "recording":
            recorded_frames.append(frame_vec)
            if len(recorded_frames) >= MAX_FRAMES:
                state = "classifying"
                print("Max frames reached — classifying...", flush=True)
            elif not hands_detected:
                state = "classifying"
                print("Hand lost — classifying...", flush=True)

        if state == "classifying":     
            if len(recorded_frames) >= MIN_SIGN_FRAMES:
                pred_idx, confidence, probs = classify_with_tta(
                    model, recorded_frames, device
                )
                prediction = CLASS_NAMES[pred_idx]
                print(f"Prediction: {prediction}  ({confidence:.0%})", flush=True)
                for i, p in enumerate(probs[0].tolist()):
                    if p > 0.05:
                        print(f"  {CLASS_NAMES[i]:10s} {p:.0%}", flush=True)
            if len(recorded_frames) >= MIN_SIGN_FRAMES:
                x, mask = prepare_sequence(recorded_frames)
                x       = x.to(device)
                mask    = mask.to(device)

                with torch.no_grad():
                    logits     = model(x, mask)
                    probs      = torch.softmax(logits, dim=1)
                    conf, pred = probs.max(dim=1)

                prediction = CLASS_NAMES[pred.item()]
                confidence = conf.item()
                print(f"Prediction: {prediction}  ({confidence:.0%})", flush=True)
                
                # print all probabilities above 5%
                for i, p in enumerate(probs[0].tolist()):
                    if p > 0.05:
                        print(f"  {CLASS_NAMES[i]:10s} {p:.0%}", flush=True)
            else:
                print(f"Too short ({len(recorded_frames)} frames) — ignored",
                      flush=True)

            state           = "idle"
            recorded_frames = []
            # Prediction remains displayed until next recording starts

        # ── Draw ──────────────────────────────────────────────────────────────
        frame = draw_landmarks(frame, pose_result, hand_result, face_result)
        frame = draw_hud(frame, state, prediction, confidence,
                         len(recorded_frames), hands_detected,
                         calibration_counter)

        cv2.imshow("Sign Language Live Testing", frame)

        # ── Keyboard ──────────────────────────────────────────────────────────
        key = cv2.waitKey(1) & 0xFF

        if key == ord('q'):
            break

        if key == ord('s'):
            # Manual start/stop override (optional)
            if state == "idle":
                state           = "recording"
                recorded_frames = []
                prediction      = None
                confidence      = 0.0
                print("Manual start — recording...", flush=True)
            elif state == "recording":
                state = "classifying"
                print(f"Manual stop — classifying {len(recorded_frames)} frames...",
                      flush=True)

        if key == ord('r'):
            state               = "idle"
            recorded_frames     = []
            prediction          = None
            confidence          = 0.0
            print("Reset.", flush=True)

    cap.release()
    pose_detector.close()
    hand_detector.close()
    face_detector.close()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
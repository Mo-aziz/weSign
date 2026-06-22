import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { createSignSessionId } from '../config/appConfig';
import {
  SIGN_RECOGNITION_SERVICE_URL,
  SIGN_HEALTH_POLL_INTERVAL_MS,
  SIGN_SERVICE_STARTUP_GRACE_MS,
  fetchSignServiceHealth,
  isTauriApp,
  signServiceStartingMessage,
  signServiceUnavailableMessage,
} from './signRecognitionConfig';

type RecognitionOptions = {
  /** @deprecated Use frameIntervalMs. Kept for call sites that still pass cadenceMs. */
  cadenceMs?: number;
  frameIntervalMs?: number;
  serviceUrl?: string;
  /** When set, frames are captured from this video element (e.g. call local preview). */
  videoElementRef?: RefObject<HTMLVideoElement | null>;
};

type RecognitionHistoryEntry = {
  id: string;
  text: string;
  timestamp: number;
};

type FrameResponse = {
  ready: boolean;
  text: string | null;
  confidence: number;
  state: string;
  hands_detected?: boolean;
};

const DEFAULT_FRAME_INTERVAL_MS = 33;
const JPEG_QUALITY = 0.72;
const MAX_FRAME_WIDTH = 640;
const MAX_FRAME_HEIGHT = 480;
const MIN_FRAME_BASE64_LENGTH = 256;
const MAX_FRAME_FAILURES_BEFORE_ERROR = 8;

const formatSignText = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (trimmed.length === 1) return trimmed.toUpperCase();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

export const useSignRecognitionService = (options: RecognitionOptions = {}) => {
  const frameInterval =
    options.frameIntervalMs ??
    (options.cadenceMs && options.cadenceMs < 2000 ? options.cadenceMs : DEFAULT_FRAME_INTERVAL_MS);
  const serviceUrl = (options.serviceUrl ?? SIGN_RECOGNITION_SERVICE_URL).replace(/\/$/, '');
  const videoElementRef = options.videoElementRef;

  const [isCapturing, setIsCapturing] = useState(false);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [history, setHistory] = useState<RecognitionHistoryEntry[]>([]);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [serviceReady, setServiceReady] = useState(false);
  const [serviceStarting, setServiceStarting] = useState(isTauriApp());
  const [recognitionState, setRecognitionState] = useState<string | null>(null);
  const [handsDetected, setHandsDetected] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ownedVideoRef = useRef<HTMLVideoElement | null>(null);
  const ownedStreamRef = useRef<MediaStream | null>(null);
  const inFlightRef = useRef(false);
  const isCapturingRef = useRef(false);
  const sessionIdRef = useRef<string>(createSignSessionId());
  const healthPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameFailureCountRef = useRef(0);

  const parseHttpError = async (response: Response): Promise<string> => {
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body.detail === 'string') {
        return body.detail;
      }
      if (Array.isArray(body.detail)) {
        return body.detail.map((item) => JSON.stringify(item)).join('; ');
      }
    } catch {
      // ignore parse errors
    }
    return `HTTP ${response.status}`;
  };

  const stopHealthPoll = useCallback(() => {
    if (healthPollRef.current) {
      clearInterval(healthPollRef.current);
      healthPollRef.current = null;
    }
  }, []);

  const checkServiceHealth = useCallback(async (): Promise<boolean> => {
    try {
      const data = await fetchSignServiceHealth(serviceUrl);
      if (data.status !== 'ok') {
        throw new Error('Sign service reported unhealthy status');
      }
      setServiceError(null);
      setServiceReady(true);
      setServiceStarting(false);
      return true;
    } catch {
      setServiceReady(false);
      return false;
    }
  }, [serviceUrl]);

  const waitForServiceHealth = useCallback(async (): Promise<boolean> => {
    const deadline = Date.now() + SIGN_SERVICE_STARTUP_GRACE_MS;
    setServiceStarting(true);
    setServiceError(signServiceStartingMessage());

    while (Date.now() < deadline) {
      if (await checkServiceHealth()) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, SIGN_HEALTH_POLL_INTERVAL_MS));
    }

    setServiceStarting(false);
    setServiceError(signServiceUnavailableMessage());
    return false;
  }, [checkServiceHealth]);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      if (isTauriApp()) {
        await waitForServiceHealth();
      } else {
        const ok = await checkServiceHealth();
        if (!cancelled && !ok) {
          setServiceError(signServiceUnavailableMessage());
        }
      }
    };

    void bootstrap();

    healthPollRef.current = setInterval(() => {
      void checkServiceHealth().then((ok) => {
        if (!ok) {
          setServiceError(signServiceUnavailableMessage());
        }
      });
    }, 10_000);

    return () => {
      cancelled = true;
      stopHealthPoll();
    };
  }, [checkServiceHealth, stopHealthPoll, waitForServiceHealth]);

  const stopOwnedMedia = useCallback(() => {
    if (ownedStreamRef.current) {
      ownedStreamRef.current.getTracks().forEach((track) => track.stop());
      ownedStreamRef.current = null;
    }
    if (ownedVideoRef.current) {
      ownedVideoRef.current.srcObject = null;
      ownedVideoRef.current = null;
    }
  }, []);

  const stopFrameLoop = useCallback(() => {
    if (intervalRef.current) {
      clearTimeout(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const postReset = useCallback(async () => {
    try {
      await fetch(`${serviceUrl}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionIdRef.current }),
      });
    } catch {
      // ignore reset errors when service is down
    }
  }, [serviceUrl]);

  const getActiveVideo = useCallback((): HTMLVideoElement | null => {
    const isVideoReady = (video: HTMLVideoElement) =>
      video.videoWidth > 0 &&
      video.videoHeight > 0 &&
      video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;

    const external = videoElementRef?.current;
    if (external && isVideoReady(external)) {
      return external;
    }
    const owned = ownedVideoRef.current;
    if (owned && isVideoReady(owned)) {
      return owned;
    }
    return null;
  }, [videoElementRef]);

  const waitForExternalVideo = useCallback(async (): Promise<boolean> => {
    const deadline = Date.now() + 12_000;
    while (Date.now() < deadline) {
      if (getActiveVideo()) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    setServiceError(
      'Camera preview is not ready. Make sure your camera is on and you can see yourself in the call video.'
    );
    return false;
  }, [getActiveVideo]);

  const captureFrameBase64 = useCallback((): string | null => {
    const video = getActiveVideo();
    if (!video) return null;

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    const canvas = canvasRef.current;

    let width = video.videoWidth;
    let height = video.videoHeight;
    if (width > MAX_FRAME_WIDTH || height > MAX_FRAME_HEIGHT) {
      const scale = Math.min(MAX_FRAME_WIDTH / width, MAX_FRAME_HEIGHT / height);
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
    }

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    if (!dataUrl.startsWith('data:image/jpeg')) {
      return null;
    }
    const comma = dataUrl.indexOf(',');
    const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
    if (base64.length < MIN_FRAME_BASE64_LENGTH) {
      return null;
    }
    return base64;
  }, [getActiveVideo]);

  const sendFrame = useCallback(async () => {
    if (!isCapturingRef.current || inFlightRef.current) return;

    const image = captureFrameBase64();
    if (!image) return;

    inFlightRef.current = true;
    try {
      const response = await fetch(`${serviceUrl}/frame`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          image,
        }),
      });

      if (!response.ok) {
        const detail = await parseHttpError(response);
        throw new Error(`Sign service error (${response.status}): ${detail}`);
      }

      const data = (await response.json()) as FrameResponse;
      frameFailureCountRef.current = 0;
      setServiceError(null);
      setServiceReady(true);
      setRecognitionState(data.state);
      setHandsDetected(Boolean(data.hands_detected));

      if (data.ready && data.text) {
        setPreviewText(formatSignText(data.text));
      }
    } catch (error) {
      frameFailureCountRef.current += 1;
      if (frameFailureCountRef.current < MAX_FRAME_FAILURES_BEFORE_ERROR) {
        return;
      }
      const detail = error instanceof Error ? error.message : 'Request failed';
      setServiceReady(false);
      setServiceError(`${detail}. Make sure your camera is on and showing video in the call.`);
    } finally {
      inFlightRef.current = false;
    }
  }, [captureFrameBase64, serviceUrl]);

  const ensureVideoSource = useCallback(async (): Promise<boolean> => {
    if (getActiveVideo()) return true;

    if (!navigator.mediaDevices?.getUserMedia) {
      setServiceError('Camera access is not available in this environment.');
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });
      ownedStreamRef.current = stream;

      const video = document.createElement('video');
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      ownedVideoRef.current = video;

      await new Promise<void>((resolve, reject) => {
        const onReady = () => {
          video.removeEventListener('loadeddata', onReady);
          resolve();
        };
        video.addEventListener('loadeddata', onReady);
        video.play().catch(reject);
        setTimeout(() => {
          if (video.videoWidth > 0) resolve();
        }, 1500);
      });

      return getActiveVideo() !== null;
    } catch {
      setServiceError('Could not access the camera. Allow camera permission and try again.');
      stopOwnedMedia();
      return false;
    }
  }, [getActiveVideo, stopOwnedMedia]);

  const startRecognition = useCallback(async () => {
    const healthy = serviceReady ? true : await waitForServiceHealth();
    if (!healthy) return;

    if (videoElementRef) {
      const ready = await waitForExternalVideo();
      if (!ready) return;
    } else {
      const hasVideo = await ensureVideoSource();
      if (!hasVideo) return;
    }

    frameFailureCountRef.current = 0;
    await postReset();
    isCapturingRef.current = true;
    setIsCapturing(true);
    setPreviewText(null);
  }, [
    ensureVideoSource,
    postReset,
    serviceReady,
    videoElementRef,
    waitForExternalVideo,
    waitForServiceHealth,
  ]);

  const stopRecognition = useCallback(() => {
    isCapturingRef.current = false;
    setIsCapturing(false);
    stopFrameLoop();
    stopOwnedMedia();
    void postReset();
    setPreviewText(null);
  }, [postReset, stopFrameLoop, stopOwnedMedia]);

  useEffect(() => {
    isCapturingRef.current = isCapturing;
    if (!isCapturing) {
      stopFrameLoop();
      return;
    }

    if (intervalRef.current) return;

    const loop = async () => {
      if (!isCapturingRef.current) return;
      const start = Date.now();
      await sendFrame();
      const elapsed = Date.now() - start;
      const delay = Math.max(0, frameInterval - elapsed);
      intervalRef.current = setTimeout(loop, delay) as any;
    };

    void loop();

    return () => {
      stopFrameLoop();
    };
  }, [isCapturing, frameInterval, sendFrame, stopFrameLoop]);

  useEffect(() => {
    return () => {
      isCapturingRef.current = false;
      stopFrameLoop();
      stopOwnedMedia();
      stopHealthPoll();
    };
  }, [stopFrameLoop, stopOwnedMedia, stopHealthPoll]);

  const confirmTranslation = useCallback(
    (overrideText?: string) => {
      const text = (overrideText ?? previewText)?.trim();
      if (!text) return null;
      const entry: RecognitionHistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text,
        timestamp: Date.now(),
      };
      setHistory((prev) => [entry, ...prev].slice(0, 15));
      setPreviewText(null);
      void postReset();
      return entry;
    },
    [previewText, postReset]
  );

  const rejectTranslation = useCallback(() => {
    setPreviewText(null);
    void postReset();
  }, [postReset]);

  const clearHistory = useCallback(() => setHistory([]), []);

  const recognitionHint = useMemo((): string | null => {
    if (serviceError || serviceStarting) return null;
    if (!isCapturing) return null;
    if (recognitionState === 'calibrating' && !handsDetected) {
      return 'Calibrating — show both hands clearly in the camera (upper body visible).';
    }
    if (recognitionState === 'calibrating') {
      return 'Calibrating — keep your hands visible...';
    }
    if (recognitionState === 'ready' && !handsDetected) {
      return 'Ready — start signing when your hands are in view.';
    }
    if (recognitionState === 'recording') {
      return 'Recording your sign... hold the gesture steady.';
    }
    return null;
  }, [handsDetected, isCapturing, recognitionState, serviceError, serviceStarting]);

  const state = useMemo(
    () => ({
      isCapturing,
      previewText,
      history,
      serviceError,
      serviceReady,
      serviceStarting,
      recognitionState,
      handsDetected,
      recognitionHint,
    }),
    [
      history,
      handsDetected,
      isCapturing,
      previewText,
      recognitionHint,
      recognitionState,
      serviceError,
      serviceReady,
      serviceStarting,
    ]
  );

  const appendPreviewText = useCallback((textToAppend: string) => {
    setPreviewText((prev) => {
      if (!prev) return textToAppend;
      return `${prev} ${textToAppend}`;
    });
  }, []);

  return {
    ...state,
    startRecognition,
    stopRecognition,
    confirmTranslation,
    rejectTranslation,
    clearHistory,
    checkServiceHealth,
    appendPreviewText,
  };
};

export type UseSignRecognitionServiceReturn = ReturnType<typeof useSignRecognitionService>;

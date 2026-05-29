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
};

const DEFAULT_FRAME_INTERVAL_MS = 100;
const JPEG_QUALITY = 0.85;

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

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ownedVideoRef = useRef<HTMLVideoElement | null>(null);
  const ownedStreamRef = useRef<MediaStream | null>(null);
  const inFlightRef = useRef(false);
  const isCapturingRef = useRef(false);
  const sessionIdRef = useRef<string>(createSignSessionId());
  const healthPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      clearInterval(intervalRef.current);
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
    const external = videoElementRef?.current;
    if (external && external.videoWidth > 0 && external.videoHeight > 0) {
      return external;
    }
    const owned = ownedVideoRef.current;
    if (owned && owned.videoWidth > 0 && owned.videoHeight > 0) {
      return owned;
    }
    return null;
  }, [videoElementRef]);

  const captureFrameBase64 = useCallback((): string | null => {
    const video = getActiveVideo();
    if (!video) return null;

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    const comma = dataUrl.indexOf(',');
    return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
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
        throw new Error(`Sign service error (${response.status})`);
      }

      const data = (await response.json()) as FrameResponse;
      setServiceError(null);
      setServiceReady(true);

      if (data.ready && data.text) {
        setPreviewText(formatSignText(data.text));
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Request failed';
      setServiceReady(false);
      setServiceError(`${detail}. ${signServiceUnavailableMessage()}`);
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

    if (!videoElementRef) {
      const hasVideo = await ensureVideoSource();
      if (!hasVideo) return;
    }

    await postReset();
    isCapturingRef.current = true;
    setIsCapturing(true);
    setPreviewText(null);
  }, [ensureVideoSource, postReset, serviceReady, videoElementRef, waitForServiceHealth]);

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

    intervalRef.current = setInterval(() => {
      void sendFrame();
    }, frameInterval);

    void sendFrame();

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

  const state = useMemo(
    () => ({
      isCapturing,
      previewText,
      history,
      serviceError,
      serviceReady,
      serviceStarting,
    }),
    [history, isCapturing, previewText, serviceError, serviceReady, serviceStarting]
  );

  return {
    ...state,
    startRecognition,
    stopRecognition,
    confirmTranslation,
    rejectTranslation,
    clearHistory,
    checkServiceHealth,
  };
};

export type UseSignRecognitionServiceReturn = ReturnType<typeof useSignRecognitionService>;

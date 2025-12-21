import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type RecognitionOptions = {
  cadenceMs?: number;
};

type RecognitionHistoryEntry = {
  id: string;
  text: string;
  timestamp: number;
};

const SAMPLE_PHRASES = [
  'Hello, how are you?',
  'I need assistance with scheduling.',
  'Can we reschedule our meeting?',
  'Please repeat that more slowly.',
  'Thank you for your help today.',
  "Let's continue this conversation tomorrow.",
  'Where should we meet for lunch?',
  'I am feeling great and excited!',
];

const randomPhrase = () => SAMPLE_PHRASES[Math.floor(Math.random() * SAMPLE_PHRASES.length)];

export const useSignRecognitionService = (options: RecognitionOptions = {}) => {
  const cadence = options.cadenceMs ?? 8000;
  const [isCapturing, setIsCapturing] = useState(false);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [history, setHistory] = useState<RecognitionHistoryEntry[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopStream = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isCapturing) {
      stopStream();
      setPreviewText(null);
      return;
    }

    if (intervalRef.current) return;

    intervalRef.current = setInterval(() => {
      setPreviewText(randomPhrase());
    }, cadence);

    // populate immediately on start
    setPreviewText(randomPhrase());

    return () => {
      stopStream();
    };
  }, [isCapturing, cadence, stopStream]);

  const startRecognition = useCallback(() => {
    setIsCapturing(true);
  }, []);

  const stopRecognition = useCallback(() => {
    setIsCapturing(false);
  }, []);

  const confirmTranslation = useCallback((overrideText?: string) => {
    const text = (overrideText ?? previewText)?.trim();
    if (!text) return null;
    const entry: RecognitionHistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      timestamp: Date.now(),
    };
    setHistory((prev) => [entry, ...prev].slice(0, 15));
    setPreviewText(null);
    return entry;
  }, [previewText]);

  const rejectTranslation = useCallback(() => {
    setPreviewText(null);
  }, []);

  const clearHistory = useCallback(() => setHistory([]), []);

  const state = useMemo(
    () => ({
      isCapturing,
      previewText,
      history,
    }),
    [history, isCapturing, previewText]
  );

  return {
    ...state,
    startRecognition,
    stopRecognition,
    confirmTranslation,
    rejectTranslation,
    clearHistory,
  };
};

export type UseSignRecognitionServiceReturn = ReturnType<typeof useSignRecognitionService>;

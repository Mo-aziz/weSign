import { useCallback, useMemo, useRef, useState } from 'react';

type SpeakOptions = {
  voice?: 'default' | 'warm' | 'professional';
  pitch?: 'low' | 'medium' | 'high';
};

type SpeechQueueItem = {
  id: string;
  text: string;
  enqueuedAt: number;
};

export const useTextToSpeechService = () => {
  const [queue, setQueue] = useState<SpeechQueueItem[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastUtterance, setLastUtterance] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const speak = useCallback((text: string, options: SpeakOptions = {}) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const item: SpeechQueueItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text: trimmed,
      enqueuedAt: Date.now(),
    };

    setQueue((prev) => [...prev, item]);
    setIsSpeaking(true);
    setLastUtterance(`Playing voice (${options.voice ?? 'default'}) with ${options.pitch ?? 'medium'} pitch: "${trimmed}"`);

    clearTimer();
    timeoutRef.current = setTimeout(() => {
      setQueue((prev) => prev.slice(1));
      setIsSpeaking(false);
    }, Math.min(4000, Math.max(trimmed.length * 80, 1200)));
  }, [clearTimer]);

  const stop = useCallback(() => {
    clearTimer();
    setQueue([]);
    setIsSpeaking(false);
    setLastUtterance(null);
  }, [clearTimer]);

  const state = useMemo(() => ({ queue, isSpeaking, lastUtterance }), [queue, isSpeaking, lastUtterance]);

  return {
    ...state,
    speak,
    stop,
  };
};

export type UseTextToSpeechServiceReturn = ReturnType<typeof useTextToSpeechService>;

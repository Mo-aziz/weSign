import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { speak as speakTTS, type VoiceSettings } from './localTTS';
import { useAppContext } from '../context/useAppContext';

type SpeechQueueItem = {
  id: string;
  text: string;
  enqueuedAt: number;
  status: 'queued' | 'speaking' | 'completed';
  voiceSettings?: VoiceSettings;
};

export const useTextToSpeechService = () => {
  const { user } = useAppContext();
  const [queue, setQueue] = useState<SpeechQueueItem[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastUtterance, setLastUtterance] = useState<string | null>(null);
  const currentItemRef = useRef<SpeechQueueItem | null>(null);

  // Process the queue
  useEffect(() => {
    // If already speaking or queue is empty, do nothing
    if (isSpeaking || queue.length === 0) return;

    const processNextItem = async () => {
      const nextItem = queue[0];
      if (!nextItem || nextItem.status === 'speaking' || nextItem.status === 'completed') return;

      try {
        setIsSpeaking(true);
        currentItemRef.current = nextItem;
        
        // Update status to speaking
        setQueue(prev => prev.map(item => 
          item.id === nextItem.id ? { ...item, status: 'speaking' } : item
        ));

        setLastUtterance(`Speaking: ${nextItem.text}`);
        
        // Use the speak function from localTTS with user's voice settings
        const voiceSettings: VoiceSettings = {
          voiceName: nextItem.voiceSettings?.voiceName || user?.voiceSettings?.voiceName,
          rate: nextItem.voiceSettings?.rate ?? user?.voiceSettings?.rate ?? 1.0,
          pitch: nextItem.voiceSettings?.pitch ?? user?.voiceSettings?.pitch ?? 1.0,
        };
        
        await speakTTS(nextItem.text, voiceSettings);
        
        // Mark as completed
        setQueue(prev => 
          prev.filter(item => item.id !== nextItem.id)
        );
        
        setLastUtterance(`Completed: ${nextItem.text}`);
      } catch (error) {
        console.error('Error in speech synthesis:', error);
        setLastUtterance(`Error: Failed to speak "${nextItem.text}"`);
        // Remove the failed item from queue
        setQueue(prev => prev.filter(item => item.id !== nextItem.id));
      } finally {
        setIsSpeaking(false);
        currentItemRef.current = null;
      }
    };

    processNextItem();
  }, [queue, isSpeaking]);

  const speak = useCallback((text: string, options?: { 
    interrupt?: boolean;
    voiceSettings?: VoiceSettings;
  }) => {
    if (!text.trim()) return;

    const id = Math.random().toString(36).substring(2, 9);
    const newItem: SpeechQueueItem = {
      id,
      text: text.trim(),
      enqueuedAt: Date.now(),
      status: 'queued',
      voiceSettings: options?.voiceSettings,
    };

    setQueue(prev => [...prev, newItem]);
    setLastUtterance(`Added to queue (${options?.voiceSettings?.voiceName ?? 'default'}): "${text.trim()}"`);
  }, []);

  const stop = useCallback(() => {
    // Cancel any ongoing speech
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    
    // Clear the queue
    setQueue([]);
    setIsSpeaking(false);
    setLastUtterance('Speech queue cleared');
    currentItemRef.current = null;
  }, []);

  const state = useMemo(() => ({
    queue,
    isSpeaking,
    lastUtterance,
    currentItem: currentItemRef.current,
  }), [queue, isSpeaking, lastUtterance]);

  return {
    ...state,
    speak,
    stop,
  };
};

export type UseTextToSpeechServiceReturn = ReturnType<typeof useTextToSpeechService>;

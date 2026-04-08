import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { speak } from './localTTS';
import type { VoiceSettings } from './localTTS';

type SpeechToTextOptions = {
  cadenceMs?: number;
  disableTTS?: boolean; // If true, don't speak the transcript (for sign language users who can't hear)
  voiceSettings?: VoiceSettings; // Voice settings to use when speaking
  onSentenceComplete?: (text: string) => void; // Callback when sentence is complete
};

type TranscriptEntry = {
  id: string;
  text: string;
  timestamp: number;
};

const SAMPLE_RESPONSES = [
  'I am speaking now, can you see my words?',
  'Please meet me in the lobby at 5 PM.',
  'The weather looks great for tomorrow.',
  "I'll call you back after my meeting.",
  'Could you share that document with me?',
  'Let me know if you can hear me clearly.',
  'Your signing is very clear, thank you!',
];

const randomPhrase = () => SAMPLE_RESPONSES[Math.floor(Math.random() * SAMPLE_RESPONSES.length)];

export const useSpeechToTextService = (options: SpeechToTextOptions = {}) => {
  const cadence = options.cadenceMs ?? 6000;
  const disableTTS = options.disableTTS ?? false;
  const voiceSettings = options.voiceSettings;
  const onSentenceComplete = options.onSentenceComplete;
  const [isListening, setIsListening] = useState(false);
  const [history, setHistory] = useState<TranscriptEntry[]>([]);
  const [transcript, setTranscript] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const cadenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isListeningRef = useRef(false);
  const voiceSettingsRef = useRef(voiceSettings);
  const sentenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTranscriptRef = useRef('');
  
  // Update voice settings ref when it changes
  useEffect(() => {
    voiceSettingsRef.current = voiceSettings;
  }, [voiceSettings]);

  const clearTimers = useCallback(() => {
    if (cadenceTimer.current) {
      clearTimeout(cadenceTimer.current);
      cadenceTimer.current = null;
    }
    if (sentenceTimeoutRef.current) {
      clearTimeout(sentenceTimeoutRef.current);
      sentenceTimeoutRef.current = null;
    }
  }, []);

  // Check if transcript contains a complete sentence
  const checkForCompleteSentence = useCallback((newTranscript: string) => {
    if (!onSentenceComplete) return;
    
    // Clear existing timeout
    if (sentenceTimeoutRef.current) {
      clearTimeout(sentenceTimeoutRef.current);
    }
    
    // Check if transcript ends with sentence punctuation
    const sentenceEnders = /[.!?]+/;
    if (sentenceEnders.test(newTranscript.trim())) {
      // Sentence complete - send it immediately
      onSentenceComplete(newTranscript.trim());
      lastTranscriptRef.current = '';
      setTranscript('');
    } else {
      // Set timeout to detect when user stops speaking (pause detection)
      sentenceTimeoutRef.current = setTimeout(() => {
        if (newTranscript.trim() && newTranscript !== lastTranscriptRef.current) {
          onSentenceComplete(newTranscript.trim());
          lastTranscriptRef.current = '';
          setTranscript('');
        }
      }, 2000); // 2 seconds of silence indicates sentence complete
    }
  }, [onSentenceComplete]);

  // Set transcript with sentence detection
  const setTranscriptWithDetection = useCallback((newTranscript: string) => {
    setTranscript(newTranscript);
    setIsTyping(true);
    
    if (cadence === 0) {
      // Real STT mode - check for complete sentences
      checkForCompleteSentence(newTranscript);
    }
  }, [cadence, checkForCompleteSentence]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const queueNextPhrase = useCallback(() => {
    // Skip auto-generation if cadence is 0 (for real STT only)
    if (cadence === 0) return;
    
    const nextDelay = cadence * (0.9 + Math.random() * 0.4); // ±20% variation
    cadenceTimer.current = setTimeout(async () => {
      if (!isListeningRef.current) return;
      const phrase = randomPhrase();
      setTranscript(phrase);
      setIsTyping(true);

      if (!disableTTS) {
        try {
          await speak(phrase, voiceSettingsRef.current);
        } catch (err) {
          console.error('TTS failed for transcript phrase:', err);
        }
      }

      setHistory((prev) => [...prev, { id: Date.now().toString(), text: phrase, timestamp: Date.now() }]);
      setIsTyping(false);
      queueNextPhrase();
    }, nextDelay);
  }, [cadence, disableTTS]);

  const startListening = useCallback(() => {
    if (isListeningRef.current) return;
    isListeningRef.current = true;
    setIsListening(true);
    setTranscript('');
    clearTimers();

    // Only start auto-generation if cadence > 0 (for demo mode)
    if (cadence > 0) {
      // Start the first phrase a little after resume to feel natural
      cadenceTimer.current = setTimeout(async () => {
        if (!isListeningRef.current) return;
        const phrase = randomPhrase();
        setTranscript(phrase);
        setIsTyping(true);

        if (!disableTTS) {
          try {
            await speak(phrase, voiceSettingsRef.current);
          } catch (err) {
            console.error('TTS failed for transcript phrase:', err);
          }
        }

        setHistory((prev) => [...prev, { id: Date.now().toString(), text: phrase, timestamp: Date.now() }]);
        setIsTyping(false);
        queueNextPhrase();
      }, 800);
    }
  }, [clearTimers, queueNextPhrase, disableTTS, cadence]);

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    setIsListening(false);
    setTranscript('');
    setIsTyping(false);
    clearTimers();
    try {
      window.speechSynthesis.cancel();
    } catch (err) {
      console.warn('Unable to cancel speech synthesis:', err);
    }
  }, [clearTimers]);

  const clearTranscript = useCallback(() => {
    setHistory([]);
  }, []);

  const state = useMemo(
    () => ({
      isListening,
      transcript,
      history,
      isTyping,
    }),
    [isListening, transcript, history, isTyping]
  );

  return {
    ...state,
    startListening,
    stopListening,
    clearTranscript,
  };
};

export type UseSpeechToTextServiceReturn = ReturnType<typeof useSpeechToTextService>;

import { useCallback, useMemo, useRef, useState, useEffect } from 'react';

type SpeechToTextOptions = {
  cadenceMs?: number;
  ttlMs?: number;
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
  const cadence = options.cadenceMs ?? 5000;
  const ttl = options.ttlMs ?? 30000; // 30 seconds default TTL
  const [isListening, setIsListening] = useState(false);
  const [history, setHistory] = useState<TranscriptEntry[]>([]);
  const [displayedTranscript, setDisplayedTranscript] = useState('');
  const transcriptRef = useRef('');
  const [isTyping, setIsTyping] = useState(false);
  const phraseCountRef = useRef(0);
  const cadenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ttlTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const typewriterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Function to clear old entries based on TTL
  const clearOldEntries = useCallback(() => {
    const now = Date.now();
    setHistory(prev => {
      const filtered = prev.filter(entry => now - entry.timestamp < ttl);
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [ttl]);

  // Update the reference immediately when history changes
  useEffect(() => {
    const newTranscript = history.map(entry => entry.text).join('\n');
    transcriptRef.current = newTranscript;
    
    // Only update the displayed transcript if we're not currently typing
    if (!isTyping) {
      setDisplayedTranscript(newTranscript);
    }
  }, [history, isTyping]);

  // Typewriter effect for the transcript
  useEffect(() => {
    if (transcriptRef.current === displayedTranscript) {
      setIsTyping(false);
      return;
    }

    setIsTyping(true);
    
    let currentIndex = 0;
    const targetText = transcriptRef.current;
    const currentText = displayedTranscript;
    
    // If the new text is shorter, just update immediately
    if (targetText.length < currentText.length) {
      setDisplayedTranscript(targetText);
      setIsTyping(false);
      return;
    }
    
    // Find the common prefix
    let commonPrefixLength = 0;
    while (commonPrefixLength < currentText.length && 
           commonPrefixLength < targetText.length && 
           currentText[commonPrefixLength] === targetText[commonPrefixLength]) {
      commonPrefixLength++;
    }
    
    // Start typing from the end of the common prefix
    currentIndex = commonPrefixLength;
    
    const typeNextChar = () => {
      if (currentIndex < targetText.length) {
        setDisplayedTranscript(targetText.substring(0, currentIndex + 1));
        currentIndex++;
        setTimeout(typeNextChar, Math.random() * 20 + 10); // Random typing speed between 10-30ms per character
      } else {
        setIsTyping(false);
      }
    };
    
    const timeoutId = setTimeout(typeNextChar, 50);
    
    return () => clearTimeout(timeoutId);
  }, [transcriptRef.current, displayedTranscript]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (cadenceTimer.current) clearTimeout(cadenceTimer.current);
      if (ttlTimer.current) clearInterval(ttlTimer.current);
      if (typewriterTimer.current) clearTimeout(typewriterTimer.current);
    };
  }, []);

  const stop = useCallback(() => {
    if (cadenceTimer.current) {
      clearTimeout(cadenceTimer.current);
      cadenceTimer.current = null;
    }
    if (ttlTimer.current) {
      clearInterval(ttlTimer.current);
      ttlTimer.current = null;
    }
    if (typewriterTimer.current) {
      clearTimeout(typewriterTimer.current);
      typewriterTimer.current = null;
    }
    phraseCountRef.current = 0; // Reset phrase count when stopping
  }, []);

  const startListening = useCallback(() => {
    if (isListening) return;
    
    setIsListening(true);
    
    // Initial phrase
    const initialEntry: TranscriptEntry = {
      id: Date.now().toString(),
      text: randomPhrase(),
      timestamp: Date.now()
    };
    
    setHistory([initialEntry]);

    const maxPhrases = 3; // Maximum number of phrases to show at once
    
    const addNewPhrase = () => {
      if (phraseCountRef.current >= maxPhrases) {
        // Remove the oldest phrase before adding a new one
        setHistory(prev => {
          const newHistory = [...prev];
          newHistory.shift(); // Remove the oldest phrase
          return newHistory;
        });
      } else {
        phraseCountRef.current++;
      }
      
      const newEntry: TranscriptEntry = {
        id: Date.now().toString(),
        text: randomPhrase(),
        timestamp: Date.now()
      };
      
      setHistory(prev => [...prev, newEntry]);
      
      // Schedule the next phrase with some randomness for more natural flow
      const nextDelay = cadence * (0.8 + Math.random() * 0.4); // ±20% variation
      cadenceTimer.current = setTimeout(addNewPhrase, nextDelay);
    };
    
    // Initial delay before starting the first phrase
    cadenceTimer.current = setTimeout(addNewPhrase, 1000);

    // Set up TTL cleanup - check less frequently to reduce lag
    ttlTimer.current = setInterval(clearOldEntries, 5000);
  }, [cadence, clearOldEntries, isListening]);

  const stopListening = useCallback(() => {
    setIsListening(false);
    stop();
  }, [stop]);

  const clearTranscript = useCallback(() => {
    setHistory([]);
  }, []);

  const state = useMemo(
    () => ({
      isListening,
      transcript: displayedTranscript,
      history,
      isTyping,
    }),
    [isListening, displayedTranscript, history, isTyping]
  );

  return {
    ...state,
    startListening,
    stopListening,
    clearTranscript,
  };
};

export type UseSpeechToTextServiceReturn = ReturnType<typeof useSpeechToTextService>;

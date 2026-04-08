import { useCallback, useEffect, useRef, useState } from 'react';
import type { VoiceSettings } from './localTTS';

type RealSpeechToTextOptions = {
  disableTTS?: boolean;
  voiceSettings?: VoiceSettings;
  onSentenceComplete?: (text: string) => void;
};

type TranscriptEntry = {
  id: string;
  text: string;
  timestamp: number;
};

export const useRealSpeechToTextService = (options: RealSpeechToTextOptions = {}) => {
  const { disableTTS, voiceSettings, onSentenceComplete } = options;
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [history, setHistory] = useState<TranscriptEntry[]>([]);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const sentenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTranscriptRef = useRef('');

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      
      const recognition = recognitionRef.current;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        console.log('Speech recognition started');
        setIsListening(true);
        setIsTyping(true);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }

        const currentTranscript = finalTranscript || interimTranscript;
        setTranscript(currentTranscript);

        // Check for complete sentence if we have final transcript
        if (finalTranscript && onSentenceComplete) {
          checkForCompleteSentence(finalTranscript);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'no-speech') {
          console.log('No speech detected');
        } else if (event.error === 'not-allowed') {
          console.error('Microphone permission denied');
        } else if (event.error === 'network') {
          console.error('Network error');
        }
      };

      recognition.onend = () => {
        console.log('Speech recognition ended');
        setIsListening(false);
        setIsTyping(false);
      };
    } else {
      console.warn('Speech recognition not supported in this browser');
    }
  }, [onSentenceComplete]);

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

  const startListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        console.log('Starting speech recognition...');
      } catch (error) {
        console.error('Failed to start speech recognition:', error);
      }
    } else {
      console.error('Speech recognition not available');
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        console.log('Stopping speech recognition...');
      } catch (error) {
        console.error('Failed to stop speech recognition:', error);
      }
    }
    
    // Clear timeouts
    if (sentenceTimeoutRef.current) {
      clearTimeout(sentenceTimeoutRef.current);
      sentenceTimeoutRef.current = null;
    }
    
    setTranscript('');
    setIsTyping(false);
  }, []);

  const clearTranscript = useCallback(() => {
    setHistory([]);
  }, []);

  return {
    isListening,
    transcript,
    history,
    isTyping,
    startListening,
    stopListening,
    clearTranscript,
  };
};

// Type declarations for Web Speech API
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
  
  interface SpeechRecognitionEvent extends Event {
    resultIndex: number;
    results: SpeechRecognitionResultList;
  }
  
  interface SpeechRecognitionErrorEvent extends Event {
    error: string;
    message?: string;
  }
  
  interface SpeechRecognitionResultList {
    length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
  }
  
  interface SpeechRecognitionResult {
    isFinal: boolean;
    length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
  }
  
  interface SpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
  }
  
  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    maxAlternatives: number;
    onstart: ((event: Event) => void) | null;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onend: ((event: Event) => void) | null;
    onsoundstart: ((event: Event) => void) | null;
    onsoundend: ((event: Event) => void) | null;
    onspeechstart: ((event: Event) => void) | null;
    onspeechend: ((event: Event) => void) | null;
    onnomatch: ((event: Event) => void) | null;
    start(): void;
    stop(): void;
    abort(): void;
  }
}

import { useCallback, useEffect, useRef, useState } from 'react';

type SpeechRecognitionResult = {
  transcript: string;
  confidence: number;
};

type SpeechRecognitionResultItem = {
  [index: number]: SpeechRecognitionResult;
  length: number;
  item(index: number): SpeechRecognitionResult;
  isFinal: boolean;
};

type SpeechRecognitionEvent = {
  resultIndex: number;
  results: Array<SpeechRecognitionResultItem>;
  error?: string;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Record<string, unknown>) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

type PersistentMicOptions = {
  onResult: (text: string, isFinal: boolean) => void;
  onError?: (error: Error) => void;
};

type PersistentMicReturn = {
  start: () => Promise<void>;
  stop: () => void;
  mute: () => void;
  unmute: () => void;
  clearBuffer: () => void;
  isListening: boolean;
  isMuted: boolean;
  transcript: string;
};

export const usePersistentMic = (options: PersistentMicOptions): PersistentMicReturn => {
  const { onResult, onError } = options;
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState('');
  const transcriptBufferRef = useRef('');
  const isMutedRef = useRef(false);

  // Initialize Web Speech API
  useEffect(() => {
    const SpeechRecognition = (window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.error('Web Speech API not supported in this browser');
      return;
    }

    recognitionRef.current = new (SpeechRecognition as unknown as new () => SpeechRecognitionLike)();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'en-US';

    recognitionRef.current.onstart = () => {
      console.log(' Microphone started listening');
      setIsListening(true);
    };

    recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
      // Ignore results if muted
      if (isMutedRef.current) {
        console.log(' Mic muted - ignoring recognition result');
        return;
      }

      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      // Update buffer with final results
      if (finalTranscript) {
        transcriptBufferRef.current += finalTranscript;
        console.log(' Final:', finalTranscript);
      }

      // Combine for display
      const displayText = transcriptBufferRef.current + interimTranscript;
      setTranscript(displayText);

      // Notify parent with final results
      if (finalTranscript) {
        onResult(finalTranscript.trim(), true);
      } else if (interimTranscript) {
        onResult(interimTranscript, false);
      }
    };

    recognitionRef.current.onerror = (event: Record<string, unknown>) => {
      const errorMsg = String(event.error || 'Unknown error');
      console.error(' Microphone error:', errorMsg);
      if (onError) {
        onError(new Error(errorMsg));
      }
    };

    recognitionRef.current.onend = () => {
      console.log(' Microphone stopped listening');
      setIsListening(false);
      // Restart listening to keep persistent connection
      if (recognitionRef.current && !isMutedRef.current) {
        try {
          recognitionRef.current.start();
        } catch (err) {
          console.error('Error restarting microphone:', err);
        }
      }
    };

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [onResult, onError]);

  const startListening = useCallback(async () => {
    if (recognitionRef.current && !isListening && !isMutedRef.current) {
      try {
        recognitionRef.current.start();
        console.log(' Starting microphone');
      } catch (err) {
        console.error('Error starting microphone:', err);
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
        console.log(' Stopping microphone');
      } catch (err) {
        console.error('Error stopping microphone:', err);
      }
    }
  }, [isListening]);

  const mute = useCallback(() => {
    console.log('🔇 Muting microphone');
    isMutedRef.current = true;
    setIsMuted(true);
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.error('Error stopping mic for mute:', err);
      }
    }
  }, [isListening]);

  const unmute = useCallback(() => {
    console.log(' Unmuting microphone');
    isMutedRef.current = false;
    setIsMuted(false);
    if (recognitionRef.current) {
      try {
        // Always try to start, even if already listening - ensures speech recognition resumes
        recognitionRef.current.start();
        console.log(' Microphone unmuted and started');
      } catch (err: Error | unknown) {
        // Ignore "already started" errors - those are expected
        const errMsg = err instanceof Error ? err.message : String(err);
        if (!errMsg.includes('already started')) {
          console.error(' Error starting mic after unmute:', errMsg);
          // Retry once after a small delay
          setTimeout(() => {
            try {
              if (recognitionRef.current && !isMutedRef.current) {
                recognitionRef.current.start();
                console.log(' Microphone retry successful');
              }
            } catch (retryErr) {
              console.error(' Microphone retry failed:', retryErr);
            }
          }, 50);
        }
      }
    }
  }, []);

  const clearBuffer = useCallback(() => {
    console.log(' Clearing microphone buffer');
    transcriptBufferRef.current = '';
    setTranscript('');
  }, []);

  return {
    start: startListening,
    stop: stopListening,
    mute,
    unmute,
    clearBuffer,
    isListening,
    isMuted,
    transcript,
  };
};

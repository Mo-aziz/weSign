// TypeScript type definitions for Web Speech Recognition API
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

declare var SpeechRecognition: {
  prototype: SpeechRecognition;
  new (): SpeechRecognition;
} | undefined;

declare var webkitSpeechRecognition: {
  prototype: SpeechRecognition;
  new (): SpeechRecognition;
} | undefined;

// Check if Web Speech Recognition API is available
const isSpeechRecognitionSupported = () => {
  return (
    'SpeechRecognition' in window ||
    'webkitSpeechRecognition' in window
  );
};

// Get the SpeechRecognition constructor (works in Chrome/Edge)
const getSpeechRecognition = (): any => {
  if ('SpeechRecognition' in window) {
    return (window as any).SpeechRecognition;
  }
  if ('webkitSpeechRecognition' in window) {
    return (window as any).webkitSpeechRecognition;
  }
  return null;
};

export type SpeechRecognitionOptions = {
  continuous?: boolean;
  interimResults?: boolean;
  lang?: string;
};

export type SpeechRecognitionCallbackResult = {
  transcript: string;
  isFinal: boolean;
};

export type SpeechRecognitionCallbacks = {
  onResult?: (result: SpeechRecognitionCallbackResult) => void;
  onError?: (error: Error) => void;
  onEnd?: () => void;
};

let recognitionInstance: SpeechRecognition | null = null;

export const startSpeechRecognition = (
  options: SpeechRecognitionOptions = {},
  callbacks: SpeechRecognitionCallbacks = {}
): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!isSpeechRecognitionSupported()) {
      const error = new Error('Speech Recognition not supported in this browser');
      callbacks.onError?.(error);
      reject(error);
      return;
    }

    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      const error = new Error('Speech Recognition API not available');
      callbacks.onError?.(error);
      reject(error);
      return;
    }

    // Aggressively stop any existing recognition
    const oldInstance = recognitionInstance;
    recognitionInstance = null; // Clear immediately so new instance isn't confused
    
    if (oldInstance) {
      try {
        console.log('[Speech Recognition] Aborting old recognition instance');
        (oldInstance as SpeechRecognition).abort();
      } catch (e) {
        console.warn('[Speech Recognition] Error aborting old instance:', e);
      }
    }

    // Double-check that we're creating a fresh instance
    if (recognitionInstance !== null) {
      console.warn('[Speech Recognition] WARNING: recognitionInstance still exists after clearing!');
      try {
        (recognitionInstance as SpeechRecognition).abort();
        recognitionInstance = null;
      } catch (e) {
        recognitionInstance = null; // Force clear
      }
    }

    const recognition = new SpeechRecognition() as SpeechRecognition;
    recognitionInstance = recognition;

    recognition.continuous = options.continuous ?? true;
    recognition.interimResults = options.interimResults ?? true;
    recognition.lang = options.lang ?? 'en-US';

    let finalTranscript = '';
    let hasError = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      const fullTranscript = finalTranscript + interimTranscript;
      callbacks.onResult?.({
        transcript: fullTranscript.trim(),
        isFinal: !interimTranscript,
      });
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const error = new Error(`Speech recognition error: ${event.error}`);
      
      // Don't treat certain errors as fatal
      if (event.error === 'no-speech') {
        console.warn('[Speech Recognition] No speech detected, will continue listening...');
        return;
      }
      
      if (event.error === 'audio-capture') {
        console.warn('[Speech Recognition] No audio input detected, will continue listening...');
        return;
      }
      
      // "aborted" is expected when we intentionally stop - not a real error
      if (event.error === 'aborted') {
        console.warn('[Speech Recognition] Recognition was aborted (expected when stopping)');
        return;
      }
      
      hasError = true;
      callbacks.onError?.(error);
      reject(error);
    };

    recognition.onend = () => {
      recognitionInstance = null;
      callbacks.onEnd?.();
      if (!hasError) {
        resolve();
      }
    };

    try {
      recognition.start();
    } catch (error) {
      recognitionInstance = null;
      const err = error instanceof Error ? error : new Error('Failed to start speech recognition');
      callbacks.onError?.(err);
      reject(err);
    }
  });
};

export const stopSpeechRecognition = (aggressive: boolean = false): void => {
  const instance = recognitionInstance;
  recognitionInstance = null; // Clear immediately
  
  if (instance) {
    try {
      if (aggressive) {
        // Use abort for forced cleanup (when starting a new recognition)
        console.log('[Speech Recognition] Stopping with abort (aggressive cleanup)');
        instance.abort();
      } else {
        // Use stop for normal completion (user taking a break)
        console.log('[Speech Recognition] Stopping with stop (normal)');
        instance.stop();
      }
    } catch (error) {
      console.warn('[Speech Recognition] Error stopping recognition:', error);
    }
  }
};

export const isListening = (): boolean => {
  return recognitionInstance !== null;
};


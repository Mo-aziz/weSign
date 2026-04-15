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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare const SpeechRecognition: {
  prototype: SpeechRecognition;
  new (): SpeechRecognition;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare const webkitSpeechRecognition: {
  prototype: SpeechRecognition;
  new (): SpeechRecognition;
};

// Check if Web Speech Recognition API is available
const isSpeechRecognitionSupported = () => {
  return (
    'SpeechRecognition' in window ||
    'webkitSpeechRecognition' in window
  );
};

// Get the SpeechRecognition constructor (works in Chrome/Edge)
const getSpeechRecognition = (): typeof SpeechRecognition | null => {
  if ('SpeechRecognition' in window) {
    return (window as unknown as Record<string, unknown>).SpeechRecognition as typeof SpeechRecognition;
  }
  if ('webkitSpeechRecognition' in window) {
    return (window as unknown as Record<string, unknown>).webkitSpeechRecognition as typeof SpeechRecognition;
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
  onEnd?: (isManualStop: boolean) => void;
  onNetworkError?: (retryCount: number, maxRetries: number) => void;
};

let recognitionInstance: SpeechRecognition | null = null;
let wasManuallyStopped = false; // Track if stop was manual vs automatic timeout
let networkErrorRetryCount = 0;
const MAX_NETWORK_ERROR_RETRIES = 5;

export type NetworkErrorRetryCallback = (retryCount: number, maxRetries: number) => void;

export const startSpeechRecognition = (
  options: SpeechRecognitionOptions = {},
  callbacks: SpeechRecognitionCallbacks & { onNetworkError?: NetworkErrorRetryCallback } = {}
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

    // Stop any existing recognition
    if (recognitionInstance) {
      try {
        recognitionInstance.stop();
      } catch (e) {
        // Ignore errors when stopping
      }
    }

    const recognition = new SpeechRecognition();
    recognitionInstance = recognition;
    wasManuallyStopped = false; // Reset flag for this session

    recognition.continuous = options.continuous ?? true;
    recognition.interimResults = options.interimResults ?? true;
    recognition.lang = options.lang ?? 'en-US';

    let finalTranscript = '';

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
      // Handle recoverable errors that should be ignored
      if (event.error === 'aborted' || event.error === 'no-speech' || event.error === 'audio-capture') {
        console.log(`🎤 Recoverable speech recognition error (ignored): ${event.error}`);
        return;
      }
      
      // Handle network errors specially - these are temporary and should be retried
      if (event.error === 'network' || event.error === 'service-unavailable') {
        networkErrorRetryCount++;
        console.warn(`⚠️ Temporary network error (attempt ${networkErrorRetryCount}/${MAX_NETWORK_ERROR_RETRIES}):`, event.error);
        
        if (networkErrorRetryCount < MAX_NETWORK_ERROR_RETRIES) {
          // Signal the retry attempt to any listeners
          callbacks.onNetworkError?.(networkErrorRetryCount, MAX_NETWORK_ERROR_RETRIES);
          // Don't reject - let onEnd handle the retry
          return;
        } else {
          // Max retries exceeded, now it's a real error
          console.error(`❌ Network error exceeded max retries (${MAX_NETWORK_ERROR_RETRIES})`);
          networkErrorRetryCount = 0;
        }
      }
      
      // All other errors are fatal
      const error = new Error(`Speech recognition error: ${event.error}`);
      networkErrorRetryCount = 0; // Reset counter on fatal error
      callbacks.onError?.(error);
      reject(error);
    };

    recognition.onend = () => {
      recognitionInstance = null;
      callbacks.onEnd?.(wasManuallyStopped);
      resolve();
    };

    try {
      recognition.start();
    } catch (error) {
      recognitionInstance = null;
      networkErrorRetryCount = 0;
      const err = error instanceof Error ? error : new Error('Failed to start speech recognition');
      callbacks.onError?.(err);
      reject(err);
    }
  });
};

export const stopSpeechRecognition = (): void => {
  if (recognitionInstance) {
    try {
      wasManuallyStopped = true; // Mark as intentional stop
      recognitionInstance.stop();
    } catch (error) {
      console.warn('Error stopping speech recognition:', error);
    }
    recognitionInstance = null;
  }
};

export const isListening = (): boolean => {
  return recognitionInstance !== null;
};


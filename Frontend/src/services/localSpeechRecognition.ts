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
};

let recognitionInstance: SpeechRecognition | null = null;
let wasManuallyStopped = false; // Track if stop was manual vs automatic timeout

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
      // Don't treat intentional aborts or recoverable errors as failures
      if (event.error === 'aborted' || event.error === 'no-speech' || event.error === 'audio-capture') {
        console.log(`🎤 Recoverable speech recognition error (ignored): ${event.error}`);
        return;
      }
      
      const error = new Error(`Speech recognition error: ${event.error}`);
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


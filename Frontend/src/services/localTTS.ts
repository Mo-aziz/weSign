// Check if Web Speech API is available
const isSpeechSynthesisSupported = () => {
  return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
};

// Cache voices to avoid repeated lookups
let voices: SpeechSynthesisVoice[] = [];
let voicesLoaded = false;

const loadVoices = (): Promise<SpeechSynthesisVoice[]> => {
  return new Promise((resolve) => {
    if (voices.length > 0) {
      resolve(voices);
      return;
    }

    // Some browsers need this event to be triggered to load voices
    const onVoicesChanged = () => {
      voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        voicesLoaded = true;
        window.speechSynthesis.onvoiceschanged = null;
        resolve(voices);
      }
    };

    window.speechSynthesis.onvoiceschanged = onVoicesChanged;
    
    // Try to get voices immediately
    voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      voicesLoaded = true;
      resolve(voices);
    } else if (!voicesLoaded) {
      // If voices aren't loaded yet, wait for the voiceschanged event
      window.speechSynthesis.onvoiceschanged = onVoicesChanged;
    }
  });
};

export interface VoiceSettings {
  voiceName?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

export const speak = async (text: string, settings: VoiceSettings = {}): Promise<void> => {
  if (!isSpeechSynthesisSupported()) {
    console.warn('Web Speech API not supported in this browser');
    throw new Error('Text-to-speech not supported in this browser');
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  // Wait for voices to be loaded
  const availableVoices = await loadVoices();
  
  return new Promise((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Set voice properties from settings or use defaults
    utterance.rate = settings.rate ?? 1.0;
    utterance.pitch = settings.pitch ?? 1.0;
    utterance.volume = settings.volume ?? 1.0;

    // Set voice if specified in settings
    if (settings.voiceName) {
      const voice = availableVoices.find(v => v.name === settings.voiceName);
      if (voice) {
        utterance.voice = voice;
      }
    }

    // If no voice selected, use default selection logic
    if (!utterance.voice && availableVoices.length > 0) {
      // Prefer a local (non-remote) voice if available
      const localVoices = availableVoices.filter(v => v.localService);
      const preferredVoices = localVoices.length > 0 ? localVoices : availableVoices;
      
      // Try to find a natural-sounding voice
      const naturalVoice = preferredVoices.find(v => 
        v.name.includes('Natural') || 
        v.name.includes('Enhanced') ||
        v.name.includes('Premium')
      );
      
      utterance.voice = naturalVoice || preferredVoices[0];
    }

    // Set up event handlers
    utterance.onend = () => {
      console.log('Speech synthesis completed');
      resolve();
    };
    
    utterance.onerror = (event) => {
      console.error('SpeechSynthesis error:', event);
      reject(new Error('Speech synthesis failed'));
    };

    // Add a small delay to ensure the previous speech is properly cancelled
    setTimeout(() => {
      try {
        window.speechSynthesis.speak(utterance);
      } catch (error) {
        console.error('Error starting speech synthesis:', error);
        reject(error);
      }
    }, 50);
  });
};

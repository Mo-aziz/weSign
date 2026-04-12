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
      const requestedVoiceName = settings.voiceName;
      
      // Helper function to detect gender from voice name
      const detectGender = (voiceName: string): 'female' | 'male' | 'neutral' => {
        const lowerName = voiceName.toLowerCase();
        const femaleKeywords = ['female', 'woman', 'girl', 'mrs', 'ms', 'she', 'aria', 'clara', 'emma', 'eva', 'zira', 'susan', 'moira', 'victoria'];
        const maleKeywords = ['male', 'man', 'boy', 'mr', 'he', 'david', 'mark', 'james', 'george', 'henry', 'jorge', 'juan'];
        
        if (femaleKeywords.some(kw => lowerName.includes(kw))) return 'female';
        if (maleKeywords.some(kw => lowerName.includes(kw))) return 'male';
        return 'neutral';
      };
      
      const getLanguageCode = (voiceName: string): string | null => {
        // First try to extract language code like (en-US), (it-IT), etc.
        const codeMatch = voiceName.match(/\(([a-z]{2}-[A-Z]{2})\)/);
        if (codeMatch) return codeMatch[1];
        
        // If no code found, try to match native language names
        const lowerName = voiceName.toLowerCase();
        const languageMap: { [key: string]: string } = {
          // English
          'english': 'en-US',
          'inglese': 'en-US',
          'anglais': 'en-US',
          
          // Italian
          'italian': 'it-IT',
          'italiano': 'it-IT',
          
          // French
          'french': 'fr-FR',
          'français': 'fr-FR',
          'francaise': 'fr-FR',
          
          // Spanish
          'spanish': 'es-ES',
          'español': 'es-ES',
          
          // German
          'german': 'de-DE',
          'deutsch': 'de-DE',
          
          // Portuguese
          'portuguese': 'pt-PT',
          'português': 'pt-PT',
          'portugues': 'pt-PT',
          
          // Dutch
          'dutch': 'nl-NL',
          'nederlands': 'nl-NL',
          
          // Polish
          'polish': 'pl-PL',
          'polski': 'pl-PL',
          
          // Russian
          'russian': 'ru-RU',
          'русский': 'ru-RU',
          
          // Japanese
          'japanese': 'ja-JP',
          '日本語': 'ja-JP',
          
          // Chinese (Mandarin)
          'chinese': 'zh-CN',
          'mandarin': 'zh-CN',
          '中文': 'zh-CN',
          
          // Korean
          'korean': 'ko-KR',
          '한국어': 'ko-KR',
          
          // Arabic
          'arabic': 'ar-SA',
          'العربية': 'ar-SA',
          
          // Hindi
          'hindi': 'hi-IN',
          'हिन्दी': 'hi-IN',
          
          // Turkish
          'turkish': 'tr-TR',
          'türkçe': 'tr-TR',
          'turkce': 'tr-TR',
        };
        
        for (const [langName, code] of Object.entries(languageMap)) {
          if (lowerName.includes(langName)) {
            return code;
          }
        }
        
        return null;
      };
      
      const requestedGender = detectGender(requestedVoiceName);
      const requestedLang = getLanguageCode(requestedVoiceName);
      
      console.log(`🎤 [TTS] Voice matching: "${requestedVoiceName}" | Gender: ${requestedGender} | Lang: ${requestedLang}`);
      
      // Priority 1: Exact match
      let selectedVoice = availableVoices.find(v => v.name === requestedVoiceName);
      if (selectedVoice) {
        console.log(`✅ [TTS] Priority 1 (Exact): "${selectedVoice.name}"`);
        utterance.voice = selectedVoice;
      } else {
        // Priority 2: Case-insensitive match
        selectedVoice = availableVoices.find(v => v.name.toLowerCase() === requestedVoiceName.toLowerCase());
        if (selectedVoice) {
          console.log(`✅ [TTS] Priority 2 (Case-insensitive): "${selectedVoice.name}"`);
          utterance.voice = selectedVoice;
        } else if (requestedLang) {
          // Priority 3: Same language + same gender
          selectedVoice = availableVoices.find(v => {
            const voiceLang = getLanguageCode(v.name);
            return voiceLang === requestedLang && detectGender(v.name) === requestedGender;
          });
          if (selectedVoice) {
            console.log(`✅ [TTS] Priority 3 (Same Lang + Gender): "${selectedVoice.name}"`);
            utterance.voice = selectedVoice;
          } else {
            // Priority 4: Same language (any gender)
            selectedVoice = availableVoices.find(v => getLanguageCode(v.name) === requestedLang);
            if (selectedVoice) {
              console.log(`✅ [TTS] Priority 4 (Same Lang): "${selectedVoice.name}"`);
              utterance.voice = selectedVoice;
            } else {
              // Priority 5: English + same gender
              selectedVoice = availableVoices.find(v => {
                const voiceLang = getLanguageCode(v.name);
                return voiceLang?.startsWith('en') && detectGender(v.name) === requestedGender;
              });
              if (selectedVoice) {
                console.log(`✅ [TTS] Priority 5 (English + Gender): "${selectedVoice.name}"`);
                utterance.voice = selectedVoice;
              } else {
                // Priority 6: English (any gender)
                selectedVoice = availableVoices.find(v => getLanguageCode(v.name)?.startsWith('en'));
                if (selectedVoice) {
                  console.log(`✅ [TTS] Priority 6 (English): "${selectedVoice.name}"`);
                  utterance.voice = selectedVoice;
                } else {
                  console.log(`✅ [TTS] Priority 7 (Default): Using first available`);
                  utterance.voice = availableVoices[0] || undefined;
                }
              }
            }
          }
        } else {
          // If no language code detected, try gender matching
          selectedVoice = availableVoices.find(v => detectGender(v.name) === requestedGender);
          if (selectedVoice) {
            console.log(`✅ [TTS] Priority (Gender): "${selectedVoice.name}"`);
            utterance.voice = selectedVoice;
          }
        }
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

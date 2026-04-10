import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { useSignRecognitionService } from '../services/useSignRecognitionService';
import { startSpeechRecognition, stopSpeechRecognition } from '../services/localSpeechRecognition';

const formatTimestamp = (timestamp: number) => new Date(timestamp).toLocaleTimeString();

const CallModal = () => {
  const { 
    user, 
    callState, 
    currentCall, 
    localStream, 
    remoteStream,
    endCall: contextEndCall,
    sendTranslation,
    sendTranscript,
    translationMessages,
    transcriptMessages,
    isCameraEnabled,
    toggleCamera
  } = useAppContext();

  // Video refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  // Keep refs in sync with context streams
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    remoteStreamRef.current = remoteStream;
  }, [remoteStream]);

  // Initialize speech synthesis
  useEffect(() => {
    const initSpeechSynthesis = () => {
      window.speechSynthesis.getVoices();
    };

    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = initSpeechSynthesis;
    }
    initSpeechSynthesis();
  }, []);

  // Set video streams - single unified effect
  useEffect(() => {
    if (!localVideoRef.current) return;

    // If we have a stream from context, use it
    if (localStream) {
      console.log('Setting local video stream from context:', localStream);
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(err => {
        console.error('Failed to play local video:', err);
      });
      return; // Done, don't try to request new stream
    }

    console.log('No local stream available yet, waiting for context to provide it...');
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      console.log('Setting remote video stream:', remoteStream);
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.playsInline = true;
      
      // Force video to play
      remoteVideoRef.current.play().catch(err => {
        console.log('Remote video immediate play failed:', err);
      });
      
      remoteVideoRef.current.onloadedmetadata = () => {
        console.log('Remote video metadata loaded, attempting play');
        remoteVideoRef.current?.play().catch(err => {
          console.error('Remote video play failed on metadata:', err);
        });
      };
    }
  }, [remoteStream]);

  // Sign recognition service
  const signService = useSignRecognitionService({ cadenceMs: 5000 });

  // Speech recognition - EXACT copy of Translation page + sendTranscript + pause detection
  const [speechEditable, setSpeechEditable] = useState('');
  const [isSpeechEditing, setIsSpeechEditing] = useState(false);
  const [isMicListening, setIsMicListening] = useState(false);
  const [isMicPausedForTTS, setIsMicPausedForTTS] = useState(false); // NEW: Track if mic is paused during TTS
  const [elapsedTime, setElapsedTime] = useState(0);
  const [previewEditMode, setPreviewEditMode] = useState(false);
  const [previewEditText, setPreviewEditText] = useState('');
  const recognitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processedMessageTimestampsRef = useRef<Set<number>>(new Set()); // Track processed messages to prevent duplicate TTS
  const pausedMessageTimestampRef = useRef<number | null>(null); // Track which message caused the pause to prevent duplicate resume attempts
  const isMicPausedRef = useRef<boolean>(false); // Use ref for immediate access in handlers (not state)
  const micSafetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Safety timeout to force mic open after 3 seconds

  const lastFinalTranscriptRef = useRef('');

  // Handle double-click on preview text to edit
  const handlePreviewDoubleClick = () => {
    setPreviewEditMode(true);
    setPreviewEditText(previewText);
  };

  // Save edited preview text and confirm it
  const handleSavePreviewEdit = () => {
    setPreviewEditMode(false);
    if (previewEditText.trim()) {
      // Use the full confirmation handler to send and speak the edited text
      handleConfirmTranslation(previewEditText);
    }
  };

  // Cancel edit
  const handleCancelPreviewEdit = () => {
    setPreviewEditMode(false);
    setPreviewEditText('');
  };

  // Timer effect - increment every second when call is connected
  useEffect(() => {
    if (callState !== 'connected') {
      setElapsedTime(0);
      return;
    }

    const timerInterval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [callState]);

  const handleMicToggle = async () => {
    if (isMicListening) {
      stopSpeechRecognition();
      setIsMicListening(false);
      setIsMicPausedForTTS(false);
      isMicPausedRef.current = false;
      lastFinalTranscriptRef.current = '';
      if (recognitionTimeoutRef.current) {
        clearTimeout(recognitionTimeoutRef.current);
      }
      // Clear safety timeout if present
      if (micSafetyTimeoutRef.current) {
        clearTimeout(micSafetyTimeoutRef.current);
        micSafetyTimeoutRef.current = null;
      }
    } else {
      setIsMicListening(true);
      lastFinalTranscriptRef.current = '';
      try {
        await startSpeechRecognition(
          {
            continuous: true,
            interimResults: true,
            lang: 'en-US',
          },
          {
            onResult: (result) => {
              const currentTranscript = result.transcript;
              const lastFinal = lastFinalTranscriptRef.current;
              
              // Extract only the new part (what came after the last final transcript)
              let newPart = '';
              if (lastFinal) {
                // Find where the new content starts
                if (currentTranscript.startsWith(lastFinal)) {
                  newPart = currentTranscript.slice(lastFinal.length).trim();
                } else {
                  // If structure changed, use the whole current transcript
                  newPart = currentTranscript.trim();
                }
              } else {
                newPart = currentTranscript.trim();
              }
              
              // Show only the new part in the text box (current sentence being spoken)
              if (newPart || !result.isFinal) {
                setSpeechEditable(newPart);
                setIsSpeechEditing(true);
              }
              
              // When we get a final result, extract and add only the new sentence(s)
              if (result.isFinal && newPart) {
                // Split by sentence endings and add each new sentence separately
                const sentences = newPart.split(/(?<=[.!?])\s+/).filter(s => s.trim());
                
                sentences.forEach((sentence) => {
                  if (sentence.trim()) {
                    console.log('Final sentence detected, sending to non-hearing:', sentence.trim());
                    // Send to non-hearing person using sendTranscript
                    sendTranscript(sentence.trim());
                  }
                });
                
                // Update the last final transcript to current full transcript
                lastFinalTranscriptRef.current = currentTranscript;
                
                // Clear the text box immediately for the next sentence
                setSpeechEditable('');
                setIsSpeechEditing(false);
              }
            },
            onError: (error) => {
              console.error('Speech recognition error:', error);
              setIsMicListening(false);
              lastFinalTranscriptRef.current = '';
            },
            onEnd: () => {
              setIsMicListening(false);
              lastFinalTranscriptRef.current = '';
            },
          }
        );
      } catch (error) {
        console.error('Failed to start speech recognition:', error);
        setIsMicListening(false);
      }
    }
  };

  // Remove all old broken functions - we only use handleMicToggle now

  const startRecognition = useCallback(() => {
    signService.startRecognition();
  }, [signService]);

  const stopRecognition = useCallback(() => {
    signService.stopRecognition();
  }, [signService]);

  // Debug: Track transcript messages
  useEffect(() => {
    console.log('=== TRANSCRIPT MESSAGES UPDATED ===');
    console.log('Number of messages:', transcriptMessages.length);
    console.log('Messages:', transcriptMessages);
  }, [transcriptMessages]);
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [speechEditable, isSpeechEditing, transcriptMessages]);

  // Track whether we've started mic for this call to avoid infinite loops
  const micStartedRef = useRef(false);
  const signStartedRef = useRef(false);

  // Start services when call is connected
  useEffect(() => {
    console.log('Call state changed:', callState, 'User type:', user?.isDeaf ? 'deaf' : 'hearing');
    
    if (callState === 'connected') {
      if (user?.isDeaf) {
        if (!signStartedRef.current) {
          console.log('Starting sign recognition for deaf user');
          startRecognition();
          signStartedRef.current = true;
        }
      } else {
        if (!micStartedRef.current) {
          console.log('Auto-starting speech recognition for hearing user');
          handleMicToggle();
          micStartedRef.current = true;
        }
      }
      return;
    }

    // Any non-connected state should stop call-only services and reset flags.
    console.log('Stopping call services for non-connected state');
    if (user?.isDeaf) {
      if (signStartedRef.current) {
        stopRecognition();
        signStartedRef.current = false;
      }
    } else {
      if (micStartedRef.current) {
        handleMicToggle();
        micStartedRef.current = false;
      }
    }
    
    // Clear any pending safety timeout and reset pause state
    if (micSafetyTimeoutRef.current) {
      clearTimeout(micSafetyTimeoutRef.current);
      micSafetyTimeoutRef.current = null;
    }
    setIsMicPausedForTTS(false);
    isMicPausedRef.current = false;
    pausedMessageTimestampRef.current = null;
  }, [callState, user?.isDeaf, handleMicToggle, startRecognition, stopRecognition]);

  // Debug: Log user voiceSettings whenever they change
  useEffect(() => {
    console.log('[DEBUG] User voiceSettings changed:', user?.voiceSettings);
    console.log('[DEBUG] Voice name:', user?.voiceSettings?.voiceName);
    console.log('[DEBUG] Voice rate:', user?.voiceSettings?.rate);
    console.log('[DEBUG] Voice pitch:', user?.voiceSettings?.pitch);
  }, [user?.voiceSettings?.voiceName, user?.voiceSettings?.rate, user?.voiceSettings?.pitch]);

  // Remove old useEffect - transcript is now handled in handleMicToggle

  const handleConfirmTranslation = useCallback((text: string) => {
    console.log('[handleConfirmTranslation] Called with text:', text);
    console.log('[handleConfirmTranslation] Current user object:', user);
    console.log('[handleConfirmTranslation] user?.voiceSettings:', user?.voiceSettings);
    
    const entry = signService.confirmTranslation(text);
    console.log('[handleConfirmTranslation] Confirmed entry:', entry);
    console.log('[handleConfirmTranslation] currentCall:', currentCall);
    
    if (entry && currentCall) {
      const remoteUserIsDeaf = currentCall.callee.id === user?.id 
        ? currentCall.caller.isDeaf 
        : currentCall.callee.isDeaf;

      console.log('[handleConfirmTranslation] currentCall.caller:', currentCall.caller);
      console.log('[handleConfirmTranslation] currentCall.callee:', currentCall.callee);
      console.log('[handleConfirmTranslation] Current user id:', user?.id);
      console.log('[handleConfirmTranslation] Remote user is deaf:', remoteUserIsDeaf);
      
      const shouldSpeakValue = !remoteUserIsDeaf;
      console.log('[handleConfirmTranslation] *** ABOUT TO SEND MESSAGE ***');
      console.log('[handleConfirmTranslation] text:', entry.text);
      console.log('[handleConfirmTranslation] shouldSpeak:', shouldSpeakValue);
      console.log('[handleConfirmTranslation] voiceSettings:', user?.voiceSettings);
      console.log('[handleConfirmTranslation] voiceSettings.voiceName:', user?.voiceSettings?.voiceName);
      sendTranslation(entry.text, shouldSpeakValue, user?.voiceSettings);
    } else {
      console.log('[handleConfirmTranslation] SKIPPED - entry:', !!entry, 'currentCall:', !!currentCall);
    }
  }, [signService, sendTranslation, user?.isDeaf, user?.id, user?.voiceSettings, currentCall]);

  // Auto-speak only the LATEST remote message if shouldSpeak is true
  useEffect(() => {
    if (translationMessages.length === 0) return;
    
    const latestMsg: any = translationMessages[translationMessages.length - 1];
    console.log('[Auto-TTS] Processing latest message:', latestMsg);
    console.log('[Auto-TTS] shouldSpeak:', latestMsg.shouldSpeak, 'isLocal:', latestMsg.isLocal, 'text:', latestMsg.text);
    
    // Check if this message has already been processed to prevent duplicate TTS
    if (latestMsg.timestamp && processedMessageTimestampsRef.current.has(latestMsg.timestamp)) {
      console.log('[Auto-TTS] 🔁 Message already processed, skipping:', latestMsg.timestamp);
      return;
    }
    
    if (latestMsg.shouldSpeak && !latestMsg.isLocal && latestMsg.text) {
      // Mark this message as processed
      if (latestMsg.timestamp) {
        processedMessageTimestampsRef.current.add(latestMsg.timestamp);
      }
      console.log('[Auto-TTS] ✓ SPEAKING message:', latestMsg.text);
      console.log('[Auto-TTS] Sender voice settings:', latestMsg.voiceSettings);
      
      // NEW: Pause microphone during TTS playback to prevent feedback loop
      const shouldPauseMic = user?.isDeaf === false && isMicListening; // Pause only if hearing user with mic on
      if (shouldPauseMic) {
        console.log('[Auto-TTS] 🔇 Pausing microphone to prevent feedback loop');
        stopSpeechRecognition(false); // Normal stop, not aggressive abort
        setIsMicPausedForTTS(true);
        isMicPausedRef.current = true; // Track in ref for immediate access in handlers
        
        // Track which message caused this pause (to prevent duplicate resume attempts)
        if (latestMsg.timestamp) {
          pausedMessageTimestampRef.current = latestMsg.timestamp;
          console.log('[Auto-TTS] Marked pause for message timestamp:', latestMsg.timestamp);
        }
      }
      
      const utterance = new SpeechSynthesisUtterance(latestMsg.text);
      
      // Use sender's voice settings if available, with safe defaults
      try {
        utterance.rate = latestMsg.voiceSettings?.rate ?? 1.0;
        utterance.pitch = latestMsg.voiceSettings?.pitch ?? 1.0;
      } catch (error) {
        console.warn('[Auto-TTS] Error setting rate/pitch, using defaults:', error);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
      }
      utterance.volume = 1.0;

      const setVoiceAndSpeak = () => {
        try {
          const voices = window.speechSynthesis.getVoices();
          console.log('[Auto-TTS] Available voices count:', voices.length);
          
          if (!voices || voices.length === 0) {
            console.warn('[Auto-TTS] No voices available, will use default');
            window.speechSynthesis.speak(utterance);
            return;
          }

          // Helper function to detect gender from voice name
          const detectGender = (voiceName: string): 'male' | 'female' | 'neutral' => {
            const nameLower = voiceName.toLowerCase();
            // Female keywords
            if (nameLower.includes('female') || nameLower.includes('woman') || 
                nameLower.includes('girl') || nameLower.includes('mrs') ||
                nameLower.includes('clara') || nameLower.includes('victoria') ||
                nameLower.includes('amira') || nameLower.includes('nadia') ||
                nameLower.includes('denise') || nameLower.includes('linda')) {
              return 'female';
            }
            // Male keywords
            if (nameLower.includes('male') || nameLower.includes('man') ||
                nameLower.includes('boy') || nameLower.includes('mr') ||
                nameLower.includes('george') || nameLower.includes('james') ||
                nameLower.includes('david') || nameLower.includes('pablo') ||
                nameLower.includes('carlos') || nameLower.includes('francisco')) {
              return 'male';
            }
            return 'neutral';
          };

          // Helper function to extract language code from voice
          const extractLanguageCode = (voice: SpeechSynthesisVoice): string => {
            // voice.lang is like "en-US", "fr-FR", etc.
            return voice.lang.split('-')[0].toLowerCase();
          };

          // Helper function to detect language from voice name
          const detectLanguageFromName = (voiceName: string): string | null => {
            const nameLower = voiceName.toLowerCase();
            
            const languageMap: { [key: string]: string } = {
              'french': 'fr', 'français': 'fr',
              'spanish': 'es', 'español': 'es',
              'german': 'de', 'deutsch': 'de',
              'italian': 'it', 'italiano': 'it',
              'portuguese': 'pt', 'português': 'pt',
              'dutch': 'nl', 'nederlands': 'nl',
              'polish': 'pl', 'polski': 'pl',
              'russian': 'ru', 'русский': 'ru',
              'chinese': 'zh', 'japanese': 'ja', 'korean': 'ko',
              'hindi': 'hi', 'arabic': 'ar', 'turkish': 'tr'
            };

            for (const [lang, code] of Object.entries(languageMap)) {
              if (nameLower.includes(lang)) {
                return code;
              }
            }
            return null;
          };

          // Try to find sender's selected voice
          if (latestMsg.voiceSettings?.voiceName) {
            const senderVoiceName = latestMsg.voiceSettings.voiceName;
            const senderGender = detectGender(senderVoiceName);
            
            console.log('[Auto-TTS] 🔍 Looking for voice:', senderVoiceName);
            console.log('[Auto-TTS] Detected sender gender:', senderGender);
            
            // Try exact match first
            let matchedVoice = voices.find(v => v.name === senderVoiceName);
            
            if (matchedVoice) {
              console.log('[Auto-TTS] ✓ Found sender voice (EXACT MATCH):', matchedVoice.name);
              utterance.voice = matchedVoice;
              window.speechSynthesis.speak(utterance);
              return;
            }
            
            // Try case-insensitive match
            console.log('[Auto-TTS] Exact match failed, trying case-insensitive...');
            matchedVoice = voices.find(v => v.name.toLowerCase() === senderVoiceName.toLowerCase());
            
            if (matchedVoice) {
              console.log('[Auto-TTS] ✓ Found sender voice (CASE-INSENSITIVE):', matchedVoice.name);
              utterance.voice = matchedVoice;
              window.speechSynthesis.speak(utterance);
              return;
            }
            
            // Try partial match
            console.log('[Auto-TTS] Case-insensitive failed, trying partial match...');
            matchedVoice = voices.find(v => v.name.toLowerCase().includes(senderVoiceName.toLowerCase()));
            
            if (matchedVoice) {
              console.log('[Auto-TTS] ✓ Found sender voice (PARTIAL MATCH):', matchedVoice.name);
              utterance.voice = matchedVoice;
              window.speechSynthesis.speak(utterance);
              return;
            }
            
            console.warn('[Auto-TTS] ✗ Sender voice not found on this system:', senderVoiceName);
            
            // NEW ENHANCED FALLBACK CHAIN
            const detectedLanguage = detectLanguageFromName(senderVoiceName);
            console.log('[Auto-TTS] Detected language from voice name:', detectedLanguage);
            
            // Priority 1: Same language + same gender
            if (detectedLanguage && senderGender !== 'neutral') {
              console.log('[Auto-TTS] 🔍 Searching for voice in', detectedLanguage, 'with gender:', senderGender);
              const sameLangSameGender = voices.filter(v => {
                const voiceLang = extractLanguageCode(v);
                const voiceGender = detectGender(v.name);
                return voiceLang === detectedLanguage && voiceGender === senderGender;
              });
              
              if (sameLangSameGender.length > 0) {
                console.log('[Auto-TTS] ✓ Found', sameLangSameGender[0].name, '(same language + same gender)');
                utterance.voice = sameLangSameGender[0];
                window.speechSynthesis.speak(utterance);
                return;
              }
            }
            
            // Priority 2: Same language (any gender)
            if (detectedLanguage) {
              console.log('[Auto-TTS] 🔍 Searching for voice in', detectedLanguage, '(any gender)');
              const sameLang = voices.filter(v => {
                const voiceLang = extractLanguageCode(v);
                return voiceLang === detectedLanguage;
              });
              
              if (sameLang.length > 0) {
                console.log('[Auto-TTS] ✓ Found', sameLang[0].name, '(same language)');
                utterance.voice = sameLang[0];
                window.speechSynthesis.speak(utterance);
                return;
              }
            }
            
            // Priority 3: English with matching gender
            if (senderGender !== 'neutral') {
              console.log('[Auto-TTS] 🔍 Searching for English voice with gender:', senderGender);
              const englishSameGender = voices.filter(v => {
                const voiceLang = extractLanguageCode(v);
                const voiceGender = detectGender(v.name);
                return voiceLang === 'en' && voiceGender === senderGender;
              });
              
              if (englishSameGender.length > 0) {
                console.log('[Auto-TTS] ✓ Found', englishSameGender[0].name, '(English with matching gender)');
                utterance.voice = englishSameGender[0];
                window.speechSynthesis.speak(utterance);
                return;
              }
            }
            
            // Priority 4: Default English voice (any gender)
            console.log('[Auto-TTS] 🔄 Falling back to default English voice');
            const englishVoices = voices.filter(v => extractLanguageCode(v) === 'en');
            
            if (englishVoices.length > 0) {
              const defaultEnglishVoice = englishVoices[0];
              console.log('[Auto-TTS] ✓ Using:', defaultEnglishVoice.name, '(' + defaultEnglishVoice.lang + ')');
              utterance.voice = defaultEnglishVoice;
              window.speechSynthesis.speak(utterance);
              return;
            } else {
              console.warn('[Auto-TTS] ⚠️ No English voices found, using system default');
              // utterance.voice will be undefined, system will use default
              window.speechSynthesis.speak(utterance);
              return;
            }
          } else {
            console.log('[Auto-TTS] No voiceName provided in message voiceSettings');
          }

          // If no voiceSettings provided at all, use default English
          console.log('[Auto-TTS] 🔄 Using default voice (no voiceSettings)');
          const englishVoices = voices.filter(v => extractLanguageCode(v) === 'en');
          
          if (englishVoices.length > 0) {
            const defaultEnglishVoice = englishVoices[0];
            console.log('[Auto-TTS] ✓ Using default English voice:', defaultEnglishVoice.name);
            utterance.voice = defaultEnglishVoice;
          }
          
          console.log('[Auto-TTS] 🔊 About to speak with voice:', utterance.voice?.name || '(system default)');
          console.log('[Auto-TTS] Utterance settings - rate:', utterance.rate, 'pitch:', utterance.pitch, 'volume:', utterance.volume);
          window.speechSynthesis.speak(utterance);
        } catch (error) {
          console.error('[Auto-TTS] Error in setVoiceAndSpeak:', error);
          try {
            window.speechSynthesis.speak(utterance);
          } catch (fallbackError) {
            console.error('[Auto-TTS] Fallback speak also failed:', fallbackError);
          }
        }
      };

      utterance.onerror = (event) => {
        console.error('[Auto-TTS] Speech synthesis error:', event.error);
        // Resume microphone on error - check using ref for immediate state access
        const shouldResume = isMicPausedRef.current && pausedMessageTimestampRef.current !== null;
        console.log('[Auto-TTS] Error handler - shouldResume:', shouldResume, 'isMicPausedRef:', isMicPausedRef.current, 'pausedTimestamp:', pausedMessageTimestampRef.current);
        
        if (shouldResume) {
          console.log('[Auto-TTS] ⚠️ TTS error - resuming microphone');
          setIsMicPausedForTTS(false);
          isMicPausedRef.current = false;
          pausedMessageTimestampRef.current = null; // Clear to prevent duplicate resumes
          
          // Clear any existing safety timeout
          if (micSafetyTimeoutRef.current) {
            clearTimeout(micSafetyTimeoutRef.current);
            micSafetyTimeoutRef.current = null;
          }
          
          // Wait longer to ensure old recognition fully stopped
          setTimeout(() => {
            console.log('[Auto-TTS] Attempting to resume speech recognition after error');
            setIsMicListening(true);
            startSpeechRecognition(
              {
                continuous: true,
                interimResults: true,
                lang: 'en-US',
              },
              {
                onResult: (result) => {
                  // Clear safety timeout once speech recognition actually starts working
                  if (micSafetyTimeoutRef.current) {
                    clearTimeout(micSafetyTimeoutRef.current);
                    micSafetyTimeoutRef.current = null;
                  }
                  
                  const currentTranscript = result.transcript;
                  const lastFinal = lastFinalTranscriptRef.current;
                  
                  let newPart = '';
                  if (lastFinal) {
                    if (currentTranscript.startsWith(lastFinal)) {
                      newPart = currentTranscript.slice(lastFinal.length).trim();
                    } else {
                      newPart = currentTranscript.trim();
                    }
                  } else {
                    newPart = currentTranscript.trim();
                  }
                  
                  if (newPart || !result.isFinal) {
                    setSpeechEditable(newPart);
                    setIsSpeechEditing(true);
                  }
                  
                  if (result.isFinal && newPart) {
                    const sentences = newPart.split(/(?<=[.!?])\s+/).filter(s => s.trim());
                    sentences.forEach((sentence) => {
                      if (sentence.trim()) {
                        console.log('Final sentence detected, sending to non-hearing:', sentence.trim());
                        sendTranscript(sentence.trim());
                      }
                    });
                    lastFinalTranscriptRef.current = currentTranscript;
                    setSpeechEditable('');
                    setIsSpeechEditing(false);
                  }
                },
                onError: (error) => {
                  console.error('Speech recognition error on resume:', error);
                  setIsMicListening(false);
                },
                onEnd: () => {
                  setIsMicListening(false);
                },
              }
            ).catch(err => {
              console.error('[Auto-TTS] Failed to resume speech recognition:', err);
              setIsMicListening(false);
            });
            
            // Safety timeout: Force mic open after 3 seconds if it hasn't started normally
            micSafetyTimeoutRef.current = setTimeout(() => {
              console.warn('[Auto-TTS] ⚠️ SAFETY TIMEOUT (error recovery): Forcing microphone open after 3 seconds');
              setIsMicListening(true);
              micSafetyTimeoutRef.current = null;
            }, 3000);
          }, 1200); // Even longer delay for error recovery
        }
      };

      utterance.onend = () => {
        console.log('[Auto-TTS] ✓ TTS completed - resuming microphone');
        // Resume microphone when TTS finishes - check using ref for immediate state access
        const shouldResume = isMicPausedRef.current && pausedMessageTimestampRef.current !== null;
        console.log('[Auto-TTS] onend handler - shouldResume:', shouldResume, 'isMicPausedRef:', isMicPausedRef.current, 'pausedTimestamp:', pausedMessageTimestampRef.current);
        
        if (shouldResume) {
          console.log('[Auto-TTS] Resuming mic for paused message');
          setIsMicPausedForTTS(false);
          isMicPausedRef.current = false;
          pausedMessageTimestampRef.current = null; // Clear to prevent duplicate resumes
          
          // Clear any existing safety timeout
          if (micSafetyTimeoutRef.current) {
            clearTimeout(micSafetyTimeoutRef.current);
            micSafetyTimeoutRef.current = null;
          }
          
          // Wait longer to ensure old recognition fully stopped
          setTimeout(() => {
            console.log('[Auto-TTS] Attempting to resume speech recognition after TTS end');
            setIsMicListening(true);
            startSpeechRecognition(
              {
                continuous: true,
                interimResults: true,
                lang: 'en-US',
              },
              {
                onResult: (result) => {
                  // Clear safety timeout once speech recognition actually starts working
                  if (micSafetyTimeoutRef.current) {
                    clearTimeout(micSafetyTimeoutRef.current);
                    micSafetyTimeoutRef.current = null;
                  }
                  
                  const currentTranscript = result.transcript;
                  const lastFinal = lastFinalTranscriptRef.current;
                  
                  let newPart = '';
                  if (lastFinal) {
                    if (currentTranscript.startsWith(lastFinal)) {
                      newPart = currentTranscript.slice(lastFinal.length).trim();
                    } else {
                      newPart = currentTranscript.trim();
                    }
                  } else {
                    newPart = currentTranscript.trim();
                  }
                  
                  if (newPart || !result.isFinal) {
                    setSpeechEditable(newPart);
                    setIsSpeechEditing(true);
                  }
                  
                  if (result.isFinal && newPart) {
                    const sentences = newPart.split(/(?<=[.!?])\s+/).filter(s => s.trim());
                    sentences.forEach((sentence) => {
                      if (sentence.trim()) {
                        console.log('Final sentence detected, sending to non-hearing:', sentence.trim());
                        sendTranscript(sentence.trim());
                      }
                    });
                    lastFinalTranscriptRef.current = currentTranscript;
                    setSpeechEditable('');
                    setIsSpeechEditing(false);
                  }
                },
                onError: (error) => {
                  console.error('[Auto-TTS] Speech recognition error on resume:', error);
                  setIsMicListening(false);
                },
                onEnd: () => {
                  console.log('[Auto-TTS] Speech recognition ended');
                  setIsMicListening(false);
                },
              }
            ).catch(err => {
              console.error('[Auto-TTS] PROMISE REJECTED - Failed to resume speech recognition:', err);
              console.error('[Auto-TTS] Error details:', err instanceof Error ? err.message : err);
              setIsMicListening(false);
            });
            
            // Safety timeout: Force mic open after 3 seconds if it hasn't started normally
            micSafetyTimeoutRef.current = setTimeout(() => {
              console.warn('[Auto-TTS] ⚠️ SAFETY TIMEOUT: Forcing microphone open after 3 seconds');
              setIsMicListening(true);
              micSafetyTimeoutRef.current = null;
            }, 3000);
          }, 1000); // Increased delay to 1000ms to ensure proper cleanup
        }
      };

      try {
        if (!window.speechSynthesis.getVoices() || window.speechSynthesis.getVoices().length === 0) {
          console.log('[Auto-TTS] Voices not loaded yet, waiting for onvoiceschanged');
          window.speechSynthesis.onvoiceschanged = () => {
            setVoiceAndSpeak();
          };
        } else {
          setVoiceAndSpeak();
        }
      } catch (error) {
        console.error('[Auto-TTS] Error during voice setup:', error);
        try {
          window.speechSynthesis.speak(utterance);
        } catch (fallbackError) {
          console.error('[Auto-TTS] Final fallback failed:', fallbackError);
        }
      }
    } else {
      const reason = !latestMsg.shouldSpeak ? 'shouldSpeak=false (deaf)' : latestMsg.isLocal ? 'local' : 'no text';
      console.log('[Auto-TTS] ✗ NOT speaking -', reason);
    }
  }, [translationMessages, user?.isDeaf, isMicListening]);

  const endCall = useCallback(() => {
    console.log('[CallModal] Ending call - stopping services and media');
    
    stopRecognition();
    // Stop microphone if it's listening
    if (isMicListening) {
      handleMicToggle();
    }
    
    // CRITICAL: Stop all tracks using refs to avoid stale closures
    // Local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        console.log('[CallModal] Stopping local track:', track.kind, 'enabled:', track.enabled);
        track.stop();
      });
    }
    
    // Remote stream
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach(track => {
        console.log('[CallModal] Stopping remote track:', track.kind);
        track.stop();
      });
    }
    
    // Detach video elements before cleanup
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    
    // Now notify the service to clean up state
    contextEndCall();
  }, [contextEndCall, stopRecognition, isMicListening, handleMicToggle]);

  // Get current preview text
  const previewText = useMemo(() => {
    return signService.previewText || '';
  }, [signService.previewText]);

  // Render different interfaces based on user type
  const renderDeafInterface = () => (
    <div className="h-full flex flex-col">
      {/* Camera for deaf user */}
      <div className="flex-1 relative bg-black">
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
          controls={false}
          disablePictureInPicture={true}
        />
        {!localStream && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-lg font-medium text-white">Camera off</p>
          </div>
        )}
        
        {/* Camera toggle button */}
        <button
          onClick={toggleCamera}
          className="absolute top-4 right-4 p-3 rounded-full bg-gray-800/50 text-white hover:bg-gray-700/50 transition-colors"
        >
          {isCameraEnabled ? '📹' : '📵'}
        </button>

        {/* End call button - X style at lower part of camera */}
        <button
          onClick={endCall}
          className="absolute bottom-4 left-1/2 transform -translate-x-1/2 w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Translation panel for deaf user */}
      <div className="bg-white dark:bg-slate-900 p-4 border-t border-slate-200 dark:border-slate-700">
        <div className="space-y-3">
          {/* Sign to text preview */}
          <div>
            <p className="text-xs text-purple-600 dark:text-purple-400 mb-1">Your signing</p>
            {previewEditMode ? (
              // Edit mode
              <div>
                <textarea
                  value={previewEditText}
                  onChange={(e) => setPreviewEditText(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-800 rounded-lg p-2 border border-blue-500 dark:border-blue-500 text-sm text-gray-900 dark:text-gray-100 font-medium min-h-[60px] resize-none focus:outline-none"
                  autoFocus
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleSavePreviewEdit}
                    className="flex-1 rounded-lg bg-green-500 px-2 py-1 text-xs font-semibold text-white hover:bg-green-600"
                  >
                    ✓ Save
                  </button>
                  <button
                    onClick={handleCancelPreviewEdit}
                    className="flex-1 rounded-lg bg-gray-400 px-2 py-1 text-xs font-semibold text-white hover:bg-gray-500"
                  >
                    ✕ Cancel
                  </button>
                </div>
              </div>
            ) : (
              // View mode
              <div
                onDoubleClick={handlePreviewDoubleClick}
                className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 min-h-[60px] border border-gray-200 dark:border-gray-700 cursor-text hover:border-purple-400 transition-colors"
              >
                <p className="text-sm text-gray-900 dark:text-gray-100 font-medium">{previewText || 'Start signing...'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">(Double-click to edit)</p>
              </div>
            )}
          </div>
          
          {/* Incoming text from other user - show both translationMessages and transcriptMessages */}
          <div>
            <p className="text-xs text-purple-600 dark:text-purple-400 mb-1">What they're saying</p>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 min-h-[60px] max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-700">
              {(() => {
                // Combine and filter: show remote translationMessages + all transcriptMessages
                const remoteTranslations = translationMessages.filter(msg => msg.isLocal === false);
                const allTranscripts = transcriptMessages;
                const combined = [...remoteTranslations, ...allTranscripts].sort((a, b) => a.timestamp - b.timestamp);
                
                return combined.length > 0 ? (
                  combined.slice(-3).map((msg, index) => (
                    <p key={index} className="text-sm text-gray-900 dark:text-gray-100 font-medium mb-1">
                      {msg.text}
                    </p>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">Waiting...</p>
                );
              })()}
            </div>
          </div>
          
          <button
            onClick={() => handleConfirmTranslation(previewText)}
            disabled={!previewText}
            className="w-full rounded-lg bg-blue-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirm & Speak
          </button>
        </div>
      </div>
    </div>
  );

  const renderHearingInterface = () => (
    <div className="h-full flex flex-col">
      {/* Microphone panel for hearing user */}
      <div className="bg-gray-50 dark:bg-gray-900 p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-black dark:text-gray-100">Microphone</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleMicToggle}
              className={`p-2 rounded-lg transition-colors ${
                isMicListening 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-300 text-black'
              }`}
            >
              {isMicListening ? '🎤' : '🔇'}
            </button>
          </div>
        </div>
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 min-h-[80px] border border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-black dark:text-gray-100 font-medium">
            {speechEditable || 'Start speaking...'}
          </p>
          {isSpeechEditing && (
            <p className="text-xs text-blue-500 mt-1">Listening...</p>
          )}
          {isMicPausedForTTS && (
            <p className="text-xs text-orange-500 mt-1 font-semibold">🔇 Listening paused (remote voice speaking)</p>
          )}
        </div>
        <div className="mt-2 text-xs text-black dark:text-gray-400">
          Status: {isMicPausedForTTS ? '🔇 Paused (TTS)' : isMicListening ? '🎤 Listening' : 'Not listening'} | 
          Editing: {isSpeechEditing ? 'Yes' : 'No'} |
          Text: "{speechEditable || 'Empty'}"
        </div>
      </div>

      {/* Incoming sign translations - ONLY show remote messages (isLocal: false) */}
      <div className="flex-1 bg-white dark:bg-slate-900 p-4 overflow-y-auto relative">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">What they're signing</h3>
        <div className="space-y-2">
          {translationMessages.filter(msg => msg.isLocal === false).length > 0 ? (
            translationMessages
              .filter(msg => msg.isLocal === false)
              .map((msg, index) => (
                <div key={index} className="bg-slate-100 dark:bg-slate-800 rounded-lg p-3">
                  <p className="text-sm text-slate-900 dark:text-white">{msg.text}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {formatTimestamp(msg.timestamp)}
                  </p>
                </div>
              ))
          ) : (
            <p className="text-slate-500 dark:text-slate-400 text-center py-8">
              Waiting for their signs...
            </p>
          )}
        </div>

        {/* End call button - X style at lower part of hearing interface */}
        <button
          onClick={endCall}
          className="absolute bottom-4 left-1/2 transform -translate-x-1/2 w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* iPhone-style status bar */}
      <div className="bg-black text-white px-6 py-2 flex justify-between items-center text-xs">
        <span>
          {callState === 'connected' 
            ? `${Math.floor(elapsedTime / 60)}:${(elapsedTime % 60).toString().padStart(2, '0')}`
            : callState === 'calling'
            ? 'Calling...'
            : '00:00'
          }
        </span>
        <span>{currentCall?.callee?.username || currentCall?.caller?.username || 'Unknown'}</span>
        <div className="flex items-center gap-1">
          <span>📶</span>
          <span>🔋</span>
        </div>
      </div>

      {/* Main call interface */}
      <div className="h-[calc(100vh-32px)]">
        {callState === 'calling' ? (
          // Calling state - show connecting UI
          <div className="h-full flex flex-col items-center justify-center text-white">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white text-4xl font-bold mb-8">
              {currentCall?.callee?.username?.charAt(0).toUpperCase() || '?'}
            </div>
            <h2 className="text-2xl font-semibold mb-2">
              {currentCall?.callee?.username || 'Unknown'}
            </h2>
            <p className="text-lg text-slate-300 mb-8">Calling...</p>
            
            {/* End call button - X style at bottom of calling screen */}
            <button
              onClick={endCall}
              className="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          // Connected state - show full call interface
          user?.isDeaf ? renderDeafInterface() : renderHearingInterface()
        )}
      </div>
    </div>
  );
};

export default CallModal;

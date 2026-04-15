import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppContext } from '../context/useAppContext';
import { useSignRecognitionService } from '../services/useSignRecognitionService';
import { startSpeechRecognition, stopSpeechRecognition } from '../services/localSpeechRecognition';

// Type definitions for message objects
type TranslationMessage = { text: string; timestamp: number; shouldSpeak: boolean; isLocal?: boolean };
type TranscriptMessage = { text: string; timestamp: number; shouldSpeak: boolean; isLocal?: boolean };

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
  const [elapsedTime, setElapsedTime] = useState(0);
  const [previewEditMode, setPreviewEditMode] = useState(false);
  const [previewEditText, setPreviewEditText] = useState('');
  const recognitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const networkErrorRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      lastFinalTranscriptRef.current = '';
      if (recognitionTimeoutRef.current) {
        clearTimeout(recognitionTimeoutRef.current);
      }
      if (networkErrorRetryRef.current) {
        clearTimeout(networkErrorRetryRef.current);
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
              console.error('Speech recognition error (fatal):', error);
              setIsMicListening(false);
              lastFinalTranscriptRef.current = '';
            },
            onNetworkError: (retryCount, maxRetries) => {
              // Network errors are temporary - auto-retry with exponential backoff
              console.warn(`🔄 Network error detected (${retryCount}/${maxRetries}), retrying in ${100 * retryCount}ms...`);
              
              // Clear any existing retry timer
              if (networkErrorRetryRef.current) {
                clearTimeout(networkErrorRetryRef.current);
              }
              
              // Exponential backoff: 100ms, 200ms, 300ms, etc.
              const retryDelayMs = 100 * retryCount;
              
              networkErrorRetryRef.current = setTimeout(() => {
                // Only retry if user still has mic enabled
                if (isMicListeningRef.current) {
                  console.log(`↻ Retrying speech recognition after network error (attempt ${retryCount})`);
                  handleMicToggle().catch(err => {
                    console.error('Failed to retry speech recognition:', err);
                    setIsMicListening(false);
                  });
                }
              }, retryDelayMs);
            },
            onEnd: (isManualStop) => {
              // Only close mic if user manually stopped it
              // If it's an auto-timeout (no-speech), auto-restart it
              if (isManualStop) {
                setIsMicListening(false);
              } else if (isMicListeningRef.current) {
                // Auto-restart on browser timeout
                console.log('Browser timeout detected during initial speech recognition, auto-restarting');
                setTimeout(() => {
                  autoRestartSpeechRecognitionOnTimeout();
                }, 100);
              }
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
  }, [callState, user?.isDeaf, handleMicToggle, startRecognition, stopRecognition]);

  // Track received messages that we've already spoken
  const spokenReceivedMessagesRef = useRef<Set<number>>(new Set());
  
  // Refs for microphone pause/resume during TTS (use refs to avoid closure staleness)
  const isMicPausedRef = useRef(false);
  const pausedMessageTimestampRef = useRef<number | null>(null);
  const ttsResumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ttsSafetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMicListeningRef = useRef(isMicListening); // Track mic state in ref to avoid stale closure

  // Update the ref whenever isMicListening changes
  useEffect(() => {
    isMicListeningRef.current = isMicListening;
  }, [isMicListening]);

  // Helper to auto-restart speech recognition if it times out (browser no-speech error)
  const autoRestartSpeechRecognitionOnTimeout = useCallback(async () => {
    // Only auto-restart if the mic is supposed to be on
    if (!isMicListeningRef.current) return;

    console.log(' Auto-restarting speech recognition after browser timeout');
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
                  console.log('Final sentence detected, sending after auto-restart:', sentence.trim());
                  sendTranscript(sentence.trim());
                }
              });
              
              lastFinalTranscriptRef.current = currentTranscript;
              setSpeechEditable('');
              setIsSpeechEditing(false);
            }
          },
          onNetworkError: (retryCount, maxRetries) => {
            // Propagate network errors but continue trying
            console.warn(`⚠️ Auto-restart: Network error (${retryCount}/${maxRetries}), will retry...`);
          },
          onError: (error) => {
            console.error('Speech recognition error (auto-restart):', error);
            // Don't change state on error, let the user manually close if needed
          },
          onEnd: (isManualStop) => {
            // If auto-timeout and mic should still be on, restart again
            if (!isManualStop && isMicListeningRef.current) {
              console.log('Speech recognition ended by timeout again, restarting...');
              setTimeout(() => {
                autoRestartSpeechRecognitionOnTimeout();
              }, 100);
            }
          },
        }
      );
    } catch (error) {
      console.error(' Failed to auto-restart speech recognition:', error);
    }
  }, [startSpeechRecognition, sendTranscript]);

  // Play TTS for received translation messages from other user
  useEffect(() => {
    // Only the hearing user should hear received translations
    if (user?.isDeaf) return;

    // Find received messages with shouldSpeak = true that we haven't spoken yet
    const receivedMessages = translationMessages.filter(
      (msg: TranslationMessage) => msg.isLocal === false && msg.shouldSpeak === true
    );

    if (receivedMessages.length === 0) return;

    // Get the most recent one
    const lastReceivedMessage = receivedMessages[receivedMessages.length - 1];
    
    // Check if we've already spoken this message
    if (spokenReceivedMessagesRef.current.has(lastReceivedMessage.timestamp)) {
      return; // Already spoken, skip
    }

    // Mark as spoken
    spokenReceivedMessagesRef.current.add(lastReceivedMessage.timestamp);
    console.log(' Playing TTS for received translation:', lastReceivedMessage.text);

    // Pause microphone to avoid TTS feedback
    if (isMicListening) {
      console.log('🎙️ Pausing microphone during TTS playback (preventing echo)');
      stopSpeechRecognition();
      isMicPausedRef.current = true;
      pausedMessageTimestampRef.current = lastReceivedMessage.timestamp;
    }

    // Play TTS using Web Speech API
    const utterance = new SpeechSynthesisUtterance(lastReceivedMessage.text);
    
    // Use user's voice settings if available
    utterance.rate = user?.voiceSettings?.rate ?? 1.0;
    utterance.pitch = user?.voiceSettings?.pitch ?? 1.0;
    utterance.volume = 1.0;

    // Smart voice selection with gender + language awareness
    const voices = window.speechSynthesis.getVoices();
    
    console.log(` [TTS] User voice settings: ${user?.voiceSettings?.voiceName || 'NOT SET'} | Available voices: ${voices.length}`);
    
    if (user?.voiceSettings?.voiceName && voices.length > 0) {
      const requestedVoiceName = user.voiceSettings.voiceName;
      console.log(` [TTS] Attempting to find voice: "${requestedVoiceName}"`);
      
      // Helper function to detect gender from voice name
      const detectGender = (voiceName: string): 'female' | 'male' | 'neutral' => {
        const lowerName = voiceName.toLowerCase();
        const femaleKeywords = ['female', 'woman', 'girl', 'mrs', 'ms', 'she', 'aria', 'clara', 'emma', 'eva', 'zira', 'susan', 'moira', 'victoria'];
        const maleKeywords = ['male', 'man', 'boy', 'mr', 'he', 'david', 'mark', 'james', 'george', 'henry', 'jorge', 'juan'];
        
        if (femaleKeywords.some(kw => lowerName.includes(kw))) return 'female';
        if (maleKeywords.some(kw => lowerName.includes(kw))) return 'male';
        return 'neutral';
      };
      
      const requestedGender = detectGender(requestedVoiceName);
      
      // Helper to extract language code from voice
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
      
      const requestedLang = getLanguageCode(requestedVoiceName);
      
      console.log(` Voice matching: "${requestedVoiceName}" | Gender: ${requestedGender} | Lang: ${requestedLang}`);
      
      // Priority 1: Exact match
      let selectedVoice = voices.find(v => v.name === requestedVoiceName);
      if (selectedVoice) {
        console.log(` Priority 1 (Exact): Found "${selectedVoice.name}"`);
        utterance.voice = selectedVoice;
      } else {
        // Priority 2: Case-insensitive / partial match
        selectedVoice = voices.find(v => v.name.toLowerCase() === requestedVoiceName.toLowerCase());
        if (selectedVoice) {
          console.log(` Priority 2 (Partial): Found "${selectedVoice.name}"`);
          utterance.voice = selectedVoice;
        } else if (requestedLang) {
          // Priority 3: Same language + same gender
          selectedVoice = voices.find(v => {
            const voiceLang = getLanguageCode(v.name);
            return voiceLang === requestedLang && detectGender(v.name) === requestedGender;
          });
          if (selectedVoice) {
            console.log(` Priority 3 (Same Lang + Gender): Found "${selectedVoice.name}"`);
            utterance.voice = selectedVoice;
          } else {
            // Priority 4: Same language + any gender
            selectedVoice = voices.find(v => getLanguageCode(v.name) === requestedLang);
            if (selectedVoice) {
              console.log(` Priority 4 (Same Lang): Found "${selectedVoice.name}"`);
              utterance.voice = selectedVoice;
            } else {
              // Priority 5: English + same gender
              selectedVoice = voices.find(v => {
                const voiceLang = getLanguageCode(v.name);
                return voiceLang?.startsWith('en') && detectGender(v.name) === requestedGender;
              });
              if (selectedVoice) {
                console.log(` Priority 5 (English + Gender): Found "${selectedVoice.name}"`);
                utterance.voice = selectedVoice;
              } else {
                // Priority 6: English (any gender)
                selectedVoice = voices.find(v => getLanguageCode(v.name)?.startsWith('en'));
                if (selectedVoice) {
                  console.log(` Priority 6 (English): Found "${selectedVoice.name}"`);
                  utterance.voice = selectedVoice;
                } else {
                  // Priority 7: Any available voice
                  selectedVoice = voices[0];
                  console.log(` Priority 7 (Default): Using "${selectedVoice?.name}"`);
                  utterance.voice = selectedVoice || undefined;
                }
              }
            }
          }
        } else {
          // If no language detected, try gender match or default
          selectedVoice = voices.find(v => detectGender(v.name) === requestedGender);
          if (selectedVoice) {
            console.log(` Priority (Gender Match): Found "${selectedVoice.name}"`);
            utterance.voice = selectedVoice;
          } else {
            console.log(` Priority (Default): Using first available voice`);
            utterance.voice = voices[0] || undefined;
          }
        }
      }
    } else {
      // Voice settings not available or no voices loaded
      if (!user?.voiceSettings?.voiceName) {
        console.warn(` [TTS] No voice settings configured. Using system default.`);
      }
      if (voices.length === 0) {
        console.warn(` [TTS] No voices available yet (${voices.length} voices)`);
      }
    }

    // Log the final voice being used
    console.log(` [TTS] Final voice: ${utterance.voice?.name || 'SYSTEM DEFAULT'}`);
    if (utterance.voice) {
      console.log(`  → Lang: ${utterance.voice.lang}, Local: ${utterance.voice.localService}`);
    }

    utterance.onend = () => {
      console.log(' TTS completed for received translation');
      
      // Resume microphone if we paused it
      if (isMicPausedRef.current && pausedMessageTimestampRef.current === lastReceivedMessage.timestamp) {
        console.log(' [Auto-TTS] Attempting to resume speech recognition after TTS end');
        
        // Clear any pending timeouts
        if (ttsResumeTimeoutRef.current) {
          clearTimeout(ttsResumeTimeoutRef.current);
        }
        if (ttsSafetyTimeoutRef.current) {
          clearTimeout(ttsSafetyTimeoutRef.current);
        }

        // Attempt to resume microphone
        isMicPausedRef.current = false;
        pausedMessageTimestampRef.current = null;
        
        // Resume with slight delay to ensure speech synthesis fully stopped
        ttsResumeTimeoutRef.current = setTimeout(async () => {
          console.log(' Resuming microphone after TTS');
          try {
            setIsMicListening(true);
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
                        console.log('Final sentence detected, sending to non-hearing (TTS resume):', sentence.trim());
                        sendTranscript(sentence.trim());
                      }
                    });
                    
                    lastFinalTranscriptRef.current = currentTranscript;
                    setSpeechEditable('');
                    setIsSpeechEditing(false);
                  }
                },
                onError: (error) => {
                  console.error('Speech recognition error (TTS resume):', error);
                  setIsMicListening(false);
                  lastFinalTranscriptRef.current = '';
                },
                onEnd: (isManualStop) => {
                  // Only close if user manually stopped it (not auto-timeout)
                  if (isManualStop) {
                    setIsMicListening(false);
                  } else if (isMicListeningRef.current) {
                    // Auto-restart on browser timeout
                    console.log(' Browser timeout after TTS resume, auto-restarting');
                    setTimeout(() => {
                      autoRestartSpeechRecognitionOnTimeout();
                    }, 100);
                  }
                  lastFinalTranscriptRef.current = '';
                },
              }
            );
          } catch (error) {
            console.error(' Failed to resume microphone after TTS:', error);
            setIsMicListening(false);
          }
        }, 100);

        // Safety timeout: force microphone open if resume hasn't happened after 3 seconds
        ttsSafetyTimeoutRef.current = setTimeout(() => {
          if (!isMicListeningRef.current && isMicPausedRef.current === false) {
            console.log(' [Auto-TTS] SAFETY TIMEOUT: Forcing microphone open after 3 seconds');
            // Force toggle the mic open
            setIsMicListening(true);
            handleMicToggle().catch(err => console.error('Safety timeout: Failed to open mic:', err));
          }
        }, 3000);
      }
    };

    utterance.onerror = (event) => {
      console.error('TTS error:', event);
      
      // Resume microphone on error too
      if (isMicPausedRef.current && pausedMessageTimestampRef.current === lastReceivedMessage.timestamp) {
        console.log(' [Auto-TTS] Resuming after TTS error');
        
        isMicPausedRef.current = false;
        pausedMessageTimestampRef.current = null;
        
        setTimeout(async () => {
          console.log(' Resuming microphone after TTS error');
          try {
            setIsMicListening(true);
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
                        console.log('Final sentence detected, sending to non-hearing (TTS error recovery):', sentence.trim());
                        sendTranscript(sentence.trim());
                      }
                    });
                    
                    lastFinalTranscriptRef.current = currentTranscript;
                    setSpeechEditable('');
                    setIsSpeechEditing(false);
                  }
                },
                onError: (error) => {
                  console.error('Speech recognition error (TTS error recovery):', error);
                  setIsMicListening(false);
                  lastFinalTranscriptRef.current = '';
                },
                onEnd: (isManualStop) => {
                  // Only close if user manually stopped it (not auto-timeout)
                  if (isManualStop) {
                    setIsMicListening(false);
                  } else if (isMicListeningRef.current) {
                    // Auto-restart on browser timeout
                    console.log(' Browser timeout in TTS error recovery, auto-restarting');
                    setTimeout(() => {
                      autoRestartSpeechRecognitionOnTimeout();
                    }, 100);
                  }
                  lastFinalTranscriptRef.current = '';
                },
              }
            );
          } catch (error) {
            console.error(' Failed to resume microphone after TTS error:', error);
            setIsMicListening(false);
          }
        }, 100);
      }
    };

    window.speechSynthesis.speak(utterance);

    // Cleanup on unmount
    return () => {
      if (ttsResumeTimeoutRef.current) {
        clearTimeout(ttsResumeTimeoutRef.current);
      }
      if (ttsSafetyTimeoutRef.current) {
        clearTimeout(ttsSafetyTimeoutRef.current);
      }
    };
  }, [translationMessages, user?.isDeaf, user?.voiceSettings, handleMicToggle]);

  // Remove old useEffect - transcript is now handled in handleMicToggle

  const handleConfirmTranslation = useCallback((text: string) => {
    const entry = signService.confirmTranslation(text);
    if (entry) {
      // Determine if the other user is deaf or hearing
      let shouldSpeakToOtherUser = false;
      if (currentCall) {
        const otherUser = currentCall.caller.id === user?.id ? currentCall.callee : currentCall.caller;
        shouldSpeakToOtherUser = !otherUser.isDeaf; // Flag for receiver - they will speak it
        console.log(` Call type check: other user "${otherUser.username}" isDeaf=${otherUser.isDeaf} → shouldSpeak=${shouldSpeakToOtherUser}`);
      }
      
      // Send translation with appropriate shouldSpeak flag (receiver will play TTS)
      sendTranslation(entry.text, shouldSpeakToOtherUser);
      
      // DO NOT play audio on sender side - receiver will handle TTS
      console.log(' Translation sent, receiver will handle TTS if needed');
    }
  }, [signService, sendTranslation, user?.voiceSettings, user?.id, currentCall]);

  const endCall = useCallback(() => {
    stopRecognition();
    // Stop microphone if it's listening
    if (isMicListening) {
      handleMicToggle();
    }
    
    // Cleanup TTS and mic pause refs
    console.log(' Cleaning up TTS and microphone refs on call end');
    if (ttsResumeTimeoutRef.current) {
      clearTimeout(ttsResumeTimeoutRef.current);
      ttsResumeTimeoutRef.current = null;
    }
    if (ttsSafetyTimeoutRef.current) {
      clearTimeout(ttsSafetyTimeoutRef.current);
      ttsSafetyTimeoutRef.current = null;
    }
    isMicPausedRef.current = false;
    pausedMessageTimestampRef.current = null;
    
    // Stop all tracks in local stream to turn off camera
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
    // Stop all tracks in remote stream
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
    }
    
    contextEndCall();
  }, [contextEndCall, stopRecognition, isMicListening, localStream, remoteStream, handleMicToggle]);

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
          className="absolute bottom-4 left-1/2 transform -translate-x-1/2 w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-colors end-call-button"
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
          
          {/* Incoming messages from other user - show both translations and transcripts */}
          <div>
            <p className="text-xs text-purple-600 dark:text-purple-400 mb-1">What they're saying</p>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 min-h-[60px] max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-700">
              {translationMessages.filter((msg: TranslationMessage) => msg.isLocal === false).length > 0 || transcriptMessages.filter((msg: TranscriptMessage) => msg.isLocal === false).length > 0 ? (
                <>
                  {/* Show sign translations from other user */}
                  {translationMessages
                    .filter((msg: TranslationMessage) => msg.isLocal === false)
                    .slice(-3)
                    .reverse()
                    .map((msg, index) => (
                      <p key={`trans-${index}`} className="text-sm text-gray-900 dark:text-gray-100 font-medium mb-1">
                        {msg.text}
                      </p>
                    ))}
                  
                  {/* Show speech transcripts from hearing user */}
                  {transcriptMessages
                    .filter((msg: TranscriptMessage) => msg.isLocal === false)
                    .slice(-3)
                    .reverse()
                    .map((msg, index) => (
                      <p key={`speech-${index}`} className="text-sm text-black dark:text-white font-medium mb-1">
                        {msg.text}
                      </p>
                    ))}
                </>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">Waiting for their messages...</p>
              )}
            </div>
          </div>
          
          <button
            onClick={() => handleConfirmTranslation(previewText)}
            disabled={!previewText}
            className="w-full rounded-lg bg-blue-500 dark:bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
        </div>
        <div className="mt-2 text-xs text-black dark:text-gray-400">
          Status: {isMicListening ? 'Listening' : 'Not listening'} | 
          Editing: {isSpeechEditing ? 'Yes' : 'No'} |
          Text: "{speechEditable || 'Empty'}"
        </div>
      </div>

      {/* Incoming sign translations */}
      <div className="flex-1 bg-white dark:bg-slate-900 p-4 overflow-y-auto relative">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">What they're signing</h3>
        <div className="space-y-2">
          {translationMessages.filter((msg: TranslationMessage) => msg.isLocal === false).length > 0 ? (
            translationMessages
              .filter((msg: TranslationMessage) => msg.isLocal === false)
              .slice()
              .reverse()
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
          className="absolute bottom-4 left-1/2 transform -translate-x-1/2 w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-colors end-call-button"
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
          <div className="h-full flex flex-col items-center justify-center text-white call-connecting-state">
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
              className="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-colors end-call-button"
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

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
  }, [callState, user?.isDeaf, handleMicToggle, startRecognition, stopRecognition]);

  // Remove old useEffect - transcript is now handled in handleMicToggle

  const handleConfirmTranslation = useCallback((text: string) => {
    const entry = signService.confirmTranslation(text);
    if (entry) {
      sendTranslation(entry.text, true); // Set shouldSpeak to true so hearing person hears it
      
      // Speak the entire text at once with better settings to prevent interruption
      const utterance = new SpeechSynthesisUtterance(entry.text);
      
      // Configure utterance for better completion
      utterance.rate = user?.voiceSettings?.rate ?? 1.0;
      utterance.pitch = user?.voiceSettings?.pitch ?? 1.0;
      utterance.volume = 1.0;
      
      // Set voice if available - wait for voices to be loaded
      const setVoiceAndSpeak = () => {
        const voices = window.speechSynthesis.getVoices();
        console.log('Available voices:', voices.length);
        
        if (user?.voiceSettings?.voiceName) {
          const voice = voices.find(v => v.name === user?.voiceSettings?.voiceName);
          if (voice) {
            utterance.voice = voice;
            console.log('Using voice:', voice.name);
          } else {
            console.log('Voice not found, using default');
          }
        }
        
        // Ensure speech completes
        utterance.onend = () => {
          console.log('Speech completed successfully');
        };
        
        utterance.onerror = (event) => {
          console.error('Speech error:', event);
        };
        
        // Cancel any existing speech before starting new one
        window.speechSynthesis.cancel();
        
        // Small delay to ensure cancel is processed
        setTimeout(() => {
          window.speechSynthesis.speak(utterance);
          console.log('Speaking:', entry.text);
        }, 100);
      };
      
      // If voices are not loaded yet, wait for them
      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
          setVoiceAndSpeak();
        };
      } else {
        setVoiceAndSpeak();
      }
    }
  }, [signService, sendTranslation, user?.voiceSettings, user?.isDeaf]);

  const endCall = useCallback(() => {
    stopRecognition();
    // Stop microphone if it's listening
    if (isMicListening) {
      handleMicToggle();
    }
    
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
          
          {/* Incoming text from hearing user */}
          <div>
            <p className="text-xs text-purple-600 dark:text-purple-400 mb-1">What they're saying</p>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 min-h-[60px] max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-700">
              {transcriptMessages.length > 0 ? (
                transcriptMessages.slice(-3).map((msg, index) => (
                  <p key={index} className="text-sm text-gray-900 dark:text-gray-100 font-medium mb-1">
                    {msg.text}
                  </p>
                ))
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">Waiting...</p>
              )}
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
          {translationMessages.length > 0 ? (
            translationMessages.map((msg, index) => (
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

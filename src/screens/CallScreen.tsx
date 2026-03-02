import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useSignRecognitionService } from '../services/useSignRecognitionService';
import { speak } from '../services/localTTS';
import { useSpeechToTextService } from '../services/useSpeechToTextService';

const formatTimestamp = (timestamp: number) => new Date(timestamp).toLocaleTimeString();

interface LocationState {
  contact?: {
    id: string;
    username: string;
  };
}

const CallScreen = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const contact = (state as LocationState)?.contact;
  
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
    isMicEnabled,
    toggleCamera,
    toggleMic
  } = useAppContext();

  // Video refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Initialize speech synthesis
  useEffect(() => {
    const initSpeechSynthesis = () => {
      window.speechSynthesis.getVoices();
    };

    window.speechSynthesis.onvoiceschanged = initSpeechSynthesis;
    initSpeechSynthesis();

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      window.speechSynthesis.cancel();
    };
  }, []);

  // Set up video streams
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Sign recognition service (for deaf users)
  const {
    startRecognition,
    stopRecognition,
    confirmTranslation,
    rejectTranslation,
    clearHistory,
    previewText,
    history,
  } = useSignRecognitionService();

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastUtterance, setLastUtterance] = useState('');
  const [editableText, setEditableText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [confirmedText, setConfirmedText] = useState<string | null>(null);

  // Speech-to-text service (for non-deaf users)
  const {
    startListening,
    stopListening,
    clearTranscript,
    transcript,
    history: transcriptHistory,
    isTyping
  } = useSpeechToTextService({
    disableTTS: user?.isDeaf ?? false,
    voiceSettings: user?.voiceSettings ? {
      voiceName: user.voiceSettings.voiceName,
      rate: user.voiceSettings.rate ?? 1.0,
      pitch: user.voiceSettings.pitch ?? 1.0,
    } : undefined
  });

  const previewRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (previewText && previewRef.current) {
      previewRef.current.scrollTo({ top: previewRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [previewText]);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [transcript, isTyping, transcriptHistory]);

  // Start services when call is connected
  useEffect(() => {
    if (callState === 'connected') {
      if (user?.isDeaf) {
        startRecognition();
        startListening();
      } else {
        startListening();
      }
    }

    return () => {
      stopRecognition();
      stopListening();
    };
  }, [callState, user?.isDeaf, startRecognition, stopRecognition, startListening, stopListening]);

  // Send transcript when speech is detected (for non-deaf users)
  useEffect(() => {
    if (!user?.isDeaf && transcript && callState === 'connected') {
      sendTranscript(transcript);
    }
  }, [transcript, user?.isDeaf, callState, sendTranscript]);

  const stopSpeaking = useCallback(() => {
    try {
      window.speechSynthesis.cancel();
    } catch (error) {
      console.error('Error stopping speech synthesis:', error);
    } finally {
      setIsSpeaking(false);
    }
  }, []);

  const handleEndCall = () => {
    contextEndCall();
    stopRecognition();
    stopListening();
    stopSpeaking();
    navigate('/contacts');
  };

  // Handle confirm translation (for deaf users)
  const handleConfirmTranslation = async () => {
    const entry = confirmTranslation(isEditing ? editableText : previewText ?? undefined);
    if (entry) {
      const textToConfirm = isEditing ? editableText : entry.text;
      setConfirmedText(textToConfirm);
      setLastUtterance(textToConfirm);
      setIsEditing(false);

      // Send translation to the other user via data channel
      sendTranslation(textToConfirm, true);

      // Speak the text
      if (callState === 'connected') {
        setIsSpeaking(true);
        try {
          const sentences = textToConfirm.split(/(?<=[.!?])\s+/);

          for (const sentence of sentences) {
            const trimmed = sentence.trim();
            if (!trimmed) continue;

            await speak(trimmed, {
              voiceName: user?.voiceSettings?.voiceName,
              rate: user?.voiceSettings?.rate ?? 1.0,
              pitch: user?.voiceSettings?.pitch ?? 1.0,
            });

            if (sentence !== sentences[sentences.length - 1]) {
              await new Promise((resolve) => setTimeout(resolve, 300));
            }
          }
        } catch (error) {
          console.error('Error in speech synthesis:', error);
        } finally {
          setIsSpeaking(false);
        }
      }
    }
  };

  const handleRejectTranslation = () => {
    setIsEditing(false);
    rejectTranslation();
  };

  const handleStartListening = useCallback(() => {
    window.speechSynthesis.cancel();
    startListening();
  }, [startListening]);

  // Determine call status display
  const callStatus = useMemo(() => {
    switch (callState) {
      case 'calling':
        return 'Calling...';
      case 'incoming':
        return 'Incoming call';
      case 'connected':
        return 'Live call in progress';
      case 'ending':
        return 'Ending call...';
      default:
        return 'Not in call';
    }
  }, [callState]);

  const callHeader = useMemo(() => {
    if (!user?.isDeaf) {
      return 'Listening via microphone';
    }
    return 'Capturing sign language via camera';
  }, [user?.isDeaf]);

  const renderCaptureCard = () => {
    if (!user?.isDeaf) return null;
    
    return (
      <div className="card-surface overflow-hidden">
        <div className="flex items-center justify-between p-4">
          <h3 className="text-lg font-semibold text-white">Your Camera</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleCamera}
              className={`rounded-full p-2 transition ${isCameraEnabled ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-400'}`}
              title={isCameraEnabled ? 'Camera on' : 'Camera off'}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isCameraEnabled ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                )}
              </svg>
            </button>
          </div>
        </div>
        <div className="relative aspect-video bg-slate-950">
          {localStream && isCameraEnabled ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-slate-500">Camera is off</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPrimaryPanel = () => {
    if (user?.isDeaf) {
      return (
        <div className="card-surface space-y-4 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Translation preview</h3>
            <span className="text-xs text-slate-500">Confirm before sending</span>
          </div>
          <div className="h-40 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            {isEditing ? (
              <textarea
                value={editableText}
                onChange={(e) => setEditableText(e.target.value)}
                className="h-full w-full bg-transparent text-sm text-slate-300 outline-none resize-none"
                autoFocus
              />
            ) : (
              <div 
                ref={previewRef} 
                className="h-full text-sm text-slate-300 cursor-text"
                onClick={() => {
                  setEditableText(previewText || '');
                  setIsEditing(true);
                }}
              >
                {previewText || 'Waiting for next recognition...'}
              </div>
            )}
          </div>
          
          {/* Show received transcripts from the other user */}
          <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-slate-400">From {contact?.username || 'other communicator'}</p>
            </div>
            <div className="min-h-[3rem] max-h-32 overflow-y-auto">
              {transcriptMessages.length > 0 ? (
                <div className="space-y-2">
                  {transcriptMessages.slice(-3).map((msg, idx) => (
                    <div key={idx} className="text-sm text-slate-200 border-b border-slate-700 pb-2 last:border-0">
                      <p>{msg.text}</p>
                      <p className="text-xs text-slate-500">{formatTimestamp(msg.timestamp)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">No speech detected yet...</p>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleConfirmTranslation}
              disabled={!previewText}
              className="flex-1 rounded-2xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-slate-700"
            >
              Confirm & play audio
            </button>
            <button
              onClick={handleRejectTranslation}
              disabled={!previewText}
              className="rounded-2xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-amber-500 hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-600"
            >
              {isEditing ? 'Cancel' : 'Reject'}
            </button>
          </div>
          {lastUtterance && <p className="text-xs text-slate-500">{lastUtterance}</p>}
        </div>
      );
    }

    return (
      <div className="card-surface space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Your Speech</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMic}
              className={`rounded-full p-2 transition ${isMicEnabled ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-400'}`}
              title={isMicEnabled ? 'Mic on' : 'Mic off'}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isMicEnabled ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                )}
              </svg>
            </button>
            <span className="text-xs text-slate-500">{isMicEnabled ? 'Mic on' : 'Mic muted'}</span>
          </div>
        </div>
        {transcript && (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-200">
            <p className="text-xs uppercase tracking-wide text-amber-400">Speaking now</p>
            <p className="mt-1">{transcript}</p>
            {isTyping && <p className="text-xs text-slate-500">Processing...</p>}
          </div>
        )}
        <div
          ref={transcriptRef}
          className="h-40 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300 whitespace-pre-line"
        >
          {transcriptHistory && transcriptHistory.length > 0 ? (
            transcriptHistory.map((entry) => (
              <div key={entry.id} className="mb-2">
                <p className="text-slate-200">{entry.text}</p>
                <p className="text-xs text-slate-500">{formatTimestamp(entry.timestamp)}</p>
              </div>
            ))
          ) : (
            <p className="text-slate-400 italic">Your speech will appear here...</p>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleStartListening}
            disabled={!isMicEnabled}
            className="flex-1 rounded-2xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            Resume listening
          </button>
          <button
            onClick={clearTranscript}
            className="rounded-2xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-amber-500 hover:bg-amber-500/10"
          >
            Clear
          </button>
        </div>

        {/* Show received translations from sign language user */}
        <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-slate-400">From {contact?.username || 'sign language user'}</p>
          </div>
          <div className="min-h-[3rem] max-h-32 overflow-y-auto">
            {translationMessages.length > 0 ? (
              <div className="space-y-2">
                {translationMessages.slice(-3).map((msg, idx) => (
                  <div key={idx} className="text-sm text-slate-200 border-b border-slate-700 pb-2 last:border-0">
                    <p>{msg.text}</p>
                    <p className="text-xs text-slate-500">{formatTimestamp(msg.timestamp)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">Waiting for sign language translation...</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderHistoryCard = () => (
    <div className="card-surface space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">
          {user?.isDeaf ? 'Confirmed translations' : 'Live caption history'}
        </h3>
        <button
          onClick={() => {
            if (user?.isDeaf) {
              clearHistory();
            } else {
              clearTranscript();
            }
          }}
          className="text-xs text-slate-400 transition hover:text-slate-200"
        >
          Clear history
        </button>
      </div>
      <div className="space-y-3">
        {user?.isDeaf ? (
          history.length === 0 ? (
            <p className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-500">
              Confirm translations to generate audio output for the hearing participant.
            </p>
          ) : (
            history.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-sm text-slate-200">{entry.text}</p>
                <p className="text-xs text-slate-500">{formatTimestamp(entry.timestamp)}</p>
              </div>
            ))
          )
        ) : (
          (transcriptHistory.length === 0 ? (
            <p className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-500">
              Press "Resume listening" to start the simulated transcript with audio. Finished sentences will appear here.
            </p>
          ) : (
            transcriptHistory.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-sm text-slate-200">{entry.text}</p>
                <p className="text-xs text-slate-500">{formatTimestamp(entry.timestamp)}</p>
              </div>
            ))
          ))
        )}
      </div>
    </div>
  );

  // Calculate call duration
  const callDuration = useMemo(() => {
    if (!currentCall?.startTime) return null;
    const duration = Math.floor((Date.now() - currentCall.startTime) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [currentCall]);

  const renderInsightsCard = () => (
    <div className="card-surface space-y-4 p-6">
      <h3 className="text-lg font-semibold text-white">Call insights</h3>
      <ul className="space-y-3 text-sm text-slate-400">
        {callDuration && (
          <li className="rounded-2xl bg-slate-950/60 p-4">
            <span className="font-semibold text-slate-200">Call duration:</span> {callDuration}
          </li>
        )}
        <li className="rounded-2xl bg-slate-950/60 p-4">
          <span className="font-semibold text-slate-200">Voice status:</span> {isSpeaking ? 'Audio playing' : 'Idle'}
        </li>
        <li className="rounded-2xl bg-slate-950/60 p-4">
          <span className="font-semibold text-slate-200">Current preview:</span> {previewText ?? 'None'}
        </li>
        <li className="rounded-2xl bg-slate-950/60 p-4">
          <span className="font-semibold text-slate-200">Last confirmed:</span> {confirmedText ?? 'No confirmations yet'}
        </li>
      </ul>
    </div>
  );

  const featurePanels = [
    { id: 'capture', element: renderCaptureCard() },
    { id: 'primary', element: renderPrimaryPanel() },
    { id: 'history', element: renderHistoryCard() },
    { id: 'insights', element: renderInsightsCard() },
  ];

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-glow">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-wide text-slate-400">Call session</p>
            <h2 className="text-3xl font-semibold text-white">{callHeader}</h2>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="rounded-full bg-brand-600/20 px-4 py-2 text-brand-200">{callStatus}</span>
            {user?.isDeaf ? (
              <span className="rounded-full bg-slate-800 px-4 py-2 text-slate-300">Sign language mode</span>
            ) : (
              <span className="rounded-full bg-slate-800 px-4 py-2 text-slate-300">Voice mode</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span className="rounded-full bg-slate-900 px-3 py-1 text-slate-300">You: {user?.username ?? 'Unknown'}</span>
          {contact && <span className="rounded-full bg-slate-900 px-3 py-1 text-slate-300">Connected with @{contact.username}</span>}
          <button
            onClick={handleEndCall}
            disabled={callState === 'idle'}
            className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            End call
          </button>
        </div>
      </header>

      <section className="space-y-6 lg:grid lg:grid-cols-2 lg:gap-8 lg:space-y-0">
        {featurePanels.map((panel) => (
          <div key={panel.id}>{panel.element}</div>
        ))}
      </section>
    </div>
  );
};

export default CallScreen;

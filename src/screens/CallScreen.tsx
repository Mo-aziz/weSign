import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useSignRecognitionService } from '../services/useSignRecognitionService';
import { speak } from '../services/localTTS';
import { useSpeechToTextService } from '../services/useSpeechToTextService';

const formatTimestamp = (timestamp: number) => new Date(timestamp).toLocaleTimeString();

const CallScreen = () => {
  const { state } = useLocation();
  const { user } = useAppContext();
  const contact = (state as { contact?: { username: string } })?.contact;

  // Initialize speech synthesis
  useEffect(() => {
    const initSpeechSynthesis = () => {
      // This will load the voices
      window.speechSynthesis.getVoices();
    };

    // Some browsers need this event to be triggered to load voices
    window.speechSynthesis.onvoiceschanged = initSpeechSynthesis;
    initSpeechSynthesis();

    return () => {
      // Clean up
      window.speechSynthesis.onvoiceschanged = null;
      window.speechSynthesis.cancel();
    };
  }, []);

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
  const {
    startListening,
    stopListening,
    clearTranscript,
    transcript,
    history: transcriptHistory,
    isTyping
  } = useSpeechToTextService({
    disableTTS: user?.isDeaf ?? false, // Disable TTS only for sign language users (they can't hear), enable for normal communicators
    voiceSettings: user?.voiceSettings ? {
      voiceName: user.voiceSettings.voiceName,
      rate: user.voiceSettings.rate ?? 1.0,
      pitch: user.voiceSettings.pitch ?? 1.0,
    } : undefined
  });

  const [isCallActive, setIsCallActive] = useState(true);
  const [confirmedText, setConfirmedText] = useState<string | null>(null);
  const [editableText, setEditableText] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const previewRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (previewText && previewRef.current) {
      previewRef.current.scrollTo({ top: previewRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [previewText]);

  // Auto-scroll transcript when it updates
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [transcript, isTyping, transcriptHistory]);

  useEffect(() => {
    if (user?.isDeaf) {
      startRecognition();
      // Also start listening so sign language user can see what the other communicator is saying
      startListening();
    }

    return () => {
      stopRecognition();
      stopListening();
      stopSpeaking();
    };
  }, [startRecognition, stopRecognition, startListening, stopListening, user?.isDeaf]);

  const stopSpeaking = useCallback(() => {
    try {
      // Stop any ongoing speech
      window.speechSynthesis.cancel();
      console.log('Speech synthesis stopped');
    } catch (error) {
      console.error('Error stopping speech synthesis:', error);
    } finally {
      setIsSpeaking(false);
    }
  }, []);

  const callHeader = useMemo(() => {
    if (!user?.isDeaf) {
      return 'Listening via microphone';
    }
    return 'Capturing sign language via camera';
  }, [user?.isDeaf]);

  // Handle start listening with proper speech synthesis cleanup
  const handleStartListening = useCallback(() => {
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    // Start listening
    startListening();
  }, [startListening]);

  const endCall = () => {
    setIsCallActive(false);
    stopRecognition();
    stopListening();
    stopSpeaking();
    setConfirmedText(null);
  };

  const handleConfirmTranslation = async () => {
    const entry = confirmTranslation(isEditing ? editableText : previewText ?? undefined);
    if (entry) {
      const textToConfirm = isEditing ? editableText : entry.text;
      setConfirmedText(textToConfirm);
      setLastUtterance(textToConfirm);
      setIsEditing(false);

      // Speak the confirmed text immediately using the user's selected voice settings
      if (!isCallActive) return;

      setIsSpeaking(true);
      try {
        // Split text into sentences for more natural speech
        const sentences = textToConfirm.split(/(?<=[.!?])\s+/);

        for (const sentence of sentences) {
          const trimmed = sentence.trim();
          if (!trimmed) continue;

          await speak(trimmed, {
            voiceName: user?.voiceSettings?.voiceName,
            rate: user?.voiceSettings?.rate ?? 1.0,
            pitch: user?.voiceSettings?.pitch ?? 1.0,
          });

          // Small pause between sentences
          if (sentence !== sentences[sentences.length - 1]) {
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
        }
      } catch (error) {
        console.error('Error in speech synthesis for confirmed translation:', error);
      } finally {
        setIsSpeaking(false);
      }
    }
  };

  const handleRejectTranslation = () => {
    setIsEditing(false);
    rejectTranslation();
  };

  const activeStatus = isCallActive ? 'Live call in progress' : 'Call ended';

  const renderCaptureCard = () => (
    <div className="card-surface h-80 overflow-hidden p-6">
      <div className="flex h-full flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Live capture</h3>
          <span className="text-xs text-slate-500">Camera active</span>
        </div>
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/60">
          <div className="text-center text-sm text-slate-500">
            {user?.isDeaf
              ? 'Webcam feed simulated here. Position yourself so gestures are clearly visible.'
              : 'Microphone capture running. Speak clearly towards your device.'}
          </div>
        </div>
      </div>
    </div>
  );

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
          
          {/* Small area showing the other communicator's speech */}
          <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-slate-400">From {contact?.username || 'other communicator'}</p>
            </div>
            <div className="min-h-[3rem] max-h-24 overflow-y-auto">
              {transcript ? (
                <p className="text-xs text-slate-300">{transcript}</p>
              ) : transcriptHistory.length > 0 ? (
                <p className="text-xs text-slate-300">{transcriptHistory[0].text}</p>
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
          <h3 className="text-lg font-semibold text-white">Live transcript</h3>
          <span className="text-xs text-slate-500">Shared in real time</span>
        </div>
        {transcript && (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-200">
            <p className="text-xs uppercase tracking-wide text-amber-400">Speaking now</p>
            <p className="mt-1">{transcript}</p>
            {isTyping && <p className="text-xs text-slate-500">Playing audio...</p>}
          </div>
        )}
        <div
          ref={transcriptRef}
          className="h-52 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300 whitespace-pre-line"
        >
          {transcriptHistory && transcriptHistory.length > 0 ? (
            transcriptHistory.map((entry) => (
              <div key={entry.id} className="mb-2">
                <p className="text-slate-200">{entry.text}</p>
                <p className="text-xs text-slate-500">{formatTimestamp(entry.timestamp)}</p>
              </div>
            ))
          ) : (
            <p className="text-slate-400 italic">Listening to the sign language communicator....</p>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleStartListening}
            className="flex-1 rounded-2xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-500"
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

  const renderInsightsCard = () => (
    <div className="card-surface space-y-4 p-6">
      <h3 className="text-lg font-semibold text-white">Call insights</h3>
      <ul className="space-y-3 text-sm text-slate-400">
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
            <span className="rounded-full bg-brand-600/20 px-4 py-2 text-brand-200">{activeStatus}</span>
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
            onClick={endCall}
            disabled={!isCallActive}
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

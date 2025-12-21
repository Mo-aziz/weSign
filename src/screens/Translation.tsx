import { useEffect, useMemo, useState, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { useSignRecognitionService } from '../services/useSignRecognitionService';
import { useTextToSpeechService } from '../services/useTextToSpeechService';
import { startSpeechRecognition, stopSpeechRecognition } from '../services/localSpeechRecognition';

type CaptionEntry = {
  id: string;
  text: string;
  timestamp: number;
};

const Translation = () => {
  const { user } = useAppContext();
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [autoListen, setAutoListen] = useState(true);

  // cadence so preview updates roughly every 5 seconds
  const signService = useSignRecognitionService({ cadenceMs: 5000 });
  const ttsService = useTextToSpeechService();

  const [signEditable, setSignEditable] = useState('');
  const [isSignEditing, setIsSignEditing] = useState(false);

  const [speechEditable, setSpeechEditable] = useState('');
  const [isSpeechEditing, setIsSpeechEditing] = useState(false);
  const [captionHistory, setCaptionHistory] = useState<CaptionEntry[]>([]);
  const [isMicListening, setIsMicListening] = useState(false);
  const recognitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFinalTranscriptRef = useRef<string>('');

  const SPEECH_SAMPLE_SENTENCES = useMemo(
    () => [
      'The interpreter will join the meeting shortly.',
      'Please look at the camera while you are signing.',
      'We are testing the captioning workflow.',
      'Can you confirm that the audio is clear?',
      'This is a sample sentence for practice.',
      'Thank you for using the translation studio.',
    ],
    []
  );

  const randomSpeechSample = () =>
    SPEECH_SAMPLE_SENTENCES[Math.floor(Math.random() * SPEECH_SAMPLE_SENTENCES.length)];

  // keep sign editable text in sync with preview when not actively editing
  useEffect(() => {
    if (signService.previewText && !isSignEditing) {
      setSignEditable(signService.previewText);
    }
  }, [signService.previewText, isSignEditing]);

  // auto-speak mode: automatically confirm + speak any new sign preview
  useEffect(() => {
    if (!autoSpeak || !signService.previewText) return;
    const text = signService.previewText;
    const entry = signService.confirmTranslation(text);
    if (entry) {
      // Use the user's voice settings when speaking
      ttsService.speak(text, {
        voiceSettings: {
          voiceName: user?.voiceSettings?.voiceName,
          rate: user?.voiceSettings?.rate,
          pitch: user?.voiceSettings?.pitch,
        }
      });
      setCaptionHistory((prev) => [
        { id: entry.id, text, timestamp: entry.timestamp },
        ...prev,
      ]);
    }
  }, [autoSpeak, signService.previewText, signService, ttsService, user?.voiceSettings]);

  // simulate speech-side test sentences every ~6 seconds
  useEffect(() => {
    if (!autoListen || isMicListening) return;
    const interval = setInterval(() => {
      if (isSpeechEditing) return;
      const sample = randomSpeechSample();
      setSpeechEditable(sample);
      setCaptionHistory((prev) => [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          text: sample,
          timestamp: Date.now(),
        },
        ...prev,
      ]);
    }, 6000);
    return () => clearInterval(interval);
  }, [autoListen, isSpeechEditing, isMicListening, randomSpeechSample]);

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      stopSpeechRecognition();
      if (recognitionTimeoutRef.current) {
        clearTimeout(recognitionTimeoutRef.current);
      }
    };
  }, []);

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
                    setCaptionHistory((prev) => [
                      {
                        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                        text: sentence.trim(),
                        timestamp: Date.now(),
                      },
                      ...prev,
                    ]);
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
        lastFinalTranscriptRef.current = '';
      }
    }
  };

  return (
    <div className="space-y-8">
      <header className="rounded-3xl border border-slate-200 bg-white/70 p-6 shadow-lg dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-glow">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white lg:text-3xl">Translation studio</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
              Simulate both sign-to-voice and speech-to-text workflows. You can use this space to communicate face to face with a signer.
            </p>
          </div>
          <div className="flex min-w-[220px] flex-col gap-2 rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-200">Signed in as {user?.username ?? 'guest'}</span>
            <span>Preference: {user?.isDeaf ? 'Sign language lead' : 'Spoken language lead'}</span>
          </div>
        </div>
      </header>

      <section className="space-y-6 lg:grid lg:grid-cols-2 lg:gap-8 lg:space-y-0">
        <div className="space-y-6">
          <div className="card-surface space-y-4 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Sign → Text → Voice</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Practice signing and preview generated captions before broadcasting.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <label className="flex items-center gap-2">
                  <span>Auto speak</span>
                  <button
                    onClick={() => setAutoSpeak((prev) => !prev)}
                    className={`relative h-7 w-12 rounded-full transition-colors duration-300 ${
                      autoSpeak ? 'bg-brand-600' : 'bg-slate-400'
                    }`}
                  >
                    <span
                      className={`absolute left-1 top-1 h-5 w-4 rounded-full bg-white transition-transform duration-300 ${
                        autoSpeak ? 'translate-x-3' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </label>
                <button
                  onClick={signService.startRecognition}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-brand-500 hover:text-brand-500 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-400"
                >
                  Start
                </button>
                <button
                  onClick={signService.stopRecognition}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-rose-500 hover:text-rose-500 dark:border-slate-700 dark:text-slate-300"
                >
                  Stop
                </button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Live preview</p>
                <div className="mt-2 h-40 overflow-hidden rounded-2xl border border-slate-200 bg-white/80 p-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-200">
                  <textarea
                    className="h-full w-full resize-none bg-transparent p-2 text-sm text-slate-700 outline-none dark:text-slate-200"
                    value={signEditable}
                    onChange={(e) => {
                      setIsSignEditing(true);
                      setSignEditable(e.target.value);
                    }}
                    placeholder="Awaiting recognition..."
                  />
                </div>
                <div className="mt-3 flex gap-2 text-xs">
                  <button
                    onClick={() => {
                      const text = signEditable || signService.previewText || '';
                      const entry = signService.confirmTranslation(text);
                      if (entry) {
                        setAutoSpeak(false);
                        setIsSignEditing(false);
                        ttsService.speak(entry.text);
                        setCaptionHistory((prev) => [
                          {
                            id: entry.id,
                            text: entry.text,
                            timestamp: entry.timestamp,
                          },
                          ...prev,
                        ]);
                      }
                    }}
                    disabled={!signEditable && !signService.previewText}
                    className="flex-1 rounded-2xl bg-brand-600 px-3 py-2 font-semibold text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-slate-400 dark:disabled:bg-slate-700"
                  >
                    Confirm & speak
                  </button>
                  <button
                    onClick={() => {
                      setSignEditable('');
                      setIsSignEditing(false);
                    }}
                    disabled={!signEditable && !signService.previewText}
                    className="rounded-2xl border border-slate-300 px-3 py-2 font-semibold text-slate-600 transition hover:border-amber-500 hover:text-amber-500 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 dark:border-slate-700 dark:text-slate-300"
                  >
                    Clear
                  </button>
                </div>
                {ttsService.lastUtterance && (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{ttsService.lastUtterance}</p>
                )}
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">History</p>
                <div className="mt-2 space-y-2">
                  {signService.history.length === 0 && (
                    <p className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-4 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-400">
                      Confirm translations to build a reference list.
                    </p>
                  )}
                  {signService.history.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-2xl border border-slate-200 bg-white/70 p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200"
                    >
                      <p>{entry.text}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="card-surface space-y-4 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Voice output queue</h2>
              <button
                onClick={ttsService.stop}
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-rose-500 transition hover:border-rose-500 dark:border-slate-700 dark:text-rose-300"
              >
                Clear queue
              </button>
            </div>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              {ttsService.queue.length === 0 && <li>No items awaiting playback.</li>}
              {ttsService.queue.map((item) => (
                <li
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-950/60"
                >
                  <p>{item.text}</p>
                  <p className="text-xs text-slate-400">
                    Queued {new Date(item.enqueuedAt).toLocaleTimeString()}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="min-w-[calc(100vw-3rem)] space-y-6 lg:min-w-0">
          <div className="card-surface space-y-4 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Speech → Real-time captions</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Simulate live captions for the signing participant.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <label className="flex items-center gap-2">
                  <span>Auto listen</span>
                  <button
                    onClick={() => setAutoListen((prev) => !prev)}
                    className={`relative h-7 w-12 rounded-full transition-colors duration-300 ${
                      autoListen ? 'bg-brand-600' : 'bg-slate-400'
                    }`}
                  >
                    <span
                      className={`absolute left-1 top-1 h-5 w-4 rounded-full bg-white transition-transform duration-300 ${
                        autoListen ? 'translate-x-3' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </label>
                <button
                  onClick={handleMicToggle}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    isMicListening
                      ? 'border-rose-500 bg-rose-500 text-white hover:bg-rose-600 dark:border-rose-400 dark:bg-rose-600'
                      : 'border-slate-300 text-slate-600 hover:border-brand-500 hover:text-brand-500 dark:border-slate-700 dark:text-slate-300'
                  }`}
                >
                  {isMicListening ? 'Stop mic' : 'Start mic'}
                </button>
                <button
                  onClick={() => {
                    const sample = randomSpeechSample();
                    setSpeechEditable(sample);
                    setIsSpeechEditing(false);
                    setCaptionHistory((prev) => [
                      {
                        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                        text: sample,
                        timestamp: Date.now(),
                      },
                      ...prev,
                    ]);
                  }}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-brand-500 hover:text-brand-500 dark:border-slate-700 dark:text-slate-300"
                >
                  Add sample now
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-200 space-y-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Editable caption text
                </p>
                <textarea
                  className="mt-2 h-24 w-full resize-none rounded-2xl border border-slate-200 bg-white/70 p-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-200"
                  value={speechEditable}
                  onChange={(e) => {
                    setIsSpeechEditing(true);
                    setSpeechEditable(e.target.value);
                  }}
                  placeholder={isMicListening ? "Listening... Speak into your microphone." : "Sample sentences will appear here every few seconds. Or click 'Start mic' to speak."}
                />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Caption history
                </p>
                <div className="mt-2 max-h-40 space-y-2 overflow-y-auto">
                  {captionHistory.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-400">
                      Confirm text to see it here with timestamps.
                    </p>
                  ) : (
                    captionHistory.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-2xl border border-slate-200 bg-white/70 p-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200"
                      >
                        <p>{entry.text}</p>
                        <p className="text-xs text-slate-400">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2 text-xs">
              <button
                onClick={() => {
                  setCaptionHistory([]);
                }}
                className="rounded-2xl border border-slate-300 px-3 py-2 font-semibold text-slate-600 transition hover:border-amber-500 hover:text-amber-500 dark:border-slate-700 dark:text-slate-300"
              >
                Clear captions
              </button>
            </div>
          </div>

          <div className="card-surface space-y-4 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Workflow tips</h3>
            <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <li className="rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                Use the auto-speak toggle to experience fully hands-free signing output.
              </li>
              <li className="rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                Manual confirmation lets you proofread before speech synthesis.
              </li>
              <li className="rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                Export transcripts by copying text blocks into notes for later review.
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Translation;

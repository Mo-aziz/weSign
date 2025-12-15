import { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { useSignRecognitionService } from '../services/useSignRecognitionService';
import { useSpeechToTextService } from '../services/useSpeechToTextService';
import { useTextToSpeechService } from '../services/useTextToSpeechService';
import { speak } from '../services/localTTS';

const Translation = () => {
  const { user } = useAppContext();
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [autoListen, setAutoListen] = useState(true);

  const signService = useSignRecognitionService({ cadenceMs: 6000 });
  const speechService = useSpeechToTextService({ cadenceMs: 4500 });
  const ttsService = useTextToSpeechService();

  useEffect(() => {
    if (autoSpeak && signService.previewText) {
      const entry = signService.confirmTranslation();
      if (entry) {
        // Use the local TTS service
        speak(entry.text).catch(console.error);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSpeak, signService.previewText]);

  useEffect(() => {
    if (autoListen) {
      speechService.startListening();
      return () => {
        speechService.stopListening();
      };
    }
    return undefined;
  }, [autoListen, speechService]);

  const transcriptSentences = useMemo(() => {
    if (!speechService.transcript) return [] as string[];
    return speechService.transcript.split('\n').filter(Boolean).slice(-6);
  }, [speechService.transcript]);

  return (
    <div className="space-y-8">
      <header className="rounded-3xl border border-slate-200 bg-white/70 p-6 shadow-lg dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-glow">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-slate-500 dark:text-slate-400">Translation studio</p>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white lg:text-3xl">Experiment with multimodal translation</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
              Simulate both sign-to-voice and speech-to-text workflows. Use this space to rehearse before joining a real call.
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
                <p className="text-sm text-slate-500 dark:text-slate-400">Practice signing and preview generated captions before broadcasting.</p>
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
                      className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white transition-transform duration-300 ${
                        autoSpeak ? 'translate-x-5' : 'translate-x-0'
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
                <div className="mt-2 h-40 overflow-y-auto rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-200">
                  {signService.previewText ?? 'Awaiting recognition...'}
                </div>
                <div className="mt-3 flex gap-2 text-xs">
                  <button
                    onClick={async () => {
                      const entry = signService.confirmTranslation();
                      if (entry) {
                        setAutoSpeak(false);
                        try {
                          await speak(entry.text);
                        } catch (error) {
                          console.error('Error speaking text:', error);
                        }
                      }
                    }}
                    disabled={!signService.previewText}
                    className="flex-1 rounded-2xl bg-brand-600 px-3 py-2 font-semibold text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-slate-400 dark:disabled:bg-slate-700"
                  >
                    Confirm & speak
                  </button>
                  <button
                    onClick={signService.rejectTranslation}
                    disabled={!signService.previewText}
                    className="rounded-2xl border border-slate-300 px-3 py-2 font-semibold text-slate-600 transition hover:border-amber-500 hover:text-amber-500 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 dark:border-slate-700 dark:text-slate-300"
                  >
                    Reject
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
                    <div key={entry.id} className="rounded-2xl border border-slate-200 bg-white/70 p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200">
                      <p>{entry.text}</p>
                      <p className="text-xs text-slate-400">{new Date(entry.timestamp).toLocaleTimeString()}</p>
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
                <li key={item.id} className="rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                  <p>{item.text}</p>
                  <p className="text-xs text-slate-400">Queued {new Date(item.enqueuedAt).toLocaleTimeString()}</p>
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
                <p className="text-sm text-slate-500 dark:text-slate-400">Simulate live captions for the signing participant.</p>
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
                      className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white transition-transform duration-300 ${
                        autoListen ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </label>
                <button
                  onClick={speechService.startListening}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-brand-500 hover:text-brand-500 dark:border-slate-700 dark:text-slate-300"
                >
                  Start
                </button>
                <button
                  onClick={speechService.stopListening}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-rose-500 hover:text-rose-500 dark:border-slate-700 dark:text-slate-300"
                >
                  Stop
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-200">
              {transcriptSentences.length === 0 ? (
                <p>Listening for speech input...</p>
              ) : (
                transcriptSentences.map((line, index) => (
                  <p key={`${line}-${index}`} className="mb-2">
                    {line}
                  </p>
                ))
              )}
            </div>
            <div className="flex gap-2 text-xs">
              <button
                onClick={speechService.clearTranscript}
                className="rounded-2xl border border-slate-300 px-3 py-2 font-semibold text-slate-600 transition hover:border-amber-500 hover:text-amber-500 dark:border-slate-700 dark:text-slate-300"
              >
                Clear transcript
              </button>
              <button
                onClick={() => speechService.startListening()}
                className="rounded-2xl bg-brand-600 px-3 py-2 font-semibold text-white transition hover:bg-brand-500"
              >
                Add sample
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

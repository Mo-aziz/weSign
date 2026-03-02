import { useEffect, useMemo, useState } from 'react';
import { speak as speakTTS } from '../services/localTTS';

// Volume icon SVG component
const VolumeIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
  </svg>
);

type VoiceSettingsProps = {
  onVoiceChange: (voice: SpeechSynthesisVoice) => void;
  onRateChange: (rate: number) => void;
  onPitchChange: (pitch: number) => void;
  initialVoice?: string;
  initialRate?: number;
  initialPitch?: number;
};

const VoiceSettings = ({ 
  onVoiceChange, 
  onRateChange, 
  onPitchChange,
  initialVoice = '',
  initialRate = 1.0,
  initialPitch = 1.0
}: VoiceSettingsProps) => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>(initialVoice);
  const [rate, setRate] = useState<number>(initialRate);
  const [pitch, setPitch] = useState<number>(initialPitch);

  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length > 0) {
        setVoices(availableVoices);
        if (!selectedVoice) {
          const defaultVoice = availableVoices.find(v => v.default) || availableVoices[0];
          if (defaultVoice) {
            setSelectedVoice(defaultVoice.name);
            onVoiceChange(defaultVoice);
          }
        }
      }
    };

    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [onVoiceChange, selectedVoice]);

  const handleVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const voiceName = e.target.value;
    const voice = voices.find(v => v.name === voiceName);
    if (voice) {
      setSelectedVoice(voiceName);
      onVoiceChange(voice);
    }
  };

  const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newRate = parseFloat(e.target.value);
    setRate(newRate);
    onRateChange(newRate);
  };

  const handlePitchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPitch = parseFloat(e.target.value);
    setPitch(newPitch);
    onPitchChange(newPitch);
  };

  const testVoice = async () => {
    const testText = 'This is a test of the voice settings';
    const testSettings = {
      voiceName: selectedVoice,
      rate: rate,
      pitch: pitch,
    } as const;
    
    try {
      await speakTTS(testText, testSettings);
    } catch (error) {
      console.error('Error testing voice:', error);
    }
  };

  // Filter out duplicate-sounding voices (e.g., keep only one of Hazel/Susan)
  const filteredVoices = useMemo(() => {
    const hasHazel = voices.some(v => v.name.toLowerCase().includes('hazel'));
    const hasSusan = voices.some(v => v.name.toLowerCase().includes('susan'));

    // If both Hazel and Susan exist, remove Hazel to avoid two very similar voices
    if (hasHazel && hasSusan) {
      return voices.filter(v => !v.name.toLowerCase().includes('hazel'));
    }

    return voices;
  }, [voices]);

  // Group voices by language
  const voicesByLang = filteredVoices.reduce<Record<string, SpeechSynthesisVoice[]>>((acc, voice) => {
    if (!acc[voice.lang]) {
      acc[voice.lang] = [];
    }
    acc[voice.lang].push(voice);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white">
          <VolumeIcon className="inline w-5 h-5 mr-2" />
          Voice Settings
        </h3>
        <p className="text-sm text-slate-400">Customize text-to-speech voice and settings</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Voice</label>
          <div className="relative">
            <VolumeIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <select
              value={selectedVoice}
              onChange={handleVoiceChange}
              className="input-field pl-10 w-full"
            >
              {Object.entries(voicesByLang).map(([lang, langVoices]) => (
                <optgroup key={lang} label={new Intl.DisplayNames(['en'], { type: 'language' }).of(lang) || lang}>
                  {langVoices.map(voice => (
                    <option key={voice.name} value={voice.name}>
                      {voice.name} {voice.default && '• Default'}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Speed: {rate.toFixed(1)}x
            </label>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={rate}
              onChange={handleRateChange}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Pitch: {pitch.toFixed(1)}x
            </label>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={pitch}
              onChange={handlePitchChange}
              className="w-full"
            />
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={testVoice}
            className="text-sm text-brand-400 hover:text-brand-300 transition-colors"
          >
            Test Voice
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceSettings;

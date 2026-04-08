import { useEffect, useMemo, useState } from 'react';
import { speak as speakTTS } from '../services/localTTS';

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

  const filteredVoices = useMemo(() => {
    const hasHazel = voices.some(v => v.name.toLowerCase().includes('hazel'));
    const hasSusan = voices.some(v => v.name.toLowerCase().includes('susan'));

    // If both Hazel and Susan exist, remove Hazel to avoid two very similar voices
    if (hasHazel && hasSusan) {
      return voices.filter(v => !v.name.toLowerCase().includes('hazel'));
    }

    return voices;
  }, [voices]);

  const VolumeIcon = () => (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
    </svg>
  );

  return (
    <div className="space-y-6">
      {/* Voice Selection Card */}
      <div className="card-surface space-y-4 p-6">
        <div className="flex items-center justify-between">
          <label className="text-lg font-semibold text-white">Output Voice</label>
          <VolumeIcon />
        </div>
        <div className="relative">
          <select
            value={selectedVoice}
            onChange={(e) => {
              const voice = voices.find(v => v.name === e.target.value);
              if (voice) {
                setSelectedVoice(voice.name);
                onVoiceChange(voice);
              }
            }}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-white focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-slate-900"
          >
            {filteredVoices.map((voice) => (
              <option key={voice.name} value={voice.name}>
                {voice.name} ({voice.lang})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sliders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Rate Slider */}
        <div className="card-surface space-y-4 p-6">
          <div className="flex justify-between items-center">
            <label className="text-lg font-semibold text-white">Speaking Rate</label>
            <span className="text-sm font-bold text-brand-300 px-2 py-1 bg-brand-500/20 rounded-lg">{rate}x</span>
          </div>
          <input 
            type="range" 
            min="0.5" 
            max="2" 
            step="0.1" 
            value={rate}
            onChange={(e) => {
              const newRate = parseFloat(e.target.value);
              setRate(newRate);
              onRateChange(newRate);
            }}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-500"
          />
          <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-tighter">
            <span>Slower</span>
            <span>Normal</span>
            <span>Faster</span>
          </div>
        </div>

        {/* Pitch Slider */}
        <div className="card-surface space-y-4 p-6">
          <div className="flex justify-between items-center">
            <label className="text-lg font-semibold text-white">Voice Pitch</label>
            <span className="text-sm font-bold text-slate-300 px-2 py-1 bg-slate-600 rounded-lg">Default</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="100" 
            value={pitch * 50}
            onChange={(e) => {
              const newPitch = parseFloat(e.target.value) / 50;
              setPitch(newPitch);
              onPitchChange(newPitch);
            }}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-slate-500"
          />
          <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-tighter">
            <span>Deep</span>
            <span>High</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceSettings;

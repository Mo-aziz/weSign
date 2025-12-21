import { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import VoiceSettings from '../components/VoiceSettings';

const Settings = () => {
  const { user, darkMode, toggleDarkMode, updateUser, logout } = useAppContext();
  const [username, setUsername] = useState(user?.username ?? '');
  const [isDeaf, setIsDeaf] = useState(user?.isDeaf ?? true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [voiceSettings, setVoiceSettings] = useState({
    voiceName: user?.voiceSettings?.voiceName || '',
    rate: user?.voiceSettings?.rate ?? 1.0,
    pitch: user?.voiceSettings?.pitch ?? 1.0
  });

  const handleSaveProfile = () => {
    if (!username.trim()) {
      setStatusMessage('Username cannot be empty.');
      return;
    }

    updateUser({ 
      username: username.trim(), 
      isDeaf,
      voiceSettings: {
        voiceName: voiceSettings.voiceName,
        rate: voiceSettings.rate,
        pitch: voiceSettings.pitch
      }
    });
    setStatusMessage('Profile updated successfully.');
  };

  return (
    <div className="space-y-8">
      <header className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-glow">
        <p className="text-sm uppercase tracking-wide text-slate-400">Personalize</p>
        <h2 className="text-3xl font-semibold text-white">Settings & preferences</h2>
        <p className="mt-2 text-sm text-slate-400">
          Adjust your profile, communication preferences, and app theme.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card-surface space-y-6 p-6">
          <div>
            <h3 className="text-lg font-semibold text-white">Profile</h3>
            <p className="text-sm text-slate-400">Update how others identify you in the platform.</p>
          </div>
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-300" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              className="input-field"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-200">Primary communication style</p>
              <p className="text-xs text-slate-500">Toggle to indicate sign language preference.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsDeaf((prev) => !prev)}
              className={`relative h-8 w-14 rounded-full transition-colors duration-300 ${
                isDeaf ? 'bg-brand-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`absolute left-1 top-1 h-6 w-6 rounded-full bg-white transition-transform duration-300 ${
                  isDeaf ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <button
            onClick={handleSaveProfile}
            className="rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-500"
          >
            Save profile
          </button>
          {statusMessage && <p className="text-xs text-brand-200">{statusMessage}</p>}
        </div>

        <div className="card-surface space-y-6 p-6">
          <VoiceSettings 
            onVoiceChange={(voice) => setVoiceSettings(prev => ({ ...prev, voiceName: voice.name }))}
            onRateChange={(rate) => setVoiceSettings(prev => ({ ...prev, rate }))}
            onPitchChange={(pitch) => setVoiceSettings(prev => ({ ...prev, pitch }))}
            initialVoice={voiceSettings.voiceName}
            initialRate={voiceSettings.rate}
            initialPitch={voiceSettings.pitch}
          />
        </div>

        <div className="card-surface space-y-6 p-6">
          <div>
            <h3 className="text-lg font-semibold text-white">Experience</h3>
            <p className="text-sm text-slate-400">Fine-tune how the interface looks and feels.</p>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-200">Dark mode</p>
                <p className="text-xs text-slate-500">Keep the interface easy on the eyes.</p>
              </div>
              <button
                type="button"
                onClick={toggleDarkMode}
                className={`relative h-8 w-14 rounded-full transition-colors duration-300 ${
                  darkMode ? 'bg-brand-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`absolute left-1 top-1 h-6 w-6 rounded-full bg-white transition-transform duration-300 ${
                    darkMode ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-400">
              <p className="font-semibold text-slate-200">App preferences</p>
              <ul className="mt-3 space-y-2 text-xs">
                <li>• Enable real-time captions for all calls.</li>
                <li>• Remember my call layout preferences.</li>
                <li>• Notify me of new interpreters joining the platform.</li>
              </ul>
            </div>
          </div>
          <button
            onClick={logout}
            className="rounded-2xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:border-rose-500 hover:bg-rose-500/10 hover:text-rose-200"
          >
            Sign out of all sessions
          </button>
        </div>
      </section>
    </div>
  );
};

export default Settings;

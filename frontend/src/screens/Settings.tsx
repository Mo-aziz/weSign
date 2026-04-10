import { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import VoiceSettings from '../components/VoiceSettings';
import { speak } from '../services/localTTS';
import { updateUserTypeOnServer } from '../services/useCallService';

const Settings = () => {
  const { user, toggleDarkMode, updateUser, logout } = useAppContext();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [voiceSettings, setVoiceSettings] = useState({
    voiceName: user?.voiceSettings?.voiceName || '',
    rate: user?.voiceSettings?.rate ?? 1.0,
    pitch: user?.voiceSettings?.pitch ?? 1.0
  });

  // Debug: Log when user or voiceSettings change
  useEffect(() => {
    console.log('[Settings Page] user object:', user);
    console.log('[Settings Page] user.voiceSettings:', user?.voiceSettings);
    console.log('[Settings Page] voiceName:', user?.voiceSettings?.voiceName);
    console.log('[Settings Page] rate:', user?.voiceSettings?.rate);
    console.log('[Settings Page] pitch:', user?.voiceSettings?.pitch);
  }, [user?.voiceSettings?.voiceName, user?.voiceSettings?.rate, user?.voiceSettings?.pitch]);

  // Debug: Log when local state changes
  useEffect(() => {
    console.log('[Settings Page] Local voiceSettings state:', voiceSettings);
  }, [voiceSettings]);

  const handleSaveProfile = () => {
    if (!user?.username.trim()) {
      setStatusMessage('Username cannot be empty.');
      return;
    }

    console.log('[Settings] Saving voice settings:', {
      voiceName: voiceSettings.voiceName,
      rate: voiceSettings.rate,
      pitch: voiceSettings.pitch
    });

    updateUser({ 
      username: user.username, 
      isDeaf: user.isDeaf,
      voiceSettings: {
        voiceName: voiceSettings.voiceName,
        rate: voiceSettings.rate,
        pitch: voiceSettings.pitch
      }
    });
    setStatusMessage('Profile updated successfully.');
  };

  const handleTestVoice = () => {
    const testText = "This is a test of your voice settings. If you can hear this clearly, your settings are working properly.";
    console.log('[Settings] Testing voice with settings:', voiceSettings);
    speak(testText, {
      voiceName: voiceSettings.voiceName,
      rate: voiceSettings.rate,
      pitch: voiceSettings.pitch,
    }).catch(console.error);
    setStatusMessage('Testing voice...');
  };

  const handleToggleUserType = async () => {
    if (!user) return;

    const newIsDeaf = !user.isDeaf;
    const newTypeLabel = newIsDeaf ? 'sign language user' : 'hearing user';

    try {
      setStatusMessage('Updating user type on server...');
      console.log(`[Settings] Toggling user type from ${user.isDeaf} to ${newIsDeaf}`);
      
      // Update server first
      await updateUserTypeOnServer(newIsDeaf);
      console.log('[Settings] Server synchronized successfully');
      
      // Then update local state
      updateUser({
        username: user.username,
        isDeaf: newIsDeaf,
        voiceSettings: user.voiceSettings
      });
      
      setStatusMessage(`Successfully switched to ${newTypeLabel} mode.`);
    } catch (error) {
      console.error('[Settings] Failed to update user type:', error);
      setStatusMessage(`Failed to change user type: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 p-4">
      <div className="max-w-4xl mx-auto space-y-10">
        <header className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-glow">
          <div>
            <p className="text-sm uppercase tracking-wide text-slate-400">Settings</p>
            <h2 className="text-3xl font-semibold text-white">Customize your experience</h2>
          </div>
          <p className="text-sm text-slate-400">
            Update your profile, voice preferences, and appearance settings.
          </p>
        </header>

        <section className="card-surface space-y-6 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Profile Information</h3>
            <span className="text-xs text-slate-400">{user?.username ?? 'Guest'}</span>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                Username
              </label>
              <input
                type="text"
                value={user?.username ?? ''}
                readOnly
                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-white focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                User Type
              </label>
              <div className="flex items-center gap-4">
                <select
                  value={user?.isDeaf ? 'deaf' : 'hearing'}
                  disabled
                  className="flex-1 rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-white focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                >
                  <option value="deaf">Deaf / Hard of Hearing</option>
                  <option value="hearing">Hearing</option>
                </select>
                <button
                  onClick={handleToggleUserType}
                  className="rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-colors"
                >
                  Change Type
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="card-surface space-y-6 p-6">
          <h3 className="text-lg font-semibold text-white">Voice Settings</h3>
          <VoiceSettings
            onVoiceChange={(voice) => setVoiceSettings(prev => ({ ...prev, voiceName: voice.name }))}
            onRateChange={(rate) => setVoiceSettings(prev => ({ ...prev, rate }))}
            onPitchChange={(pitch) => setVoiceSettings(prev => ({ ...prev, pitch }))}
            initialVoice={voiceSettings.voiceName}
            initialRate={voiceSettings.rate}
            initialPitch={voiceSettings.pitch}
          />
          
          <div className="flex gap-4">
            <button
              onClick={handleTestVoice}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-3 font-semibold !text-white shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-colors"
            >
              Test Voice
            </button>
            <button
              onClick={handleSaveProfile}
              className="flex-1 rounded-lg bg-brand-600 px-4 py-3 font-semibold !text-white shadow-lg hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-colors"
            >
              Save Changes
            </button>
          </div>
        </section>

        <section className="card-surface space-y-6 p-6">
          <h3 className="text-lg font-semibold text-white">Appearance</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white">Dark Mode</p>
              <p className="text-sm text-slate-400">Toggle between light and dark themes</p>
            </div>
            <button
              onClick={toggleDarkMode}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-colors"
            >
              Toggle Theme
            </button>
          </div>
        </section>

        {statusMessage && (
          <div className={`rounded-lg p-4 text-sm ${
            statusMessage.includes('successfully') ? 'bg-green-500/20' : 'bg-blue-500/20'
          } text-white`}>
            {statusMessage}
          </div>
        )}

        <div className="flex flex-col gap-4 sm:flex-row">
          <button
            onClick={logout}
            className="rounded-xl border border-slate-700 px-6 py-3 font-semibold text-slate-300 transition hover:border-rose-500 hover:bg-rose-500/10 hover:text-rose-200"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;

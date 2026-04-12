import { type FormEvent, useMemo, useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';

const Contacts = () => {
  const { contacts, addContact, removeContact, user, initiateCall, callState, darkMode } = useAppContext();
  const [contactName, setContactName] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info'>('info');

  // Listen for call-blocked events from the signaling service
  useEffect(() => {
    const handleCallBlocked = (event: Event) => {
      const customEvent = event as unknown as Record<string, unknown>;
      const detail = customEvent.detail as Record<string, unknown>;
      if (detail && detail.type === 'call-blocked') {
        setFeedback((detail.reason || 'Call blocked') as string);
        setFeedbackType('error');
        // Auto-dismiss after 3 seconds
        const timer = setTimeout(() => {
          setFeedback(null);
        }, 3000);
        return () => clearTimeout(timer);
      }
    };

    window.addEventListener('callMessage', handleCallBlocked);
    return () => window.removeEventListener('callMessage', handleCallBlocked);
  }, []);

  const sortedContacts = useMemo(
    () => [...contacts].sort((a, b) => a.username.localeCompare(b.username)),
    [contacts]
  );

  const handleAddContact = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = addContact(contactName);
    if (result.success) {
      setFeedback('Contact added successfully.');
      setContactName('');
    } else {
      setFeedback(result.message ?? 'Unable to add contact.');
    }
  };

  const handleCallContact = async (contact: { id: string; username: string }) => {
    if (callState !== 'idle') {
      setFeedback('You are already in a call. Please end the current call first.');
      return;
    }
    
    try {
      // For demo purposes, we assume the contact is the opposite type
      const isContactDeaf = !user?.isDeaf;
      await initiateCall(contact.id, contact.username, isContactDeaf);
      // Note: If call is blocked, the error will show via callMessage event listener
      // Only show success if we get here without errors
      setFeedback('Call initiated successfully.');
      setFeedbackType('success');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Skip showing feedback for call-blocked errors - they show via event listener
      if (errorMessage.includes('call-blocked')) {
        console.log('Call blocked - error shown via event listener');
        // Don't set feedback - let the event listener handle it
        setFeedbackType('error');
        return;
      }
      
      if (errorMessage.includes('WebSocket')) {
        setFeedback('Connection error: Signaling server unreachable. Make sure to run "npm run server" in a separate terminal.');
      } else if (errorMessage.includes('MediaPermissionDenied')) {
        setFeedback('❌ Camera/Microphone access denied.\n\n FIXES:\n1. BROWSER: Click lock icon → Allow Camera & Microphone\n2. WINDOWS: Settings → Privacy → Camera/Microphone → Allow browser\n3. CLOSE: Close Zoom/Teams/Discord using your camera\n4. RETRY: Try calling again');
      } else if (errorMessage.includes('NoMediaDeviceFound')) {
        setFeedback('❌ No camera or microphone found. Please connect a camera or microphone and retry.');
      } else if (errorMessage.includes('MediaDeviceInUse')) {
        setFeedback('❌ Your camera or microphone is being used by another app. Close it and retry.');
      } else if (errorMessage.includes('SecurityError')) {
        setFeedback('❌ Security issue: Try accessing via http://localhost:1420 or contact support.');
      } else if (errorMessage.includes('MediaDevices') || errorMessage.includes('getUserMedia')) {
        setFeedback(`❌ Camera/Microphone error: ${errorMessage}`);
      } else {
        setFeedback(`Failed to initiate call: ${errorMessage}`);
      }
      setFeedbackType('error');
      console.error('Call initiation error:', error);
    }
  };

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-glow">
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-400">Contacts</p>
          <h2 className="text-3xl font-semibold text-white">Stay connected with your network</h2>
        </div>
        <p className="text-sm text-slate-400">
          Add and manage your contacts for seamless communication.
        </p>
      </header>

      <section className="card-surface space-y-6 p-6">
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Add New Contact</h3>
          <form className="flex gap-4" onSubmit={handleAddContact}>
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="flex-1 rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-white placeholder:text-slate-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-slate-900"
              placeholder="Enter username"
              required
            />
            <button
              type="submit"
              className="rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white shadow-lg hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-colors"
            >
              Add Contact
            </button>
          </form>
          {feedback && (
            <div className={`mt-4 rounded-lg p-3 text-sm ${
              feedbackType === 'success' ? 'bg-green-500/20 text-green-100' : 
              feedbackType === 'error' ? 'bg-red-500/30 text-red-100 border border-red-500/50' : 
              'bg-blue-500/20'
            } ${darkMode ? '' : 'text-black'}`}>
              {feedback}
            </div>
          )}
        </div>
      </section>

      <section className="card-surface space-y-4 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          Your Contacts ({sortedContacts.length})
        </h3>
        {sortedContacts.length === 0 ? (
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-8 text-center">
            <p className="text-slate-400">No contacts yet. Add your first contact to get started!</p>
          </div>
        ) : (
          sortedContacts.map((contact) => (
            <div
              key={contact.id}
              className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/30 p-4 transition-all hover:border-slate-600 hover:bg-slate-800/50"
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white font-semibold">
                  {contact.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-white">{contact.username}</p>
                  <p className="text-sm text-slate-400">ID: {contact.id}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleCallContact(contact)}
                  disabled={callState !== 'idle'}
                  className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white shadow-lg hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Call contact"
                >
                  Call contact
                </button>
                <button
                  onClick={() => removeContact(contact.id)}
                  className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:border-rose-500 hover:bg-rose-500/10 hover:text-rose-200"
                  title="Remove contact"
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
};

export default Contacts;

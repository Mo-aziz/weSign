import { type FormEvent, useMemo, useState, useEffect } from 'react';
import { useAppContext } from '../context/useAppContext';
import { getUserById } from '../services/userService';

const Contacts = () => {
  const { contacts, addContact, removeContact, user, initiateCall, callState } = useAppContext();
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

  const handleAddContact = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback('Looking up user on server...');
    setFeedbackType('info');
    const result = await addContact(contactName);
    if (result.success) {
      setFeedback('Contact added. They must be online in the app to receive calls.');
      setFeedbackType('success');
      setContactName('');
    } else {
      setFeedback(result.message ?? 'Unable to add contact.');
      setFeedbackType('error');
    }
  };

  const handleCallContact = async (contact: { id: string; username: string }) => {
    if (callState !== 'idle') {
      setFeedback('You are already in a call. Please end the current call first.');
      return;
    }
    
    try {
      const remoteUser = await getUserById(contact.id);
      await initiateCall(
        contact.id,
        contact.username,
        remoteUser.isDeafMute ?? !user?.isDeaf,
      );
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
        setFeedback('Connection error: Signaling server unreachable. Check your internet connection and try again.');
      } else if (errorMessage.includes('MediaPermissionDenied')) {
        setFeedback('❌ Camera/Microphone access denied.\n\n FIXES:\n1. BROWSER: Click lock icon → Allow Camera & Microphone\n2. WINDOWS: Settings → Privacy → Camera/Microphone → Allow browser\n3. CLOSE: Close Zoom/Teams/Discord using your camera\n4. RETRY: Try calling again');
      } else if (errorMessage.includes('NoMediaDeviceFound')) {
        setFeedback('❌ No camera or microphone found. Please connect a camera or microphone and retry.');
      } else if (errorMessage.includes('MediaDeviceInUse')) {
        setFeedback('❌ Your camera or microphone is being used by another app. Close it and retry.');
      } else if (errorMessage.includes('SecurityError')) {
        setFeedback('❌ Security issue: Camera/microphone requires a secure context (HTTPS). Use the deployed website or allow permissions in your browser.');
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
    <div className="space-y-8">
      <header className="page-hero flex flex-col gap-4 p-7">
        <div>
          <p className="section-title">Contacts</p>
          <h2 className="section-heading">Stay connected with your network</h2>
        </div>
        <p className="text-sm text-slate-300">
          Add and manage your contacts for seamless communication.
        </p>
      </header>

      <section className="card-surface space-y-6 p-6">
        <div>
          <h3 className="mb-4 text-lg font-semibold text-white">Add New Contact</h3>
          <form className="flex gap-4" onSubmit={handleAddContact}>
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="input-field flex-1"
              placeholder="Enter username"
              required
            />
            <button
              type="submit"
              className="float-button"
            >
              Add Contact
            </button>
          </form>
          {feedback && (
            <div className={`mt-4 rounded-lg p-3 text-sm feedback-message ${
              feedbackType === 'success' ? 'bg-green-500/20 text-green-100' : 
              feedbackType === 'error' ? 'bg-red-500/30 text-red-100 border border-red-500/50' : 
              'bg-blue-500/20'
            }`}>
              {feedback}
            </div>
          )}
        </div>
      </section>

      <section className="card-surface space-y-4 p-6">
        <h3 className="mb-4 text-lg font-semibold text-white">
          Your Contacts ({sortedContacts.length})
        </h3>
        {sortedContacts.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
            <p className="text-slate-300">No contacts yet. Add your first contact to get started!</p>
          </div>
        ) : (
          sortedContacts.map((contact) => (
            <div
              key={contact.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 transition-all hover:-translate-y-1 hover:border-white/20 hover:bg-white/8"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                  {contact.username.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-white truncate">{contact.username}</p>
                  <p className="text-sm text-slate-400 truncate">ID: {contact.id}</p>
                </div>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={() => handleCallContact(contact)}
                  disabled={callState !== 'idle'}
                  className="float-button rounded-xl px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                  title="Call contact"
                >
                  Call contact
                </button>
                <button
                  onClick={() => removeContact(contact.id)}
                  className="float-button float-button-secondary rounded-xl px-4 py-2 text-sm hover:border-rose-500 hover:text-rose-100"
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

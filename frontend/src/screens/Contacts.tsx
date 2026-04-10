import { type FormEvent, useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { validateCallEligibility } from '../services/useCallService';

const Contacts = () => {
  const { contacts, addContact, removeContact, user, initiateCall, callState, updateContact } = useAppContext();
  const [contactName, setContactName] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

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

  const handleCallContact = async (contact: { id: string; username: string; isDeaf?: boolean }) => {
    if (callState !== 'idle') {
      setFeedback('You are already in a call. Please end the current call first.');
      return;
    }
    
    if (!user?.id) {
      setFeedback('User not logged in. Please log in first.');
      return;
    }
    
    try {
      setFeedback('🔍 Validating call eligibility from server...');
      
      console.log('[Contacts] === CALL VALIDATION START ===');
      console.log('[Contacts] Caller (current user): ID=' + user.id + ', Username=' + user.username + ', IsDeaf=' + user.isDeaf);
      console.log('[Contacts] Callee (contact): ID=' + contact.id + ', Username=' + contact.username + ', LocalIsDeaf=' + contact.isDeaf);
      
      // Query BOTH users' status from server (100% accurate)
      let validationResult;
      try {
        validationResult = await validateCallEligibility(user.id, contact.id);
      } catch (validateError) {
        console.error('[Contacts] Validation query failed:', validateError);
        throw validateError;
      }
      
      const callerIsDeaf = validationResult.callerIsDeaf;
      const calleeIsDeaf = validationResult.calleeIsDeaf;
      
      console.log('[Contacts] === SERVER RESPONSE ===');
      console.log('[Contacts] Caller isDeaf type:', typeof callerIsDeaf, 'value:', callerIsDeaf);
      console.log('[Contacts] Callee isDeaf type:', typeof calleeIsDeaf, 'value:', calleeIsDeaf);

      // Update local contact type if it differs from server
      if (contact.isDeaf !== calleeIsDeaf) {
        console.log('[Contacts] Updating contact isDeaf from', contact.isDeaf, 'to', calleeIsDeaf);
        updateContact(contact.id, calleeIsDeaf);
      }

      // Validate call rules (EXPLICIT CHECKS FOR SAFETY)
      console.log('[Contacts] === VALIDATION CHECK ===');
      console.log('[Contacts] Check: !callerIsDeaf =', !callerIsDeaf);
      console.log('[Contacts] Check: !calleeIsDeaf =', !calleeIsDeaf);
      console.log('[Contacts] Check: Both hearing? =', !callerIsDeaf && !calleeIsDeaf);
      
      // CRITICAL: Block if both are hearing
      if (callerIsDeaf === false && calleeIsDeaf === false) {
        console.warn('[Contacts] ❌ CALL BLOCKED: Both users are hearing (callerIsDeaf=false, calleeIsDeaf=false)');
        setFeedback(`❌ Cannot call: Both users are hearing. At least one must be deaf/hard of hearing for translation. Please contact a deaf/hard of hearing user.`);
        return;
      }
      
      // Double-check: if callers types are unexpectedly undefined or null, reject for safety
      if (typeof callerIsDeaf !== 'boolean' || typeof calleeIsDeaf !== 'boolean') {
        console.error('[Contacts] ❌ Invalid types received from server!', { callerIsDeaf, calleeIsDeaf });
        setFeedback(`❌ Error validating user types. Please try again.`);
        return;
      }
      
      // All validation passed - proceed with call
      console.log('[Contacts] ✓ CALL VALIDATION PASSED');
      console.log('[Contacts] Call allowed:', (callerIsDeaf ? 'Deaf' : 'Hearing'), '→', (calleeIsDeaf ? 'Deaf' : 'Hearing'));
      await initiateCall(contact.id, contact.username, calleeIsDeaf);
      setFeedback('✓ Call initiated successfully.');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error('[Contacts] ❌ CALL VALIDATION FAILED:', { error: errorMessage, stack: error instanceof Error ? error.stack : undefined });
      
      if (errorMessage.includes('WebSocket')) {
        setFeedback('❌ Connection error: Signaling server unreachable. Make sure "npm run server" is running.');
      } else if (errorMessage.includes('MediaPermissionDenied')) {
        setFeedback('❌ Camera/Microphone access denied.\n\nFIXES:\n1. BROWSER: Click lock icon → Allow Camera & Microphone\n2. WINDOWS: Settings → Privacy → Camera/Microphone → Allow browser\n3. CLOSE: Close Zoom/Teams/Discord\n4. RETRY: Try calling again');
      } else if (errorMessage.includes('NoMediaDeviceFound')) {
        setFeedback('❌ No camera or microphone found. Please connect a camera/microphone and retry.');
      } else if (errorMessage.includes('MediaDeviceInUse')) {
        setFeedback('❌ Your camera/microphone is in use by another app. Close it and retry.');
      } else if (errorMessage.includes('SecurityError')) {
        setFeedback('❌ Security issue: Try accessing via https://localhost:1420 or contact support.');
      } else if (errorMessage.includes('MediaDevices') || errorMessage.includes('getUserMedia')) {
        setFeedback(`❌ Media error: ${errorMessage}`);
      } else if (errorMessage.includes('timeout') || errorMessage.includes('User status query')) {
        setFeedback(`⚠️ Server unavailable - cannot verify user types. Please check your connection and try again.`);
      } else {
        setFeedback(`❌ Call failed: ${errorMessage}`);
      }
      console.error('Call error:', error);
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
              feedback.includes('❌') ? 'bg-red-500/20 text-red-200' :
              feedback.includes('successfully') ? 'bg-green-500/20 text-green-200' : 'bg-blue-500/20 text-blue-200'
            }`}>
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

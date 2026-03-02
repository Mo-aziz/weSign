import { type FormEvent, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

const Contacts = () => {
  const { contacts, addContact, removeContact, user, initiateCall, callState } = useAppContext();
  const navigate = useNavigate();
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

  const handleCallContact = async (contact: { id: string; username: string }) => {
    if (callState !== 'idle') {
      setFeedback('You are already in a call. Please end the current call first.');
      return;
    }
    
    try {
      // For demo purposes, we assume the contact is the opposite type
      const isContactDeaf = !user?.isDeaf;
      await initiateCall(contact.id, contact.username, isContactDeaf);
      navigate('/call', { state: { contact } });
    } catch (error) {
      setFeedback('Failed to initiate call. Please try again.');
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
        <p className="max-w-2xl text-sm text-slate-400">
          Access interpreters, colleagues, and friends instantly. Select a contact to start a communication session.
        </p>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span className="rounded-full bg-brand-600/20 px-3 py-1 text-brand-200">
            Signed in as {user?.username ?? 'guest'}
          </span>
          <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-300">
            Preference: {user?.isDeaf ? 'Sign language' : 'Spoken language'}
          </span>
          <button
            onClick={() => navigate('/call')}
            className="rounded-2xl bg-brand-600 px-4 py-2 font-semibold text-white transition hover:bg-brand-500"
          >
            Start a new call
          </button>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[2fr,1fr] lg:gap-8">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Saved contacts</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {sortedContacts.length === 0 && (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400 sm:col-span-2">
                No contacts yet. Add a username to begin building your network.
              </div>
            )}
            {sortedContacts.map((contact) => (
              <div key={contact.id} className="card-surface flex flex-col gap-4 p-6">
                <div>
                  <p className="text-base font-semibold text-white">@{contact.username}</p>
                  <p className="text-xs text-slate-500">ID: {contact.id}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleCallContact(contact)}
                    disabled={callState !== 'idle'}
                    className="flex-1 rounded-2xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-slate-700"
                  >
                    {callState !== 'idle' ? 'In Call...' : 'Call contact'}
                  </button>
                  <button
                    onClick={() => removeContact(contact.id)}
                    className="rounded-2xl border border-transparent px-4 py-2 text-sm font-semibold text-rose-300 transition hover:border-rose-500 hover:bg-rose-500/10"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="card-surface space-y-6 p-6">
          <div>
            <h3 className="text-lg font-semibold text-white">Add new contact</h3>
            <p className="text-sm text-slate-400">
              Enter the username of someone you regularly communicate with.
            </p>
          </div>
          <form className="space-y-3" onSubmit={handleAddContact}>
            <input
              className="input-field"
              placeholder="username.id"
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
            />
            <button
              type="submit"
              className="w-full rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-500"
            >
              Save contact
            </button>
          </form>
          {feedback && <p className="text-xs text-slate-400">{feedback}</p>}
          <p className="text-xs text-slate-500">
            You can connect with interpreters, friends, or colleagues across teams. Contacts sync across your devices.
          </p>
        </aside>
      </section>
    </div>
  );
};

export default Contacts;

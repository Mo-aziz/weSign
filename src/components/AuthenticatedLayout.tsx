import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import IncomingCallModal from './IncomingCallModal';

const navItems = [
  { label: 'Contacts', to: '/contacts', description: 'Manage your contact list' },
  { label: 'Call', to: '/call', description: 'Start a communication session' },
  { label: 'Translation', to: '/translation', description: 'Practice AI-assisted translation' },
  { label: 'Settings', to: '/settings', description: 'Personalize your experience' },
];

const AuthenticatedLayout = () => {
  const { user, logout, incomingCall, acceptCall, rejectCall } = useAppContext();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <div className="flex min-h-screen justify-center bg-slate-100 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100 lg:justify-start">
      <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white/70 px-6 py-10 backdrop-blur lg:block dark:border-slate-800 dark:bg-slate-900/70">
        <div className="space-y-8">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-500">Signed in as</p>
            <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{user.username}</p>
            <p className="text-xs text-slate-500 dark:text-slate-500">ID: {user.id}</p>
            <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-600/20 dark:text-brand-300">
              {user.isDeaf ? 'Signing preference' : 'Voice preference'}
            </span>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `block rounded-2xl px-4 py-3 transition ${
                    isActive
                      ? 'bg-brand-100 text-brand-700 shadow-lg dark:bg-brand-600/20 dark:text-brand-200 dark:shadow-glow'
                      : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-white'
                  }`
                }
              >
                <p className="text-sm font-semibold">{item.label}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{item.description}</p>
              </NavLink>
            ))}
          </nav>

          <button
            onClick={logout}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:border-rose-500 hover:bg-rose-500/10 hover:text-rose-500 dark:border-slate-700 dark:text-slate-300 dark:hover:text-rose-200"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex flex-col items-center gap-3 border-b border-slate-200 bg-white/80 px-6 py-4 text-center backdrop-blur transition-colors duration-300 lg:hidden dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex flex-col gap-1">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-500">Signed in as</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{user.username}</p>
          </div>
          <button
            onClick={logout}
            className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-rose-500 hover:bg-rose-500/10 hover:text-rose-500 dark:border-slate-700 dark:text-slate-300 dark:hover:text-rose-200"
          >
            Sign out
          </button>
        </header>

        <nav className="mobile-nav mx-auto flex w-full max-w-[400px] snap-x snap-mandatory gap-2 overflow-x-auto border-b border-slate-200 bg-white/70 px-3 py-3 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/90">
          {navItems.map((item) => (
            <NavLink
              key={`${item.to}-mobile`}
              to={item.to}
              className={({ isActive }) =>
                `flex min-w-[7.2rem] flex-col gap-1 rounded-2xl px-3 py-3 text-xs font-semibold transition snap-center ${
                  isActive
                    ? 'bg-brand-100 text-brand-700 shadow-lg dark:bg-brand-600/20 dark:text-brand-200 dark:shadow-glow'
                    : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-white'
                }`
              }
            >
              <span>{item.label}</span>
              <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">{item.description}</span>
            </NavLink>
          ))}
        </nav>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto min-h-full w-full max-w-[430px] px-4 py-10">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Incoming Call Modal */}
      <IncomingCallModal
        incomingCall={incomingCall}
        onAccept={acceptCall}
        onReject={rejectCall}
      />
    </div>
  );
};

export default AuthenticatedLayout;

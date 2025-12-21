import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

const Login = () => {
  const { user, login } = useAppContext();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isDeaf, setIsDeaf] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      navigate('/contacts', { replace: true });
    }
  }, [navigate, user]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!username.trim()) {
      setError('Username is required');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    login({ username, isDeaf });
    navigate('/contacts', { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-6 py-12 dark:bg-slate-950">
      <div className="w-full max-w-md space-y-8 card-surface p-10">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold text-slate-900 italic dark:text-white">WE SIGN</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Connect seamlessly across signing and speaking communities.</p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600 dark:text-slate-300" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              className="input-field"
              placeholder="your.userid"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600 dark:text-slate-300" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">I primarily communicate using sign language</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Toggle this off if you prefer spoken communication.</p>
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

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <button
            type="submit"
            className="w-full rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-glow transition hover:bg-brand-500"
          >
            Enter platform
          </button>
        </form>
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          By continuing you agree to our respectful communication guidelines.
        </p>
      </div>
    </div>
  );
};

export default Login;

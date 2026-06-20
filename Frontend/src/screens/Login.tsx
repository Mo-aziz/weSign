import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/useAppContext';
import { apiPost, storeTokens, clearTokens } from '../services/apiClient';
import { checkUsernameExists } from '../services/userService';

const Login = () => {
  const { user, login } = useAppContext();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/contacts', { replace: true });
    }
  }, [navigate, user]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!username.trim()) {
      setError('Username is required');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const trimmedUsername = username.trim();
      const usernameExists = await checkUsernameExists(trimmedUsername);
      if (!usernameExists) {
        throw new Error('Account not found. Please create an account first.');
      }

      console.log('Sending login request:', { username: trimmedUsername });

      // Call backend login API
      const response = await apiPost('/users/login-username', {
        username: trimmedUsername,
        password,
      });

      console.log('Login response received:', response);

      // Store tokens from response
      if (response.accessToken && response.refreshToken) {
        console.log('Storing tokens...');
        storeTokens({
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
        });
      }

      // Update app context with user data
      console.log('Processing user data:', response.user);
      const backendUser = response.user;
      
      if (!backendUser) {
        throw new Error('No user data in response');
      }

      if (!backendUser.username) {
        throw new Error('User data missing username field');
      }

      if (!backendUser.id) {
        throw new Error('User data missing id field');
      }

      login({
        id: backendUser.id,
        username: backendUser.username,
        isDeaf: backendUser.isDeafMute,
      });

      navigate('/contacts', { replace: true });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed. Please try again.';
      console.error('Login error details:', err);
      setError(errorMessage);
      clearTokens();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[inherit] flex-col items-center justify-center px-5 py-8 text-slate-100">
      <div className="w-full max-w-md space-y-6 px-1">
        <div className="page-hero text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 via-blue-500 to-cyan-400 shadow-[0_16px_32px_rgba(59,130,246,0.28)]">
            <span className="text-xl font-black text-white">WS</span>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-white">WE SIGN</h1>
            <p className="text-sm text-slate-300">A mobile-first space for signing, speaking, and staying connected.</p>
          </div>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <span className="soft-chip">Fast login</span>
            <span className="soft-chip">Live translation</span>
            <span className="soft-chip">Secure calls</span>
          </div>
        </div>

        <form className="card-surface space-y-6 p-6 sm:p-8" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              className="input-field"
              placeholder="your.userid"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="input-field"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/12 p-3 text-sm text-rose-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="float-button w-full disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {isLoading ? 'Signing In...' : 'Sign In'}
          </button>

          <p className="text-center text-sm text-slate-300">
            New to WeSign?{' '}
            <Link className="font-semibold" to="/signup">
              Create an account
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Login;

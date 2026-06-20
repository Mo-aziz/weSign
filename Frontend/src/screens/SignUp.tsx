import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/useAppContext';
import { apiPost, clearTokens, storeTokens } from '../services/apiClient';

const SignUp = () => {
  const { user, login } = useAppContext();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isDeafMute, setIsDeafMute] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/contacts', { replace: true });
    }
  }, [navigate, user]);

  const validateForm = () => {
    if (firstName.trim().length < 3) return 'First name must be at least 3 characters long';
    if (lastName.trim().length < 3) return 'Last name must be at least 3 characters long';
    if (username.trim().length < 3) return 'Username must be at least 3 characters long';
    if (!/^\d{11}$/.test(phoneNumber)) return 'Phone number must be exactly 11 digits';
    if (!email.trim()) return 'Email is required';
    if (!dob) return 'Date of birth is required';
    if (password.length < 8) return 'Password must be at least 8 characters long';
    if (password !== confirmPassword) return 'Passwords do not match';
    return null;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiPost('/users/register', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username.trim(),
        phoneNumber,
        email: email.trim(),
        dob,
        password,
        isDeafMute,
      });

      if (!response.accessToken || !response.refreshToken) {
        throw new Error('Registration succeeded, but login tokens were not returned');
      }

      const backendUser = response.user;
      if (!backendUser?.id) {
        throw new Error('Registration succeeded, but user data was not returned');
      }

      storeTokens({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      });

      login({
        id: backendUser.id,
        username: backendUser.username || username.trim(),
        isDeaf: backendUser.isDeafMute,
      });

      navigate('/contacts', { replace: true });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sign up failed. Please try again.';
      setError(errorMessage);
      clearTokens();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[inherit] flex-col items-center justify-center px-5 py-8 text-slate-100">
      <div className="w-full max-w-2xl space-y-6 px-1">
        <div className="page-hero text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 via-blue-500 to-cyan-400 shadow-[0_16px_32px_rgba(59,130,246,0.28)]">
            <span className="text-lg font-black text-white">WS</span>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-white">Create your account</h1>
            <p className="text-sm text-slate-300">Join WeSign and start connecting without barriers.</p>
          </div>
        </div>

        <form className="card-surface space-y-6 p-6 sm:p-8" onSubmit={handleSubmit}>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200" htmlFor="firstName">
                First name
              </label>
              <input
                id="firstName"
                className="input-field"
                autoComplete="given-name"
                placeholder="Your first name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200" htmlFor="lastName">
                Last name
              </label>
              <input
                id="lastName"
                className="input-field"
                autoComplete="family-name"
                placeholder="Your last name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200" htmlFor="signup-username">
                Username
              </label>
              <input
                id="signup-username"
                className="input-field"
                autoComplete="username"
                placeholder="your.userid"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200" htmlFor="phoneNumber">
                Phone number
              </label>
              <input
                id="phoneNumber"
                type="tel"
                inputMode="numeric"
                className="input-field"
                autoComplete="tel"
                placeholder="11-digit phone number"
                maxLength={11}
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value.replace(/\D/g, ''))}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                className="input-field"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200" htmlFor="dob">
                Date of birth
              </label>
              <input
                id="dob"
                type="date"
                className="input-field"
                autoComplete="bday"
                value={dob}
                onChange={(event) => setDob(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200" htmlFor="signup-password">
                Password
              </label>
              <input
                id="signup-password"
                type="password"
                className="input-field"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200" htmlFor="confirmPassword">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                className="input-field"
                autoComplete="new-password"
                placeholder="Enter password again"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200">User Type</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setIsDeafMute(true)}
                className={`float-button rounded-2xl px-4 py-3 text-sm ${
                  isDeafMute ? '' : 'float-button-secondary'
                }`}
              >
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                <span className="text-sm font-medium">Deaf / Hard of Hearing</span>
              </button>
              <button
                type="button"
                onClick={() => setIsDeafMute(false)}
                className={`float-button rounded-2xl px-4 py-3 text-sm ${
                  !isDeafMute ? '' : 'float-button-secondary'
                }`}
              >
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                <span className="text-sm font-medium">Hearing</span>
              </button>
            </div>
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
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </button>

          <p className="text-center text-sm text-slate-300">
            Already have an account?{' '}
            <Link className="font-semibold" to="/login">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default SignUp;

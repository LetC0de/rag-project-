import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { LogoMark, EyeIcon, EyeOffIcon, CheckIcon } from './Icons';
import './AuthScreen.css';

type Mode = 'login' | 'register';

const VALIDATION = {
  name: (v: string) => (v.trim().length < 2 ? 'Please enter your name.' : ''),
  username: (v: string) =>
    v.trim().length < 3 ? 'Username must be at least 3 characters.' : '',
  email: (v: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'Enter a valid email address.',
  password: (v: string) =>
    v.length < 6 ? 'Password must be at least 6 characters.' : '',
};

type Field = keyof typeof VALIDATION;

export function AuthScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [values, setValues] = useState({ name: '', username: '', password: '', email: '' });
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setValues({ name: '', username: '', password: '', email: '' });
    setTouched({});
    setError('');
    setShowPassword(false);
  }, [mode]);

  const errors = {
    name: VALIDATION.name(values.name),
    username: VALIDATION.username(values.username),
    email: VALIDATION.email(values.email),
    password: VALIDATION.password(values.password),
  };

  const canSubmit =
    mode === 'login'
      ? values.username.trim().length > 0 && values.password.length > 0
      : !Object.values(errors).some(Boolean) && Object.values(values).every(Boolean);

  const set = (field: Field) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
  };

  const blur = (field: Field) => () => setTouched((t) => ({ ...t, [field]: true }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!canSubmit) {
      setTouched({ name: true, username: true, email: true, password: true });
      return;
    }
    setBusy(true);
    try {
      if (mode === 'login') {
        await login({ username: values.username.trim(), password: values.password });
      } else {
        await register({
          name: values.name.trim(),
          username: values.username.trim(),
          email: values.email.trim().toLowerCase(),
          password: values.password,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setBusy(false);
    }
  };

  const fieldClass = (f: Field) =>
    `auth__input${touched[f] && errors[f] ? ' auth__input--invalid' : ''}`;

  return (
    <div className="auth">
      <div className="auth-bg" aria-hidden="true">
        <div className="blob blob--coral" />
        <div className="blob blob--sun" />
        <div className="blob blob--sky" />
        <div className="grain" />
      </div>

      <div className="auth__frame">
        <div className="auth__side">
          <span className="brand__mark"><LogoMark size={48} /></span>
          <blockquote className="auth__quote">
            <span className="auth__quote-mark">“</span>
            <p className="auth__quote-text">Ask your documents anything. Answers grounded in what you upload — never guessed.</p>
          </blockquote>
          <p className="auth__leaf" aria-hidden="true">❀</p>
        </div>

        <div className="auth__panel">
          <div className="auth__card">
            <header className="auth__head">
              <h1 className="auth__title">
                {mode === 'login' ? 'Welcome back' : 'Create your account'}
              </h1>
              <p className="auth__sub">
                {mode === 'login'
                  ? 'Sign in to keep chatting with your documents.'
                  : 'Sign up to start chatting with your documents.'}
              </p>
            </header>

            <div className="auth__tabs" role="tablist">
              <button
                className={`auth__tab ${mode === 'login' ? 'auth__tab--on' : ''}`}
                onClick={() => setMode('login')}
                type="button"
              >
                Sign in
              </button>
              <button
                className={`auth__tab ${mode === 'register' ? 'auth__tab--on' : ''}`}
                onClick={() => setMode('register')}
                type="button"
              >
                Sign up
              </button>
            </div>

            {error && (
              <div className="auth__error" role="alert">
                <span className="auth__error-icon">!</span>
                {error}
              </div>
            )}

            <form className="auth__form" onSubmit={handleSubmit} noValidate>
              {mode === 'register' && (
                <label className="auth__label">
                  <span className="auth__label-text">Name</span>
                  <input
                    className={fieldClass('name')}
                    value={values.name}
                    onChange={set('name')}
                    onBlur={blur('name')}
                    placeholder="Ada Lovelace"
                    autoComplete="name"
                    autoFocus
                  />
                  {touched.name && errors.name && (
                    <span className="auth__field-error">{errors.name}</span>
                  )}
                </label>
              )}

              <label className="auth__label">
                <span className="auth__label-text">Username</span>
                <input
                  className={fieldClass('username')}
                  value={values.username}
                  onChange={set('username')}
                  onBlur={blur('username')}
                  placeholder={mode === 'login' ? 'your_username' : 'Choose a username'}
                  autoComplete="username"
                  autoFocus={mode === 'login'}
                />
                {touched.username && errors.username && (
                  <span className="auth__field-error">{errors.username}</span>
                )}
              </label>

              {mode === 'register' && (
                <label className="auth__label">
                  <span className="auth__label-text">Email</span>
                  <input
                    className={fieldClass('email')}
                    type="email"
                    value={values.email}
                    onChange={set('email')}
                    onBlur={blur('email')}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                  {touched.email && errors.email && (
                    <span className="auth__field-error">{errors.email}</span>
                  )}
                </label>
              )}

              <label className="auth__label">
                <span className="auth__label-text">Password</span>
                <div className="auth__pw">
                  <input
                    className={`${fieldClass('password')} auth__input--pw`}
                    type={showPassword ? 'text' : 'password'}
                    value={values.password}
                    onChange={set('password')}
                    onBlur={blur('password')}
                    placeholder={mode === 'login' ? 'Your password' : 'At least 6 characters'}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />
                  <button
                    type="button"
                    className="auth__toggle"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOffIcon size={17} /> : <EyeIcon size={17} />}
                  </button>
                </div>
                {touched.password && errors.password && (
                  <span className="auth__field-error">{errors.password}</span>
                )}
              </label>

              <button
                className="auth__submit"
                type="submit"
                disabled={busy || !canSubmit}
              >
                {busy ? (
                  <span className="auth__spinner" aria-hidden="true" />
                ) : (
                  <CheckIcon size={16} />
                )}
                {busy
                  ? mode === 'login'
                    ? 'Signing in…'
                    : 'Creating account…'
                  : mode === 'login'
                  ? 'Sign in'
                  : 'Create account'}
              </button>
            </form>

            <p className="auth__foot">
              {mode === 'login' ? (
                <>
                  New here?{' '}
                  <button className="auth__link" type="button" onClick={() => setMode('register')}>
                    Create an account
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button className="auth__link" type="button" onClick={() => setMode('login')}>
                    Sign in
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
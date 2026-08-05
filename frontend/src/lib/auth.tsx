import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { login as apiLogin, registerUser as apiRegister, me, setAuthToken, setOnUnauthorized } from './api';
import type { LoginInput, RegisterInput, User } from './types';

const TOKEN_KEY = 'knowledge_token';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isBooting: boolean; // true while restoring a session from the stored token
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => readStoredToken());
  const [user, setUser] = useState<User | null>(null);
  const [isBooting, setIsBooting] = useState(() => Boolean(readStoredToken()));

  // Sync the api module's token so every request carries it.
  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  const logout = useCallback(() => {
    setAuthToken(null);
    setTokenState(null);
    setUser(null);
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable */
    }
  }, []);

  // On first load, restore the session from the stored token.
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const stored = readStoredToken();
      if (!stored) {
        setIsBooting(false);
        return;
      }
      try {
        const u = await me();
        if (!cancelled) setUser(u);
      } catch {
        if (!cancelled) logout();
      } finally {
        if (!cancelled) setIsBooting(false);
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, [logout]);

  // Any 401 from the API ends the session.
  useEffect(() => {
    setOnUnauthorized(() => {
      logout();
    });
    return () => setOnUnauthorized(null);
  }, [logout]);

  const login = useCallback(
    async (input: LoginInput) => {
      const res = await apiLogin(input);
      setAuthToken(res.token);
      setTokenState(res.token);
      try {
        localStorage.setItem(TOKEN_KEY, res.token);
      } catch {
        /* storage unavailable */
      }
      const u = await me();
      setUser(u);
    },
    []
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      await apiRegister(input);
      // After registering, sign the user in immediately.
      await login({ username: input.username, password: input.password });
    },
    [login]
  );

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, isBooting, login, register, logout }),
    [user, token, isBooting, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

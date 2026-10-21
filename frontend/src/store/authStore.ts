import { create } from 'zustand';
import type { Branch, User } from '../types';

export interface JwtPayload {
  user_id?: string;
  business_id?: string;
  username?: string;
  role?: string;
  full_name?: string;
  exp?: number;
  iat?: number;
  sub?: string;
}

export function parseJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  const payload = parseJwt(token);
  if (!payload || !payload.exp) return true;
  // If current timestamp in seconds is >= exp (with 10-second buffer for safety)
  return Math.floor(Date.now() / 1000) >= payload.exp - 10;
}

interface AuthState {
  token: string | null;
  user: User | null;
  currentBranch: Branch | null;
  rememberMe: boolean;
  lastActiveAt: number;
  sessionExpiredReason: string | null;
  isVerifyingSession: boolean;

  setAuth: (token: string, user: User, rememberMe?: boolean) => void;
  setCurrentBranch: (branch: Branch) => void;
  updateUser: (user: User, token?: string) => void;
  updateLastActive: () => void;
  setSessionExpiredReason: (reason: string | null) => void;
  setIsVerifyingSession: (isVerifying: boolean) => void;
  logout: (reason?: string) => void;
}

const STORAGE_KEY = 'pos_auth_state_v1';

const getStorage = (rememberMe: boolean) => (rememberMe ? localStorage : sessionStorage);

const getInitialState = () => {
  try {
    // Check localStorage first (persistent), then sessionStorage (tab/browser lifetime)
    let raw = localStorage.getItem(STORAGE_KEY);
    let fromLocal = true;
    if (!raw) {
      raw = sessionStorage.getItem(STORAGE_KEY);
      fromLocal = false;
    }

    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.token) {
        if (isTokenExpired(parsed.token)) {
          // Token is expired! Clean it up immediately
          localStorage.removeItem(STORAGE_KEY);
          sessionStorage.removeItem(STORAGE_KEY);
          return {
            token: null,
            user: null,
            currentBranch: null,
            rememberMe: parsed.rememberMe ?? true,
            lastActiveAt: Date.now(),
            sessionExpiredReason: 'Sesi login Anda telah berakhir. Silakan masuk kembali.',
            isVerifyingSession: false,
          };
        }

        return {
          token: parsed.token || null,
          user: parsed.user || null,
          currentBranch: parsed.currentBranch || null,
          rememberMe: parsed.rememberMe ?? fromLocal,
          lastActiveAt: parsed.lastActiveAt || Date.now(),
          sessionExpiredReason: null,
          isVerifyingSession: true, // will verify validity with backend on boot
        };
      }
    }
  } catch (e) {
    console.error('Failed to load auth from storage', e);
  }

  return {
    token: null,
    user: null,
    currentBranch: null,
    rememberMe: true,
    lastActiveAt: Date.now(),
    sessionExpiredReason: null,
    isVerifyingSession: false,
  };
};

export const useAuthStore = create<AuthState>((set) => ({
  ...getInitialState(),

  setAuth: (token: string, user: User, rememberMe: boolean = true) => {
    const defaultBranch = user.branches.length > 0 ? user.branches[0] : null;
    const now = Date.now();
    const newState = {
      token,
      user,
      currentBranch: defaultBranch,
      rememberMe,
      lastActiveAt: now,
      sessionExpiredReason: null,
      isVerifyingSession: false,
    };

    try {
      // Clear both storages first to prevent stale dual states
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
      getStorage(rememberMe).setItem(STORAGE_KEY, JSON.stringify(newState));
    } catch (e) {
      console.error('Failed to save auth state', e);
    }

    set(newState);
  },

  setCurrentBranch: (branch: Branch) => {
    set((state) => {
      const newState = { ...state, currentBranch: branch };
      try {
        getStorage(state.rememberMe).setItem(STORAGE_KEY, JSON.stringify(newState));
      } catch (e) {
        console.error(e);
      }
      return newState;
    });
  },

  updateUser: (user: User, token?: string) => {
    set((state) => {
      const newToken = token || state.token;
      let branch = state.currentBranch;
      if (branch && user.branches && user.branches.length > 0) {
        const exists = user.branches.some((b) => b.id === branch!.id);
        if (!exists) {
          branch = user.branches[0];
        }
      } else if (!branch && user.branches && user.branches.length > 0) {
        branch = user.branches[0];
      }

      const newState = { ...state, user, token: newToken, currentBranch: branch };
      try {
        getStorage(state.rememberMe).setItem(STORAGE_KEY, JSON.stringify(newState));
      } catch (e) {
        console.error(e);
      }
      return newState;
    });
  },

  updateLastActive: () => {
    set((state) => {
      const now = Date.now();
      const updated = { ...state, lastActiveAt: now };
      try {
        getStorage(state.rememberMe).setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        // ignore storage error
      }
      return updated;
    });
  },

  setSessionExpiredReason: (reason: string | null) => {
    set({ sessionExpiredReason: reason });
  },

  setIsVerifyingSession: (isVerifying: boolean) => {
    set({ isVerifyingSession: isVerifying });
  },

  logout: (reason?: string) => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error(e);
    }
    set({
      token: null,
      user: null,
      currentBranch: null,
      sessionExpiredReason: reason || null,
      isVerifyingSession: false,
    });
  },
}));

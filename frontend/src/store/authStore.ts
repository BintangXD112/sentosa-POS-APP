import { create } from 'zustand';
import type { Branch, User } from '../types';

interface AuthState {
  token: string | null;
  user: User | null;
  currentBranch: Branch | null;
  setAuth: (token: string, user: User) => void;
  setCurrentBranch: (branch: Branch) => void;
  updateUser: (user: User, token?: string) => void;
  logout: () => void;
}

const STORAGE_KEY = 'pos_auth_state_v1';

const getInitialState = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        token: parsed.token || null,
        user: parsed.user || null,
        currentBranch: parsed.currentBranch || null,
      };
    }
  } catch (e) {
    console.error('Failed to load auth from storage', e);
  }
  return { token: null, user: null, currentBranch: null };
};

export const useAuthStore = create<AuthState>((set) => ({
  ...getInitialState(),

  setAuth: (token: string, user: User) => {
    const defaultBranch = user.branches.length > 0 ? user.branches[0] : null;
    const newState = { token, user, currentBranch: defaultBranch };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    } catch (e) {
      console.error(e);
    }
    set(newState);
  },

  setCurrentBranch: (branch: Branch) => {
    set((state) => {
      const newState = { ...state, currentBranch: branch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
      } catch (e) {
        console.error(e);
      }
      return newState;
    });
  },

  updateUser: (user: User, token?: string) => {
    set((state) => {
      const newToken = token || state.token;
      const newState = { ...state, user, token: newToken };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
      } catch (e) {
        console.error(e);
      }
      return newState;
    });
  },

  logout: () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error(e);
    }
    set({ token: null, user: null, currentBranch: null });
  },
}));

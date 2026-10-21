import { create } from 'zustand';

export type AccentColor = 'emerald' | 'blue' | 'violet' | 'amber';

interface ThemeState {
  accentColor: AccentColor;
  compactMode: boolean;
  setAccentColor: (color: AccentColor) => void;
  setCompactMode: (compact: boolean) => void;
}

const COLOR_STORAGE_KEY = 'pos_accent_color';
const COMPACT_STORAGE_KEY = 'pos_compact_mode';

const getInitialColor = (): AccentColor => {
  try {
    const saved = localStorage.getItem(COLOR_STORAGE_KEY);
    if (saved && ['emerald', 'blue', 'violet', 'amber'].includes(saved)) {
      return saved as AccentColor;
    }
  } catch (e) {
    console.error('Failed to load accent color from storage', e);
  }
  return 'emerald';
};

const getInitialCompact = (): boolean => {
  try {
    return localStorage.getItem(COMPACT_STORAGE_KEY) === 'true';
  } catch (e) {
    console.error('Failed to load compact mode from storage', e);
    return false;
  }
};

export const applyThemeToDom = (color: AccentColor, compact: boolean) => {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', color);
    if (compact) {
      document.documentElement.setAttribute('data-compact', 'true');
    } else {
      document.documentElement.removeAttribute('data-compact');
    }
  }
};

export const useThemeStore = create<ThemeState>((set) => {
  const initialColor = getInitialColor();
  const initialCompact = getInitialCompact();

  applyThemeToDom(initialColor, initialCompact);

  return {
    accentColor: initialColor,
    compactMode: initialCompact,
    setAccentColor: (color: AccentColor) => {
      try {
        localStorage.setItem(COLOR_STORAGE_KEY, color);
      } catch (e) {
        console.error(e);
      }
      set((state) => {
        applyThemeToDom(color, state.compactMode);
        return { accentColor: color };
      });
    },
    setCompactMode: (compact: boolean) => {
      try {
        localStorage.setItem(COMPACT_STORAGE_KEY, String(compact));
      } catch (e) {
        console.error(e);
      }
      set((state) => {
        applyThemeToDom(state.accentColor, compact);
        return { compactMode: compact };
      });
    },
  };
});

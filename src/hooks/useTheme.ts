import { useState, useEffect, useCallback } from 'react';

export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'app_theme';

/**
 * Reads stored theme preference from localStorage.
 * Returns 'light', 'dark', or null if not yet explicitly saved.
 */
export function getStoredTheme(): Theme | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const item = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (item === 'light' || item === 'dark') {
      return item;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Saves explicit theme preference to localStorage.
 */
export function saveStoredTheme(theme: Theme): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
  } catch {
    // Ignore storage quota/permission errors
  }
}

/**
 * Determines system preferred color scheme via prefers-color-scheme media query.
 */
export function getSystemTheme(): Theme {
  try {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    ) {
      return 'dark';
    }
  } catch {
    // Fallback if matchMedia is unavailable
  }
  return 'light';
}

/**
 * Resolves the initial active theme:
 * 1. Checks explicit user choice stored in localStorage
 * 2. Falls back to operating system / browser preference
 */
export function resolveInitialTheme(): Theme {
  const stored = getStoredTheme();
  if (stored) return stored;
  return getSystemTheme();
}

/**
 * Pure helper to compute next theme on toggle.
 */
export function getNextTheme(current: Theme): Theme {
  return current === 'dark' ? 'light' : 'dark';
}

/**
 * Applies the given theme to document.documentElement and meta theme-color.
 */
export function applyThemeToDocument(theme: Theme): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
  }

  // Update mobile status bar & browser navigation color
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', theme === 'dark' ? '#0c0a09' : '#fafaf9');
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Synchronize DOM immediately during initialization
    const initial = resolveInitialTheme();
    if (typeof document !== 'undefined') {
      applyThemeToDocument(initial);
    }
    return initial;
  });

  // Apply to document whenever state updates
  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  // Listen for storage events (e.g. multi-tab synchronization)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY && (e.newValue === 'light' || e.newValue === 'dark')) {
        setThemeState(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Listen for system theme changes if user has not set an explicit override
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      // Only auto-switch if user hasn't explicitly stored a preference
      if (!getStoredTheme()) {
        const nextTheme = e.matches ? 'dark' : 'light';
        setThemeState(nextTheme);
      }
    };

    mediaQuery.addEventListener?.('change', handleMediaChange);
    return () => mediaQuery.removeEventListener?.('change', handleMediaChange);
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    saveStoredTheme(newTheme);
    applyThemeToDocument(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = getNextTheme(prev);
      saveStoredTheme(next);
      applyThemeToDocument(next);
      return next;
    });
  }, []);

  return {
    theme,
    isDark: theme === 'dark',
    setTheme,
    toggleTheme,
  };
}

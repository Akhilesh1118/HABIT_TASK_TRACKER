import test from 'node:test';
import assert from 'node:assert/strict';
import {
  THEME_STORAGE_KEY,
  getStoredTheme,
  saveStoredTheme,
  getNextTheme,
  resolveInitialTheme,
  applyThemeToDocument,
  Theme,
} from '../src/hooks/useTheme';

test('theme management: getStoredTheme and saveStoredTheme', () => {
  // Mock localStorage
  const mockStorage: Record<string, string> = {};
  const originalWindow = globalThis.window;
  const originalLocalStorage = globalThis.localStorage;

  try {
    const fakeLocalStorage = {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, val: string) => {
        mockStorage[key] = String(val);
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
      },
    };

    (globalThis as any).window = { localStorage: fakeLocalStorage };
    (globalThis as any).localStorage = fakeLocalStorage;

    // Initially null
    assert.equal(getStoredTheme(), null, 'Should return null when nothing is saved');

    // Save dark
    saveStoredTheme('dark');
    assert.equal(mockStorage[THEME_STORAGE_KEY], 'dark');
    assert.equal(getStoredTheme(), 'dark', 'Should read dark from storage');

    // Save light
    saveStoredTheme('light');
    assert.equal(mockStorage[THEME_STORAGE_KEY], 'light');
    assert.equal(getStoredTheme(), 'light', 'Should read light from storage');

    // Invalid value fallback
    mockStorage[THEME_STORAGE_KEY] = 'invalid-theme';
    assert.equal(getStoredTheme(), null, 'Should ignore invalid theme string');
  } finally {
    if (originalWindow !== undefined) {
      globalThis.window = originalWindow;
    } else {
      delete (globalThis as any).window;
    }
    if (originalLocalStorage !== undefined) {
      globalThis.localStorage = originalLocalStorage;
    } else {
      delete (globalThis as any).localStorage;
    }
  }
});

test('theme management: getNextTheme toggles properly', () => {
  assert.equal(getNextTheme('light'), 'dark', 'light toggles to dark');
  assert.equal(getNextTheme('dark'), 'light', 'dark toggles to light');
});

test('theme management: resolveInitialTheme precedence', () => {
  const mockStorage: Record<string, string> = {};
  const originalWindow = globalThis.window;

  try {
    const fakeLocalStorage = {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, val: string) => {
        mockStorage[key] = String(val);
      },
    };

    // Case 1: No stored preference, matchMedia returns false for dark
    (globalThis as any).window = {
      localStorage: fakeLocalStorage,
      matchMedia: (query: string) => ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    };
    assert.equal(resolveInitialTheme(), 'light');

    // Case 2: No stored preference, matchMedia returns true for dark
    (globalThis as any).window.matchMedia = (query: string) => ({
      matches: query.includes('dark'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    assert.equal(resolveInitialTheme(), 'dark');

    // Case 3: Stored preference overrides system preference
    mockStorage[THEME_STORAGE_KEY] = 'light';
    assert.equal(resolveInitialTheme(), 'light');

    mockStorage[THEME_STORAGE_KEY] = 'dark';
    (globalThis as any).window.matchMedia = () => ({ matches: false });
    assert.equal(resolveInitialTheme(), 'dark');
  } finally {
    if (originalWindow !== undefined) {
      globalThis.window = originalWindow;
    } else {
      delete (globalThis as any).window;
    }
  }
});

test('theme management: applyThemeToDocument manipulates classList and style', () => {
  const classListSet = new Set<string>();
  const styleObj: Record<string, string> = {};
  let metaContent = '';

  const mockElement = {
    classList: {
      add: (cls: string) => classListSet.add(cls),
      remove: (cls: string) => classListSet.delete(cls),
      contains: (cls: string) => classListSet.has(cls),
    },
    style: styleObj,
  };

  const mockMeta = {
    setAttribute: (attr: string, val: string) => {
      if (attr === 'content') metaContent = val;
    },
  };

  const originalDocument = globalThis.document;

  try {
    (globalThis as any).document = {
      documentElement: mockElement,
      querySelector: (selector: string) => {
        if (selector === 'meta[name="theme-color"]') return mockMeta;
        return null;
      },
    };

    // Apply dark
    applyThemeToDocument('dark');
    assert.ok(mockElement.classList.contains('dark'), 'dark class must be added in dark mode');
    assert.equal(mockElement.style.colorScheme, 'dark');
    assert.equal(metaContent, '#0c0a09');

    // Apply light
    applyThemeToDocument('light');
    assert.ok(!mockElement.classList.contains('dark'), 'dark class must be removed in light mode');
    assert.equal(mockElement.style.colorScheme, 'light');
    assert.equal(metaContent, '#fafaf9');
  } finally {
    if (originalDocument !== undefined) {
      globalThis.document = originalDocument;
    } else {
      delete (globalThis as any).document;
    }
  }
});

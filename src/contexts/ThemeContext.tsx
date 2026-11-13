/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FLOWTYM RMS — SYSTÈME CENTRALISÉ DE THÈME (LIGHT / DARK / SYSTEM)
 * Gère les design tokens, la persistance utilisateur, l'écoute système
 * et la transition fluide sans flash au chargement.
 */

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'flowtym_theme_mode_v1';

export interface ChartThemeTokens {
  isDark: boolean;
  gridStroke: string;
  axisTickColor: string;
  axisLineColor: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  tooltipMutedText: string;
  cursorFill: string;
  referenceLineColor: string;
  barNeutralFill: string;
  surfaceCardBg: string;
}

interface ThemeContextValue {
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  isDark: boolean;
  systemPrefersDark: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  chartTokens: ChartThemeTokens;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function getStoredThemeMode(): ThemeMode {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') {
      return raw;
    }
  } catch {
    // Ignore storage access failures
  }
  return 'light';
}

export function resolveTheme(mode: ThemeMode, systemPrefersDark: boolean): ResolvedTheme {
  if (mode === 'system') {
    return systemPrefersDark ? 'dark' : 'light';
  }
  return mode;
}

function applyThemeToDocument(resolved: ResolvedTheme, animate: boolean) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  if (animate) {
    root.classList.add('theme-transitioning');
    window.setTimeout(() => {
      root.classList.remove('theme-transitioning');
    }, 260);
  }

  root.classList.toggle('dark', resolved === 'dark');
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => getStoredThemeMode());
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => getSystemPrefersDark());

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const resolvedTheme = useMemo(
    () => resolveTheme(themeMode, systemPrefersDark),
    [themeMode, systemPrefersDark]
  );

  // Sync DOM without flash on initial mount
  useEffect(() => {
    applyThemeToDocument(resolvedTheme, false);
  }, [resolvedTheme]);

  const setThemeMode = useCallback(
    (nextMode: ThemeMode) => {
      const nextResolved = resolveTheme(nextMode, getSystemPrefersDark());
      applyThemeToDocument(nextResolved, true);
      setThemeModeState(nextMode);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, nextMode);
      } catch {
        // Ignore storage errors
      }
    },
    []
  );

  const toggleTheme = useCallback(() => {
    const nextMode: ThemeMode = resolvedTheme === 'dark' ? 'light' : 'dark';
    setThemeMode(nextMode);
  }, [resolvedTheme, setThemeMode]);

  const chartTokens = useMemo<ChartThemeTokens>(() => {
    const isDark = resolvedTheme === 'dark';
    return {
      isDark,
      gridStroke: isDark ? '#283145' : '#e2e8f0',
      axisTickColor: isDark ? '#98a6bd' : '#64748b',
      axisLineColor: isDark ? '#333f57' : '#cbd5e1',
      tooltipBg: isDark ? '#1c2334' : '#0f172a',
      tooltipBorder: isDark ? '#323d56' : '#1e293b',
      tooltipText: isDark ? '#e4e9f2' : '#f8fafc',
      tooltipMutedText: isDark ? '#98a6bd' : '#94a3b8',
      cursorFill: isDark ? 'rgba(139, 110, 243, 0.10)' : 'rgba(124, 58, 237, 0.06)',
      referenceLineColor: isDark ? '#e06c88' : '#e11d48',
      barNeutralFill: isDark ? '#64748b' : '#54657e',
      surfaceCardBg: isDark ? '#1c2231' : '#ffffff',
    };
  }, [resolvedTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeMode,
      resolvedTheme,
      isDark: resolvedTheme === 'dark',
      systemPrefersDark,
      setThemeMode,
      toggleTheme,
      chartTokens,
    }),
    [themeMode, resolvedTheme, systemPrefersDark, setThemeMode, toggleTheme, chartTokens]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Graceful fallback if ever called outside ThemeProvider
    return {
      themeMode: 'light',
      resolvedTheme: 'light',
      isDark: false,
      systemPrefersDark: false,
      setThemeMode: () => {},
      toggleTheme: () => {},
      chartTokens: {
        isDark: false,
        gridStroke: '#e2e8f0',
        axisTickColor: '#64748b',
        axisLineColor: '#cbd5e1',
        tooltipBg: '#0f172a',
        tooltipBorder: '#1e293b',
        tooltipText: '#f8fafc',
        tooltipMutedText: '#94a3b8',
        cursorFill: 'rgba(124, 58, 237, 0.06)',
        referenceLineColor: '#e11d48',
        barNeutralFill: '#54657e',
        surfaceCardBg: '#ffffff',
      },
    };
  }
  return ctx;
}

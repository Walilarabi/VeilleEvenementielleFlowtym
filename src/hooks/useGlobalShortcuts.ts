/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * HOOK GLOBAL DE GESTION DES RACCOURCIS CLAVIER RM
 * Supporte Ctrl (Windows/Linux) et Meta/Cmd (Mac) pour navigation rapide et recherche
 */

import { useEffect } from 'react';
import { NavTab } from '../components/layout/Sidebar';

export interface UseGlobalShortcutsOptions {
  activeTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
  onOpenCommandPalette: () => void;
  onOpenShortcutsHelp: () => void;
  onToggleFullscreen: () => void;
  onToggleSidebar?: () => void;
  onShowToast?: (msg: string) => void;
}

export function useGlobalShortcuts({
  activeTab,
  onChangeTab,
  onOpenCommandPalette,
  onOpenShortcutsHelp,
  onToggleFullscreen,
  onToggleSidebar,
  onShowToast,
}: UseGlobalShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const isModifierPressed = isMac ? e.metaKey : e.ctrlKey;
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      // 1. Global Search / Command Palette: Ctrl+K or Cmd+K
      if (isModifierPressed && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        onOpenCommandPalette();
        return;
      }

      // 2. Open Shortcuts Cheat Sheet: '?' key when not in an input, or Ctrl+/
      if ((!isInput && e.key === '?') || (isModifierPressed && e.key === '/')) {
        e.preventDefault();
        onOpenShortcutsHelp();
        return;
      }

      // 3. Toggle Fullscreen: Ctrl+Shift+F or Cmd+Shift+F
      if (isModifierPressed && e.shiftKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        onToggleFullscreen();
        return;
      }

      // 4. Toggle Sidebar: Ctrl+B or Cmd+B
      if (isModifierPressed && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        if (onToggleSidebar) onToggleSidebar();
        return;
      }

      // If user is currently typing in an input field, do not capture navigation number keys
      if (isInput) return;

      // 5. Quick Tab Switchers: Ctrl+1 through Ctrl+9
      if (isModifierPressed && !e.shiftKey && !e.altKey) {
        switch (e.key) {
          case '1':
            e.preventDefault();
            onChangeTab('flowboard');
            onShowToast?.('Raccourci Ctrl+1 : Flowboard Exécutif');
            break;
          case '2':
            e.preventDefault();
            onChangeTab('calendar');
            onShowToast?.('Raccourci Ctrl+2 : Calendrier Événementiel');
            break;
          case '3':
            e.preventDefault();
            onChangeTab('pricing');
            onShowToast?.('Raccourci Ctrl+3 : Pricing Intelligence & Recommandations');
            break;
          case '4':
            e.preventDefault();
            onChangeTab('opportunities');
            onShowToast?.('Raccourci Ctrl+4 : Opportunités & Centre RM');
            break;
          case '5':
            e.preventDefault();
            onChangeTab('reports');
            onShowToast?.('Raccourci Ctrl+5 : Rapports Propriétaires, Slack & Excel');
            break;
          case '6':
            e.preventDefault();
            onChangeTab('explorer');
            onShowToast?.('Raccourci Ctrl+6 : Explorer les Événements');
            break;
          case '7':
            e.preventDefault();
            onChangeTab('geo');
            onShowToast?.('Raccourci Ctrl+7 : Veille Géographique');
            break;
          case '8':
            e.preventDefault();
            onChangeTab('market');
            onShowToast?.('Raccourci Ctrl+8 : Analyse du Marché & Tensions');
            break;
          case '9':
            e.preventDefault();
            onChangeTab('connectivity');
            onShowToast?.('Raccourci Ctrl+9 : Connectivité PMS, CRS & API');
            break;
          case '0':
            e.preventDefault();
            onChangeTab('settings');
            onShowToast?.('Raccourci Ctrl+0 : Paramètres');
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeTab,
    onChangeTab,
    onOpenCommandPalette,
    onOpenShortcutsHelp,
    onToggleFullscreen,
    onToggleSidebar,
    onShowToast,
  ]);
}

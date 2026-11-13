/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MODAL FICHE SYNTHÉTIQUE DES RACCOURCIS CLAVIER (AIDE PRODUCTIVITÉ RM)
 */

import React from 'react';
import { Keyboard, X, Sparkles, Command, ArrowRight } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
  category: string;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const shortcuts: ShortcutItem[] = [
    // Navigation
    { category: 'Navigation Principale', keys: ['Ctrl', '1'], description: 'Ouvrir le Flowboard (Vue exécutive RM)' },
    { category: 'Navigation Principale', keys: ['Ctrl', '2'], description: 'Ouvrir le Calendrier Événementiel' },
    { category: 'Navigation Principale', keys: ['Ctrl', '3'], description: 'Ouvrir Pricing Intelligence & Recommandations' },
    { category: 'Navigation Principale', keys: ['Ctrl', '4'], description: 'Ouvrir Opportunités & Centre de Décision RM' },
    { category: 'Navigation Principale', keys: ['Ctrl', '5'], description: 'Ouvrir Rapports Propriétaires, Slack & Excel' },
    { category: 'Navigation Principale', keys: ['Ctrl', '6'], description: 'Ouvrir la Recherche & Exploration d\'événements' },

    // Productivité
    { category: 'Recherche & Productivité', keys: ['Ctrl', 'K'], description: 'Ouvrir la Palette de commandes / Recherche rapide' },
    { category: 'Recherche & Productivité', keys: ['?'], description: 'Afficher cette fiche d\'aide aux raccourcis clavier' },
    { category: 'Recherche & Productivité', keys: ['Ctrl', 'Shift', 'F'], description: 'Activer / Quitter le mode plein écran (Fullscreen)' },
    { category: 'Recherche & Productivité', keys: ['Ctrl', 'B'], description: 'Réduire ou déployer le menu latéral gauche' },
    { category: 'Recherche & Productivité', keys: ['Échap'], description: 'Fermer la modal ou le tiroir contextuel ouvert' },
  ];

  const categories = Array.from(new Set(shortcuts.map((s) => s.category)));

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-xl w-full overflow-hidden flex flex-col animate-in zoom-in-95"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-violet-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-amber-300">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Raccourcis Clavier Revenue Management</h3>
              <p className="text-xs text-violet-200">
                Navigation rapide et productivité accélérée (supporte Ctrl et Cmd/⌘ sur Mac)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Shortcuts Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {categories.map((cat) => (
            <div key={cat} className="space-y-2.5">
              <h4 className="text-xs font-bold text-violet-700 dark:text-violet-300 uppercase tracking-wider">
                {cat}
              </h4>
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-2 divide-y divide-slate-200/60 dark:divide-slate-800/70">
                {shortcuts
                  .filter((s) => s.category === cat)
                  .map((s, idx) => (
                    <div
                      key={idx}
                      className="py-2.5 px-3 flex items-center justify-between gap-4 text-xs"
                    >
                      <span className="text-slate-700 dark:text-slate-300 font-medium">{s.description}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {s.keys.map((k, i) => (
                          <React.Fragment key={i}>
                            <kbd className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg shadow-2xs font-mono font-bold text-[11px] text-slate-800 dark:text-slate-200">
                              {k}
                            </kbd>
                            {i < s.keys.length - 1 && (
                              <span className="text-slate-400 font-bold">+</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Conseil : appuyez sur <strong>?</strong> à tout moment pour rouvrir cette aide</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Compris
          </button>
        </div>
      </div>
    </div>
  );
};

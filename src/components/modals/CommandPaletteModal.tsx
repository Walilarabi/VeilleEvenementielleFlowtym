/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PALETTE DE COMMANDES & RECHERCHE GLOBALE (CTRL+K / CMD+K)
 * Permet aux Revenue Managers de basculer instantanément entre les vues, événements et actions clés
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  LayoutDashboard,
  Calendar,
  DollarSign,
  AlertTriangle,
  FileText,
  FileSpreadsheet,
  Maximize2,
  Minimize2,
  Sparkles,
  Zap,
  ArrowRight,
  TrendingUp,
  Sliders,
  X,
  Keyboard,
  Clock,
  Compass,
  MapPin,
  Radio,
} from 'lucide-react';
import { NavTab } from '../layout/Sidebar';
import { EventItem } from '../../types';

export interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tab: NavTab) => void;
  onSelectEvent?: (event: EventItem) => void;
  events?: EventItem[];
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
  onExportExcel: () => void;
  onOpenShortcutsHelp: () => void;
}

interface PaletteAction {
  id: string;
  category: 'Modules RM' | 'Événements Majeurs' | 'Actions Rapides';
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  run: () => void;
  badge?: string;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  onSelectTab,
  onSelectEvent,
  events = [],
  onToggleFullscreen,
  isFullscreen,
  onExportExcel,
  onOpenShortcutsHelp,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Actions catalogue
  const actions: PaletteAction[] = [
    // 1. Navigation Modules
    {
      id: 'tab-flowboard',
      category: 'Modules RM',
      title: 'Flowboard Exécutif RM',
      subtitle: 'Tableau de bord synthétique, signaux marché et radar D3',
      icon: LayoutDashboard,
      shortcut: 'Ctrl+1',
      run: () => {
        onSelectTab('flowboard');
        onClose();
      },
    },
    {
      id: 'tab-calendar',
      category: 'Modules RM',
      title: 'Calendrier Événementiel',
      subtitle: 'Planning mensuel des événements & vacances scolaires',
      icon: Calendar,
      shortcut: 'Ctrl+2',
      run: () => {
        onSelectTab('calendar');
        onClose();
      },
    },
    {
      id: 'tab-pricing',
      category: 'Modules RM',
      title: 'Pricing Intelligence & Recommandations',
      subtitle: 'Tableau de pilotage tarifaire 21 colonnes, compset Lighthouse & D-EDGE',
      icon: DollarSign,
      shortcut: 'Ctrl+3',
      run: () => {
        onSelectTab('pricing');
        onClose();
      },
      badge: 'Recommandé',
    },
    {
      id: 'tab-lighthouse-veille',
      category: 'Modules RM',
      title: 'Veille Concurrentielle Lighthouse (5 onglets)',
      subtitle: 'Demande marché, tarifs compset, évolutions J-1/J-3/J-7 et export XLSX',
      icon: TrendingUp,
      run: () => {
        onSelectTab('pricing');
        onClose();
      },
      badge: 'Lighthouse',
    },
    {
      id: 'tab-opportunities',
      category: 'Modules RM',
      title: 'Opportunités & Centre de Décision RM',
      subtitle: 'Détection des sous-tarifications, alertes bornes de sécurité et arbitrage',
      icon: AlertTriangle,
      shortcut: 'Ctrl+4',
      run: () => {
        onSelectTab('opportunities');
        onClose();
      },
    },
    {
      id: 'tab-reports',
      category: 'Modules RM',
      title: 'Rapport Propriétaires & Automatisations',
      subtitle: 'Rapport mensuel de gestion, comparatif prévisions par typologie, alertes Slack',
      icon: FileText,
      shortcut: 'Ctrl+5',
      run: () => {
        onSelectTab('reports');
        onClose();
      },
      badge: 'Nouveau',
    },
    {
      id: 'tab-explorer',
      category: 'Modules RM',
      title: 'Explorer les Événements',
      subtitle: 'Recherche multi-critères et filtres géographiques',
      icon: Compass,
      shortcut: 'Ctrl+6',
      run: () => {
        onSelectTab('explorer');
        onClose();
      },
    },
    {
      id: 'tab-geo',
      category: 'Modules RM',
      title: 'Veille Géographique',
      subtitle: 'Cartographie des périmètres 10/30 km et lieux stratégiques',
      icon: MapPin,
      shortcut: 'Ctrl+7',
      run: () => {
        onSelectTab('geo');
        onClose();
      },
    },
    {
      id: 'tab-market',
      category: 'Modules RM',
      title: 'Analyse du Marché & Tensions',
      subtitle: 'Courbes de prix compset et calendrier de vacances multi-pays',
      icon: TrendingUp,
      shortcut: 'Ctrl+8',
      run: () => {
        onSelectTab('market');
        onClose();
      },
    },
    {
      id: 'tab-connectivity',
      category: 'Modules RM',
      title: 'Connectivité PMS, CRS & API',
      subtitle: 'Flux temps réel Lighthouse et D-EDGE CRS',
      icon: Radio,
      shortcut: 'Ctrl+9',
      run: () => {
        onSelectTab('connectivity');
        onClose();
      },
    },

    // 2. Quick Actions
    {
      id: 'act-fullscreen',
      category: 'Actions Rapides',
      title: isFullscreen ? 'Quitter le mode plein écran' : 'Passer en mode plein écran',
      subtitle: 'Maximiser l’espace de travail sur les grilles et graphiques',
      icon: isFullscreen ? Minimize2 : Maximize2,
      shortcut: 'Ctrl+Shift+F',
      run: () => {
        onToggleFullscreen();
        onClose();
      },
    },
    {
      id: 'act-export-excel',
      category: 'Actions Rapides',
      title: 'Télécharger l’historique complet des prix & occupation (Excel)',
      subtitle: 'Export universel .csv UTF-8 avec 24 colonnes pour travail hors ligne',
      icon: FileSpreadsheet,
      run: () => {
        onExportExcel();
        onClose();
      },
      badge: 'Excel',
    },
    {
      id: 'act-shortcuts-help',
      category: 'Actions Rapides',
      title: 'Aide & guide des raccourcis clavier RM',
      subtitle: 'Afficher la fiche synthétique des raccourcis de productivité',
      icon: Keyboard,
      shortcut: '?',
      run: () => {
        onClose();
        onOpenShortcutsHelp();
      },
    },
  ];

  // Add major events dynamically
  events.slice(0, 8).forEach((ev) => {
    actions.push({
      id: `ev-${ev.id}`,
      category: 'Événements Majeurs',
      title: ev.title,
      subtitle: `${ev.startDate} · ${ev.venueName} · Score RM: ${ev.scoreBreakdown.finalRMScore}/100`,
      icon: Zap,
      badge: ev.impactLevel.toUpperCase(),
      run: () => {
        if (onSelectEvent) onSelectEvent(ev);
        onClose();
      },
    });
  });

  // Filter actions based on query
  const filteredActions = actions.filter((act) => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return (
      act.title.toLowerCase().includes(q) ||
      act.subtitle.toLowerCase().includes(q) ||
      act.category.toLowerCase().includes(q)
    );
  });

  // Keyboard navigation inside palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredActions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredActions.length) % filteredActions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const action = filteredActions[selectedIndex];
      if (action) action.run();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 sm:pt-20 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
      >
        {/* Search Header Input */}
        <div className="relative flex items-center px-4 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <Search className="w-5 h-5 text-violet-600 dark:text-violet-400 mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Tapez une commande, un module ou un événement... (ex: Pricing, SIAL, Excel, Ctrl+1)"
            className="w-full bg-transparent text-sm font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="hidden sm:inline-flex items-center text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-800 ml-2 shrink-0">
            ÉCHAP
          </span>
        </div>

        {/* Action Items List */}
        <div className="max-h-[60vh] overflow-y-auto p-2 divide-y divide-slate-100 dark:divide-slate-800/80">
          {filteredActions.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
              Aucun résultat pour &laquo; <strong>{query}</strong> &raquo;
            </div>
          ) : (
            filteredActions.map((action, index) => {
              const isSelected = index === selectedIndex;
              const Icon = action.icon;

              return (
                <div
                  key={action.id}
                  onClick={action.run}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`p-3 rounded-2xl flex items-center justify-between gap-3 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-violet-600 text-white shadow-xs'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-violet-700 dark:text-violet-300'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs truncate">
                          {action.title}
                        </span>
                        {action.badge && (
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                              isSelected
                                ? 'bg-white/20 text-white'
                                : 'bg-violet-100 dark:bg-violet-900/40 text-violet-800 dark:text-violet-300'
                            }`}
                          >
                            {action.badge}
                          </span>
                        )}
                      </div>
                      <p
                        className={`text-[11px] truncate mt-0.5 ${
                          isSelected ? 'text-violet-100' : 'text-slate-400'
                        }`}
                      >
                        {action.subtitle}
                      </p>
                    </div>
                  </div>

                  {action.shortcut && (
                    <kbd
                      className={`hidden sm:inline-flex px-2 py-1 text-[10px] font-mono font-bold rounded shadow-2xs border ${
                        isSelected
                          ? 'bg-white/20 text-white border-white/30'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      {action.shortcut}
                    </kbd>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Hints */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span>↑↓ pour naviguer</span>
            <span>↵ pour sélectionner</span>
            <span>Échap pour quitter</span>
          </div>
          <span className="text-violet-700 dark:text-violet-300 font-semibold hidden sm:inline">
            Flowtym Command Palette
          </span>
        </div>
      </div>
    </div>
  );
};

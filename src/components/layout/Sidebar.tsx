import React from 'react';
import {
  LayoutDashboard,
  Calendar,
  Compass,
  MapPin,
  TrendingUp,
  Repeat,
  AlertTriangle,
  Database,
  Sliders,
  Flame,
  Radio,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  PanelLeft,
  EyeOff,
  Maximize2,
  FileText,
} from 'lucide-react';

export type NavTab =
  | 'flowboard'
  | 'calendar'
  | 'explorer'
  | 'geo'
  | 'market'
  | 'pricing'
  | 'intelligence'
  | 'opportunities'
  | 'reports'
  | 'sources'
  | 'connectivity'
  | 'settings';

export type SidebarMode = 'full' | 'compact' | 'hidden';

export interface SidebarProps {
  activeTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
  pendingSuggestionsCount: number;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  mode?: SidebarMode;
  onModeChange?: (mode: SidebarMode) => void;
}

interface NavItemConfig {
  id: NavTab;
  label: string;
  subtitle: string;
  fullDescription: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  shortcut?: string;
}

interface NavSectionConfig {
  title: string;
  items: NavItemConfig[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onChangeTab,
  pendingSuggestionsCount,
  isMobileOpen = false,
  onCloseMobile,
  mode = 'full',
  onModeChange,
}) => {
  const sections: NavSectionConfig[] = [
    {
      title: 'PILOTAGE',
      items: [
        {
          id: 'flowboard',
          label: 'Flowboard',
          subtitle: 'Vue exécutive RM',
          fullDescription: 'Vue exécutive RM',
          icon: LayoutDashboard,
          shortcut: 'Ctrl+1',
        },
        {
          id: 'calendar',
          label: 'Calendrier événementiel',
          subtitle: 'Planning et tableau RM',
          fullDescription: 'Planning et tableau RM — Entrée principale de la veille événementielle',
          icon: Calendar,
          shortcut: 'Ctrl+2',
        },
        {
          id: 'explorer',
          label: 'Explorer les événements',
          subtitle: 'Recherche multi-villes et exploration',
          fullDescription: 'Recherche multi-villes et exploration',
          icon: Compass,
          shortcut: 'Ctrl+6',
        },
        {
          id: 'geo',
          label: 'Veille géographique',
          subtitle: 'Périmètres 10/30 km et lieux stratégiques',
          fullDescription: 'Périmètres 10/30 km et lieux stratégiques',
          icon: MapPin,
          shortcut: 'Ctrl+7',
        },
      ],
    },
    {
      title: 'ANALYSE & REVENUE MANAGEMENT',
      items: [
        {
          id: 'market',
          label: 'Analyse du marché',
          subtitle: 'Tension, prix & vacances scolaires',
          fullDescription: 'Tension de la demande, prix, compression et impact historique des vacances scolaires par segment',
          icon: TrendingUp,
          shortcut: 'Ctrl+8',
        },
        {
          id: 'pricing',
          label: 'Pricing Intelligence',
          subtitle: 'Positionnement & recommandations',
          fullDescription: 'Analyse concurrentielle, positionnement tarifaire et recommandations de prix.',
          icon: DollarSign,
          badge: 'Position Compset',
          shortcut: 'Ctrl+3',
        },
        {
          id: 'intelligence',
          label: 'Analyses & récurrences',
          subtitle: 'Événements récurrents & validation',
          fullDescription: 'Événements récurrents, tendances, historique, validation et règles de récurrence',
          icon: Repeat,
          badge: pendingSuggestionsCount > 0 ? `${pendingSuggestionsCount} à valider` : undefined,
        },
        {
          id: 'opportunities',
          label: 'Opportunités & alertes RM',
          subtitle: 'Sous-tarification, alertes & reco RM',
          fullDescription: 'Risques de sous-tarification, opportunités tarifaires, alertes de compression et recommandations RM',
          icon: AlertTriangle,
          shortcut: 'Ctrl+4',
        },
        {
          id: 'reports',
          label: 'Rapports & Gestion',
          subtitle: 'Propriétaires, Slack & Excel',
          fullDescription: 'Rapport mensuel propriétaires, comparatif prévisions vs réel par typologie, alertes Slack parité et export Excel',
          icon: FileText,
          badge: 'Propriétaires & IA',
          shortcut: 'Ctrl+5',
        },
      ],
    },
    {
      title: 'ADMINISTRATION & DONNÉES',
      items: [
        {
          id: 'sources',
          label: 'Sources & couverture',
          subtitle: 'Sources de données, audit & ingestion',
          fullDescription: 'Sources de données, couverture géographique, fiabilité, audit et ingestion',
          icon: Database,
        },
        {
          id: 'connectivity',
          label: 'Connectivité & API',
          subtitle: 'Lighthouse & D-EDGE CRS',
          fullDescription: 'Intégration temps réel Lighthouse Rate Insight et D-EDGE Central Reservation System',
          icon: Radio,
          shortcut: 'Ctrl+9',
        },
        {
          id: 'settings',
          label: 'Paramètres',
          subtitle: 'Hôtels, Supabase & préférences',
          fullDescription: 'Configuration des hôtels, paramètres Supabase et préférences générales',
          icon: Sliders,
        },
      ],
    },
  ];

  const isCompact = mode === 'compact';

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 top-[60px] bg-slate-900/30 backdrop-blur-2xs z-30 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Fixed Sticky Sidebar: constantly visible on desktop, zero scroll shift */}
      <aside
        style={{ position: 'fixed' }}
        className={`fixed left-0 top-[60px] bottom-0 h-[calc(100vh-60px)] lg:h-[calc(100dvh-60px)] max-h-screen bg-white border-r border-slate-200/90 flex flex-col justify-between z-30 transition-all duration-300 ease-in-out ${
          isMobileOpen
            ? 'translate-x-0 w-64 shadow-2xl z-40'
            : mode === 'hidden'
            ? '-translate-x-full w-64'
            : isCompact
            ? 'translate-x-0 w-[72px]'
            : 'translate-x-0 w-64'
        }`}
      >
        {/* Header du Sidebar avec icône de repli / dépliage / masquage */}
        <div
          className={`h-11 border-b border-slate-100/90 shrink-0 bg-slate-50/60 flex items-center transition-all ${
            isCompact ? 'justify-center px-1' : 'justify-between px-3.5'
          }`}
        >
          {!isCompact ? (
            <>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <PanelLeft className="w-3.5 h-3.5 text-violet-600" />
                <span>Navigation</span>
              </span>

              <div className="flex items-center gap-1">
                {/* Bouton Réduire en mode compact (icônes seules) */}
                <button
                  type="button"
                  onClick={() => onModeChange?.('compact')}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-white border border-transparent hover:border-slate-200 transition-all cursor-pointer flex items-center gap-1 text-[11px]"
                  title="Réduire le menu en mode compact (icônes uniquement)"
                  aria-label="Réduire le menu en mode compact"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-500" />
                </button>

                {/* Bouton Masquer complètement (Plein écran) */}
                <button
                  type="button"
                  onClick={() => onModeChange?.('hidden')}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all cursor-pointer"
                  title="Masquer complètement le menu latéral pour maximiser l'espace d'affichage"
                  aria-label="Masquer complètement le menu latéral"
                >
                  <EyeOff className="w-3.5 h-3.5 text-slate-400 hover:text-rose-600" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-1">
              {/* Bouton Déployer le menu complet */}
              <button
                type="button"
                onClick={() => onModeChange?.('full')}
                className="p-1.5 rounded-lg text-slate-600 hover:text-violet-700 hover:bg-white border border-transparent hover:border-slate-200 transition-all cursor-pointer"
                title="Déployer le menu latéral complet"
                aria-label="Déployer le menu latéral complet"
              >
                <ChevronRight className="w-4 h-4 text-violet-600" />
              </button>

              {/* Bouton Masquer complètement */}
              <button
                type="button"
                onClick={() => onModeChange?.('hidden')}
                className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                title="Masquer complètement le menu"
                aria-label="Masquer le menu"
              >
                <EyeOff className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Scrollable menu navigation independent of main page */}
        {isCompact ? (
          /* MODE COMPACT : ICÔNES UNIQUEMENT AVEC TOOLTIPS ÉLÉGANTS */
          <div className="py-3 px-2 space-y-4 overflow-y-auto overflow-x-hidden flex-1 flex flex-col items-center">
            {sections.map((section, sIdx) => (
              <div
                key={section.title}
                className={`w-full flex flex-col items-center space-y-1.5 ${
                  sIdx > 0 ? 'pt-2.5 border-t border-slate-100' : ''
                }`}
              >
                {/* Separateur discret */}
                <div
                  className="w-4 h-0.5 bg-slate-200 rounded-full my-0.5 opacity-60"
                  title={section.title}
                />

                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <div key={item.id} className="relative group/tooltip flex justify-center w-full">
                      <button
                        type="button"
                        onClick={() => {
                          onChangeTab(item.id);
                          if (onCloseMobile) onCloseMobile();
                        }}
                        aria-label={item.label}
                        className={`w-11 h-11 flex items-center justify-center rounded-xl transition-all cursor-pointer relative ${
                          isActive
                            ? 'bg-violet-600 text-white shadow-sm ring-2 ring-violet-300'
                            : 'text-slate-500 hover:text-violet-700 hover:bg-violet-50/80'
                        }`}
                      >
                        <Icon
                          className={`w-5 h-5 transition-transform group-hover/tooltip:scale-110 ${
                            isActive ? 'text-white' : ''
                          }`}
                        />

                        {/* Badge dot ou compteur compact */}
                        {item.badge && (
                          <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center ring-2 ring-white shadow-2xs">
                            {item.badge.includes('à valider') ? item.badge.split(' ')[0] : '•'}
                          </span>
                        )}
                      </button>

                      {/* Tooltip flottant au survol vers la droite */}
                      <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 invisible opacity-0 group-hover/tooltip:visible group-hover/tooltip:opacity-100 transition-all duration-150 pointer-events-none whitespace-nowrap">
                        <div className="bg-slate-900/95 backdrop-blur-xs text-white px-3.5 py-2.5 rounded-xl shadow-xl border border-slate-700/80 space-y-0.5 min-w-[190px] max-w-[280px] relative text-left">
                          {/* Triangle flèche */}
                          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900/95" />

                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-xs text-white tracking-wide">{item.label}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {item.shortcut && (
                                <kbd className="text-[9px] font-mono bg-slate-800 text-violet-300 border border-slate-700 px-1.5 py-0.5 rounded font-bold shadow-2xs">
                                  {item.shortcut}
                                </kbd>
                              )}
                              {item.badge && (
                                <span className="text-[9px] font-black bg-violet-500 text-white px-1.5 py-0.2 rounded-full whitespace-nowrap">
                                  {item.badge}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-[10px] text-slate-300 leading-snug font-normal">
                            {item.subtitle}
                          </div>
                          <div className="text-[9px] text-violet-300 font-semibold uppercase tracking-wider pt-1 border-t border-slate-800">
                            {section.title}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
          /* MODE DÉPLOYÉ COMPLET : INTITULÉS ET DESCRIPTIONS */
          <div className="p-3.5 space-y-3 overflow-y-auto flex-1">
            {sections.map((section, sIdx) => (
              <div key={section.title} className={sIdx > 0 ? 'pt-2 border-t border-slate-100/90' : ''}>
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {section.title}
                </div>
                <div className="space-y-0.5 mt-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          onChangeTab(item.id);
                          if (onCloseMobile) onCloseMobile();
                        }}
                        title={item.fullDescription}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-all cursor-pointer group ${
                          isActive
                            ? 'bg-violet-50 text-violet-700 font-semibold shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-1">
                          <Icon
                            className={`w-4 h-4 shrink-0 transition-colors ${
                              isActive ? 'text-violet-600' : 'text-slate-400 group-hover:text-slate-600'
                            }`}
                          />
                          <div className="min-w-0">
                            <div className="leading-tight truncate">{item.label}</div>
                            <div
                              className={`text-[10px] leading-tight mt-0.5 truncate ${
                                isActive ? 'text-violet-600/80 font-medium' : 'text-slate-400 font-normal'
                              }`}
                            >
                              {item.subtitle}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-1.5">
                          {item.shortcut && (
                            <kbd className="hidden group-hover:inline-block text-[9px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              {item.shortcut}
                            </kbd>
                          )}
                          {item.badge && (
                            <span className="text-[10px] font-semibold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full whitespace-nowrap shadow-2xs">
                              {item.badge}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* RM Market Pressure Widget in Sidebar footer */}
        {isCompact ? (
          <div className="p-2 border-t border-slate-100 shrink-0 bg-white flex justify-center relative group/rmwidget">
            <button
              type="button"
              onClick={() => {
                onChangeTab('market');
                if (onCloseMobile) onCloseMobile();
              }}
              className="w-11 h-11 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 flex flex-col items-center justify-center border border-violet-200/80 transition-all cursor-pointer relative"
              aria-label="Pression Marché RM 82%"
            >
              <Flame className="w-4 h-4 text-violet-600 animate-pulse" />
              <span className="text-[9px] font-black text-violet-800 leading-none mt-0.5">82%</span>
            </button>

            {/* Tooltip for RM Widget */}
            <div className="absolute left-full ml-3 bottom-2 z-50 invisible opacity-0 group-hover/rmwidget:visible group-hover/rmwidget:opacity-100 transition-all duration-150 pointer-events-none whitespace-nowrap">
              <div className="bg-slate-900/95 backdrop-blur-xs text-white px-3.5 py-2.5 rounded-xl shadow-xl border border-slate-700/80 space-y-0.5 relative text-left">
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900/95" />
                <div className="font-bold text-xs text-white flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <span>Pression RM Marché : Élevée (82%)</span>
                </div>
                <div className="text-[10px] text-slate-300">
                  Cliquer pour ouvrir l'analyse du marché
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3.5 border-t border-slate-100 shrink-0 bg-white">
            <button
              type="button"
              onClick={() => {
                onChangeTab('market');
                if (onCloseMobile) onCloseMobile();
              }}
              className="w-full text-left bg-slate-50 hover:bg-violet-50/70 rounded-xl p-3 border border-slate-200/70 hover:border-violet-200 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between text-xs text-slate-700 font-medium mb-1.5">
                <span className="flex items-center gap-1.5 group-hover:text-violet-700">
                  <Flame className="w-3.5 h-3.5 text-violet-600" />
                  Pression RM Marché
                </span>
                <span className="font-bold text-violet-700 tabular-nums">Élevée →</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                <div className="bg-violet-600 h-1.5 rounded-full w-[82%]" />
              </div>
              <p className="text-[10px] text-slate-500 mt-2 leading-relaxed group-hover:text-slate-700">
                Voir le calendrier des dates sous tension dans Analyse du marché.
              </p>
            </button>
          </div>
        )}
      </aside>
    </>
  );
};


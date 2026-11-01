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
} from 'lucide-react';

export type NavTab =
  | 'flowboard'
  | 'calendar'
  | 'explorer'
  | 'geo'
  | 'market'
  | 'intelligence'
  | 'opportunities'
  | 'sources'
  | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
  pendingSuggestionsCount: number;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

interface NavItemConfig {
  id: NavTab;
  label: string;
  subtitle: string;
  fullDescription: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
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
        },
        {
          id: 'calendar',
          label: 'Calendrier événementiel',
          subtitle: 'Planning et tableau RM',
          fullDescription: 'Planning et tableau RM — Entrée principale de la veille événementielle',
          icon: Calendar,
        },
        {
          id: 'explorer',
          label: 'Explorer les événements',
          subtitle: 'Recherche multi-villes et exploration',
          fullDescription: 'Recherche multi-villes et exploration',
          icon: Compass,
        },
        {
          id: 'geo',
          label: 'Veille géographique',
          subtitle: 'Périmètres 10/30 km et lieux stratégiques',
          fullDescription: 'Périmètres 10/30 km et lieux stratégiques',
          icon: MapPin,
        },
      ],
    },
    {
      title: 'ANALYSE & REVENUE MANAGEMENT',
      items: [
        {
          id: 'market',
          label: 'Analyse du marché',
          subtitle: 'Tension de la demande, prix & compression',
          fullDescription: 'Tension de la demande, évolution des prix, périodes de forte demande et compression',
          icon: TrendingUp,
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
          id: 'settings',
          label: 'Paramètres',
          subtitle: 'Hôtels, Supabase & préférences',
          fullDescription: 'Configuration des hôtels, paramètres Supabase et préférences générales',
          icon: Sliders,
        },
      ],
    },
  ];

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
        className={`fixed left-0 top-[60px] bottom-0 w-64 h-[calc(100vh-60px)] lg:h-[calc(100dvh-60px)] max-h-screen bg-white border-r border-slate-200/90 flex flex-col justify-between z-30 overflow-y-auto transition-transform duration-200 ease-in-out ${
          isMobileOpen ? 'translate-x-0 shadow-2xl z-40' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Scrollable menu navigation independent of main page */}
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
                      {item.badge && (
                        <span className="text-[10px] font-semibold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap ml-1.5 shadow-2xs">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* RM Market Pressure Widget in Sidebar footer */}
        <div className="p-3.5 border-t border-slate-100 shrink-0 bg-white">
          <button
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
      </aside>
    </>
  );
};

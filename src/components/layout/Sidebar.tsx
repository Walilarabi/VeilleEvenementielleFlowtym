import React from 'react';
import {
  LayoutDashboard,
  Compass,
  Calendar,
  Sparkles,
  Database,
  Sliders,
  TrendingUp,
  Flame,
} from 'lucide-react';

export type NavTab =
  | 'flowboard'
  | 'market'
  | 'calendar'
  | 'explorer'
  | 'intelligence'
  | 'geo'
  | 'sources'
  | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
  pendingSuggestionsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onChangeTab,
  pendingSuggestionsCount,
}) => {
  const navItems = [
    {
      id: 'flowboard' as NavTab,
      label: 'Flowboard',
      subtitle: 'Vue exécutive RM',
      icon: LayoutDashboard,
    },
    {
      id: 'market' as NavTab,
      label: 'Marché',
      subtitle: 'Dates sous tension & Demande',
      icon: Flame,
    },
    {
      id: 'calendar' as NavTab,
      label: 'Calendrier',
      subtitle: 'Planning & Tableau RM',
      icon: Calendar,
    },
    {
      id: 'explorer' as NavTab,
      label: 'Explorer',
      subtitle: 'Recherche multi-villes',
      icon: Compass,
    },
    {
      id: 'intelligence' as NavTab,
      label: 'Event Intelligence',
      subtitle: 'Analyses & Récurrences',
      icon: Sparkles,
      badge: pendingSuggestionsCount > 0 ? `${pendingSuggestionsCount} à valider` : undefined,
    },
    {
      id: 'geo' as NavTab,
      label: 'Veille Géographique',
      subtitle: 'Périmètres 10/30 km & Lieux',
      icon: TrendingUp,
    },
    {
      id: 'sources' as NavTab,
      label: 'Sources & Couverture',
      subtitle: 'Audit & Ingestion',
      icon: Database,
    },
    {
      id: 'settings' as NavTab,
      label: 'Paramètres',
      subtitle: 'Hôtels & Supabase',
      icon: Sliders,
    },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200/90 flex flex-col justify-between shrink-0 h-[calc(100vh-57px)] sticky top-[57px]">
      <div className="p-4 space-y-1">
        <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Navigation Principale
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChangeTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs transition-all cursor-pointer ${
                isActive
                  ? 'bg-violet-50 text-violet-700 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? 'text-violet-600' : 'text-slate-400'
                  }`}
                />
                <div>
                  <div className="leading-tight">{item.label}</div>
                  <div className="text-[10px] text-slate-400 font-normal leading-tight mt-0.5">
                    {item.subtitle}
                  </div>
                </div>
              </div>
              {item.badge && (
                <span className="text-[10px] font-semibold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* RM Quick Status Widget in Sidebar footer */}
      <div className="p-4 border-t border-slate-100">
        <button
          onClick={() => onChangeTab('market')}
          className="w-full text-left bg-slate-50 hover:bg-violet-50/70 rounded-xl p-3 border border-slate-200/70 hover:border-violet-200 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-xs text-slate-700 font-medium mb-1.5">
            <span className="flex items-center gap-1.5 group-hover:text-violet-700">
              <TrendingUp className="w-3.5 h-3.5 text-violet-600" />
              Pression RM Marché
            </span>
            <span className="font-bold text-violet-700 tabular-nums">Élevée →</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
            <div className="bg-violet-600 h-1.5 rounded-full w-[82%]" />
          </div>
          <p className="text-[11px] text-slate-500 mt-2 leading-relaxed group-hover:text-slate-700">
            Voir le calendrier des dates sous tension dans l'onglet Marché.
          </p>
        </button>
      </div>
    </aside>
  );
};

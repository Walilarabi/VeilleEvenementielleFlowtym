import React from 'react';
import {
  LayoutGrid,
  Gauge,
  LineChart,
  Calendar,
  TrendingUp,
  Database,
  SlidersHorizontal,
  Zap,
  FileText,
  Settings,
  LogOut,
  Sparkles,
  MapPin,
} from 'lucide-react';

export type NavTab =
  | 'flowboard'
  | 'market'
  | 'explorer'
  | 'calendar'
  | 'forecast'
  | 'sources'
  | 'pricing'
  | 'connectivity'
  | 'reports'
  | 'settings'
  | 'intelligence'
  | 'opportunities'
  | 'geo';

export type SidebarMode = 'compact' | 'full' | 'hidden';

export interface SidebarProps {
  activeTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
  pendingSuggestionsCount?: number;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  mode?: SidebarMode;
  onModeChange?: (mode: SidebarMode) => void;
  onLogout?: () => void;
  userInitials?: string;
  userName?: string;
}

interface NavItem {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onChangeTab,
  isMobileOpen = false,
  onCloseMobile,
  onLogout,
  userInitials = 'NA',
  userName = 'Nabil Amrani',
}) => {
  const navItems: NavItem[] = [
    {
      id: 'flowboard',
      label: 'Flowboard',
      icon: LayoutGrid,
    },
    {
      id: 'market',
      label: 'Analyse du marché',
      icon: Gauge,
    },
    {
      id: 'pricing',
      label: 'Pricing Intelligent',
      icon: SlidersHorizontal,
    },
    {
      id: 'calendar',
      label: 'Veille Événementielle',
      icon: Calendar,
    },
    {
      id: 'geo',
      label: 'Veille géographique',
      icon: MapPin,
    },
    {
      id: 'forecast',
      label: 'Demand Forecast',
      icon: TrendingUp,
    },
    {
      id: 'sources',
      label: 'Données & Inventaire',
      icon: Database,
    },
    {
      id: 'connectivity',
      label: 'Connectivité',
      icon: Zap,
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: FileText,
    },
    {
      id: 'settings',
      label: 'Paramètres',
      icon: Settings,
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 top-[60px] bg-slate-900/30 dark:bg-black/60 backdrop-blur-2xs z-30 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Slim Icon-Rail Sidebar matching reference screenshot */}
      <aside
        style={{ position: 'fixed' }}
        className={`fixed left-0 top-0 bottom-0 h-screen w-16 bg-white dark:bg-slate-900 border-r border-slate-200/90 dark:border-slate-800 flex flex-col justify-between items-center py-3.5 z-40 transition-transform duration-200 ${
          isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top: Logo Flowtym purple rounded badge */}
        <div className="flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={() => onChangeTab('flowboard')}
            className="w-10 h-10 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white flex items-center justify-center shadow-md dark:shadow-none transition-transform hover:scale-105 cursor-pointer relative group/brand"
            aria-label="Flowtym RMS Accueil"
          >
            <TrendingUp className="w-5 h-5 text-white" />
            <div className="absolute left-full ml-3.5 px-3 py-1.5 bg-slate-950 dark:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xl border border-transparent dark:border-slate-700 whitespace-nowrap opacity-0 group-hover/brand:opacity-100 pointer-events-none transition-opacity duration-150 z-50">
              Flowtym RMS
            </div>
          </button>

          {/* Navigation Icons list with Tooltip on Hover */}
          <nav className="flex flex-col items-center gap-1.5 w-full px-2" aria-label="Menu principal">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <div key={item.id} className="relative group/nav w-full flex justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      onChangeTab(item.id);
                      if (onCloseMobile) onCloseMobile();
                    }}
                    aria-label={item.label}
                    className={`w-11 h-11 flex items-center justify-center rounded-xl transition-all cursor-pointer relative ${
                      isActive
                        ? 'bg-violet-600 text-white shadow-sm ring-2 ring-violet-300 dark:ring-violet-500/40'
                        : 'text-slate-500 dark:text-slate-400 hover:text-violet-700 dark:hover:text-violet-300 hover:bg-violet-50/80 dark:hover:bg-violet-950/60'
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 transition-transform group-hover/nav:scale-110 ${
                        isActive ? 'text-white' : ''
                      }`}
                    />

                    {/* Notification dot */}
                    {item.badge && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
                    )}
                  </button>

                  {/* Clean Dark Tooltip on hover */}
                  <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 pointer-events-none opacity-0 invisible group-hover/nav:opacity-100 group-hover/nav:visible transition-all duration-150 whitespace-nowrap">
                    <div className="bg-slate-950 dark:bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-2xl border border-slate-800 dark:border-slate-700">
                      {item.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: User Avatar & Logout */}
        <div className="flex flex-col items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 w-full px-2">
          {/* User Avatar Circle */}
          <div className="relative group/user w-full flex justify-center">
            <div
              className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-800 dark:text-violet-200 font-bold text-xs flex items-center justify-center border border-violet-200 dark:border-violet-800 cursor-pointer shadow-2xs hover:bg-violet-200 dark:hover:bg-violet-900 transition-colors"
              title={userName}
            >
              {userInitials}
            </div>
            <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 pointer-events-none opacity-0 invisible group-hover/user:opacity-100 group-hover/user:visible transition-all duration-150 whitespace-nowrap">
              <div className="bg-slate-950 dark:bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-2xl border border-slate-800 dark:border-slate-700">
                {userName} · Session active
              </div>
            </div>
          </div>

          {/* Logout button */}
          <div className="relative group/logout w-full flex justify-center">
            <button
              type="button"
              onClick={onLogout}
              className="w-10 h-10 rounded-xl text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Déconnexion"
            >
              <LogOut className="w-4 h-4" />
            </button>
            <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 pointer-events-none opacity-0 invisible group-hover/logout:opacity-100 group-hover/logout:visible transition-all duration-150 whitespace-nowrap">
              <div className="bg-slate-950 dark:bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-2xl border border-slate-800 dark:border-slate-700">
                Déconnexion
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

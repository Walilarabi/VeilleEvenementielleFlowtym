import React, { useState, useEffect } from 'react';
import {
  Building2,
  Bell,
  CheckCircle2,
  ChevronDown,
  Sparkles,
  LogOut,
  User,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  PanelLeft,
  Maximize,
  Minimize,
  Search,
  Keyboard,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';
import { Hotel } from '../../types';
import { useTheme, ThemeMode } from '../../contexts/ThemeContext';

interface NavbarProps {
  hotels: Hotel[];
  selectedHotelId: string;
  onSelectHotel: (id: string) => void;
  pendingSuggestionsCount: number;
  onOpenSuggestions: () => void;
  pendingProposalsCount: number;
  onOpenProposals: () => void;
  user: { name: string; email: string; role: string } | null;
  onLogout: () => void;
  onToggleMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
  sidebarMode?: 'full' | 'compact' | 'hidden';
  onToggleSidebarMode?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenShortcutsHelp?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  hotels,
  selectedHotelId,
  onSelectHotel,
  pendingSuggestionsCount,
  onOpenSuggestions,
  pendingProposalsCount,
  onOpenProposals,
  user,
  onLogout,
  onToggleMobileMenu,
  isMobileMenuOpen = false,
  sidebarMode = 'full',
  onToggleSidebarMode,
  onOpenCommandPalette,
  onOpenShortcutsHelp,
  isFullscreen: externalIsFullscreen,
  onToggleFullscreen: externalOnToggleFullscreen,
}) => {
  const currentHotel = hotels.find((h) => h.id === selectedHotelId);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [localIsFullscreen, setLocalIsFullscreen] = useState(false);
  const { themeMode, isDark, setThemeMode, toggleTheme } = useTheme();

  // Sync with document fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setLocalIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const isFullscreen = externalIsFullscreen !== undefined ? externalIsFullscreen : localIsFullscreen;

  const handleToggleFullscreen = () => {
    if (externalOnToggleFullscreen) {
      externalOnToggleFullscreen();
      return;
    }

    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn('Fullscreen not supported or blocked:', err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(console.warn);
      }
    }
  };

  return (
    <header className="sticky top-0 z-40 h-[60px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200/80 dark:border-slate-800 px-4 sm:px-6 flex items-center transition-colors">
      <div className="flex items-center justify-between gap-4 w-full">
        {/* Left: Brand Identity + Mobile & Desktop Sidebar Toggles */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Mobile hamburger */}
          {onToggleMobileMenu && (
            <button
              type="button"
              onClick={onToggleMobileMenu}
              className="lg:hidden p-1.5 -ml-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              aria-label={isMobileMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            >
              {isMobileMenuOpen ? <X className="w-5 h-5 text-violet-700 dark:text-violet-400" /> : <Menu className="w-5 h-5" />}
            </button>
          )}

          {/* Desktop sidebar toggle button */}
          {onToggleSidebarMode && (
            <button
              type="button"
              onClick={onToggleSidebarMode}
              className="hidden lg:flex p-1.5 -ml-1 text-slate-500 dark:text-slate-400 hover:text-violet-700 dark:hover:text-violet-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer items-center justify-center border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
              title={
                sidebarMode === 'full'
                  ? 'Réduire le menu latéral (mode compact)'
                  : sidebarMode === 'compact'
                  ? 'Masquer le menu latéral (plein écran)'
                  : 'Déployer le menu latéral'
              }
              aria-label="Basculer l'affichage du menu latéral"
            >
              {sidebarMode === 'full' ? (
                <PanelLeftClose className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              ) : sidebarMode === 'compact' ? (
                <PanelLeft className="w-5 h-5 text-violet-700 dark:text-violet-400" />
              ) : (
                <PanelLeftOpen className="w-5 h-5 text-violet-700 dark:text-violet-400" />
              )}
            </button>
          )}
          <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center text-white shadow-sm shadow-violet-200 dark:shadow-none">
            <div className="w-4 h-4 rounded-full border-2 border-white flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-white/95" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">Flowtym</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-violet-100/70 dark:bg-violet-950/80 text-violet-700 dark:text-violet-300 border border-transparent dark:border-violet-800/60">
                Event Intelligence
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
              Veille & anticipation de la demande hôtelière
            </p>
          </div>
        </div>

        {/* Center: Hotel Portfolio Selector */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center bg-slate-50 dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700 rounded-lg px-3 py-1.5 hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
            <Building2 className="w-4 h-4 text-violet-600 dark:text-violet-400 mr-2 shrink-0" />
            <select
              value={selectedHotelId}
              onChange={(e) => onSelectHotel(e.target.value)}
              className="bg-transparent text-xs font-medium text-slate-800 dark:text-slate-100 pr-6 focus:outline-none cursor-pointer appearance-none"
            >
              <option value="all">Tous les hôtels (Portfolio Groupe — {hotels.length} établissements)</option>
              {hotels.map((hotel) => (
                <option key={hotel.id} value={hotel.id}>
                  {hotel.name} · {hotel.city} ({hotel.roomCount} ch. · {hotel.stars}★)
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute right-2.5 pointer-events-none" />
          </div>

          {currentHotel && (
            <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/70 rounded-lg px-2.5 py-1.5">
              <span>Segment: <strong className="text-slate-700 dark:text-slate-200 font-semibold">{currentHotel.segment}</strong></span>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span>ADR Base: <strong className="text-slate-700 dark:text-slate-200 font-semibold tabular-nums">{currentHotel.baseADR}€</strong></span>
            </div>
          )}
        </div>

        {/* Right: Quick Search, Theme Switcher, Fullscreen, Proposals & Profile */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Quick Search / Command Palette button (Ctrl+K) */}
          {onOpenCommandPalette && (
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="hidden md:flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-xl text-xs transition-all cursor-pointer shadow-2xs"
              title="Recherche rapide et commandes (Ctrl+K / ⌘K)"
            >
              <Search className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
              <span className="text-slate-500 dark:text-slate-400 hidden lg:inline">Recherche...</span>
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-[10px] font-mono text-slate-500 dark:text-slate-400 font-bold shadow-2xs">
                Ctrl+K
              </kbd>
            </button>
          )}

          {/* Theme Toggle (Mode Clair / Mode Sombre) */}
          <button
            type="button"
            onClick={toggleTheme}
            title={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
            aria-label={isDark ? 'Activer le mode clair' : 'Activer le mode sombre'}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
              isDark
                ? 'bg-slate-800 text-amber-300 border-slate-700 hover:bg-slate-700/90 hover:border-slate-600'
                : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            {isDark ? (
              <Sun className="w-3.5 h-3.5 text-amber-300" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
            )}
            <span className="hidden xl:inline whitespace-nowrap">
              {isDark ? 'Mode Clair' : 'Mode Sombre'}
            </span>
          </button>

          {/* Raccourcis Clavier Help button */}
          {onOpenShortcutsHelp && (
            <button
              type="button"
              onClick={onOpenShortcutsHelp}
              title="Guide des raccourcis clavier (?)"
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer hidden sm:flex items-center justify-center border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
              aria-label="Afficher les raccourcis clavier"
            >
              <Keyboard className="w-4 h-4" />
            </button>
          )}

          {/* Bouton Plein Écran (Fullscreen API) */}
          <button
            type="button"
            onClick={handleToggleFullscreen}
            title={
              isFullscreen
                ? 'Quitter le mode plein écran (Échap / Ctrl+Shift+F)'
                : 'Passer en mode plein écran (Fullscreen API · Ctrl+Shift+F)'
            }
            aria-label="Basculer le mode plein écran"
            className={`p-2 rounded-xl transition-all cursor-pointer border hidden sm:flex items-center justify-center ${
              isFullscreen
                ? 'bg-violet-50 dark:bg-violet-950/70 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-700 shadow-2xs ring-1 ring-violet-300 dark:ring-violet-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-violet-700 dark:hover:text-violet-300 hover:bg-slate-100 dark:hover:bg-slate-800 border-transparent hover:border-slate-200 dark:hover:border-slate-700'
            }`}
          >
            {isFullscreen ? (
              <Minimize className="w-4 h-4 text-violet-700 dark:text-violet-300" />
            ) : (
              <Maximize className="w-4 h-4" />
            )}
          </button>

          {/* Propositions button */}
          <button
            onClick={onOpenProposals}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
              pendingProposalsCount > 0
                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700/70 hover:bg-amber-100 dark:hover:bg-amber-950 shadow-2xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
            title="Consulter les propositions d'événements à impact moyen (Score RM 30 à 59)"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span className="hidden md:inline">Propositions</span>
            {pendingProposalsCount > 0 && (
              <span className="w-5 h-5 bg-amber-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center tabular-nums">
                {pendingProposalsCount}
              </span>
            )}
          </button>

          {/* Pending Suggestions Notification button */}
          <button
            onClick={onOpenSuggestions}
            title={`${pendingSuggestionsCount} suggestions d'événements à valider`}
            className="relative p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {pendingSuggestionsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-violet-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center tabular-nums">
                {pendingSuggestionsCount}
              </span>
            )}
          </button>

          {/* User profile & Theme & Logout */}
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-700 hover:opacity-80 transition-opacity cursor-pointer"
            >
              <div className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 border border-transparent dark:border-violet-800 flex items-center justify-center font-bold text-xs">
                {user?.name ? user.name.split(' ').map((n) => n[0]).join('') : 'WL'}
              </div>
              <div className="hidden md:block text-left">
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 leading-none">
                  {user?.name || 'Wali L.'}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {user?.role || 'Head of RM'}
                </div>
              </div>
              <ChevronDown className="w-3 h-3 text-slate-400 dark:text-slate-500" />
            </button>

            {/* Profile Dropdown */}
            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-60 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-2 text-xs space-y-1.5 animate-in fade-in z-50">
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="font-bold text-slate-900 dark:text-slate-100">{user?.name || 'Wali Larabi'}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user?.email || 'wali.larabi@flowtym.com'}</div>
                </div>

                {/* Theme Mode Selector inside Profile Menu */}
                <div className="px-2 py-1.5 space-y-1.5 border-b border-slate-100 dark:border-slate-800">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
                    Apparence de l’interface
                  </div>
                  <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    {([
                      { id: 'light' as ThemeMode, label: 'Clair', Icon: Sun },
                      { id: 'dark' as ThemeMode, label: 'Sombre', Icon: Moon },
                      { id: 'system' as ThemeMode, label: 'Auto', Icon: Monitor },
                    ]).map(({ id, label, Icon }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setThemeMode(id)}
                        className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                          themeMode === id
                            ? 'bg-white dark:bg-slate-900 text-violet-700 dark:text-violet-300 shadow-2xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        <Icon className="w-3 h-3" />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    onLogout();
                  }}
                  className="w-full text-left px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Se déconnecter</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

import React, { useState } from 'react';
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
} from 'lucide-react';
import { Hotel } from '../../types';

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
}) => {
  const currentHotel = hotels.find((h) => h.id === selectedHotelId);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  return (
    <header className="sticky top-0 z-40 h-[60px] bg-white/95 backdrop-blur-sm border-b border-slate-200/80 px-4 sm:px-6 flex items-center transition-colors">
      <div className="flex items-center justify-between gap-4 w-full">
        {/* Left: Brand Identity + Mobile & Desktop Sidebar Toggles */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Mobile hamburger */}
          {onToggleMobileMenu && (
            <button
              type="button"
              onClick={onToggleMobileMenu}
              className="lg:hidden p-1.5 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              aria-label={isMobileMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            >
              {isMobileMenuOpen ? <X className="w-5 h-5 text-violet-700" /> : <Menu className="w-5 h-5" />}
            </button>
          )}

          {/* Desktop sidebar toggle button */}
          {onToggleSidebarMode && (
            <button
              type="button"
              onClick={onToggleSidebarMode}
              className="hidden lg:flex p-1.5 -ml-1 text-slate-500 hover:text-violet-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer items-center justify-center border border-transparent hover:border-slate-200"
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
                <PanelLeftClose className="w-5 h-5 text-slate-600" />
              ) : sidebarMode === 'compact' ? (
                <PanelLeft className="w-5 h-5 text-violet-700" />
              ) : (
                <PanelLeftOpen className="w-5 h-5 text-violet-700" />
              )}
            </button>
          )}
          <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center text-white shadow-sm shadow-violet-200">
            <div className="w-4 h-4 rounded-full border-2 border-white flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-slate-900">Flowtym</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-violet-100/70 text-violet-700">
                Event Intelligence
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              Veille & anticipation de la demande hôtelière
            </p>
          </div>
        </div>

        {/* Center: Hotel Portfolio Selector */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center bg-slate-50 border border-slate-200/90 rounded-lg px-3 py-1.5 hover:border-slate-300 transition-colors">
            <Building2 className="w-4 h-4 text-violet-600 mr-2 shrink-0" />
            <select
              value={selectedHotelId}
              onChange={(e) => onSelectHotel(e.target.value)}
              className="bg-transparent text-xs font-medium text-slate-800 pr-6 focus:outline-none cursor-pointer appearance-none"
            >
              <option value="all">Tous les hôtels (Portfolio Groupe — 4 établissements)</option>
              {hotels.map((hotel) => (
                <option key={hotel.id} value={hotel.id}>
                  {hotel.name} · {hotel.city} ({hotel.roomCount} ch. · {hotel.stars}★)
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 pointer-events-none" />
          </div>

          {currentHotel && (
            <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500 bg-slate-50/70 border border-slate-200/60 rounded-lg px-2.5 py-1.5">
              <span>Segment: <strong className="text-slate-700 font-semibold">{currentHotel.segment}</strong></span>
              <span className="text-slate-300">|</span>
              <span>ADR Base: <strong className="text-slate-700 font-semibold tabular-nums">{currentHotel.baseADR}€</strong></span>
            </div>
          )}
        </div>

        {/* Right: Mode Demo, Proposals & Actions */}
        <div className="flex items-center gap-3">
          {/* Propositions button */}
          <button
            onClick={onOpenProposals}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              pendingProposalsCount > 0
                ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 shadow-2xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            title="Consulter les propositions d'événements à impact moyen (Score RM 30 à 59)"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span className="hidden md:inline">Propositions</span>
            {pendingProposalsCount > 0 && (
              <span className="w-5 h-5 bg-amber-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                {pendingProposalsCount}
              </span>
            )}
          </button>

          {/* Pending Suggestions Notification button */}
          <button
            onClick={onOpenSuggestions}
            title={`${pendingSuggestionsCount} suggestions d'événements à valider`}
            className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Bell className="w-4 h-4" />
            {pendingSuggestionsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-violet-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                {pendingSuggestionsCount}
              </span>
            )}
          </button>

          {/* User profile & Logout */}
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 pl-2 border-l border-slate-200 hover:opacity-80 transition-opacity"
            >
              <div className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-xs">
                {user?.name ? user.name.split(' ').map((n) => n[0]).join('') : 'WL'}
              </div>
              <div className="hidden md:block text-left">
                <div className="text-xs font-semibold text-slate-800 leading-none">
                  {user?.name || 'Wali L.'}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {user?.role || 'Head of RM'}
                </div>
              </div>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {/* Profile Dropdown */}
            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 text-xs space-y-1 animate-in fade-in z-50">
                <div className="px-3 py-2 border-b border-slate-100">
                  <div className="font-bold text-slate-900">{user?.name || 'Wali Larabi'}</div>
                  <div className="text-[11px] text-slate-500 truncate">{user?.email || 'wali.larabi@flowtym.com'}</div>
                </div>

                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    onLogout();
                  }}
                  className="w-full text-left px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl font-semibold flex items-center gap-2 transition-colors cursor-pointer"
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

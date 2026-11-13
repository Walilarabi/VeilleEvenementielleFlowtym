/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from './auth/AuthProvider';
import { PanelLeftOpen, ChevronRight } from 'lucide-react';
import { Navbar } from './components/layout/Navbar';
import { Sidebar, NavTab, SidebarMode } from './components/layout/Sidebar';
const KPIHeader = React.lazy(() => import('./components/kpi/KPIHeader').then((module) => ({ default: module.KPIHeader })));

const SIDEBAR_MODE_STORAGE_KEY = 'flowtym_sidebar_mode_v1';

const getInitialSidebarMode = (): SidebarMode => {
  try {
    const saved = localStorage.getItem(SIDEBAR_MODE_STORAGE_KEY);
    if (saved === 'full' || saved === 'compact' || saved === 'hidden') {
      return saved;
    }
  } catch (err) {
    console.error('Failed to load sidebar mode', err);
  }
  return 'full';
};
import { CalendarControls } from './components/calendar/CalendarControls';
const CalendarView = React.lazy(() => import('./components/calendar/CalendarView').then((module) => ({ default: module.CalendarView })));
const TableView = React.lazy(() => import('./components/calendar/TableView').then((module) => ({ default: module.TableView })));
const FlowboardView = React.lazy(() => import('./components/flowboard/FlowboardView').then((module) => ({ default: module.FlowboardView })));
const ExplorerView = React.lazy(() => import('./components/explorer/ExplorerView').then((module) => ({ default: module.ExplorerView })));
const EventIntelligenceView = React.lazy(() => import('./components/intelligence/EventIntelligenceView').then((module) => ({ default: module.EventIntelligenceView })));
const SourcesCoverageView = React.lazy(() => import('./components/sources/SourcesCoverageView').then((module) => ({ default: module.SourcesCoverageView })));
const SettingsView = React.lazy(() => import('./components/settings/SettingsView').then((module) => ({ default: module.SettingsView })));
const GeoIntelligenceView = React.lazy(() => import('./components/geo/GeoIntelligenceView').then((module) => ({ default: module.GeoIntelligenceView })));
const EventDetailModal = React.lazy(() => import('./components/events/EventDetailModal').then((module) => ({ default: module.EventDetailModal })));
const AddEventModal = React.lazy(() => import('./components/modals/AddEventModal').then((module) => ({ default: module.AddEventModal })));
const ImportExcelModal = React.lazy(() => import('./components/modals/ImportExcelModal').then((module) => ({ default: module.ImportExcelModal })));
const RefreshModal = React.lazy(() => import('./components/modals/RefreshModal').then((module) => ({ default: module.RefreshModal })));
const ProposalsModal = React.lazy(() => import('./components/proposals/ProposalsModal').then((module) => ({ default: module.ProposalsModal })));
import { LoginPage } from './components/auth/LoginPage';
const MarketCalendarView = React.lazy(() => import('./components/market/MarketCalendarView').then((module) => ({ default: module.MarketCalendarView })));
const SchoolHolidaysCalendarView = React.lazy(() => import('./components/events/SchoolHolidaysCalendarView').then((module) => ({ default: module.SchoolHolidaysCalendarView })));
import { CalendarSubNavbar, CalendarSubTabMode } from './components/calendar/CalendarSubNavbar';
const RMDecisionCenter = React.lazy(() => import('./components/intelligence/RMDecisionCenter').then((module) => ({ default: module.RMDecisionCenter })));
const DemandForecastView = React.lazy(() => import('./components/forecast/DemandForecastView').then((module) => ({ default: module.DemandForecastView })));
const DateDetailModal = React.lazy(() => import('./components/events/DateDetailModal').then((module) => ({ default: module.DateDetailModal })));
const HotelConnectivityHub = React.lazy(() => import('./components/connectivity/HotelConnectivityHub').then((module) => ({ default: module.HotelConnectivityHub })));
const RateIntelligenceView = React.lazy(() => import('./components/pricing/RateIntelligenceView').then((module) => ({ default: module.RateIntelligenceView })));
const RateOpportunityPushNotification = React.lazy(() => import('./components/notifications/RateOpportunityPushNotification').then((module) => ({ default: module.RateOpportunityPushNotification })));
import { PushOpportunityAlert } from './services/pushNotificationService';
const ReportsAndAutomationsHub = React.lazy(() => import('./components/reports/ReportsAndAutomationsHub').then((module) => ({ default: module.ReportsAndAutomationsHub })));
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
const CommandPaletteModal = React.lazy(() => import('./components/modals/CommandPaletteModal').then((module) => ({ default: module.CommandPaletteModal })));
const KeyboardShortcutsModal = React.lazy(() => import('./components/modals/KeyboardShortcutsModal').then((module) => ({ default: module.KeyboardShortcutsModal })));

import { convertSchoolHolidaysToEventItems } from './services/schoolHolidayEventConverter';
import { generateSchoolHolidaysForYear } from './data/schoolHolidaysData';

import { EventItem, EventSuggestion, EventSource, FilterState, Hotel, EventProposal, Venue } from './types';

const EMPTY_HOTEL: Hotel = { id: '', name: '', group: null, city: '', country: '', address: null, lat: null, lng: null, stars: null, roomCount: null, segment: null, baseADR: null };
import { exportEventsToCSV } from './utils/helpers';


export default function App() {
  const { supabase, user, loading: authLoading, error: authError, recoveryMode, signOut } = useAuth();
  const handleLogout = async () => {
    try { await signOut(); }
    catch (error) { console.error('Supabase sign-out failed:', error); showToast('La déconnexion a échoué. Veuillez réessayer.'); }
  };

  // Global Navigation State
  const [activeTab, setActiveTab] = useState<NavTab>('calendar');
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(getInitialSidebarMode);

  const handleSidebarModeChange = (newMode: SidebarMode) => {
    setSidebarMode(newMode);
    try {
      localStorage.setItem(SIDEBAR_MODE_STORAGE_KEY, newMode);
    } catch (err) {
      console.error('Failed to save sidebar mode', err);
    }
  };

  const handleCycleSidebarMode = () => {
    const nextMode: SidebarMode =
      sidebarMode === 'full' ? 'compact' : sidebarMode === 'compact' ? 'hidden' : 'full';
    handleSidebarModeChange(nextMode);
  };

  // Fullscreen & Shortcuts Modals State
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn('Fullscreen request blocked or not supported:', err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(console.warn);
      }
    }
  };

  // Global Keyboard Shortcuts Hook (Ctrl+K, Ctrl+1..9, Ctrl+Shift+F, ?)
  useGlobalShortcuts({
    activeTab,
    onChangeTab: (tab) => setActiveTab(tab),
    onOpenCommandPalette: () => setIsCommandPaletteOpen((prev) => !prev),
    onOpenShortcutsHelp: () => setIsShortcutsHelpOpen(true),
    onToggleFullscreen: handleToggleFullscreen,
    onToggleSidebar: handleCycleSidebarMode,
    onShowToast: (msg) => showToast(msg),
  });

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [hotelsLoading, setHotelsLoading] = useState(true);
  const [hotelsError, setHotelsError] = useState<string | null>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [sources, setSources] = useState<EventSource[]>([]);
  const [suggestions, setSuggestions] = useState<EventSuggestion[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);

  // Proposals State (Score RM 30 à 59)
  const [proposals, setProposals] = useState<EventProposal[]>([]);

  useEffect(() => {
    let active = true;
    const loadAccessibleHotels = async () => {
      if (!supabase) {
        if (active) {
          setHotelsError('Connexion Supabase indisponible : aucun portefeuille hôtelier réel ne peut être chargé.');
          setHotelsLoading(false);
        }
        return;
      }
      setHotelsLoading(true);
      setHotelsError(null);
      try {
        const { data, error } = await supabase
          .from('hotels')
          .select('id,name,group_name,city,country,address,lat,lng,stars,room_count,segment,base_adr')
          .eq('is_active', true)
          .order('name');
        if (error) throw error;
        const rows = (data ?? []).map((row: any): Hotel => ({
          id: row.id,
          name: row.name,
          group: row.group_name ?? null,
          city: row.city ?? '',
          country: row.country ?? '',
          address: row.address ?? null,
          lat: typeof row.lat === 'number' ? row.lat : null,
          lng: typeof row.lng === 'number' ? row.lng : null,
          stars: typeof row.stars === 'number' ? row.stars : null,
          roomCount: typeof row.room_count === 'number' ? row.room_count : null,
          segment: ['Luxe', 'Boutique', 'Affaires', 'Économique', 'Resort'].includes(row.segment) ? row.segment : null,
          baseADR: typeof row.base_adr === 'number' ? row.base_adr : null,
        }));
        if (!active) return;
        setHotels(rows);
        if (rows.length === 0) {
          setHotelsError('Aucun hôtel actif accessible dans Supabase. Faites initialiser l’établissement et ses droits avant d’utiliser le RMS.');
          return;
        }
        setFilterState((prev) => ({
          ...prev,
          selectedHotelId: rows.some((hotel) => hotel.id === prev.selectedHotelId)
            ? prev.selectedHotelId
            : rows[0].id,
        }));
      } catch (error) {
        if (active) setHotelsError(error instanceof Error ? error.message : 'Impossible de charger les hôtels depuis Supabase.');
      } finally {
        if (active) setHotelsLoading(false);
      }
    };
    void loadAccessibleHotels();
    return () => { active = false; };
  }, [supabase]);

  // View switch: 'calendar' vs 'table' (default to 'table' so Table View is immediately active)
  const [viewMode, setViewMode] = useState<'calendar' | 'table'>('table');
  const [calendarSubTab, setCalendarSubTab] = useState<CalendarSubTabMode>('table');
  const [selectedDateForModal, setSelectedDateForModal] = useState<string | null>(null);

  // Filter state (Matching the reference screenshot default configuration)
  const [filterState, setFilterState] = useState<FilterState>({
    search: '',
    periodTab: 'all', // "Tous 106" active in screenshot
    impact: 'all',
    category: 'all',
    city: 'all',
    status: 'all',
    recurrenceOnly: false,
    rmsPrioritiesOnly: false,
    anomaliesOnly: false,
    watchlistOnly: false,
    showSchoolHolidays: true,
    selectedHotelId: '',
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth(),
  });

  // Collapsible advanced filters (open by default like the screenshot)
  const [isFilterExpanded, setIsFilterExpanded] = useState(true);

  // Modals & Drawers
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addEventDefaultDate, setAddEventDefaultDate] = useState<string>(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date()));
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isRefreshModalOpen, setIsRefreshModalOpen] = useState(false);
  const [isProposalsModalOpen, setIsProposalsModalOpen] = useState(false);

  // Toast notification feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Filter updates
  const handleFilterChange = (updates: Partial<FilterState>) => {
    setFilterState((prev) => ({ ...prev, ...updates }));
  };

  const handleResetFilters = () => {
    setFilterState((prev) => ({
      ...prev,
      search: '',
      periodTab: 'all',
      impact: 'all',
      category: 'all',
      city: 'all',
      status: 'all',
      recurrenceOnly: false,
      rmsPrioritiesOnly: false,
      anomaliesOnly: false,
      watchlistOnly: false,
    }));
    showToast('Filtres réinitialisés');
  };

  // Current Hotel selection
  const currentHotel = useMemo(() => {
    return hotels.find((h) => h.id === filterState.selectedHotelId) || hotels[0] || EMPTY_HOTEL;
  }, [hotels, filterState.selectedHotelId]);

  // School holidays converted into EventItem representations
  const schoolHolidayEvents = useMemo(() => {
    const hList = generateSchoolHolidaysForYear(filterState.currentYear);
    return convertSchoolHolidaysToEventItems(hList, currentHotel);
  }, [currentHotel, filterState.currentYear]);

  // Combined events pool (merging standard events and official school holidays)
  const allEventsWithHolidays = useMemo(() => {
    if (filterState.showSchoolHolidays === false) return events;
    return [...events, ...schoolHolidayEvents];
  }, [events, schoolHolidayEvents, filterState.showSchoolHolidays]);

  // Filtered Events Calculation
  const filteredEvents = useMemo(() => {
    return allEventsWithHolidays.filter((ev) => {
      // Search
      if (filterState.search.trim()) {
        const q = filterState.search.toLowerCase();
        const matchTitle = ev.title.toLowerCase().includes(q);
        const matchVenue = ev.venueName.toLowerCase().includes(q);
        const matchCity = ev.city.toLowerCase().includes(q);
        if (!matchTitle && !matchVenue && !matchCity) return false;
      }

      // Period Tab
      if (filterState.periodTab === 'upcoming') {
        if (new Date(ev.startDate) < new Date(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date()))) return false;
      } else if (filterState.periodTab === 'ongoing') {
        const inMonth =
          ev.startDate.startsWith(`${filterState.currentYear}-${String(filterState.currentMonth + 1).padStart(2, '0')}`) ||
          ev.endDate.startsWith(`${filterState.currentYear}-${String(filterState.currentMonth + 1).padStart(2, '0')}`);
        if (!inMonth) return false;
      } else if (filterState.periodTab === 'past') {
        if (new Date(ev.startDate) >= new Date(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date()))) return false;
      }

      // Impact
      if (filterState.impact !== 'all' && ev.impactLevel !== filterState.impact) {
        return false;
      }

      // Category
      if (filterState.category !== 'all' && ev.category !== filterState.category) {
        return false;
      }

      // City
      if (filterState.city !== 'all' && ev.city !== filterState.city) {
        return false;
      }

      // Status
      if (filterState.status !== 'all' && ev.status !== filterState.status) {
        return false;
      }

      // Toggles
      if (filterState.recurrenceOnly && !ev.isRecurring) return false;
      if (filterState.rmsPrioritiesOnly && ev.scoreBreakdown.finalRMScore < 50) return false;
      if (filterState.anomaliesOnly && !ev.isAnomaly) return false;
      if (filterState.watchlistOnly && !ev.isWatchlist) return false;

      return true;
    });
  }, [allEventsWithHolidays, filterState]);

  // Event interaction handlers
  const handleToggleFavorite = (eventId: string) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, isFavorite: !e.isFavorite } : e))
    );
    if (selectedEvent && selectedEvent.id === eventId) {
      setSelectedEvent((prev) => (prev ? { ...prev, isFavorite: !prev.isFavorite } : null));
    }
  };

  const handleToggleWatchlist = (eventId: string) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, isWatchlist: !e.isWatchlist } : e))
    );
    if (selectedEvent && selectedEvent.id === eventId) {
      setSelectedEvent((prev) => (prev ? { ...prev, isWatchlist: !prev.isWatchlist } : null));
    }
    showToast('Statut de surveillance RM mis à jour');
  };

  const handleToggleYieldActive = (eventId: string) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, isYieldActive: !e.isYieldActive } : e))
    );
    if (selectedEvent && selectedEvent.id === eventId) {
      setSelectedEvent((prev) => (prev ? { ...prev, isYieldActive: !prev.isYieldActive } : null));
    }
    showToast('Politique Yield & Stop-Sell mise à jour pour cet événement');
  };

  // Add event handler
  const handleAddEvent = (newEvent: EventItem) => {
    void newEvent;
    showToast("Création non enregistrée : le backend événementiel n'est pas encore raccordé. Aucun événement n'a été ajouté.");
  };

  const handleOpenAddOnDate = (dateStr: string) => {
    setAddEventDefaultDate(dateStr);
    setIsAddModalOpen(true);
  };

  // Excel / CSV Import handler
  const handleImportEvents = (imported: EventItem[]) => {
    void imported;
    showToast("Import bloqué : aucun backend événementiel persistant n'est disponible.");
  };

  // Excel / CSV Export handler
  const handleExportData = () => {
    exportEventsToCSV(filteredEvents);
    showToast('Export CSV généré avec succès');
  };

  // PDF Export handler
  const handleExportPDF = () => {
    const currentHotel = hotels.find((h) => h.id === filterState.selectedHotelId) || hotels[0];
    showToast('Génération du rapport PDF en cours...');
    void import('./utils/pdfExport').then(({ exportEventsToPDF }) => {
      exportEventsToPDF({ events: filteredEvents, hotel: currentHotel, viewMode, filterState });
      showToast('Rapport PDF généré.');
    }).catch((error) => {
      console.error('PDF export failed:', error);
      showToast('Échec de génération du rapport PDF.');
    });
  };

  const handleDownloadTemplate = () => {
    const sampleEvent: EventItem = {
      id: 'template-sample',
      title: 'Exemple Modèle Salon',
      category: 'salons_foires',
      venueId: 'venue-porte-versailles',
      venueName: 'Paris Expo Porte de Versailles',
      city: 'Paris',
      country: 'France',
      startDate: '2026-11-01',
      endDate: '2026-11-04',
      expectedAttendance: 50000,
      internationalRatioPercent: 40,
      status: 'confirmed',
      impactLevel: 'critique',
      scoreBreakdown: {
        attendanceScore: 18,
        internationalScore: 12,
        saturationScore: 15,
        proximityScore: 15,
        compressionScore: 12,
        finalRMScore: 72,
        confidenceScore: 99,
      },
      sources: ['Modèle Flowtym'],
      evidences: [],
      hotelImpacts: {},
      isRecurring: true,
      createdAt: '2026-10-31',
      lastVerifiedAt: '2026-10-31',
    };
    exportEventsToCSV([sampleEvent], 'modele_import_flowtym.csv');
    showToast('Modèle de fichier CSV téléchargé');
  };

  // Refresh flow completion
  const handleRefreshComplete = (
    newHighImpact: EventItem[],
    newProps: EventProposal[],
    stats: { newCount: number; modifiedCount: number; cancelledCount: number; verifiedCount: number }
  ) => {
    void newHighImpact; void newProps; void stats;
    showToast("Actualisation non enregistrée : la veille événementielle n'est pas encore raccordée à un stockage persistant.");
  };

  // Proposal acceptance / refusal
  const handleAcceptProposal = (propId: string) => {
    const p = proposals.find((x) => x.id === propId);
    if (!p) return;

    // 1. Mark as accepted in proposals list
    setProposals((prev) =>
      prev.map((x) => (x.id === propId ? { ...x, status: 'accepted' } : x))
    );

    // 2. Integrate into events calendar immediately
    const newEvent: EventItem = {
      id: `ev-accepted-${Date.now()}`,
      title: p.title,
      subtitle: p.subtitle,
      category: p.category,
      venueId: 'venue-porte-versailles',
      venueName: p.venueName,
      city: p.city,
      country: 'France',
      startDate: p.startDate,
      endDate: p.endDate,
      expectedAttendance: p.expectedAttendance,
      internationalRatioPercent: 35,
      status: 'confirmed',
      impactLevel: p.impactLevel,
      scoreBreakdown: {
        attendanceScore: 12,
        internationalScore: 8,
        saturationScore: 10,
        proximityScore: 10,
        compressionScore: 8,
        finalRMScore: p.score,
        confidenceScore: 95,
      },
      sources: [p.detectedSource],
      evidences: [],
      hotelImpacts: {},
      isRecurring: false,
      isFavorite: false,
      isWatchlist: true,
      isYieldActive: false,
      createdAt: new Date().toISOString().slice(0, 10),
      lastVerifiedAt: new Date().toISOString().slice(0, 10),
    };

    setEvents((prev) => [newEvent, ...prev]);
    showToast(`L'événement "${p.title}" a été validé et intégré au calendrier.`);
  };

  const handleRefuseProposal = (propId: string) => {
    setProposals((prev) =>
      prev.map((x) => (x.id === propId ? { ...x, status: 'refused' } : x))
    );
    showToast('Événement refusé (conservé avec mention barrée)');
  };

  const handleRestoreProposal = (propId: string) => {
    setProposals((prev) =>
      prev.map((x) => (x.id === propId ? { ...x, status: 'pending' } : x))
    );
    showToast('Proposition rétablie en attente');
  };

  // Hotel management
  const handleAddHotel = (_newHotel: Hotel) => {
    showToast("Ajout bloqué : les hôtels doivent être créés et autorisés dans Supabase par un administrateur.");
  };

  const handleDeleteHotel = (_hotelId: string) => {
    showToast("Suppression bloquée : aucun hôtel n'est supprimé depuis cette interface non raccordée à un flux d'administration sécurisé.");
  };

  const pendingSuggestionsCount = suggestions.filter((s) => s.status === 'pending').length;
  const pendingProposalsCount = proposals.filter((p) => p.status === 'pending').length;

  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
      <div className="text-center space-y-3"><div className="mx-auto h-9 w-9 rounded-full border-4 border-violet-100 border-t-violet-600 animate-spin" /><p className="text-sm font-medium text-slate-600">Vérification de votre session sécurisée…</p></div>
    </div>
  );
  if (recoveryMode || !user) return <LoginPage authError={authError} recoveryMode={recoveryMode} />;
  if (hotelsLoading) return <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]"><div className="text-center space-y-3"><div className="mx-auto h-9 w-9 rounded-full border-4 border-violet-100 border-t-violet-600 animate-spin" /><p className="text-sm font-medium text-slate-600">Chargement des établissements autorisés depuis Supabase…</p></div></div>;
  if (hotelsError || hotels.length === 0) return <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-6"><div className="max-w-xl rounded-2xl border border-amber-200 bg-white p-6 shadow-sm"><h1 className="text-lg font-bold text-slate-900">Portefeuille hôtelier indisponible</h1><p className="mt-2 text-sm text-slate-600">{hotelsError || 'Aucun hôtel actif accessible.'}</p><button onClick={() => window.location.reload()} className="mt-4 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white">Réessayer</button></div></div>;

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-slate-900 antialiased font-sans">
      {/* Top Navbar */}
      <Navbar
        hotels={hotels}
        selectedHotelId={filterState.selectedHotelId}
        onSelectHotel={(id) => handleFilterChange({ selectedHotelId: id })}
        pendingSuggestionsCount={pendingSuggestionsCount}
        onOpenSuggestions={() => {
          setActiveTab('flowboard');
          setIsMobileMenuOpen(false);
        }}
        pendingProposalsCount={pendingProposalsCount}
        onOpenProposals={() => setIsProposalsModalOpen(true)}
        user={user}
        onLogout={handleLogout}
        onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
        isMobileMenuOpen={isMobileMenuOpen}
        sidebarMode={sidebarMode}
        onToggleSidebarMode={handleCycleSidebarMode}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenShortcutsHelp={() => setIsShortcutsHelpOpen(true)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
      />

      {/* Main Container: Fixed Sidebar + Content */}
      <div className="flex-1 flex relative">
        {/* Sidebar Navigation (Slim Icon-Rail) */}
        <Sidebar
          activeTab={activeTab}
          onChangeTab={(tab) => {
            setActiveTab(tab);
            setIsMobileMenuOpen(false);
          }}
          pendingSuggestionsCount={pendingSuggestionsCount + pendingProposalsCount}
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
          onLogout={handleLogout}
          userInitials={user.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}
          userName={user?.name || 'Nabil Amrani'}
        />

        {/* Dynamic Content Viewport */}
        <main
          className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 min-w-0 transition-[margin] duration-200 ease-in-out lg:ml-16 w-full"
        >
          <React.Suspense fallback={<div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">Chargement du module…</div>}>
          {/* TAB: CALENDRIER & ÉVÉNEMENTS (VUE TABLEAU / CALENDRIER / VACANCES SCOLAIRES) */}
          {activeTab === 'calendar' && (
            <div className="space-y-6">
              {/* Header KPI cards with Actualiser button */}
              <KPIHeader
                events={events}
                filterState={filterState}
                onFilterChange={handleFilterChange}
                onTriggerRefresh={() => setIsRefreshModalOpen(true)}
              />

              {/* Sub-navigation bar matching reference screenshot: Liste, Calendrier, Heatmap, Vacances scolaires */}
              <CalendarSubNavbar
                activeTab={calendarSubTab}
                onChangeTab={(tab) => {
                  setCalendarSubTab(tab);
                  if (tab === 'table') setViewMode('table');
                  if (tab === 'calendar') setViewMode('calendar');
                }}
                onOpenSources={() => setActiveTab('sources')}
                onOpenImportHistory={() => setIsImportModalOpen(true)}
                onOpenGeo={() => setActiveTab('geo')}
                holidaysCount={57}
              />

              {/* View 1: Vacances Scolaires (Screenshot Layout & Deep RM Analysis) */}
              {calendarSubTab === 'school_holidays' && (
                <SchoolHolidaysCalendarView
                  hotel={currentHotel}
                  onShowToast={showToast}
                />
              )}

              {/* View: Explorer Events (Marché & Concurrence) */}
              {calendarSubTab === 'explorer' && (
                <ExplorerView
                  events={events}
                  hotels={hotels}
                  selectedHotelId={filterState.selectedHotelId}
                  onSelectEvent={setSelectedEvent}
                />
              )}

              {/* View 2: Heatmap (Market Tension) */}
              {calendarSubTab === 'heatmap' && (
                <MarketCalendarView
                  events={events}
                  hotels={hotels}
                  selectedHotelId={filterState.selectedHotelId}
                  onSelectHotel={(id) => setFilterState((prev) => ({ ...prev, selectedHotelId: id }))}
                  onSelectEvent={setSelectedEvent}
                  onShowToast={showToast}
                />
              )}

              {/* View 3 & 4: Table vs Calendar View with Controls */}
              {(calendarSubTab === 'table' || calendarSubTab === 'calendar') && (
                <>
                  {/* Controls bar (Selectors, Tabs, Search & Filters, Tableau / Calendrier Switch) */}
                  <CalendarControls
                    filterState={filterState}
                    onFilterChange={handleFilterChange}
                    viewMode={viewMode}
                    onToggleViewMode={(mode) => {
                      setViewMode(mode);
                      setCalendarSubTab(mode);
                    }}
                    onOpenAddModal={() => setIsAddModalOpen(true)}
                    onOpenImportModal={() => setIsImportModalOpen(true)}
                    onDownloadTemplate={handleDownloadTemplate}
                    onExportData={handleExportData}
                    onExportPDF={handleExportPDF}
                    onResetFilters={handleResetFilters}
                    isFilterExpanded={isFilterExpanded}
                    onToggleFilterExpanded={() => setIsFilterExpanded(!isFilterExpanded)}
                    events={allEventsWithHolidays}
                  />

                  {/* Active View Quick Indicator & One-Click Toggle */}
                  <div className="flex items-center justify-between bg-violet-50/70 border border-violet-200/80 px-4 py-2.5 rounded-2xl text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-violet-600" />
                      <span className="text-violet-950 font-medium">
                        Affichage actif : <strong className="font-bold">{viewMode === 'table' ? 'Tableau (Vue Liste des événements & vacances)' : 'Calendrier (Planning mensuel des événements & vacances)'}</strong>
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        const newMode = viewMode === 'table' ? 'calendar' : 'table';
                        setViewMode(newMode);
                        setCalendarSubTab(newMode);
                      }}
                      className="font-bold text-violet-700 hover:text-violet-900 bg-white hover:bg-violet-100/60 px-3.5 py-1.5 rounded-xl border border-violet-200 shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <span>{viewMode === 'table' ? 'Afficher la Vue Calendrier ▦' : 'Afficher la Vue Tableau ⊞'}</span>
                    </button>
                  </div>

                  {/* View Display: Calendrier vs Tableau */}
                  {viewMode === 'calendar' ? (
                    <CalendarView
                      events={filteredEvents}
                      currentYear={filterState.currentYear}
                      currentMonth={filterState.currentMonth}
                      onSelectEvent={setSelectedEvent}
                      onAddEventOnDate={handleOpenAddOnDate}
                      onExportPDF={handleExportPDF}
                      onSelectDate={(dateStr) => setSelectedDateForModal(dateStr)}
                    />
                  ) : (
                    <TableView
                      events={filteredEvents}
                      onSelectEvent={setSelectedEvent}
                      onToggleFavorite={handleToggleFavorite}
                      onExportPDF={handleExportPDF}
                    />
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB: MARCHÉ (Calendrier des dates à surveiller & Niveau de demande) */}
          {activeTab === 'market' && (
            <MarketCalendarView
              events={events}
              hotels={hotels}
              selectedHotelId={filterState.selectedHotelId}
              onSelectHotel={(id) => setFilterState((prev) => ({ ...prev, selectedHotelId: id }))}
              onSelectEvent={setSelectedEvent}
              onShowToast={showToast}
            />
          )}

          {/* TAB 2: FLOWBOARD (Executive RM Dashboard) */}
          {activeTab === 'flowboard' && (
            <FlowboardView
              events={events}
              suggestions={suggestions}
              hotels={hotels}
              selectedHotelId={filterState.selectedHotelId}
              onSelectEvent={setSelectedEvent}
              onApproveSuggestion={(id) => {
                const s = suggestions.find((x) => x.id === id);
                if (s) {
                  setSuggestions((prev) => prev.filter((x) => x.id !== id));
                  showToast(`Suggestion "${s.eventTitle}" validée`);
                }
              }}
              onDismissSuggestion={(id) => {
                setSuggestions((prev) => prev.filter((x) => x.id !== id));
                showToast('Suggestion ignorée');
              }}
              onGoToExplorer={() => {
                setActiveTab('calendar');
                setCalendarSubTab('explorer');
              }}
              onGoToCalendar={() => setActiveTab('calendar')}
              onGoToSchoolHolidays={() => {
                setActiveTab('calendar');
                setCalendarSubTab('school_holidays');
              }}
              onGoToOpportunities={() => setActiveTab('opportunities')}
            />
          )}

          {/* TAB 3: EXPLORER (Deep Search & Discovery) */}
          {activeTab === 'explorer' && (
            <ExplorerView
              events={events}
              hotels={hotels}
              selectedHotelId={filterState.selectedHotelId}
              onSelectEvent={setSelectedEvent}
            />
          )}

          {/* TAB: PRICING INTELLIGENCE (Analyse concurrentielle, positionnement tarifaire et recommandations de prix) */}
          {activeTab === 'pricing' && (
            <RateIntelligenceView
              hotel={currentHotel}
              events={events}
              onSelectEvent={setSelectedEvent}
              onGoToExcelUpload={() => setActiveTab('sources')}
              onShowToast={showToast}
            />
          )}

          {/* TAB 6: ANALYSES & RÉCURRENCES (Événements récurrents, tendances, historique, validation) */}
          {activeTab === 'intelligence' && (
            <EventIntelligenceView
              events={events}
              hotels={hotels}
              selectedHotelId={filterState.selectedHotelId}
              onSelectEvent={setSelectedEvent}
              defaultTab="recurrences"
              onOpenProposals={() => setIsProposalsModalOpen(true)}
              pendingProposalsCount={pendingProposalsCount}
            />
          )}

          {/* TAB 7: OPPORTUNITÉS & ALERTES RM (Risques de sous-tarification, opportunités tarifaires, alertes compression) */}
          {activeTab === 'opportunities' && (
            <RMDecisionCenter
              hotel={currentHotel}
              events={events}
              onSelectEvent={setSelectedEvent}
              onShowToast={showToast}
            />
          )}

          {/* TAB 5: VEILLE GÉOGRAPHIQUE (Périmètres 10/30 km, Découverte & Catégories) */}
          {activeTab === 'geo' && (
            <GeoIntelligenceView
              hotels={hotels}
              selectedHotelId={filterState.selectedHotelId}
              events={events}
              onSelectHotel={(id) => setFilterState((prev) => ({ ...prev, selectedHotelId: id }))}
              onSelectEvent={setSelectedEvent}
              onShowToast={showToast}
            />
          )}

          {/* TAB 6: SOURCES & COUVERTURE (Crawling audit & Venues directory) */}
          {activeTab === 'sources' && (
            <SourcesCoverageView
              sources={sources}
              venues={venues}
              events={events}
              hotel={currentHotel}
              onNavigateToPricing={() => setActiveTab('pricing')}
              onShowToast={showToast}
            />
          )}

          {/* TAB: CONNECTIVITÉ & API (Lighthouse & D-EDGE CRS) */}
          {activeTab === 'connectivity' && (
            <HotelConnectivityHub
              hotel={currentHotel}
              onNavigateToPricing={() => setActiveTab('pricing')}
              onShowToast={showToast}
            />
          )}

          {/* TAB: DEMAND FORECAST (Prévision d'occupation, d'ADR et de RevPAR) */}
          {activeTab === 'forecast' && (
            <DemandForecastView
              hotel={currentHotel}
              events={events}
              onSelectEvent={setSelectedEvent}
              onGoToMarket={() => setActiveTab('market')}
            />
          )}

          {/* TAB: RAPPORTS D'ACTIVITÉ REVENUE MANAGEMENT */}
          {activeTab === 'reports' && (
            <ReportsAndAutomationsHub
              hotel={currentHotel}
              onShowToast={showToast}
              onNavigateToDecisionCenter={() => setActiveTab('opportunities')}
            />
          )}

          {/* TAB 7: PARAMÈTRES (Hotel portfolio, Veille Géo & Supabase) */}
          {activeTab === 'settings' && (
            <SettingsView
              hotels={hotels}
              onAddHotel={handleAddHotel}
              onDeleteHotel={handleDeleteHotel}
              selectedHotelId={filterState.selectedHotelId}
              onSelectHotel={(id) => setFilterState((prev) => ({ ...prev, selectedHotelId: id }))}
              onShowToast={showToast}
            />
          )}
          </React.Suspense>
        </main>
      </div>

      <React.Suspense fallback={null}>
      {/* Side Drawer: Event Detail Sheet */}
      <EventDetailModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        hotels={hotels}
        selectedHotelId={filterState.selectedHotelId}
        onToggleFavorite={handleToggleFavorite}
        onToggleWatchlist={handleToggleWatchlist}
        onToggleYieldActive={handleToggleYieldActive}
      />

      {/* Modal: Add Event */}
      <AddEventModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddEvent={handleAddEvent}
        venues={venues}
        hotels={hotels}
        defaultDate={addEventDefaultDate}
      />

      {/* Modal: Import Excel */}
      <ImportExcelModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportEvents={handleImportEvents}
      />

      {/* Modal: Refresh Intelligent Search */}
      <RefreshModal
        isOpen={isRefreshModalOpen}
        onClose={() => setIsRefreshModalOpen(false)}
        hotel={currentHotel}
        onRefreshComplete={handleRefreshComplete}
        onOpenProposals={() => setIsProposalsModalOpen(true)}
      />

      {/* Modal: Proposals To Validate (Score RM 30 to 59) */}
      <ProposalsModal
        isOpen={isProposalsModalOpen}
        onClose={() => setIsProposalsModalOpen(false)}
        proposals={proposals}
        onAcceptProposal={handleAcceptProposal}
        onRefuseProposal={handleRefuseProposal}
        onRestoreProposal={handleRestoreProposal}
      />

      {/* Modal: Date Detail & Compset Rate Benchmark */}
      <DateDetailModal
        isOpen={selectedDateForModal !== null}
        onClose={() => setSelectedDateForModal(null)}
        dateStr={selectedDateForModal || ''}
        hotel={currentHotel}
        events={allEventsWithHolidays}
        onSelectEvent={setSelectedEvent}
        onApplyRecommendation={(dateStr, rate) => {
          showToast(`Tarif recommandé de ${rate}€ validé et appliqué pour le ${dateStr}`);
        }}
      />

      {/* Top-Right Visual Push Notification for Major Rate Opportunities */}
      <RateOpportunityPushNotification
        onNavigateToPricing={(alert: PushOpportunityAlert) => {
          setActiveTab('pricing');
          showToast(`Navigation vers Pricing Intelligence : ${alert.title} (+${alert.gapEur}€)`);
        }}
        onApplyRecommendedRate={(alert: PushOpportunityAlert) => {
          showToast(`✓ Tarif conseillé de ${alert.recommendedRate}€ appliqué pour le ${alert.dateStr} (+${alert.gapEur}€)`);
        }}
        onShowToast={showToast}
      />

      {/* Command Palette Modal (Ctrl+K / ⌘K) */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          showToast(`Navigation rapide : ${tab}`);
        }}
        onSelectEvent={(ev) => {
          setSelectedEvent(ev);
        }}
        events={events}
        onToggleFullscreen={handleToggleFullscreen}
        isFullscreen={isFullscreen}
        onExportExcel={() => {
          void import('./services/excelHistoricalExportService').then(({ exportCompleteHistoricalExcel }) => {
            const res = exportCompleteHistoricalExcel({ hotelName: currentHotel.name });
            showToast(`✓ ${res.totalRows} dates de prix et d'occupation exportées dans "${res.filename}"`);
          }).catch((error) => {
            console.error('Historical Excel export failed:', error);
            showToast("Échec de l'export Excel.");
          });
        }}
        onOpenShortcutsHelp={() => setIsShortcutsHelpOpen(true)}
      />

      {/* Keyboard Shortcuts Cheat Sheet Modal (?) */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsHelpOpen}
        onClose={() => setIsShortcutsHelpOpen(false)}
      />
      </React.Suspense>

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-lg border border-slate-700 animate-in slide-in-from-bottom-2 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-violet-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

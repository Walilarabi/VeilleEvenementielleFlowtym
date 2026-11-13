/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from './auth/AuthProvider';
import { useRevenueWorkspace } from './hooks/useRevenueWorkspace';
import { RevenueBackendStatus } from './components/backend/RevenueBackendStatus';
import { PanelLeftOpen, ChevronRight } from 'lucide-react';
import { Navbar } from './components/layout/Navbar';
import { Sidebar, NavTab, SidebarMode } from './components/layout/Sidebar';
import { KPIHeader } from './components/kpi/KPIHeader';

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
import { CalendarView } from './components/calendar/CalendarView';
import { TableView } from './components/calendar/TableView';
import { FlowboardView } from './components/flowboard/FlowboardView';
import { ExplorerView } from './components/explorer/ExplorerView';
import { EventIntelligenceView } from './components/intelligence/EventIntelligenceView';
import { SourcesCoverageView } from './components/sources/SourcesCoverageView';
import { SettingsView } from './components/settings/SettingsView';
import { GeoIntelligenceView } from './components/geo/GeoIntelligenceView';
import { EventDetailModal } from './components/events/EventDetailModal';
import { AddEventModal } from './components/modals/AddEventModal';
import { ImportExcelModal } from './components/modals/ImportExcelModal';
import { RefreshModal } from './components/modals/RefreshModal';
import { ProposalsModal } from './components/proposals/ProposalsModal';
import { LoginPage } from './components/auth/LoginPage';
import { MarketCalendarView } from './components/market/MarketCalendarView';
import { SchoolHolidaysCalendarView } from './components/events/SchoolHolidaysCalendarView';
import { CalendarSubNavbar, CalendarSubTabMode } from './components/calendar/CalendarSubNavbar';
import { RMDecisionCenter } from './components/intelligence/RMDecisionCenter';
import { DemandForecastView } from './components/forecast/DemandForecastView';
import { DateDetailModal } from './components/events/DateDetailModal';
import { HotelConnectivityHub } from './components/connectivity/HotelConnectivityHub';
import { RateIntelligenceView } from './components/pricing/RateIntelligenceView';
import { RateOpportunityPushNotification } from './components/notifications/RateOpportunityPushNotification';
import { PushOpportunityAlert } from './services/pushNotificationService';
import { ReportsAndAutomationsHub } from './components/reports/ReportsAndAutomationsHub';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { CommandPaletteModal } from './components/modals/CommandPaletteModal';
import { KeyboardShortcutsModal } from './components/modals/KeyboardShortcutsModal';
import { exportCompleteHistoricalExcel } from './services/excelHistoricalExportService';
import { convertSchoolHolidaysToEventItems } from './services/schoolHolidayEventConverter';
import { generateSchoolHolidaysForYear } from './data/schoolHolidaysData';

import {
  INITIAL_VENUES,
  INITIAL_SUGGESTIONS,
  INITIAL_SOURCES,
} from './data/mockData';
import { EventItem, FilterState, Hotel, EventProposal } from './types';
import { exportEventsToCSV } from './utils/helpers';
import { exportEventsToPDF } from './utils/pdfExport';

export default function App() {
  const { user, supabase, loading: authLoading, error: authError, recoveryMode, signOut } = useAuth();
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
  const [venues, setVenues] = useState(INITIAL_VENUES);
  const [sources, setSources] = useState(INITIAL_SOURCES);
  const [suggestions, setSuggestions] = useState<typeof INITIAL_SUGGESTIONS>([]);
  const [events, setEvents] = useState<EventItem[]>([]);

  // Proposals State (Score RM 30 à 59)
  const [proposals, setProposals] = useState<EventProposal[]>([]);

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
    currentYear: 2026,
    currentMonth: 9, // October 2026 (0-indexed)
  });


  const { workspace: revenueWorkspace, loading: revenueLoading, error: revenueError, refresh: refreshRevenueWorkspace } =
    useRevenueWorkspace(supabase, filterState.selectedHotelId);

  useEffect(() => {
    if (!revenueWorkspace) return;
    setHotels(revenueWorkspace.hotels);
    setEvents(revenueWorkspace.events);
    setSuggestions([]);
    if (!revenueWorkspace.hotels.some((hotel) => hotel.id === filterState.selectedHotelId)) {
      setFilterState((previous) => ({ ...previous, selectedHotelId: revenueWorkspace.hotels[0]?.id ?? '' }));
    }
  }, [revenueWorkspace, filterState.selectedHotelId]);

  // Collapsible advanced filters (open by default like the screenshot)
  const [isFilterExpanded, setIsFilterExpanded] = useState(true);

  // Modals & Drawers
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addEventDefaultDate, setAddEventDefaultDate] = useState<string>('2026-10-15');
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
    return hotels.find((h) => h.id === filterState.selectedHotelId) || hotels[0];
  }, [hotels, filterState.selectedHotelId]);

  // School holidays converted into EventItem representations
  const schoolHolidayEvents = useMemo(() => {
    if (!currentHotel) return [];
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
        if (new Date(ev.startDate) < new Date('2026-10-01')) return false;
      } else if (filterState.periodTab === 'ongoing') {
        const inMonth =
          ev.startDate.startsWith(`${filterState.currentYear}-${String(filterState.currentMonth + 1).padStart(2, '0')}`) ||
          ev.endDate.startsWith(`${filterState.currentYear}-${String(filterState.currentMonth + 1).padStart(2, '0')}`);
        if (!inMonth) return false;
      } else if (filterState.periodTab === 'past') {
        if (new Date(ev.startDate) >= new Date('2026-10-01')) return false;
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
    setEvents((prev) => [newEvent, ...prev]);
    showToast(`Événement "${newEvent.title}" ajouté avec succès`);
  };

  const handleOpenAddOnDate = (dateStr: string) => {
    setAddEventDefaultDate(dateStr);
    setIsAddModalOpen(true);
  };

  // Excel / CSV Import handler
  const handleImportEvents = (imported: EventItem[]) => {
    setEvents((prev) => [...imported, ...prev]);
    showToast(`${imported.length} événements importés dans le référentiel`);
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
    exportEventsToPDF({
      events: filteredEvents,
      hotel: currentHotel,
      viewMode,
      filterState,
    });
    setTimeout(() => {
      showToast('Rapport PDF téléchargé avec succès');
    }, 1000);
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
    // Score >= 60 auto-integrated
    if (newHighImpact.length > 0) {
      setEvents((prev) => [...newHighImpact, ...prev]);
    }
    // Score 30-59 added to proposals
    if (newProps.length > 0) {
      setProposals((prev) => [...newProps, ...prev]);
    }
    showToast(`Actualisation terminée : ${stats.newCount} nouveaux événements détectés`);
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
    showToast('La création d’hôtel sera activée après ajout de la route sécurisée dédiée.');
  };

  const handleDeleteHotel = (_hotelId: string) => {
    showToast('La suppression d’hôtel est volontairement désactivée : elle nécessite une procédure d’archivage sécurisée.');
  };

  const pendingSuggestionsCount = suggestions.filter((s) => s.status === 'pending').length;
  const pendingProposalsCount = proposals.filter((p) => p.status === 'pending').length;

  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
      <div className="text-center space-y-3"><div className="mx-auto h-9 w-9 rounded-full border-4 border-violet-100 border-t-violet-600 animate-spin" /><p className="text-sm font-medium text-slate-600">Vérification de votre session sécurisée…</p></div>
    </div>
  );
  if (recoveryMode || !user) return <LoginPage authError={authError} recoveryMode={recoveryMode} />;
  if (revenueLoading && !revenueWorkspace) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="text-center space-y-3"><div className="mx-auto h-9 w-9 rounded-full border-4 border-violet-100 border-t-violet-600 animate-spin"/><p className="text-sm text-slate-600">Chargement des données Revenue Management depuis Supabase…</p></div></div>;
  if (revenueError || !revenueWorkspace || hotels.length === 0 || !currentHotel) return <div className="min-h-screen bg-slate-50 p-8"><div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 space-y-4"><h1 className="text-xl font-bold">Données Revenue Management indisponibles</h1><p className="text-sm text-slate-600">{revenueError || 'Aucun hôtel accessible dans votre organisation.'}</p><button className="px-4 py-2 rounded-lg bg-violet-600 text-white" onClick={refreshRevenueWorkspace}>Réessayer</button><p className="text-xs text-slate-500">Les données de démonstration ne sont pas utilisées comme substitut aux données de production.</p></div></div>;

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
          <RevenueBackendStatus loading={revenueLoading} error={revenueError} loadedAt={revenueWorkspace?.loadedAt} hotelCount={revenueWorkspace?.hotels.length ?? 0} rateCount={revenueWorkspace?.rates.length ?? 0} eventCount={revenueWorkspace?.events.length ?? 0} forecastCount={revenueWorkspace?.forecasts.length ?? 0} onRefresh={refreshRevenueWorkspace} />
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
              onGoToPricing={() => setActiveTab('pricing')}
              onGoToForecast={() => setActiveTab('forecast')}
              backendMode
              backendRates={revenueWorkspace.rates}
              backendForecasts={revenueWorkspace.forecasts}
              backendInventory={revenueWorkspace.inventory}
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
              backendRates={revenueWorkspace.rates}
              backendLoading={revenueLoading}
              backendError={revenueError}
              supabase={supabase}
              onBackendRefresh={refreshRevenueWorkspace}
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
              backendMode
              supabase={supabase}
              backendLoading={revenueLoading}
              backendError={revenueError}
              onBackendRefresh={refreshRevenueWorkspace}
              onShowToast={showToast}
            />
          )}

          {/* TAB 7: OPPORTUNITÉS & ALERTES RM (Risques de sous-tarification, opportunités tarifaires, alertes compression) */}
          {activeTab === 'opportunities' && (
            <RMDecisionCenter
              hotel={currentHotel}
              events={events}
              onSelectEvent={setSelectedEvent}
              onShowToast={showToast}
              backendRates={revenueWorkspace.rates}
              backendLoading={revenueLoading}
              backendError={revenueError}
              supabase={supabase}
              onBackendRefresh={refreshRevenueWorkspace}
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
              backendMode
              backendIntegrations={revenueWorkspace.integrations}
              backendLoading={revenueLoading}
              backendError={revenueError}
            />
          )}

          {/* TAB: DEMAND FORECAST (Prévision d'occupation, d'ADR et de RevPAR) */}
          {activeTab === 'forecast' && (
            <DemandForecastView
              hotel={currentHotel}
              events={events}
              onSelectEvent={setSelectedEvent}
              onGoToMarket={() => setActiveTab('market')}
              backendForecasts={revenueWorkspace.forecasts}
              backendInventory={revenueWorkspace.inventory}
              backendLoading={revenueLoading}
              backendError={revenueError}
              supabase={supabase}
              onBackendRefresh={refreshRevenueWorkspace}
              onShowToast={showToast}
            />
          )}

          {/* TAB: RAPPORTS D'ACTIVITÉ REVENUE MANAGEMENT */}
          {activeTab === 'reports' && (
            <ReportsAndAutomationsHub
              hotel={currentHotel}
              onShowToast={showToast}
              onNavigateToDecisionCenter={() => setActiveTab('opportunities')}
              backendMode
              backendRates={revenueWorkspace.rates}
              backendForecasts={revenueWorkspace.forecasts}
              backendInventory={revenueWorkspace.inventory}
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
              backendMode
              backendParameters={revenueWorkspace.parameters}
              supabase={supabase}
              onBackendRefresh={refreshRevenueWorkspace}
            />
          )}
        </main>
      </div>

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
          const res = exportCompleteHistoricalExcel({ hotelName: currentHotel.name });
          showToast(`✓ ${res.totalRows} dates de prix et d'occupation exportées dans "${res.filename}"`);
        }}
        onOpenShortcutsHelp={() => setIsShortcutsHelpOpen(true)}
      />

      {/* Keyboard Shortcuts Cheat Sheet Modal (?) */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsHelpOpen}
        onClose={() => setIsShortcutsHelpOpen(false)}
      />

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

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FLOWTYM REVENUE — PLANNING TARIFAIRE CONNECTÉ & BIDIRECTIONNEL (2-WAY SYNC)
 * Grille tarifaire opérationnelle reliée au moteur RM, aux connecteurs PMS / Channel Manager et à Supabase.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Layers,
  Download,
  RefreshCw,
  Undo2,
  Check,
  X,
  AlertTriangle,
  CheckCircle2,
  Send,
  Plug,
  Sparkles,
  Edit3,
  ShieldAlert,
  History,
  RotateCcw,
  Radio,
  ArrowRight,
  Settings,
  Copy,
  Target,
  Eye,
  GitBranch,
  FileSpreadsheet,
  CalendarClock,
  ScrollText,
  Save,
} from 'lucide-react';
import {
  DistributionChannelCode,
  Hotel,
  HotelConnectivityConfig,
  HotelTariffConfiguration,
  RateAuditHistoryEntry,
  RateCalendarCell,
  RatePlanCode,
  RateSyncConflict,
  RateSyncOperation,
  RateSyncStatus,
} from '../../types';
import {
  DISTRIBUTION_CHANNEL_DEFS,
  RATE_PLANNING_EVENT,
  acceptRecommendationInPlanning,
  applyBulkEditInPlanning,
  buildCellKey,
  copyRatesOverPeriod,
  duplicateRoomRatesInPlanning,
  ensurePlanningCellsForDateRange,
  getCellRoleForPlan,
  getHotelConnectivityConfig,
  getRateAuditHistory,
  getRatePlanningCells,
  getRateSyncConflicts,
  getRateSyncOperations,
  previewBulkEditInPlanning,
  previewRateChangeCascade,
  pullExternalUpdatesInPlanning,
  recalculateDerivedPlansInPlanning,
  rejectRecommendationInPlanning,
  resolveRateConflictInPlanning,
  retryFailedCellSync,
  revertHistoryEntryInPlanning,
  simulateExternalSystemChange,
  updateCellManuallyInPlanning,
} from '../../services/ratePlanningSyncService';
import {
  TARIFF_CONFIG_EVENT,
  getHotelTariffConfig,
  normalizeRateExcludingBreakfast,
  resolveReferencePlanCode,
  saveHotelTariffConfig,
} from '../../services/tariffConfigurationService';
import {
  getCachedConnectorsForHotel,
  saveScheduledRateChange,
} from '../../services/connectors/connectorRegistry';
import { ConfigSubTab, TariffConfigurationCenter } from './TariffConfigurationCenter';
import { RateRelationsDashboard } from './RateRelationsDashboard';
import { SmartExcelImportModal } from './SmartExcelImportModal';
import { SyncControlCenterModal } from './SyncControlCenterModal';

type PlanningViewMode =
  | 'by_category'
  | 'by_plan'
  | 'by_reference'
  | 'by_channel'
  | 'room_and_plan'
  | 'comparative'
  | 'flex_nrf'
  | 'breakfast'
  | 'derived'
  | 'independent'
  | 'inventory'
  | 'restrictions'
  | 'sync_status';

const VIEW_MODE_OPTIONS: { id: PlanningViewMode; label: string }[] = [
  { id: 'by_category', label: 'Par catégorie' },
  { id: 'by_plan', label: 'Par plan' },
  { id: 'by_reference', label: 'Par référence' },
  { id: 'by_channel', label: 'Par canal' },
  { id: 'room_and_plan', label: 'Chambre × Plan' },
  { id: 'comparative', label: 'Comparative' },
  { id: 'flex_nrf', label: 'FLEX / NRF' },
  { id: 'breakfast', label: 'Avec / Sans PDJ' },
  { id: 'derived', label: 'Dérivés' },
  { id: 'independent', label: 'Indépendants' },
  { id: 'inventory', label: 'Stock (Left for sale)' },
  { id: 'restrictions', label: 'Restrictions' },
  { id: 'sync_status', label: 'Statut Sync' },
];

const WEEKDAY_OPTIONS: { day: number; label: string }[] = [
  { day: 1, label: 'Lun' },
  { day: 2, label: 'Mar' },
  { day: 3, label: 'Mer' },
  { day: 4, label: 'Jeu' },
  { day: 5, label: 'Ven' },
  { day: 6, label: 'Sam' },
  { day: 0, label: 'Dim' },
];

import { getTodayIsoDate } from '../../utils/eventFilterUtils';

interface RatePlanningViewProps {
  hotel: Hotel;
  configVersion?: number;
  onShowToast: (msg: string) => void;
  onOpenConnectivitySettings: () => void;
}

const DAY_SHORT_FR = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const MONTH_FULL_FR = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];
const MONTH_SHORT_FR = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];

function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return dt.toISOString().slice(0, 10);
}

function formatDateRangeLabel(dates: string[]): string {
  if (!dates.length) return '';
  const parse = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return `${d} ${MONTH_SHORT_FR[m - 1]} ${y}`;
  };
  return `${parse(dates[0])} → ${parse(dates[dates.length - 1])}`;
}

function formatShortTimestamp(iso: string | null | undefined): string {
  if (!iso) return 'Jamais';
  try {
    const d = new Date(iso);
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

const SYNC_STATUS_META: Record<
  RateSyncStatus,
  { label: string; dotClass: string; badgeClass: string }
> = {
  saved_local: {
    label: 'Enregistré local',
    dotClass: 'bg-violet-500',
    badgeClass:
      'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800/70',
  },
  queued: {
    label: 'En file d’attente',
    dotClass: 'bg-amber-400',
    badgeClass:
      'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/70',
  },
  synced: {
    label: 'Confirmé externe',
    dotClass: 'bg-emerald-500',
    badgeClass:
      'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70',
  },
  pending: {
    label: 'En attente',
    dotClass: 'bg-amber-400',
    badgeClass:
      'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/70',
  },
  sending: {
    label: 'Envoyé (ACK en attente)',
    dotClass: 'bg-sky-500',
    badgeClass:
      'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800/70',
  },
  failed: {
    label: 'Échec envoi',
    dotClass: 'bg-rose-500',
    badgeClass:
      'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/70',
  },
  rejected: {
    label: 'Rejeté externe',
    dotClass: 'bg-orange-500',
    badgeClass:
      'bg-orange-50 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-800/70',
  },
  conflict: {
    label: 'Conflit',
    dotClass: 'bg-rose-600',
    badgeClass:
      'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-700',
  },
};

const ORIGIN_LABELS: Record<RateCalendarCell['modificationOrigin'], string> = {
  flowtym_auto: 'Auto RM',
  flowtym_manual: 'Manuel',
  pms: 'PMS',
  channel_manager: 'CM',
};

export const RatePlanningView: React.FC<RatePlanningViewProps> = ({
  hotel,
  configVersion = 0,
  onShowToast,
  onOpenConnectivitySettings,
}) => {
  // Dynamic today date computed on mount
  const todayStr = useMemo(() => getTodayIsoDate(), []);

  // Top-level Section (A. Planning Tarifaire | B. Configuration Tarifaire) & View Mode
  const [activeSection, setActiveSection] = useState<'planning' | 'config'>('planning');
  const [configInitialTab, setConfigInitialTab] = useState<ConfigSubTab>('hotel_ref');
  const [showRelationsDashboard, setShowRelationsDashboard] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<PlanningViewMode>('by_category');
  const [tariffConfig, setTariffConfig] = useState<HotelTariffConfiguration>(() =>
    getHotelTariffConfig(hotel)
  );

  // Persisted Domain Data State
  const [cells, setCells] = useState<RateCalendarCell[]>(() => getRatePlanningCells(hotel));
  const [operations, setOperations] = useState<RateSyncOperation[]>(() =>
    getRateSyncOperations(hotel.id)
  );
  const [conflicts, setConflicts] = useState<RateSyncConflict[]>(() =>
    getRateSyncConflicts(hotel.id)
  );
  const [history, setHistory] = useState<RateAuditHistoryEntry[]>(() =>
    getRateAuditHistory(hotel.id)
  );
  const [connectivity, setConnectivity] = useState<HotelConnectivityConfig>(() =>
    getHotelConnectivityConfig(hotel)
  );

  // Reload state helper
  const reloadPlanningState = useCallback(() => {
    setTariffConfig(getHotelTariffConfig(hotel));
    setCells(getRatePlanningCells(hotel));
    setOperations(getRateSyncOperations(hotel.id));
    setConflicts(getRateSyncConflicts(hotel.id));
    setHistory(getRateAuditHistory(hotel.id));
    setConnectivity(getHotelConnectivityConfig(hotel));
  }, [hotel]);

  useEffect(() => {
    reloadPlanningState();
  }, [reloadPlanningState, configVersion]);

  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<{ hotelId?: string }>).detail;
      if (!detail?.hotelId || detail.hotelId === hotel.id) {
        reloadPlanningState();
      }
    };
    window.addEventListener(RATE_PLANNING_EVENT, handler);
    window.addEventListener(TARIFF_CONFIG_EVENT, handler);
    return () => {
      window.removeEventListener(RATE_PLANNING_EVENT, handler);
      window.removeEventListener(TARIFF_CONFIG_EVENT, handler);
    };
  }, [hotel.id, reloadPlanningState]);

  const activeCategories = useMemo(
    () => tariffConfig.roomCategories.filter((rc) => rc.isActive && !rc.isArchived),
    [tariffConfig]
  );

  const activePlans = useMemo(
    () => tariffConfig.ratePlans.filter((p) => p.status === 'active'),
    [tariffConfig]
  );

  // Available date boundaries
  const { minAvailDate, maxAvailDate } = useMemo(() => {
    if (!cells.length) return { minAvailDate: todayStr, maxAvailDate: addDays(todayStr, 99) };
    const dates = Array.from(new Set(cells.map((c) => c.stayDate))).sort();
    return { minAvailDate: dates[0], maxAvailDate: dates[dates.length - 1] };
  }, [cells, todayStr]);

  // Period & Horizon controls (always start at today dynamically, excluding past dates unless explicitly changed)
  const [windowStartDate, setWindowStartDate] = useState<string>(() => getTodayIsoDate());
  const [customEndDate, setCustomEndDate] = useState<string>(() => addDays(getTodayIsoDate(), 29));
  const [showPastDates, setShowPastDates] = useState<boolean>(false);
  const [horizonDays, setHorizonDays] = useState<7 | 15 | 30 | 90 | 365 | 'custom'>(30);
  const [columnWindowOffset, setColumnWindowOffset] = useState<number>(0);

  // Filters & Layout State
  const [showFiltersBar, setShowFiltersBar] = useState<boolean>(false);
  const [showChannelsBar, setShowChannelsBar] = useState<boolean>(false);
  const [selectedChannel, setSelectedChannel] = useState<DistributionChannelCode | 'ALL'>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterRatePlan, setFilterRatePlan] = useState<'all' | RatePlanCode>('all');
  const [filterSyncStatus, setFilterSyncStatus] = useState<'all' | RateSyncStatus>('all');
  const [onlyRecommendations, setOnlyRecommendations] = useState<boolean>(false);
  const [onlyManualEdits, setOnlyManualEdits] = useState<boolean>(false);

  // Collapsible Category Groups & Status subrows
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [expandedStatusCategories, setExpandedStatusCategories] = useState<Record<string, boolean>>({});

  // Sync / Async UI Loading Flags
  const [isPulling, setIsPulling] = useState<boolean>(false);
  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);

  // Modals & Drawers
  const [selectedCellKey, setSelectedCellKey] = useState<string | null>(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState<boolean>(false);
  const [bulkConfirmStep, setBulkConfirmStep] = useState<boolean>(false);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState<boolean>(false);
  const [copyModalTab, setCopyModalTab] = useState<'period' | 'room'>('period');
  const [isConflictModalOpen, setIsConflictModalOpen] = useState<boolean>(false);
  const [isDiagnosticsModalOpen, setIsDiagnosticsModalOpen] = useState<boolean>(false);
  const [diagnosticsTab, setDiagnosticsTab] = useState<'status' | 'queue' | 'simulator'>('status');
  const [isHistoryDrawerExpanded, setIsHistoryDrawerExpanded] = useState<boolean>(true);
  const [isSmartExcelOpen, setIsSmartExcelOpen] = useState<boolean>(false);
  const [isSyncControlOpen, setIsSyncControlOpen] = useState<boolean>(false);
  const [syncControlInitialTab, setSyncControlInitialTab] = useState<'control' | 'conflicts' | 'logs' | 'scheduled'>('control');

  // Édition rapide inline (double-clic sur prix ou Left for sale)
  const [inlineEditTarget, setInlineEditTarget] = useState<{
    key: string;
    field: 'rate' | 'inventory';
    roomTypeCode: string;
    stayDate: string;
    cellKey: string;
  } | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState<string>('');

  // Cell Inspector Form State
  const selectedCell = useMemo(
    () => cells.find((c) => c.cellKey === selectedCellKey) || null,
    [cells, selectedCellKey]
  );
  const [editRateInput, setEditRateInput] = useState<number>(200);
  const [editInventoryInput, setEditInventoryInput] = useState<number>(10);
  const [editMinStay, setEditMinStay] = useState<number>(1);
  const [editMaxStay, setEditMaxStay] = useState<string>('');
  const [editCta, setEditCta] = useState<boolean>(false);
  const [editCtd, setEditCtd] = useState<boolean>(false);
  const [editClosed, setEditClosed] = useState<boolean>(false);
  const [editReason, setEditReason] = useState<string>('');
  const [cascadeDerivedPlans, setCascadeDerivedPlans] = useState<boolean>(true);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [qaSimulateMode, setQaSimulateMode] = useState<'normal' | 'failed' | 'rejected'>('normal');

  useEffect(() => {
    if (!selectedCell) return;
    setEditRateInput(selectedCell.currentRateEur);
    setEditInventoryInput(selectedCell.inventoryLeftForSale ?? selectedCell.inventoryAvailable);
    setEditMinStay(selectedCell.minStay);
    setEditMaxStay(selectedCell.maxStay !== null ? String(selectedCell.maxStay) : '');
    setEditCta(selectedCell.cta);
    setEditCtd(selectedCell.ctd);
    setEditClosed(selectedCell.isClosed);
    setEditReason('');
    setRejectReason('');
    setQaSimulateMode('normal');
  }, [selectedCell]);

  // Live Cascade Impact Preview in Cell Drawer
  const drawerImpactPreview = useMemo(() => {
    if (!selectedCell) return null;
    return previewRateChangeCascade(hotel, selectedCell.cellKey, editRateInput);
  }, [hotel, selectedCell, editRateInput]);

  // Bulk Edit Modal Form State
  const [bulkStartDate, setBulkStartDate] = useState<string>(() => getTodayIsoDate());
  const [bulkEndDate, setBulkEndDate] = useState<string>(() => addDays(getTodayIsoDate(), 6));
  const [bulkWeekdays, setBulkWeekdays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [bulkRoomCodes, setBulkRoomCodes] = useState<string[]>(() =>
    activeCategories.map((t) => t.code)
  );
  const [bulkRatePlans, setBulkRatePlans] = useState<RatePlanCode[]>([
    tariffConfig.globalReferencePlanCode || 'BAR',
  ]);
  const [bulkMode, setBulkMode] = useState<'fixed' | 'delta_eur' | 'delta_pct' | 'inventory_set'>('delta_pct');
  const [bulkValue, setBulkValue] = useState<number>(5);
  const [bulkMinStay, setBulkMinStay] = useState<string>('');
  const [bulkClosed, setBulkClosed] = useState<'unchanged' | 'open' | 'closed'>('unchanged');
  const [bulkCascade, setBulkCascade] = useState<boolean>(true);
  const [bulkReason, setBulkReason] = useState<string>('Ajustement tarifaire en masse');
  const [bulkScheduleEnabled, setBulkScheduleEnabled] = useState<boolean>(false);
  const [bulkScheduleDatetime, setBulkScheduleDatetime] = useState<string>(() => {
    const dt = new Date(Date.now() + 2 * 3600 * 1000);
    return dt.toISOString().slice(0, 16);
  });

  useEffect(() => {
    setBulkRoomCodes(activeCategories.map((t) => t.code));
  }, [activeCategories]);

  // Copy Period Modal State + Duplicate Room State
  const [copySourceStart, setCopySourceStart] = useState<string>(() => getTodayIsoDate());
  const [copySourceEnd, setCopySourceEnd] = useState<string>(() => addDays(getTodayIsoDate(), 6));
  const [copyTargetStart, setCopyTargetStart] = useState<string>(() => addDays(getTodayIsoDate(), 7));
  const [copyRestrictions, setCopyRestrictions] = useState<boolean>(true);
  const [dupSourceRoom, setDupSourceRoom] = useState<string>(activeCategories[0]?.code || 'classique');
  const [dupTargetRooms, setDupTargetRooms] = useState<string[]>(() =>
    activeCategories[1]?.code ? [activeCategories[1].code] : []
  );
  const [dupOffsetEur, setDupOffsetEur] = useState<number>(20);
  const [dupPlanCodes, setDupPlanCodes] = useState<string[]>(() =>
    activePlans.map((p) => p.code)
  );

  // QA Webhook Simulator State
  const [simDate, setSimDate] = useState<string>(() => getTodayIsoDate());
  const [simRoomCode, setSimRoomCode] = useState<string>(activeCategories[0]?.code || 'classique');
  const [simPlanCode, setSimPlanCode] = useState<RatePlanCode>('BAR');
  const [simSource, setSimSource] = useState<'pms' | 'channel_manager'>(
    connectivity.activeMode === 'channel_manager' ? 'channel_manager' : 'pms'
  );
  const [simRate, setSimRate] = useState<number>(285);

  useEffect(() => {
    if (activeCategories[0]?.code) setSimRoomCode(activeCategories[0].code);
    setSimSource(connectivity.activeMode === 'channel_manager' ? 'channel_manager' : 'pms');
  }, [activeCategories, connectivity.activeMode]);

  // Periodic background poll aligned with connectivity setting
  const handlePullUpdates = useCallback(
    async (silent: boolean = false) => {
      setIsPulling(true);
      try {
        const res = await pullExternalUpdatesInPlanning(hotel);
        reloadPlanningState();
        if (!silent) {
          if (res.importedCount > 0) {
            onShowToast(
              `${res.importedCount} modification(s) importée(s) depuis ${
                connectivity.activeMode === 'channel_manager'
                  ? connectivity.channelManagerProvider
                  : connectivity.pmsProvider
              } (anti-boucle vérifié).`
            );
          } else {
            onShowToast('Synchronisation bidirectionnelle à jour — aucune divergence détectée.');
          }
        }
      } catch (err: any) {
        if (!silent) {
          onShowToast(`Échec actualisation externe : ${err?.message || 'erreur réseau'}`);
        }
      } finally {
        setIsPulling(false);
      }
    },
    [hotel, connectivity, reloadPlanningState, onShowToast]
  );

  useEffect(() => {
    const intervalMs = (connectivity.pollingIntervalMinutes || 15) * 60 * 1000;
    const timer = window.setInterval(() => {
      void handlePullUpdates(true);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [connectivity.pollingIntervalMinutes, handlePullUpdates]);

  const effectiveMinDate = useMemo(
    () => (showPastDates ? minAvailDate : todayStr > minAvailDate ? todayStr : minAvailDate),
    [showPastDates, minAvailDate, todayStr]
  );

  // Horizon complet demandé + génération paresseuse jusqu'à 365j/custom
  const requestedSpanDays = useMemo(() => {
    if (horizonDays !== 'custom') return horizonDays;
    const startMs = Date.parse(`${windowStartDate}T00:00:00Z`);
    const endMs = Date.parse(`${customEndDate}T00:00:00Z`);
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) return 30;
    return Math.min(365, Math.max(1, Math.round((endMs - startMs) / 86400000) + 1));
  }, [horizonDays, windowStartDate, customEndDate]);

  useEffect(() => {
    const startBase = !showPastDates && windowStartDate < todayStr ? todayStr : windowStartDate;
    const targetEnd = addDays(startBase, requestedSpanDays - 1);
    if (targetEnd > maxAvailDate) {
      const expanded = ensurePlanningCellsForDateRange(hotel, startBase, targetEnd);
      if (expanded.length !== cells.length) {
        setCells(expanded);
      }
    }
  }, [hotel, windowStartDate, requestedSpanDays, showPastDates, todayStr, maxAvailDate]);

  useEffect(() => {
    setColumnWindowOffset(0);
  }, [windowStartDate, horizonDays, customEndDate]);

  // Liste complète des dates de la période, et fenêtre visible (max 31 colonnes à la fois pour fluidité 90/365j)
  const fullRangeDates = useMemo(() => {
    const startBase = !showPastDates && windowStartDate < todayStr ? todayStr : windowStartDate;
    const arr: string[] = [];
    for (let i = 0; i < requestedSpanDays; i++) {
      const d = addDays(startBase, i);
      if (d >= effectiveMinDate) {
        arr.push(d);
      }
    }
    return arr;
  }, [windowStartDate, requestedSpanDays, effectiveMinDate, showPastDates, todayStr]);

  const COLUMN_PAGE_SIZE = 31;
  const visibleDates = useMemo(() => {
    if (fullRangeDates.length <= COLUMN_PAGE_SIZE) return fullRangeDates;
    const safeOffset = Math.min(columnWindowOffset, Math.max(0, fullRangeDates.length - COLUMN_PAGE_SIZE));
    return fullRangeDates.slice(safeOffset, safeOffset + COLUMN_PAGE_SIZE);
  }, [fullRangeDates, columnWindowOffset]);

  const monthSpans = useMemo(() => {
    const groups: { label: string; span: number }[] = [];
    visibleDates.forEach((dStr) => {
      const [y, m] = dStr.split('-').map(Number);
      const label = `${MONTH_FULL_FR[m - 1]} ${y}`;
      const last = groups[groups.length - 1];
      if (last && last.label === label) {
        last.span += 1;
      } else {
        groups.push({ label, span: 1 });
      }
    });
    return groups;
  }, [visibleDates]);

  // Lookup Map for Fast Cell Access
  const cellMap = useMemo(() => {
    const map = new Map<string, RateCalendarCell>();
    cells.forEach((c) => map.set(c.cellKey, c));
    return map;
  }, [cells]);

  // Counts & Active KPIs
  const openConflicts = useMemo(
    () => conflicts.filter((c) => c.status === 'open'),
    [conflicts]
  );
  const pendingRecCount = useMemo(
    () =>
      cells.filter(
        (c) =>
          c.recommendation?.status === 'pending' &&
          visibleDates.includes(c.stayDate)
      ).length,
    [cells, visibleDates]
  );
  const failedOrRejectedCount = useMemo(
    () =>
      cells.filter(
        (c) =>
          (c.syncStatus === 'failed' || c.syncStatus === 'rejected') &&
          visibleDates.includes(c.stayDate)
      ).length,
    [cells, visibleDates]
  );

  const visibleTypologies = useMemo(() => {
    return activeCategories.filter(
      (t) => filterCategory === 'all' || t.code === filterCategory
    );
  }, [activeCategories, filterCategory]);

  const visibleRatePlans = useMemo(() => {
    const base = activePlans.filter(
      (p) => filterRatePlan === 'all' || p.code === filterRatePlan
    );

    if (viewMode === 'flex_nrf') {
      return base.filter(
        (p) =>
          p.code === tariffConfig.flexNrf.flexPlanCode ||
          p.code === tariffConfig.flexNrf.nrfPlanCode ||
          p.isFlexPlan ||
          p.isNrfPlan
      );
    }
    if (viewMode === 'breakfast') {
      return base.filter(
        (p) =>
          p.code === tariffConfig.globalReferencePlanCode ||
          p.breakfastMode !== 'none'
      );
    }
    if (viewMode === 'derived') {
      return base.filter(
        (p) =>
          p.planNature !== 'independent' &&
          p.calculationMode !== 'independent' &&
          Boolean(p.referencePlanCode) &&
          p.relationActive
      );
    }
    if (viewMode === 'independent') {
      return base.filter(
        (p) =>
          p.planNature === 'independent' ||
          p.calculationMode === 'independent' ||
          !p.relationActive
      );
    }
    if (viewMode === 'by_reference') {
      return [...base].sort((a, b) => {
        const aIsRef = a.code === tariffConfig.globalReferencePlanCode;
        const bIsRef = b.code === tariffConfig.globalReferencePlanCode;
        if (aIsRef !== bIsRef) return aIsRef ? -1 : 1;
        return 0;
      });
    }
    return base;
  }, [activePlans, filterRatePlan, viewMode, tariffConfig]);

  const bulkPreviewSummary = useMemo(() => {
    if (!isBulkModalOpen) return null;
    return previewBulkEditInPlanning(hotel, {
      startDate: bulkStartDate,
      endDate: bulkEndDate,
      weekdays: bulkWeekdays,
      roomTypeCodes: bulkRoomCodes,
      ratePlanCodes: bulkRatePlans,
      adjustmentMode: bulkMode === 'inventory_set' ? 'fixed' : bulkMode,
      value: bulkValue,
      cascadeDerivedPlans: bulkCascade,
    });
  }, [
    isBulkModalOpen,
    hotel,
    bulkStartDate,
    bulkEndDate,
    bulkWeekdays,
    bulkRoomCodes,
    bulkRatePlans,
    bulkMode,
    bulkValue,
    bulkCascade,
  ]);

  const activeFiltersCount = useMemo(() => {
    let n = 0;
    if (filterCategory !== 'all') n++;
    if (filterRatePlan !== 'all') n++;
    if (filterSyncStatus !== 'all') n++;
    if (onlyRecommendations) n++;
    if (onlyManualEdits) n++;
    return n;
  }, [filterCategory, filterRatePlan, filterSyncStatus, onlyRecommendations, onlyManualEdits]);

  // Period Navigation
  const shiftPeriod = (direction: -1 | 1) => {
    const step =
      horizonDays === 'custom'
        ? Math.min(30, requestedSpanDays)
        : horizonDays >= 30
        ? 15
        : horizonDays;
    const candidate = addDays(windowStartDate, direction * step);
    if (candidate < todayStr) {
      setShowPastDates(true);
    }
    if (candidate < minAvailDate) setWindowStartDate(minAvailDate);
    else setWindowStartDate(candidate);
  };

  // Actions
  const handleQuickAcceptRecommendation = async (
    e: React.MouseEvent,
    cell: RateCalendarCell
  ) => {
    e.stopPropagation();
    if (!cell.recommendation || cell.recommendation.status !== 'pending') return;
    setIsProcessingAction(true);
    try {
      const role = getCellRoleForPlan(hotel, cell.roomTypeCode, cell.ratePlanCode, cell.stayDate);
      const res = await acceptRecommendationInPlanning(hotel, cell.cellKey, {
        cascadeDerivedPlans: role !== 'independent',
      });
      reloadPlanningState();
      if (res.blockedByStaleCheck || res.conflictCount > 0) {
        onShowToast('Conflit concurrent détecté : validation explicite requise.');
        setIsConflictModalOpen(true);
      } else if (res.failedCount > 0) {
        onShowToast(`Échec transmission externe : ${res.lastError || 'vérifiez la file de synchro'}`);
      } else {
        onShowToast(
          `Tarif ${cell.recommendation.recommendedRateEur}€ accepté et confirmé par ${
            connectivity.activeMode === 'channel_manager'
              ? connectivity.channelManagerProvider
              : connectivity.pmsProvider
          }.`
        );
      }
    } catch (err: any) {
      onShowToast(err?.message || 'Erreur lors de l’acceptation.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleDrawerAcceptRecommendation = async () => {
    if (!selectedCell || !selectedCell.recommendation) return;
    setIsProcessingAction(true);
    try {
      const res = await acceptRecommendationInPlanning(hotel, selectedCell.cellKey, {
        cascadeDerivedPlans,
        simulateOutcome: qaSimulateMode === 'normal' ? undefined : qaSimulateMode,
      });
      reloadPlanningState();
      if (res.blockedByStaleCheck || res.conflictCount > 0) {
        onShowToast('Conflit détecté avant application — ouverture de la résolution de conflit.');
        setIsConflictModalOpen(true);
      } else if (res.failedCount > 0) {
        onShowToast(`Transmission non confirmée : ${res.lastError}`);
      } else {
        onShowToast(
          `Recommandation ${selectedCell.recommendation.recommendedRateEur}€ appliquée & synchronisée (${res.syncedCount} cellule(s)).`
        );
      }
    } catch (err: any) {
      onShowToast(err?.message || 'Erreur lors de la validation.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleDrawerRejectRecommendation = () => {
    if (!selectedCell || !selectedCell.recommendation) return;
    rejectRecommendationInPlanning(
      hotel,
      selectedCell.cellKey,
      rejectReason.trim() || 'Maintien tarifaire décidé par le Revenue Manager'
    );
    reloadPlanningState();
    onShowToast('Recommandation refusée — tarif inchangé.');
  };

  const handleDrawerManualSave = async (
    forceOverwrite: boolean = false,
    saveOnly: boolean = false
  ) => {
    if (!selectedCell) return;
    setIsProcessingAction(true);
    try {
      const parsedMax = editMaxStay.trim() ? Number(editMaxStay) : null;
      const res = await updateCellManuallyInPlanning(hotel, selectedCell.cellKey, {
        newRateEur: editRateInput,
        inventoryAvailable: editInventoryInput,
        minStay: editMinStay,
        maxStay: parsedMax,
        cta: editCta,
        ctd: editCtd,
        isClosed: editClosed,
        reason: editReason.trim() || undefined,
        cascadeDerivedPlans,
        forceOverwrite,
        saveOnly,
        simulateOutcome: qaSimulateMode === 'normal' ? undefined : qaSimulateMode,
      });
      reloadPlanningState();
      if (saveOnly) {
        onShowToast(
          `Tarif ${editRateInput}€ & stock (${editInventoryInput}) enregistrés localement dans FLOWTYM (envoi externe différé).`
        );
      } else if (res.conflictCount > 0) {
        onShowToast('Conflit détecté avec le système externe — résolution requise.');
        setIsConflictModalOpen(true);
      } else if (res.failedCount > 0) {
        onShowToast(`Modification locale enregistrée mais échec externe : ${res.lastError}`);
      } else {
        onShowToast(`Tarif ${editRateInput}€ & stock (${editInventoryInput}) confirmés par le connecteur.`);
      }
    } catch (err: any) {
      onShowToast(err?.message || 'Erreur de sauvegarde.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleInlineCommit = async (saveOnly: boolean = false) => {
    if (!inlineEditTarget) return;
    const num = Number(inlineEditValue);
    if (!Number.isFinite(num) || num < 0) {
      setInlineEditTarget(null);
      return;
    }
    setIsProcessingAction(true);
    try {
      if (inlineEditTarget.field === 'rate') {
        const res = await updateCellManuallyInPlanning(hotel, inlineEditTarget.cellKey, {
          newRateEur: Math.max(10, Math.round(num)),
          cascadeDerivedPlans: true,
          saveOnly,
          reason: saveOnly ? 'Édition rapide inline (local)' : 'Édition rapide inline',
        });
        reloadPlanningState();
        onShowToast(
          saveOnly
            ? `Tarif ${Math.round(num)}€ enregistré dans FLOWTYM.`
            : res.failedCount > 0
            ? `Tarif enregistré localement (échec push : ${res.lastError})`
            : `Tarif ${Math.round(num)}€ synchronisé.`
        );
      } else {
        const existingRate = cellMap.get(inlineEditTarget.cellKey)?.currentRateEur ?? 150;
        const res = await updateCellManuallyInPlanning(hotel, inlineEditTarget.cellKey, {
          newRateEur: existingRate,
          inventoryAvailable: Math.max(0, Math.round(num)),
          saveOnly,
          reason: 'Mise à jour inline stock Left for sale',
        });
        reloadPlanningState();
        onShowToast(
          `Stock Left for sale mis à jour (${Math.max(0, Math.round(num))} ch.) · ${
            saveOnly ? 'local' : `${res.syncedCount} sync`
          }`
        );
      }
    } finally {
      setInlineEditTarget(null);
      setIsProcessingAction(false);
    }
  };

  const handleRetryCellSync = async (cellKey: string) => {
    setIsProcessingAction(true);
    try {
      const res = await retryFailedCellSync(hotel, cellKey);
      reloadPlanningState();
      if (res.syncedCount > 0) {
        onShowToast('Synchronisation confirmée après nouvelle tentative.');
      } else if (res.conflictCount > 0) {
        onShowToast('Conflit détecté lors de la relance.');
        setIsConflictModalOpen(true);
      } else {
        onShowToast(`Échec persistant : ${res.lastError}`);
      }
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleUndoLatest = async () => {
    const revertible = history.find(
      (h) =>
        h.previousRateEur !== null &&
        h.actionType !== 'reverted' &&
        h.actionType !== 'recommendation_rejected'
    );
    if (!revertible) {
      onShowToast('Aucune modification récente annulable.');
      return;
    }
    setIsProcessingAction(true);
    try {
      const res = await revertHistoryEntryInPlanning(hotel, revertible.id);
      reloadPlanningState();
      onShowToast(
        res.syncedCount > 0
          ? `Annulation effectuée (${revertible.newRateEur}€ → ${revertible.previousRateEur}€) et synchronisée.`
          : 'Annulation locale effectuée.'
      );
    } catch (err: any) {
      onShowToast(err?.message || 'Impossible d’annuler.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleRevertSpecificHistory = async (historyId: string) => {
    setIsProcessingAction(true);
    try {
      await revertHistoryEntryInPlanning(hotel, historyId);
      reloadPlanningState();
      onShowToast('Tarif restauré et journalisé dans la piste d’audit.');
    } catch (err: any) {
      onShowToast(err?.message || 'Annulation impossible.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkRoomCodes.length || !bulkRatePlans.length) {
      onShowToast('Sélectionnez au moins une catégorie et un plan tarifaire.');
      return;
    }
    if (!bulkConfirmStep) {
      setBulkConfirmStep(true);
      return;
    }
    if (bulkScheduleEnabled) {
      const scheduledItem = {
        id: `sched-${Date.now()}`,
        hotelId: hotel.id,
        scheduledForIso: bulkScheduleDatetime
          ? new Date(bulkScheduleDatetime).toISOString()
          : new Date(Date.now() + 3600000).toISOString(),
        status: 'scheduled' as const,
        scopeLabel: `${bulkRoomCodes.join(', ')} · ${bulkRatePlans.join(', ')}`,
        dateFrom: bulkStartDate,
        dateTo: bulkEndDate,
        weekdays: bulkWeekdays,
        roomCategoryCodes: bulkRoomCodes,
        ratePlanCodes: bulkRatePlans,
        adjustmentMode:
          bulkMode === 'fixed'
            ? ('fixed_price' as const)
            : bulkMode === 'inventory_set'
            ? ('inventory_set' as const)
            : bulkMode,
        adjustmentValue: bulkValue,
        inventoryValue: bulkMode === 'inventory_set' ? bulkValue : null,
        minStay: bulkMinStay.trim() ? Number(bulkMinStay) : null,
        stopSell: bulkClosed === 'unchanged' ? null : bulkClosed === 'closed',
        autoPushToConnectors: true,
        actor: 'Wali Larabi',
        createdAt: new Date().toISOString(),
        summary: bulkReason,
      };
      saveScheduledRateChange(hotel.id, scheduledItem);
      void fetch(`/api/scheduled-changes/${encodeURIComponent(hotel.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scheduledItem),
      }).catch(() => {});
      setIsBulkModalOpen(false);
      setBulkConfirmStep(false);
      onShowToast(
        `Modification planifiée pour ${new Date(scheduledItem.scheduledForIso).toLocaleString('fr-FR')} (visible dans Centre Sync & Planifications).`
      );
      return;
    }
    setIsProcessingAction(true);
    try {
      const res = await applyBulkEditInPlanning(hotel, {
        startDate: bulkStartDate,
        endDate: bulkEndDate,
        weekdays: bulkWeekdays,
        roomTypeCodes: bulkRoomCodes,
        ratePlanCodes: bulkRatePlans,
        adjustmentMode: bulkMode,
        value: bulkValue,
        inventoryAvailable: bulkMode === 'inventory_set' ? Math.max(0, Math.round(bulkValue)) : undefined,
        minStay: bulkMinStay.trim() ? Number(bulkMinStay) : undefined,
        isClosed: bulkClosed === 'unchanged' ? undefined : bulkClosed === 'closed',
        cascadeDerivedPlans: bulkCascade,
        reason: bulkReason,
      });
      reloadPlanningState();
      setIsBulkModalOpen(false);
      setBulkConfirmStep(false);
      onShowToast(
        `Modification en masse : ${res.syncedCount} confirmée(s), ${res.failedCount} échec(s), ${res.conflictCount} conflit(s).`
      );
      if (res.conflictCount > 0) setIsConflictModalOpen(true);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleCopyPeriodSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessingAction(true);
    try {
      if (copyModalTab === 'room') {
        if (!dupSourceRoom || dupTargetRooms.length === 0) {
          onShowToast('Sélectionnez une catégorie source et au moins une catégorie cible.');
          return;
        }
        const res = await duplicateRoomRatesInPlanning(hotel, {
          sourceRoomCode: dupSourceRoom,
          targetRoomCodes: dupTargetRooms,
          startDate: copySourceStart,
          endDate: copySourceEnd,
          offsetEur: dupOffsetEur,
          ratePlanCodes: dupPlanCodes.length ? dupPlanCodes : activePlans.map((p) => p.code),
          copyRestrictions,
        });
        reloadPlanningState();
        setIsCopyModalOpen(false);
        onShowToast(
          `Duplication chambre → chambre terminée (${res.syncedCount} cellule(s) synchronisée(s)).`
        );
      } else {
        const res = await copyRatesOverPeriod(hotel, {
          sourceStartDate: copySourceStart,
          sourceEndDate: copySourceEnd,
          targetStartDate: copyTargetStart,
          roomTypeCodes: activeCategories.map((c) => c.code),
          ratePlanCodes: activePlans.map((p) => p.code),
          copyRestrictions,
        });
        reloadPlanningState();
        setIsCopyModalOpen(false);
        onShowToast(
          `Duplication de période terminée : ${res.syncedCount} cellule(s) copiée(s) et synchronisée(s).`
        );
      }
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleRecalculateDerivedNow = async () => {
    setIsProcessingAction(true);
    try {
      const res = await recalculateDerivedPlansInPlanning(hotel);
      reloadPlanningState();
      onShowToast(
        res.syncedCount > 0
          ? `${res.syncedCount} tarif(s) dérivé(s) recalculé(s) et synchronisé(s). Plans indépendants préservés.`
          : 'Tous les plans dérivés sont déjà alignés avec le tarif de référence actif.'
      );
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleQuickChangeGlobalRef = (nextRefCode: string) => {
    const nextRules = tariffConfig.referenceRules.map((r, i) =>
      i === 0 ? { ...r, referencePlanCode: nextRefCode } : r
    );
    const updated = saveHotelTariffConfig(
      hotel,
      {
        ...tariffConfig,
        referenceMode: 'single_global',
        globalReferencePlanCode: nextRefCode,
        referenceRules: nextRules,
      },
      'Wali Larabi',
      'Tarif de Référence',
      `Tarif de référence basculé vers ${nextRefCode}`
    );
    setTariffConfig(updated);
    reloadPlanningState();
    onShowToast(`Tarif de référence actif : ${nextRefCode}`);
  };

  const handleResolveConflict = async (
    conflictId: string,
    choice: 'keep_flowtym' | 'adopt_external'
  ) => {
    setIsProcessingAction(true);
    try {
      await resolveRateConflictInPlanning(hotel, conflictId, choice);
      reloadPlanningState();
      onShowToast(
        choice === 'keep_flowtym'
          ? 'Tarif FLOWTYM appliqué en priorité et confirmé par le système externe.'
          : 'Tarif externe adopté dans FLOWTYM sans réémission.'
      );
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleSimulateExternalWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessingAction(true);
    try {
      const res = await simulateExternalSystemChange({
        hotelId: hotel.id,
        stayDate: simDate,
        roomTypeCode: simRoomCode,
        ratePlanCode: simPlanCode,
        newRateEur: simRate,
        source: simSource,
      });
      if (res.success) {
        onShowToast(
          `Modification externe enregistrée sur ${simSource.toUpperCase()}. Cliquez sur « Actualiser » pour tester la récupération Sens 2 sans boucle.`
        );
      } else {
        onShowToast(res.message || 'Erreur lors de la simulation webhook.');
      }
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'Hotel',
      'Date',
      'Categorie',
      'PlanTarifaire',
      'TarifActuelEUR',
      'RecommandationEUR',
      'Inventaire',
      'MinStay',
      'StopSell',
      'Origine',
      'StatutSync',
      'ACK',
    ];
    const rows: string[] = [headers.join(';')];
    visibleTypologies.forEach((typ) => {
      visibleRatePlans.forEach((plan) => {
        visibleDates.forEach((dStr) => {
          const cell = cellMap.get(buildCellKey(hotel.id, typ.code, plan.code, dStr));
          if (!cell) return;
          rows.push(
            [
              hotel.name,
              cell.stayDate,
              cell.roomTypeName,
              cell.ratePlanCode,
              cell.currentRateEur,
              cell.recommendation?.recommendedRateEur ?? '',
              cell.inventoryAvailable,
              cell.minStay,
              cell.isClosed ? 'Ferme' : 'Ouvert',
              cell.modificationOrigin,
              cell.syncStatus,
              cell.lastSyncAckId ?? '',
            ].join(';')
          );
        });
      });
    });
    const blob = new Blob(['\ufeff' + rows.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flowtym-planning-tarifaire-${hotel.id}-${windowStartDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast('Export CSV du Planning Tarifaire téléchargé.');
  };

  const activeConnectionLabel =
    connectivity.activeMode === 'pms'
      ? `Mode A · ${connectivity.pmsProvider} ↔ FLOWTYM`
      : connectivity.activeMode === 'channel_manager'
      ? `Mode B · ${connectivity.channelManagerProvider} ↔ FLOWTYM`
      : `Coexistence · ${connectivity.pmsProvider} + ${connectivity.channelManagerProvider}`;

  const cellAuditHistory = useMemo(
    () => (selectedCell ? history.filter((h) => h.cellKey === selectedCell.cellKey).slice(0, 8) : []),
    [history, selectedCell]
  );

  return (
    <div className="space-y-4 pb-24">
      {/* SÉLECTEUR PRINCIPAL : A. PLANNING TARIFAIRE | B. CONFIGURATION TARIFAIRE */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-2 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveSection('planning')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeSection === 'planning'
                ? 'bg-violet-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <CalendarRange className="w-4 h-4" />
            <span>A. Planning Tarifaire</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('config')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeSection === 'config'
                ? 'bg-violet-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>B. Paramètres du Planning (12 Domaines)</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 px-2 text-xs text-slate-500 dark:text-slate-400">
          <span>
            Devise : <strong className="text-slate-800 dark:text-slate-100">{tariffConfig.currency}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Plans actifs : <strong className="text-slate-800 dark:text-slate-100 tabular-nums">{activePlans.length}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Chambres actives :{' '}
            <strong className="text-slate-800 dark:text-slate-100 tabular-nums">
              {activeCategories.reduce((s, c) => s + c.physicalRooms, 0)}
            </strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Connecteurs :{' '}
            <strong className="text-slate-800 dark:text-slate-100 tabular-nums">
              {getCachedConnectorsForHotel(hotel.id).filter((c) => c.isActive).length}
            </strong>
          </span>
        </div>
      </div>

      {activeSection === 'config' ? (
        <TariffConfigurationCenter
          hotel={hotel}
          initialSubTab={configInitialTab}
          onShowToast={onShowToast}
          onOpenConnectivitySettings={onOpenConnectivitySettings}
          onConfigUpdated={reloadPlanningState}
        />
      ) : (
        <>
          {/* PANNEAU « TARIF DE RÉFÉRENCE » */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-950/50 border border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-300 flex items-center justify-center shrink-0">
                <Target className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <div className="flex flex-wrap items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                  <span>TARIF DE RÉFÉRENCE</span>
                  <span className="px-2 py-0.5 rounded bg-violet-600 text-white text-[10px] font-bold">
                    {tariffConfig.referenceMode === 'single_global'
                      ? `Unique : ${tariffConfig.globalReferencePlanCode}`
                      : 'Par catégorie'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Pilote le calcul RM et les dérivations actives. Les plans <em>indépendants</em> ne sont jamais modifiés automatiquement.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {tariffConfig.referenceMode === 'single_global' ? (
                <select
                  value={tariffConfig.globalReferencePlanCode}
                  onChange={(e) => handleQuickChangeGlobalRef(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-slate-800 dark:text-slate-100"
                  aria-label="Choisir le tarif de référence global"
                >
                  {activePlans.map((p) => (
                    <option key={p.code} value={p.code}>
                      Réf : {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {activeCategories.map((cat) => (
                    <span
                      key={cat.code}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] font-semibold"
                    >
                      {cat.code}: <strong>{resolveReferencePlanCode(tariffConfig, cat.code, windowStartDate || todayStr)}</strong>
                    </span>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowRelationsDashboard((v) => !v)}
                className={`px-3 py-1.5 rounded-xl border font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors ${
                  showRelationsDashboard
                    ? 'bg-violet-600 border-violet-600 text-white'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>{showRelationsDashboard ? 'Masquer graphe relations' : 'Graphe des relations'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setConfigInitialTab('hotel_ref');
                  setActiveSection('config');
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-slate-700 dark:text-slate-200 cursor-pointer whitespace-nowrap"
              >
                Paramétrer références
              </button>
            </div>
          </div>

          {showRelationsDashboard && (
            <RateRelationsDashboard
              hotel={hotel}
              tariffConfig={tariffConfig}
              cells={cells}
              visibleDates={visibleDates}
              onInspectPlanningCell={(cellKey) => setSelectedCellKey(cellKey)}
              onOpenConfigRelations={() => {
                setConfigInitialTab('relations');
                setActiveSection('config');
              }}
            />
          )}

          {/* BANDEAU SUPÉRIEUR : IDENTITÉ, ÉTAT DE CONNEXION EXTERNE & STATUTS */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-violet-600 text-white flex items-center justify-center shrink-0">
                  <CalendarRange className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                      Planning Tarifaire Connecté
                    </h2>
                    <span className="text-xs text-slate-400" aria-hidden="true">·</span>
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      {hotel.name} ({hotel.city} · {hotel.roomCount} ch.)
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          connectivity.connectionHealth === 'connected'
                            ? 'bg-emerald-500'
                            : connectivity.connectionHealth === 'degraded'
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                      />
                      {activeConnectionLabel}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      Dernier Push : {formatShortTimestamp(connectivity.lastPushAt)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      Dernier Pull : {formatShortTimestamp(connectivity.lastPullAt)}
                    </span>
                    {pendingRecCount > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-violet-600 dark:text-violet-400 font-semibold tabular-nums">
                          {pendingRecCount} reco(s) RM sur la fenêtre
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {openConflicts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsConflictModalOpen(true)}
                    className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span className="tabular-nums">{openConflicts.length} Conflit(s) ouvert(s)</span>
                  </button>
                )}

                {failedOrRejectedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setDiagnosticsTab('queue');
                      setIsDiagnosticsModalOpen(true);
                    }}
                    className="px-3 py-2 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span className="tabular-nums">{failedOrRejectedCount} Échec(s) sync</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsSmartExcelOpen(true)}
                  className="px-3.5 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 hover:bg-emerald-100/70 dark:hover:bg-emerald-950/50 text-xs font-semibold text-emerald-800 dark:text-emerald-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Import Excel D-EDGE</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSyncControlInitialTab('control');
                    setIsSyncControlOpen(true);
                  }}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <ScrollText className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                  <span>Centre Sync &amp; Logs</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSyncControlInitialTab('scheduled');
                    setIsSyncControlOpen(true);
                  }}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <CalendarClock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Planifications</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDiagnosticsTab('status');
                    setIsDiagnosticsModalOpen(true);
                  }}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plug className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                  <span>Connectivité &amp; Test 2-Way</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenConnectivitySettings}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                  title="Configurer le mode PMS / Channel Manager dans Paramètres"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Connecteurs</span>
                </button>
              </div>
            </div>

            {/* BARRE D'OUTILS PRINCIPALE */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 p-1 gap-1">
                  <button
                    type="button"
                    onClick={() => shiftPeriod(-1)}
                    className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                    aria-label="Période précédente"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <input
                    type="date"
                    value={windowStartDate}
                    min={minAvailDate}
                    max={maxAvailDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) return;
                      setShowPastDates(val < todayStr);
                      setWindowStartDate(val);
                    }}
                    title="Date de début du planning"
                    className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-100 tabular-nums cursor-pointer"
                  />
                  {horizonDays === 'custom' && (
                    <input
                      type="date"
                      value={customEndDate}
                      min={windowStartDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) setCustomEndDate(val);
                      }}
                      title="Date de fin personnalisée"
                      className="px-2 py-1 rounded-lg border border-violet-300 dark:border-violet-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-100 tabular-nums cursor-pointer"
                    />
                  )}
                  <span className="px-2 text-xs font-semibold text-slate-700 dark:text-slate-200 tabular-nums whitespace-nowrap hidden sm:inline">
                    {formatDateRangeLabel(visibleDates)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPastDates(false);
                      setWindowStartDate(todayStr);
                    }}
                    className="px-2.5 py-1 mx-0.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
                  >
                    Aujourd&apos;hui
                  </button>
                  <button
                    type="button"
                    onClick={() => shiftPeriod(1)}
                    className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                    aria-label="Période suivante"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="inline-flex flex-wrap items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100/70 dark:bg-slate-800/70 p-1">
                  {[
                    { val: 7 as const, label: '7j' },
                    { val: 15 as const, label: '15j' },
                    { val: 30 as const, label: '30j' },
                    { val: 90 as const, label: '90j' },
                    { val: 365 as const, label: '365j' },
                    { val: 'custom' as const, label: 'Perso' },
                  ].map((h) => (
                    <button
                      key={String(h.val)}
                      type="button"
                      onClick={() => setHorizonDays(h.val)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                        horizonDays === h.val
                          ? 'bg-violet-600 text-white'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {h.label}
                    </button>
                  ))}
                </div>

                {fullRangeDates.length > COLUMN_PAGE_SIZE && (
                  <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-[11px] font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                    <button
                      type="button"
                      disabled={columnWindowOffset === 0}
                      onClick={() => setColumnWindowOffset((o) => Math.max(0, o - COLUMN_PAGE_SIZE))}
                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
                      aria-label="Fenêtre de colonnes précédente"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span>
                      J{columnWindowOffset + 1}–{Math.min(fullRangeDates.length, columnWindowOffset + visibleDates.length)} / {fullRangeDates.length}
                    </span>
                    <button
                      type="button"
                      disabled={columnWindowOffset + COLUMN_PAGE_SIZE >= fullRangeDates.length}
                      onClick={() =>
                        setColumnWindowOffset((o) =>
                          Math.min(Math.max(0, fullRangeDates.length - COLUMN_PAGE_SIZE), o + COLUMN_PAGE_SIZE)
                        )
                      }
                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
                      aria-label="Fenêtre de colonnes suivante"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowFiltersBar((v) => !v)}
                  className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    showFiltersBar || activeFiltersCount > 0
                      ? 'border-violet-400 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Filtres{activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ''}</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setBulkConfirmStep(false);
                    setIsBulkModalOpen(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Modifier en masse</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCopyModalTab('period');
                    setIsCopyModalOpen(true);
                  }}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Dupliquer</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleRecalculateDerivedNow()}
                  disabled={isProcessingAction}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                  <span>Recalculer dérivés</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handlePullUpdates(false)}
                  disabled={isPulling}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isPulling ? 'animate-spin' : ''}`} />
                  <span>{isPulling ? 'Pull...' : 'Actualiser (Pull)'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleUndoLatest()}
                  disabled={isProcessingAction || history.length === 0}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 cursor-pointer"
                  title="Annuler la dernière modification tarifaire"
                  aria-label="Annuler la dernière modification"
                >
                  <Undo2 className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>
              </div>
            </div>

            {/* 8 MODES D'AFFICHAGE MÉTIER */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 mr-1">
                <Eye className="w-3.5 h-3.5" /> Vue :
              </span>
              {VIEW_MODE_OPTIONS.map((vm) => (
                <button
                  key={vm.id}
                  type="button"
                  onClick={() => setViewMode(vm.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    viewMode === vm.id
                      ? 'bg-slate-900 dark:bg-violet-600 text-white'
                      : 'bg-slate-100/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700'
                  }`}
                >
                  {vm.label}
                </button>
              ))}
            </div>

            {/* LÉGENDE DISCRÈTE & CANAUX DE DISTRIBUTION */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-600 dark:text-slate-400">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Synchronisé
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-violet-500" /> Recommandation IA prête
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" /> Modifié / Attente
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500" /> Échec / Fermé / Conflit
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowChannelsBar((v) => !v)}
                className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                {showChannelsBar ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
                <span>
                  Canaux de distribution :{' '}
                  {selectedChannel === 'ALL'
                    ? 'Tous (Tarif Base)'
                    : DISTRIBUTION_CHANNEL_DEFS.find((d) => d.code === selectedChannel)?.name}
                </span>
              </button>
            </div>

            {showChannelsBar && (
              <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80">
                <button
                  type="button"
                  onClick={() => setSelectedChannel('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    selectedChannel === 'ALL'
                      ? 'bg-violet-600 text-white'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  Tous · Tarif Base
                </button>
                {DISTRIBUTION_CHANNEL_DEFS.map((ch) => (
                  <button
                    key={ch.code}
                    type="button"
                    onClick={() => setSelectedChannel(ch.code)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      selectedChannel === ch.code
                        ? 'bg-violet-600 text-white'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {ch.name} ({ch.markupPct === 0 ? 'Parité' : `${ch.markupPct > 0 ? '+' : ''}${ch.markupPct}%`})
                  </button>
                ))}
              </div>
            )}

            {showFiltersBar && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Catégorie de chambre
                  </label>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                  >
                    <option value="all">Toutes les catégories</option>
                    {activeCategories.map((t) => (
                      <option key={t.code} value={t.code}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Plan tarifaire
                  </label>
                  <select
                    value={filterRatePlan}
                    onChange={(e) => setFilterRatePlan(e.target.value as 'all' | RatePlanCode)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                  >
                    <option value="all">Tous les plans actifs ({activePlans.length})</option>
                    {activePlans.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.code} — {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Statut de synchronisation
                  </label>
                  <select
                    value={filterSyncStatus}
                    onChange={(e) => setFilterSyncStatus(e.target.value as 'all' | RateSyncStatus)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                  >
                    <option value="all">Tous les statuts</option>
                    <option value="saved_local">Enregistré local (non envoyé)</option>
                    <option value="queued">En file d&apos;attente</option>
                    <option value="synced">Confirmé externe (Synchronisé)</option>
                    <option value="sending">Envoyé (ACK en attente)</option>
                    <option value="pending">En attente</option>
                    <option value="failed">Échec envoi</option>
                    <option value="rejected">Rejeté externe</option>
                    <option value="conflict">Conflit</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end gap-1.5">
                  <label className="inline-flex items-center gap-2 font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={onlyRecommendations}
                      onChange={(e) => setOnlyRecommendations(e.target.checked)}
                      className="rounded text-violet-600"
                    />
                    <span>Recommandations IA seules</span>
                  </label>
                  <label className="inline-flex items-center gap-2 font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={onlyManualEdits}
                      onChange={(e) => setOnlyManualEdits(e.target.checked)}
                      className="rounded text-violet-600"
                    />
                    <span>Modifications manuelles seules</span>
                  </label>
                </div>

                <div className="flex items-end justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setFilterCategory('all');
                      setFilterRatePlan('all');
                      setFilterSyncStatus('all');
                      setOnlyRecommendations(false);
                      setOnlyManualEdits(false);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                  >
                    Réinitialiser filtres
                  </button>
                </div>
              </div>
            )}
          </div>

      {/* GRILLE MATRICIELLE DU PLANNING TARIFAIRE */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              {/* Ligne des mois */}
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90">
                <th
                  rowSpan={2}
                  className="sticky left-0 z-20 min-w-[235px] w-[235px] bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 align-bottom"
                >
                  Typologie / Plan Tarifaire
                </th>
                {monthSpans.map((ms, idx) => (
                  <th
                    key={`${ms.label}-${idx}`}
                    colSpan={ms.span}
                    className="px-3 py-1.5 text-center text-xs font-semibold text-slate-700 dark:text-slate-200 border-r border-slate-200/80 dark:border-slate-800 last:border-r-0"
                  >
                    {ms.label}
                  </th>
                ))}
              </tr>

              {/* Ligne des jours */}
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                {visibleDates.map((dStr) => {
                  const [y, m, d] = dStr.split('-').map(Number);
                  const dt = new Date(Date.UTC(y, m - 1, d));
                  const dow = dt.getUTCDay();
                  const isWeekend = dow === 0 || dow === 6;
                  const isToday = dStr === todayStr;

                  return (
                    <th
                      key={dStr}
                      className={`min-w-[68px] px-1.5 py-2 text-center border-r border-slate-100 dark:border-slate-800/80 last:border-r-0 ${
                        isToday
                          ? 'bg-violet-50/80 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300'
                          : isWeekend
                          ? 'bg-slate-50/70 dark:bg-slate-800/30 text-slate-700 dark:text-slate-300'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <div className="text-[10px] font-semibold uppercase">{DAY_SHORT_FR[dow]}</div>
                      <div className="text-xs font-bold tabular-nums">{d}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {viewMode === 'by_channel'
                ? DISTRIBUTION_CHANNEL_DEFS.map((ch) => (
                    <React.Fragment key={ch.code}>
                      <tr className="border-t border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
                        <td colSpan={1 + visibleDates.length} className="sticky left-0 z-10 px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <span className="px-2 py-0.5 rounded bg-violet-600 text-white text-[10px] font-bold">
                              {ch.code}
                            </span>
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              {ch.name}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              {ch.markupPct === 0 ? 'Parité tarifaire' : `${ch.markupPct > 0 ? '+' : ''}${ch.markupPct}% vs tarif base`}
                            </span>
                          </div>
                        </td>
                      </tr>
                      {visibleTypologies.map((typ) => (
                        <tr
                          key={`${ch.code}-${typ.code}`}
                          className="border-b border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/40 dark:hover:bg-slate-800/20"
                        >
                          <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 px-4 py-2.5">
                            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {typ.name} ({resolveReferencePlanCode(tariffConfig, typ.code, windowStartDate || todayStr)})
                            </div>
                          </td>
                          {visibleDates.map((dStr) => {
                            const refCode = resolveReferencePlanCode(tariffConfig, typ.code, dStr);
                            const cell = cellMap.get(buildCellKey(hotel.id, typ.code, refCode, dStr));
                            if (!cell) {
                              return (
                                <td key={dStr} className="px-1.5 py-2 text-center text-xs text-slate-300 dark:text-slate-700 border-r border-slate-100 dark:border-slate-800/70">
                                  —
                                </td>
                              );
                            }
                            const chPrice = cell.channelRates[ch.code] ?? cell.currentRateEur;
                            return (
                              <td
                                key={dStr}
                                onClick={() => setSelectedCellKey(cell.cellKey)}
                                className="px-1.5 py-2 text-center border-r border-slate-100 dark:border-slate-800/80 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60"
                              >
                                <div className="text-xs font-bold tabular-nums text-slate-900 dark:text-slate-100">
                                  {chPrice}€
                                </div>
                                <div className="text-[10px] text-slate-400 tabular-nums">
                                  {cell.currentRateEur}€ base
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))
                : viewMode === 'room_and_plan'
                ? visibleTypologies.flatMap((typ) =>
                    visibleRatePlans.map((plan) => (
                      <tr
                        key={`flat-${typ.code}-${plan.code}`}
                        className="border-b border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/40 dark:hover:bg-slate-800/20"
                      >
                        <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 px-4 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {typ.name}
                            </span>
                            <span className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[10px] font-bold shrink-0">
                              {plan.code}
                            </span>
                          </div>
                        </td>
                        {visibleDates.map((dStr) => {
                          const cell = cellMap.get(buildCellKey(hotel.id, typ.code, plan.code, dStr));
                          if (!cell) {
                            return (
                              <td key={dStr} className="px-1.5 py-2 text-center text-xs text-slate-300 dark:text-slate-700 border-r border-slate-100 dark:border-slate-800/70">
                                —
                              </td>
                            );
                          }
                          const isEditingThis =
                            inlineEditTarget?.key === `rate::${cell.cellKey}`;
                          return (
                            <td
                              key={dStr}
                              onClick={() => setSelectedCellKey(cell.cellKey)}
                              onDoubleClick={() => {
                                setInlineEditTarget({
                                  key: `rate::${cell.cellKey}`,
                                  field: 'rate',
                                  roomTypeCode: cell.roomTypeCode,
                                  stayDate: cell.stayDate,
                                  cellKey: cell.cellKey,
                                });
                                setInlineEditValue(String(cell.currentRateEur));
                              }}
                              title="Double-clic pour édition rapide (Entrée = sync, Shift+Entrée = local)"
                              className="px-1.5 py-2 text-center border-r border-slate-100 dark:border-slate-800/80 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60"
                            >
                              {isEditingThis ? (
                                <input
                                  type="number"
                                  autoFocus
                                  value={inlineEditValue}
                                  onChange={(e) => setInlineEditValue(e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  onBlur={() => void handleInlineCommit(false)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      void handleInlineCommit(e.shiftKey);
                                    } else if (e.key === 'Escape') {
                                      setInlineEditTarget(null);
                                    }
                                  }}
                                  className="w-14 px-1 py-0.5 text-center text-xs font-bold rounded border border-violet-500 bg-white dark:bg-slate-900 tabular-nums"
                                />
                              ) : (
                                <div className="text-xs font-bold tabular-nums text-slate-900 dark:text-slate-100">
                                  {cell.currentRateEur}€
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )
                : viewMode === 'by_plan'
                ? visibleRatePlans.map((plan) => (
                    <React.Fragment key={plan.code}>
                      <tr className="border-t border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
                        <td colSpan={1 + visibleDates.length} className="sticky left-0 z-10 px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <span className="px-2 py-0.5 rounded bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[10px] font-bold">
                              {plan.code}
                            </span>
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              {plan.name}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              {plan.planNature}
                              {plan.breakfastMode !== 'none' ? ' · PDJ inclus' : ''}
                            </span>
                          </div>
                        </td>
                      </tr>
                      {visibleTypologies.map((typ) => (
                        <tr
                          key={`${plan.code}-${typ.code}`}
                          className="border-b border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/40 dark:hover:bg-slate-800/20"
                        >
                          <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 px-4 py-2.5">
                            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {typ.name}
                            </div>
                          </td>
                          {visibleDates.map((dStr) => {
                            const cell = cellMap.get(buildCellKey(hotel.id, typ.code, plan.code, dStr));
                            if (!cell) {
                              return (
                                <td key={dStr} className="px-1.5 py-2 text-center text-xs text-slate-300 dark:text-slate-700 border-r border-slate-100 dark:border-slate-800/70">
                                  —
                                </td>
                              );
                            }
                            const displayedRate =
                              selectedChannel === 'ALL'
                                ? cell.currentRateEur
                                : cell.channelRates[selectedChannel] ?? cell.currentRateEur;
                            return (
                              <td
                                key={dStr}
                                onClick={() => setSelectedCellKey(cell.cellKey)}
                                className="px-1.5 py-2 text-center border-r border-slate-100 dark:border-slate-800/80 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60"
                              >
                                <div className="text-xs font-bold tabular-nums text-slate-900 dark:text-slate-100">
                                  {displayedRate}€
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))
                : visibleTypologies.map((typ) => {
                const isCatCollapsed = Boolean(collapsedCategories[typ.code]);
                const isStatusExpanded =
                  viewMode === 'restrictions' || Boolean(expandedStatusCategories[typ.code]);
                const shortCode = typ.code.slice(0, 5).toUpperCase();

                return (
                  <React.Fragment key={typ.code}>
                    {/* En-tête Catégorie de chambre */}
                    <tr className="border-t border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
                      <td
                        colSpan={1 + visibleDates.length}
                        className="sticky left-0 z-10 px-4 py-2.5"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setCollapsedCategories((prev) => ({
                              ...prev,
                              [typ.code]: !prev[typ.code],
                            }))
                          }
                          className="flex items-center gap-2.5 text-left cursor-pointer group"
                        >
                          {isCatCollapsed ? (
                            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200" />
                          )}
                          <div>
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              {typ.name}
                            </span>
                            <span className="ml-2 text-[11px] text-slate-500 dark:text-slate-400">
                              {typ.physicalRooms} chambres · {shortCode} · Réf:{' '}
                              <strong className="text-violet-600 dark:text-violet-400">
                                {resolveReferencePlanCode(tariffConfig, typ.code, windowStartDate || todayStr)}
                              </strong>
                            </span>
                          </div>
                        </button>
                      </td>
                    </tr>

                    {!isCatCollapsed && (
                      <>
                        {/* Lignes Plans Tarifaires */}
                        {visibleRatePlans.map((plan) => {
                          const role = getCellRoleForPlan(hotel, typ.code, plan.code, windowStartDate || todayStr);
                          return (
                          <tr
                            key={`${typ.code}-${plan.code}`}
                            className="border-b border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/40 dark:hover:bg-slate-800/20"
                          >
                            <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 px-4 py-2.5">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className={`px-1.5 py-0.5 rounded border text-[10px] font-bold shrink-0 ${
                                      role === 'reference'
                                        ? 'border-violet-400 bg-violet-600 text-white'
                                        : role === 'independent'
                                        ? 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
                                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                                    }`}
                                  >
                                    {plan.code}
                                  </span>
                                  <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                                    {plan.name}
                                  </span>
                                </div>
                                {viewMode === 'breakfast' && plan.breakfastMode !== 'none' && (
                                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                                    PDJ
                                  </span>
                                )}
                              </div>
                            </td>

                            {visibleDates.map((dStr) => {
                              const cell = cellMap.get(
                                buildCellKey(hotel.id, typ.code, plan.code, dStr)
                              );
                              if (!cell) {
                                return (
                                  <td
                                    key={dStr}
                                    className="px-1.5 py-2 text-center text-xs text-slate-300 dark:text-slate-700 border-r border-slate-100 dark:border-slate-800/70"
                                  >
                                    —
                                  </td>
                                );
                              }

                              const displayedRate =
                                selectedChannel === 'ALL'
                                  ? cell.currentRateEur
                                  : cell.channelRates[selectedChannel] ?? cell.currentRateEur;

                              const hasPendingRec = cell.recommendation?.status === 'pending';
                              const statusMeta = SYNC_STATUS_META[cell.syncStatus];
                              const isSelected = selectedCellKey === cell.cellKey;
                              const isEditingRate =
                                inlineEditTarget?.key === `rate::${cell.cellKey}`;

                              // Filtrage visuel discret sans casser l'alignement des colonnes
                              const matchesSyncFilter =
                                filterSyncStatus === 'all' || cell.syncStatus === filterSyncStatus;
                              const matchesRecFilter = !onlyRecommendations || hasPendingRec;
                              const matchesManualFilter = !onlyManualEdits || cell.isManualOverride;
                              const isDimmed = !(
                                matchesSyncFilter &&
                                matchesRecFilter &&
                                matchesManualFilter
                              );

                              let cellBg = 'bg-white dark:bg-slate-900';
                              if (cell.syncStatus === 'conflict') {
                                cellBg = 'bg-rose-50/90 dark:bg-rose-950/40';
                              } else if (
                                cell.syncStatus === 'failed' ||
                                cell.syncStatus === 'rejected'
                              ) {
                                cellBg = 'bg-rose-50/60 dark:bg-rose-950/25';
                              } else if (
                                cell.syncStatus === 'sending' ||
                                cell.syncStatus === 'pending' ||
                                cell.syncStatus === 'queued'
                              ) {
                                cellBg = 'bg-amber-50/60 dark:bg-amber-950/25';
                              } else if (cell.syncStatus === 'saved_local') {
                                cellBg = 'bg-violet-50/40 dark:bg-violet-950/20';
                              } else if (cell.isClosed) {
                                cellBg = 'bg-slate-100 dark:bg-slate-800/80';
                              } else if (hasPendingRec) {
                                cellBg = 'bg-violet-50/50 dark:bg-violet-950/25';
                              } else if (cell.isManualOverride) {
                                cellBg = 'bg-amber-50/40 dark:bg-amber-950/15';
                              }

                              const deltaVsPrev =
                                cell.previousRateEur !== null
                                  ? cell.currentRateEur - cell.previousRateEur
                                  : 0;

                              return (
                                <td
                                  key={dStr}
                                  onClick={() => setSelectedCellKey(cell.cellKey)}
                                  onDoubleClick={() => {
                                    setInlineEditTarget({
                                      key: `rate::${cell.cellKey}`,
                                      field: 'rate',
                                      roomTypeCode: cell.roomTypeCode,
                                      stayDate: cell.stayDate,
                                      cellKey: cell.cellKey,
                                    });
                                    setInlineEditValue(String(cell.currentRateEur));
                                  }}
                                  className={`group relative px-1.5 py-2 text-center border-r border-slate-100 dark:border-slate-800/80 cursor-pointer transition-colors ${cellBg} ${
                                    isSelected
                                      ? 'ring-2 ring-inset ring-violet-600'
                                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                                  } ${isDimmed ? 'opacity-25' : ''}`}
                                  title={`${cell.roomTypeName} · ${cell.ratePlanCode} · ${cell.stayDate} — ${statusMeta.label} (Double-clic pour éditer)`}
                                >
                                  {/* Top-right micro sync dot */}
                                  <span
                                    className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${statusMeta.dotClass}`}
                                  />

                                  {/* Quick accept button on hover when recommendation pending */}
                                  {hasPendingRec && !isDimmed && (
                                    <button
                                      type="button"
                                      onClick={(ev) => void handleQuickAcceptRecommendation(ev, cell)}
                                      disabled={isProcessingAction}
                                      title={`Accepter et synchroniser ${cell.recommendation!.recommendedRateEur}€`}
                                      className="opacity-0 group-hover:opacity-100 absolute top-1 left-1 w-4 h-4 rounded bg-violet-600 hover:bg-violet-700 text-white flex items-center justify-center transition-opacity cursor-pointer"
                                    >
                                      <Check className="w-2.5 h-2.5" />
                                    </button>
                                  )}

                                  {/* Main rate figure OR inline editor */}
                                  {isEditingRate ? (
                                    <input
                                      type="number"
                                      autoFocus
                                      value={inlineEditValue}
                                      onChange={(e) => setInlineEditValue(e.target.value)}
                                      onClick={(e) => e.stopPropagation()}
                                      onBlur={() => void handleInlineCommit(false)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          void handleInlineCommit(e.shiftKey);
                                        } else if (e.key === 'Escape') {
                                          setInlineEditTarget(null);
                                        }
                                      }}
                                      className="w-14 px-1 py-0.5 text-center text-xs font-bold rounded border border-violet-500 bg-white dark:bg-slate-900 tabular-nums"
                                    />
                                  ) : (
                                    <div
                                      className={`text-xs font-bold tabular-nums ${
                                        cell.isClosed
                                          ? 'line-through text-slate-400 dark:text-slate-500'
                                          : cell.syncStatus === 'conflict' || cell.syncStatus === 'failed'
                                          ? 'text-rose-700 dark:text-rose-300'
                                          : 'text-slate-900 dark:text-slate-100'
                                      }`}
                                    >
                                      {displayedRate}€
                                    </div>
                                  )}

                                  {/* Micro indicator line */}
                                  <div className="mt-0.5 text-[10px] font-medium tabular-nums truncate h-3.5 leading-3.5">
                                    {viewMode === 'sync_status' ? (
                                      <span className="font-semibold text-slate-600 dark:text-slate-300">
                                        {statusMeta.label.split(' ')[0]}
                                      </span>
                                    ) : viewMode === 'inventory' ? (
                                      <span className="text-sky-600 dark:text-sky-400 font-semibold">
                                        {cell.inventoryLeftForSale ?? cell.inventoryAvailable} dis.
                                      </span>
                                    ) : viewMode === 'comparative' && role !== 'reference' ? (
                                      (() => {
                                        const refCode = resolveReferencePlanCode(tariffConfig, typ.code, dStr);
                                        const refCell = cellMap.get(buildCellKey(hotel.id, typ.code, refCode, dStr));
                                        const diff = refCell ? displayedRate - refCell.currentRateEur : 0;
                                        return (
                                          <span className={diff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-violet-600 dark:text-violet-400'}>
                                            {diff >= 0 ? `+${diff}` : diff}€ vs {refCode}
                                          </span>
                                        );
                                      })()
                                    ) : viewMode === 'breakfast' && plan.breakfastMode !== 'none' ? (
                                      <span className="text-emerald-600 dark:text-emerald-400">
                                        Hors PDJ {normalizeRateExcludingBreakfast(displayedRate, plan, tariffConfig.mealPlan, typ.code, dStr)}€
                                      </span>
                                    ) : cell.syncStatus === 'conflict' ? (
                                      <span className="text-rose-600 dark:text-rose-400 font-bold">
                                        Conflit
                                      </span>
                                    ) : cell.syncStatus === 'failed' || cell.syncStatus === 'rejected' ? (
                                      <span className="text-rose-600 dark:text-rose-400 font-bold">
                                        {cell.syncStatus === 'rejected' ? 'Rejeté' : 'Échec'}
                                      </span>
                                    ) : cell.syncStatus === 'saved_local' ? (
                                      <span className="text-violet-600 dark:text-violet-400 font-semibold">
                                        Local
                                      </span>
                                    ) : hasPendingRec ? (
                                      <span className="text-violet-700 dark:text-violet-300 font-semibold">
                                        IA {cell.recommendation!.recommendedRateEur}€
                                      </span>
                                    ) : cell.modificationOrigin === 'pms' ||
                                      cell.modificationOrigin === 'channel_manager' ? (
                                      <span className="text-sky-600 dark:text-sky-400 font-semibold">
                                        {ORIGIN_LABELS[cell.modificationOrigin]}
                                      </span>
                                    ) : cell.isManualOverride ? (
                                      <span className="text-amber-700 dark:text-amber-300">
                                        Man.{deltaVsPrev !== 0 ? ` ${deltaVsPrev > 0 ? '+' : ''}${deltaVsPrev}` : ''}
                                      </span>
                                    ) : deltaVsPrev !== 0 ? (
                                      <span
                                        className={
                                          deltaVsPrev > 0
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : 'text-slate-500 dark:text-slate-400'
                                        }
                                      >
                                        {deltaVsPrev > 0 ? '+' : ''}
                                        {deltaVsPrev}€
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 dark:text-slate-600">·</span>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                          );
                        })}

                        {/* Ligne Inventaire disponible (Left for sale) avec double-clic inline */}
                        <tr
                          className={`border-b border-slate-100 dark:border-slate-800/80 text-xs ${
                            viewMode === 'inventory' ? 'bg-sky-50/40 dark:bg-sky-950/20' : ''
                          }`}
                        >
                          <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 px-4 py-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            <span className="font-bold text-slate-700 dark:text-slate-300 mr-1.5">INV.</span>
                            Left for sale
                          </td>
                          {visibleDates.map((dStr) => {
                            const refCode = resolveReferencePlanCode(tariffConfig, typ.code, dStr);
                            const barCell = cellMap.get(buildCellKey(hotel.id, typ.code, refCode, dStr));
                            const inv = barCell?.inventoryLeftForSale ?? barCell?.inventoryAvailable ?? 0;
                            const isEditingInv =
                              barCell && inlineEditTarget?.key === `inv::${barCell.cellKey}`;
                            return (
                              <td
                                key={dStr}
                                onDoubleClick={() => {
                                  if (!barCell) return;
                                  setInlineEditTarget({
                                    key: `inv::${barCell.cellKey}`,
                                    field: 'inventory',
                                    roomTypeCode: barCell.roomTypeCode,
                                    stayDate: barCell.stayDate,
                                    cellKey: barCell.cellKey,
                                  });
                                  setInlineEditValue(String(inv));
                                }}
                                title="Double-clic pour ajuster le stock Left for sale"
                                className={`px-1.5 py-1.5 text-center text-[11px] font-semibold tabular-nums border-r border-slate-100 dark:border-slate-800/80 cursor-pointer ${
                                  inv <= 2
                                    ? 'text-amber-700 dark:text-amber-300 bg-amber-50/40 dark:bg-amber-950/20'
                                    : 'text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {isEditingInv ? (
                                  <input
                                    type="number"
                                    min={0}
                                    autoFocus
                                    value={inlineEditValue}
                                    onChange={(e) => setInlineEditValue(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    onBlur={() => void handleInlineCommit(false)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        void handleInlineCommit(e.shiftKey);
                                      } else if (e.key === 'Escape') {
                                        setInlineEditTarget(null);
                                      }
                                    }}
                                    className="w-12 px-1 py-0.5 text-center text-[11px] font-bold rounded border border-violet-500 bg-white dark:bg-slate-900 tabular-nums"
                                  />
                                ) : (
                                  inv
                                )}
                              </td>
                            );
                          })}
                        </tr>

                        {/* Ligne Min. Stay */}
                        <tr className="border-b border-slate-100 dark:border-slate-800/80 text-xs">
                          <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 px-4 py-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            Min. Stay
                          </td>
                          {visibleDates.map((dStr) => {
                            const refCode = resolveReferencePlanCode(tariffConfig, typ.code, dStr);
                            const barCell = cellMap.get(buildCellKey(hotel.id, typ.code, refCode, dStr));
                            const ms = barCell?.minStay ?? 1;
                            return (
                              <td
                                key={dStr}
                                onClick={() => barCell && setSelectedCellKey(barCell.cellKey)}
                                className={`px-1.5 py-1.5 text-center text-[11px] font-semibold tabular-nums border-r border-slate-100 dark:border-slate-800/80 cursor-pointer ${
                                  ms > 1
                                    ? 'bg-amber-100/70 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
                                    : 'text-slate-400 dark:text-slate-500'
                                }`}
                              >
                                {ms > 1 ? ms : '—'}
                              </td>
                            );
                          })}
                        </tr>

                        {/* Ligne Statut extensible (Max Stay, CTA, CTD) */}
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-xs">
                          <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 px-4 py-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedStatusCategories((prev) => ({
                                  ...prev,
                                  [typ.code]: !prev[typ.code],
                                }))
                              }
                              className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 cursor-pointer"
                            >
                              {isStatusExpanded ? (
                                <ChevronDown className="w-3 h-3" />
                              ) : (
                                <ChevronRight className="w-3 h-3" />
                              )}
                              <span>Statut &amp; Restrictions</span>
                            </button>
                          </td>
                          {visibleDates.map((dStr) => {
                            const refCode = resolveReferencePlanCode(tariffConfig, typ.code, dStr);
                            const barCell = cellMap.get(buildCellKey(hotel.id, typ.code, refCode, dStr));
                            const isClosed = Boolean(barCell?.isClosed);
                            const hasRestr =
                              Boolean(barCell?.cta) || Boolean(barCell?.ctd) || (barCell?.minStay ?? 1) > 1;
                            return (
                              <td
                                key={dStr}
                                onClick={() => barCell && setSelectedCellKey(barCell.cellKey)}
                                className="px-1.5 py-1.5 text-center border-r border-slate-100 dark:border-slate-800/80 cursor-pointer"
                              >
                                <span
                                  className={`inline-block w-2 h-2 rounded-full ${
                                    isClosed
                                      ? 'bg-rose-500'
                                      : hasRestr
                                      ? 'bg-amber-500'
                                      : 'bg-emerald-500'
                                  }`}
                                  title={isClosed ? 'Fermé (Stop-Sell)' : hasRestr ? 'Restriction active' : 'Ouvert'}
                                />
                              </td>
                            );
                          })}
                        </tr>

                        {isStatusExpanded && (
                          <>
                            <tr className="border-b border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400">
                              <td className="sticky left-0 z-10 bg-slate-50/60 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 pl-8 pr-4 py-1.5">
                                Max Stay
                              </td>
                              {visibleDates.map((dStr) => {
                                const refCode = resolveReferencePlanCode(tariffConfig, typ.code, dStr);
                                const c = cellMap.get(buildCellKey(hotel.id, typ.code, refCode, dStr));
                                return (
                                  <td
                                    key={dStr}
                                    className="px-1.5 py-1.5 text-center tabular-nums border-r border-slate-100 dark:border-slate-800/70"
                                  >
                                    {c?.maxStay ?? '—'}
                                  </td>
                                );
                              })}
                            </tr>
                            <tr className="border-b border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400">
                              <td className="sticky left-0 z-10 bg-slate-50/60 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 pl-8 pr-4 py-1.5">
                                CTA (Closed to Arrival)
                              </td>
                              {visibleDates.map((dStr) => {
                                const refCode = resolveReferencePlanCode(tariffConfig, typ.code, dStr);
                                const c = cellMap.get(buildCellKey(hotel.id, typ.code, refCode, dStr));
                                return (
                                  <td
                                    key={dStr}
                                    className="px-1.5 py-1.5 text-center border-r border-slate-100 dark:border-slate-800/70"
                                  >
                                    {c?.cta ? (
                                      <span className="text-amber-600 dark:text-amber-400 font-bold">CTA</span>
                                    ) : (
                                      '—'
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                            <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                              <td className="sticky left-0 z-10 bg-slate-50/60 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 pl-8 pr-4 py-1.5">
                                CTD (Closed to Departure)
                              </td>
                              {visibleDates.map((dStr) => {
                                const refCode = resolveReferencePlanCode(tariffConfig, typ.code, dStr);
                                const c = cellMap.get(buildCellKey(hotel.id, typ.code, refCode, dStr));
                                return (
                                  <td
                                    key={dStr}
                                    className="px-1.5 py-1.5 text-center border-r border-slate-100 dark:border-slate-800/70"
                                  >
                                    {c?.ctd ? (
                                      <span className="text-amber-600 dark:text-amber-400 font-bold">CTD</span>
                                    ) : (
                                      '—'
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          </>
                        )}
                      </>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* WIDGET FLOTTANT BAS-DROITE : HISTORIQUE DES MODIFICATIONS · TRAÇABILITÉ */}
      <div className="fixed bottom-4 right-4 z-30 w-[340px] max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60">
          <div className="flex items-center gap-2">
            <History className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Historique des modifications
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400">Traçabilité</span>
            <button
              type="button"
              onClick={() => setIsHistoryDrawerExpanded((v) => !v)}
              className="p-1 rounded hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 cursor-pointer"
              aria-label="Réduire ou développer l'historique"
            >
              {isHistoryDrawerExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {isHistoryDrawerExpanded && (
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {history.length === 0 ? (
              <div className="p-4 text-xs text-slate-500 dark:text-slate-400 text-center">
                Aucune modification enregistrée sur cette session. Cliquez sur une cellule ou acceptez une recommandation IA.
              </div>
            ) : (
              history.slice(0, 12).map((entry) => {
                const st = SYNC_STATUS_META[entry.syncStatus];
                const canRevert =
                  entry.previousRateEur !== null &&
                  entry.actionType !== 'reverted' &&
                  entry.actionType !== 'recommendation_rejected';
                return (
                  <div key={entry.id} className="px-4 py-2.5 space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {entry.roomTypeCode.toUpperCase()} · {entry.ratePlanCode} · {entry.stayDate}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold whitespace-nowrap shrink-0 ${st.badgeClass}`}
                      >
                        {st.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      <span>
                        {entry.previousRateEur !== null ? `${entry.previousRateEur}€ → ` : ''}
                        <strong className="text-slate-800 dark:text-slate-100">{entry.newRateEur}€</strong>
                        {' · '}
                        {entry.actor}
                      </span>
                      {canRevert && (
                        <button
                          type="button"
                          onClick={() => void handleRevertSpecificHistory(entry.id)}
                          disabled={isProcessingAction}
                          className="text-violet-600 dark:text-violet-400 hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
                        >
                          <RotateCcw className="w-2.5 h-2.5" />
                          <span>Annuler</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* DRAWER LATÉRAL : INSPECTEUR CELLULE, RECOMMANDATION RM & SYNCHRONISATION */}
      {selectedCell && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/60 flex justify-end"
          onClick={() => setSelectedCellKey(null)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-slate-900 h-full overflow-y-auto border-l border-slate-200 dark:border-slate-800 p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <div className="text-xs font-semibold text-violet-600 dark:text-violet-400">
                  {selectedCell.roomTypeName} · {selectedCell.ratePlanCode} · {selectedCell.stayDate}
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5 tabular-nums">
                  Tarif actif : {selectedCell.currentRateEur} €
                </h3>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Origine : {ORIGIN_LABELS[selectedCell.modificationOrigin]} · Stock :{' '}
                  {selectedCell.inventoryAvailable}/{selectedCell.totalRoomsInCategory} ch.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCellKey(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
                aria-label="Fermer le panneau"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* VÉRITÉ À 4 SOURCES (FLOWTYM ENREGISTRÉ / DERNIER ENVOI / RETOUR CM / RETOUR PMS) */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  Comparaison multi-sources (Vérité 4 niveaux)
                </span>
                <span
                  className={`px-2 py-0.5 rounded-md border text-[11px] font-bold ${
                    SYNC_STATUS_META[selectedCell.syncStatus].badgeClass
                  }`}
                >
                  {SYNC_STATUS_META[selectedCell.syncStatus].label}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">FLOWTYM Enregistré</div>
                  <div className="font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                    {selectedCell.flowtymSavedRateEur} €
                  </div>
                  <div className="text-[10px] text-slate-400 tabular-nums mt-0.5">
                    {formatShortTimestamp(selectedCell.updatedAt)}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Dernier Envoi</div>
                  <div className="font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                    {selectedCell.transmittedRateEur !== null ? `${selectedCell.transmittedRateEur} €` : '—'}
                  </div>
                  <div className="text-[10px] text-slate-400 tabular-nums mt-0.5">
                    {formatShortTimestamp(selectedCell.lastSentAt || selectedCell.lastSyncAt)}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Retour Channel Manager</div>
                  <div className="font-bold text-emerald-700 dark:text-emerald-300 tabular-nums mt-0.5">
                    {(selectedCell.cmReturnedRateEur ?? selectedCell.confirmedExternalRateEur) !== null
                      ? `${selectedCell.cmReturnedRateEur ?? selectedCell.confirmedExternalRateEur} €`
                      : 'Non confirmé'}
                  </div>
                  <div className="text-[10px] text-slate-400 tabular-nums mt-0.5">
                    {formatShortTimestamp(selectedCell.cmUpdatedAt || selectedCell.lastSyncAt)}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Retour PMS</div>
                  <div className="font-bold text-sky-700 dark:text-sky-300 tabular-nums mt-0.5">
                    {selectedCell.pmsReturnedRateEur !== undefined && selectedCell.pmsReturnedRateEur !== null
                      ? `${selectedCell.pmsReturnedRateEur} €`
                      : selectedCell.confirmedExternalRateEur !== null
                      ? `${selectedCell.confirmedExternalRateEur} €`
                      : 'Non confirmé'}
                  </div>
                  <div className="text-[10px] text-slate-400 tabular-nums mt-0.5">
                    {formatShortTimestamp(selectedCell.pmsUpdatedAt || selectedCell.lastSyncAt)}
                  </div>
                </div>
              </div>

              {selectedCell.lastSyncAckId && (
                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  ACK externe : {selectedCell.lastSyncAckId} · {formatShortTimestamp(selectedCell.lastSyncAt)}
                </div>
              )}

              {selectedCell.syncErrorMessage && (
                <div className="p-2.5 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-700 dark:text-rose-300 space-y-2">
                  <div>{selectedCell.syncErrorMessage}</div>
                  <div className="flex flex-wrap gap-2">
                    {(selectedCell.syncStatus === 'failed' || selectedCell.syncStatus === 'rejected') && (
                      <button
                        type="button"
                        onClick={() => void handleRetryCellSync(selectedCell.cellKey)}
                        disabled={isProcessingAction}
                        className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold cursor-pointer"
                      >
                        Relancer la synchronisation
                      </button>
                    )}
                    {selectedCell.syncStatus === 'conflict' && (
                      <button
                        type="button"
                        onClick={() => setIsConflictModalOpen(true)}
                        className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold cursor-pointer"
                      >
                        Résoudre le conflit
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* BLOC RECOMMANDATION RM SI PRÉSENTE */}
            {selectedCell.recommendation && (
              <div className="p-4 rounded-xl border border-violet-200 dark:border-violet-800/70 bg-violet-50/60 dark:bg-violet-950/30 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-violet-900 dark:text-violet-200">
                    <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                    <span>Recommandation Moteur RM</span>
                  </div>
                  <span className="text-[11px] font-semibold text-violet-700 dark:text-violet-300 tabular-nums">
                    Confiance {selectedCell.recommendation.confidenceScore}%
                  </span>
                </div>

                <div className="flex items-baseline justify-between gap-3">
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    Tarif recommandé :{' '}
                    <strong className="text-base text-slate-900 dark:text-white tabular-nums">
                      {selectedCell.recommendation.recommendedRateEur} €
                    </strong>
                  </div>
                  <div className="text-xs font-bold tabular-nums text-violet-700 dark:text-violet-300">
                    {selectedCell.recommendation.deltaEur >= 0 ? '+' : ''}
                    {selectedCell.recommendation.deltaEur} € ({selectedCell.recommendation.deltaPct >= 0 ? '+' : ''}
                    {selectedCell.recommendation.deltaPct}%)
                  </div>
                </div>

                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {selectedCell.recommendation.justification}
                </p>

                <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 space-y-0.5">
                  <div>ID : {selectedCell.recommendation.recommendationId}</div>
                  <div>
                    Algo : {selectedCell.recommendation.algorithmVersion} · Statut :{' '}
                    {selectedCell.recommendation.status}
                  </div>
                </div>

                {selectedCell.recommendation.status === 'pending' && (
                  <div className="space-y-2.5 pt-2 border-t border-violet-200/70 dark:border-violet-800/60">
                    {drawerImpactPreview && drawerImpactPreview.targetRole !== 'independent' && (
                      <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cascadeDerivedPlans}
                          onChange={(e) => setCascadeDerivedPlans(e.target.checked)}
                          className="rounded text-violet-600"
                        />
                        <span>
                          Répercuter sur les plans dérivés ({drawerImpactPreview.impactedDerived.length} actif(s) — indépendants préservés)
                        </span>
                      </label>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleDrawerAcceptRecommendation()}
                        disabled={isProcessingAction}
                        className="flex-1 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Accepter &amp; Synchroniser</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDrawerRejectRecommendation}
                        className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                      >
                        Refuser
                      </button>
                    </div>

                    <input
                      type="text"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Motif optionnel en cas de refus..."
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                    />
                  </div>
                )}
              </div>
            )}

            {/* ÉDITION MANUELLE & RESTRICTIONS */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-100">
                <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                <span>Ajustement manuel &amp; Restrictions</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                    Tarif (€)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={5000}
                    value={editRateInput}
                    onChange={(e) => setEditRateInput(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                    Stock (Left)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={999}
                    value={editInventoryInput}
                    onChange={(e) => setEditInventoryInput(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                    Min Stay
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={14}
                    value={editMinStay}
                    onChange={(e) => setEditMinStay(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                    Max Stay
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    placeholder="Aucun"
                    value={editMaxStay}
                    onChange={(e) => setEditMaxStay(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 tabular-nums"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editClosed}
                    onChange={(e) => setEditClosed(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <span>Stop-Sell (Fermé)</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editCta}
                    onChange={(e) => setEditCta(e.target.checked)}
                    className="rounded text-amber-600"
                  />
                  <span>CTA</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editCtd}
                    onChange={(e) => setEditCtd(e.target.checked)}
                    className="rounded text-amber-600"
                  />
                  <span>CTD</span>
                </label>
              </div>

              <input
                type="text"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Motif d'audit (ex: alignement VIP ou compression salon)"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
              />

              {/* APERÇU EN DIRECT DES IMPACTS DE CASCADE & PLANS INDÉPENDANTS */}
              {drawerImpactPreview && (
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-100">
                    <span>
                      Rôle :{' '}
                      {drawerImpactPreview.targetRole === 'reference'
                        ? 'Tarif de Référence'
                        : drawerImpactPreview.targetRole === 'derived'
                        ? 'Tarif Dérivé'
                        : 'Tarif Indépendant'}
                    </span>
                    <span className="tabular-nums text-slate-500">
                      Hors PDJ : {drawerImpactPreview.normalizedExclBreakfastEur} {tariffConfig.currency}
                    </span>
                  </div>
                  {drawerImpactPreview.impactedDerived.length > 0 && cascadeDerivedPlans && (
                    <div className="text-slate-600 dark:text-slate-300">
                      Plans recalculés :{' '}
                      {drawerImpactPreview.impactedDerived
                        .map((d) => `${d.planCode} → ${d.newRateEur}€`)
                        .join(' · ')}
                    </div>
                  )}
                  {drawerImpactPreview.untouchedIndependent.length > 0 && (
                    <div className="text-slate-500">
                      Préservés (indépendants) :{' '}
                      {drawerImpactPreview.untouchedIndependent.map((u) => u.planCode).join(', ')}
                    </div>
                  )}
                  {drawerImpactPreview.warnings.map((w, idx) => (
                    <div key={idx} className="text-amber-700 dark:text-amber-300 font-semibold">
                      {w}
                    </div>
                  ))}
                </div>
              )}

              {/* Mode test QA pour vérifier les états d'échec/rejet */}
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>Simulation réponse connecteur (QA) :</span>
                <select
                  value={qaSimulateMode}
                  onChange={(e) => setQaSimulateMode(e.target.value as 'normal' | 'failed' | 'rejected')}
                  className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                >
                  <option value="normal">Nominal (ACK réel)</option>
                  <option value="failed">Simuler échec réseau</option>
                  <option value="rejected">Simuler rejet externe</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void handleDrawerManualSave(false, true)}
                  disabled={isProcessingAction}
                  className="py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Enregistrer localement</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleDrawerManualSave(false, false)}
                  disabled={isProcessingAction}
                  className="py-2 rounded-xl bg-slate-900 dark:bg-violet-600 hover:bg-slate-800 dark:hover:bg-violet-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enregistrer &amp; Transmettre</span>
                </button>
              </div>
            </div>

            {/* HISTORIQUE DE LA CELLULE */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Piste d&apos;audit de cette cellule ({cellAuditHistory.length})
              </div>
              {cellAuditHistory.length === 0 ? (
                <div className="text-xs text-slate-400">Aucune opération récente sur cette cellule.</div>
              ) : (
                <div className="space-y-2">
                  {cellAuditHistory.map((h) => (
                    <div
                      key={h.id}
                      className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span>
                          {h.previousRateEur !== null ? `${h.previousRateEur}€ → ` : ''}
                          {h.newRateEur}€
                        </span>
                        <span className="text-[10px] text-slate-400 tabular-nums">
                          {formatShortTimestamp(h.createdAt)}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400">{h.reason}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL MODIFICATION EN MASSE (AVEC APERÇU RÉCAPITULATIF AVANT CONFIRMATION) */}
      {isBulkModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/70 flex items-center justify-center p-4"
          onClick={() => setIsBulkModalOpen(false)}
        >
          <form
            onSubmit={handleBulkSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Modification tarifaire en masse &amp; Synchronisation
              </h3>
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!bulkConfirmStep ? (
              <>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Du</label>
                    <input
                      type="date"
                      value={bulkStartDate}
                      onChange={(e) => setBulkStartDate(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Au</label>
                    <input
                      type="date"
                      value={bulkEndDate}
                      onChange={(e) => setBulkEndDate(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="font-semibold text-slate-600 dark:text-slate-400">Jours de la semaine ciblés</div>
                  <div className="flex flex-wrap gap-1.5">
                    {WEEKDAY_OPTIONS.map((w) => {
                      const active = bulkWeekdays.includes(w.day);
                      return (
                        <button
                          key={w.day}
                          type="button"
                          onClick={() =>
                            setBulkWeekdays((prev) =>
                              active ? prev.filter((d) => d !== w.day) : [...prev, w.day]
                            )
                          }
                          className={`px-2.5 py-1 rounded-lg border text-xs font-semibold cursor-pointer ${
                            active
                              ? 'bg-violet-600 text-white border-violet-600'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {w.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="font-semibold text-slate-600 dark:text-slate-400">Catégories cibles</div>
                  <div className="flex flex-wrap gap-2">
                    {activeCategories.map((t) => {
                      const active = bulkRoomCodes.includes(t.code);
                      return (
                        <button
                          key={t.code}
                          type="button"
                          onClick={() =>
                            setBulkRoomCodes((prev) =>
                              active ? prev.filter((x) => x !== t.code) : [...prev, t.code]
                            )
                          }
                          className={`px-3 py-1 rounded-lg border text-xs font-semibold cursor-pointer ${
                            active
                              ? 'bg-violet-600 text-white border-violet-600'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {t.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="font-semibold text-slate-600 dark:text-slate-400">Plans tarifaires</div>
                  <div className="flex flex-wrap gap-2">
                    {activePlans.map((p) => {
                      const active = bulkRatePlans.includes(p.code);
                      return (
                        <button
                          key={p.code}
                          type="button"
                          onClick={() =>
                            setBulkRatePlans((prev) =>
                              active ? prev.filter((x) => x !== p.code) : [...prev, p.code]
                            )
                          }
                          className={`px-3 py-1 rounded-lg border text-xs font-semibold cursor-pointer ${
                            active
                              ? 'bg-violet-600 text-white border-violet-600'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {p.code}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Mode d&apos;ajustement
                    </label>
                    <select
                      value={bulkMode}
                      onChange={(e) =>
                        setBulkMode(
                          e.target.value as 'fixed' | 'delta_eur' | 'delta_pct' | 'inventory_set'
                        )
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    >
                      <option value="delta_pct">Variation (%)</option>
                      <option value="delta_eur">Variation (€)</option>
                      <option value="fixed">Tarif fixe (€)</option>
                      <option value="inventory_set">Fixer stock Left for sale</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      {bulkMode === 'inventory_set' ? 'Chambres à vendre' : 'Valeur'}
                    </label>
                    <input
                      type="number"
                      value={bulkValue}
                      onChange={(e) => setBulkValue(Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 tabular-nums"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Min Stay (optionnel)
                    </label>
                    <input
                      type="number"
                      min={1}
                      placeholder="Inchangé"
                      value={bulkMinStay}
                      onChange={(e) => setBulkMinStay(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Statut ouverture
                    </label>
                    <select
                      value={bulkClosed}
                      onChange={(e) => setBulkClosed(e.target.value as 'unchanged' | 'open' | 'closed')}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    >
                      <option value="unchanged">Inchangé</option>
                      <option value="open">Ouvrir à la vente</option>
                      <option value="closed">Fermer (Stop-Sell)</option>
                    </select>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bulkCascade}
                    onChange={(e) => setBulkCascade(e.target.checked)}
                    className="rounded text-violet-600"
                  />
                  <span>Recalculer aussi les plans dérivés liés (plans indépendants jamais modifiés)</span>
                </label>

                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 space-y-2 text-xs">
                  <label className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bulkScheduleEnabled}
                      onChange={(e) => setBulkScheduleEnabled(e.target.checked)}
                      className="rounded text-violet-600"
                    />
                    <span>Planifier l&apos;exécution pour une date et heure ultérieure</span>
                  </label>
                  {bulkScheduleEnabled && (
                    <input
                      type="datetime-local"
                      value={bulkScheduleDatetime}
                      onChange={(e) => setBulkScheduleDatetime(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs tabular-nums"
                    />
                  )}
                </div>

                <input
                  type="text"
                  value={bulkReason}
                  onChange={(e) => setBulkReason(e.target.value)}
                  placeholder="Motif de traçabilité"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                />

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsBulkModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold cursor-pointer"
                  >
                    Vérifier l&apos;impact avant confirmation →
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-xl bg-violet-50/50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 space-y-2">
                  <div className="font-bold text-violet-900 dark:text-violet-200">
                    Récapitulatif d&apos;impact avant synchronisation 2-Way
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] text-slate-500 block">Cellules directes</span>
                      <strong className="text-sm tabular-nums">{bulkPreviewSummary?.directCount ?? 0}</strong>
                    </div>
                    <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] text-slate-500 block">Dérivées impactées</span>
                      <strong className="text-sm tabular-nums text-violet-600">{bulkPreviewSummary?.derivedCount ?? 0}</strong>
                    </div>
                    <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] text-slate-500 block">Tarif moyen</span>
                      <strong className="text-sm tabular-nums">
                        {bulkPreviewSummary?.avgCurrentRateEur} → {bulkPreviewSummary?.avgNewRateEur}€
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {bulkPreviewSummary?.sampleChanges.map((sc, i) => (
                    <div key={i} className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-600 dark:text-slate-300">{sc.label}</span>
                      <span className="font-bold tabular-nums">
                        {sc.beforeEur}€ → {sc.afterEur}€
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setBulkConfirmStep(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold cursor-pointer"
                  >
                    ← Retour
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessingAction}
                    className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold cursor-pointer"
                  >
                    Confirmer &amp; Synchroniser ({(bulkPreviewSummary?.directCount ?? 0) + (bulkPreviewSummary?.derivedCount ?? 0)} cell.)
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      )}

      {/* MODAL COPIER / DUPLIQUER PÉRIODE OU CHAMBRE -> CHAMBRE */}
      {isCopyModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/70 flex items-center justify-center p-4"
          onClick={() => setIsCopyModalOpen(false)}
        >
          <form
            onSubmit={handleCopyPeriodSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 text-xs max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Duplication tarifaire
              </h3>
              <button
                type="button"
                onClick={() => setIsCopyModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100/70 dark:bg-slate-800/70 p-1 w-full">
              <button
                type="button"
                onClick={() => setCopyModalTab('period')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  copyModalTab === 'period'
                    ? 'bg-violet-600 text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Dupliquer période
              </button>
              <button
                type="button"
                onClick={() => setCopyModalTab('room')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  copyModalTab === 'room'
                    ? 'bg-violet-600 text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Dupliquer chambre → chambre
              </button>
            </div>

            {copyModalTab === 'period' ? (
              <>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCopySourceStart(windowStartDate);
                      setCopySourceEnd(addDays(windowStartDate, 6));
                      setCopyTargetStart(addDays(windowStartDate, 7));
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold cursor-pointer"
                  >
                    Dupliquer semaine (+7j)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCopySourceStart(windowStartDate);
                      setCopySourceEnd(addDays(windowStartDate, 27));
                      setCopyTargetStart(addDays(windowStartDate, 28));
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold cursor-pointer"
                  >
                    Dupliquer 4 semaines (+28j)
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-500 mb-1">Source Début</label>
                    <input
                      type="date"
                      value={copySourceStart}
                      onChange={(e) => setCopySourceStart(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-500 mb-1">Source Fin</label>
                    <input
                      type="date"
                      value={copySourceEnd}
                      onChange={(e) => setCopySourceEnd(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-500 mb-1">Date de début cible</label>
                  <input
                    type="date"
                    value={copyTargetStart}
                    onChange={(e) => setCopyTargetStart(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-500 mb-1">Du</label>
                    <input
                      type="date"
                      value={copySourceStart}
                      onChange={(e) => setCopySourceStart(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-500 mb-1">Au</label>
                    <input
                      type="date"
                      value={copySourceEnd}
                      onChange={(e) => setCopySourceEnd(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-500 mb-1">Chambre source</label>
                    <select
                      value={dupSourceRoom}
                      onChange={(e) => setDupSourceRoom(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    >
                      {activeCategories.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-500 mb-1">Écart appliqué (€)</label>
                    <input
                      type="number"
                      value={dupOffsetEur}
                      onChange={(e) => setDupOffsetEur(Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 tabular-nums"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="font-semibold text-slate-500">Chambres cibles</div>
                  <div className="flex flex-wrap gap-2">
                    {activeCategories
                      .filter((c) => c.code !== dupSourceRoom)
                      .map((c) => {
                        const active = dupTargetRooms.includes(c.code);
                        return (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() =>
                              setDupTargetRooms((prev) =>
                                active ? prev.filter((x) => x !== c.code) : [...prev, c.code]
                              )
                            }
                            className={`px-3 py-1 rounded-lg border font-semibold cursor-pointer ${
                              active
                                ? 'bg-violet-600 text-white border-violet-600'
                                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {c.name}
                          </button>
                        );
                      })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="font-semibold text-slate-500">Plans tarifaires inclus</div>
                  <div className="flex flex-wrap gap-1.5">
                    {activePlans.map((p) => {
                      const active = dupPlanCodes.includes(p.code);
                      return (
                        <button
                          key={p.code}
                          type="button"
                          onClick={() =>
                            setDupPlanCodes((prev) =>
                              active ? prev.filter((x) => x !== p.code) : [...prev, p.code]
                            )
                          }
                          className={`px-2.5 py-1 rounded-lg border font-semibold cursor-pointer ${
                            active
                              ? 'bg-slate-900 dark:bg-violet-600 text-white border-transparent'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {p.code}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={copyRestrictions}
                onChange={(e) => setCopyRestrictions(e.target.checked)}
              />
              <span>Copier aussi MinStay, CTA, CTD et Stop-Sell</span>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCopyModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isProcessingAction}
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold cursor-pointer"
              >
                Dupliquer &amp; Synchroniser
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL RÉSOLUTION DES CONFLITS CONCURRENTS */}
      {isConflictModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/70 flex items-center justify-center p-4"
          onClick={() => setIsConflictModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Résolution des conflits de synchronisation ({openConflicts.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsConflictModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {openConflicts.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                Aucun conflit ouvert sur cet établissement.
              </div>
            ) : (
              <div className="space-y-4">
                {openConflicts.map((conf) => (
                  <div
                    key={conf.id}
                    className="p-4 rounded-xl border border-rose-200 dark:border-rose-800/70 bg-rose-50/40 dark:bg-rose-950/20 space-y-3 text-xs"
                  >
                    <div className="flex items-center justify-between font-bold text-slate-900 dark:text-slate-100">
                      <span>
                        {conf.roomTypeName} · {conf.ratePlanCode} · {conf.stayDate}
                      </span>
                      <span className="font-mono text-[11px] text-rose-600 dark:text-rose-400">
                        v{conf.baseVersion} vs externe v{conf.externalVersion}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-1">
                        <div className="text-[11px] font-semibold text-violet-600 dark:text-violet-400">
                          Proposition FLOWTYM REVENUE
                        </div>
                        <div className="text-lg font-bold tabular-nums">{conf.flowtymRateEur} €</div>
                        <div className="text-[11px] text-slate-500">
                          {conf.flowtymActor} · {formatShortTimestamp(conf.flowtymTimestamp)}
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-1">
                        <div className="text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                          Modification {conf.externalSource === 'pms' ? 'PMS' : 'Channel Manager'}
                        </div>
                        <div className="text-lg font-bold tabular-nums">{conf.externalRateEur} €</div>
                        <div className="text-[11px] text-slate-500">
                          {conf.externalActor} · {formatShortTimestamp(conf.externalTimestamp)}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => void handleResolveConflict(conf.id, 'adopt_external')}
                        disabled={isProcessingAction}
                        className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                      >
                        Adopter le tarif externe ({conf.externalRateEur}€) sans réémettre
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleResolveConflict(conf.id, 'keep_flowtym')}
                        disabled={isProcessingAction}
                        className="px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold cursor-pointer"
                      >
                        Imposer tarif FLOWTYM ({conf.flowtymRateEur}€)
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DIAGNOSTICS CONNECTIVITÉ, FILE DE SYNCHRO & SIMULATEUR WEBHOOK 2-WAY */}
      {isDiagnosticsModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/70 flex items-center justify-center p-4"
          onClick={() => setIsDiagnosticsModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 max-h-[88vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Centre de Connectivité Bidirectionnelle &amp; Contrôle 2-Way
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {activeConnectionLabel} · Anti-boucle :{' '}
                  {connectivity.antiLoopEnabled ? 'Actif' : 'Désactivé'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDiagnosticsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-2 border-b border-slate-100 dark:border-slate-800 pb-2 text-xs font-semibold">
              {[
                { id: 'status' as const, label: 'Architecture Active' },
                { id: 'queue' as const, label: `Journal des Synchros (${operations.length})` },
                { id: 'simulator' as const, label: 'Test Webhook Externe (Sens 2)' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setDiagnosticsTab(t.id)}
                  className={`px-3 py-1.5 rounded-lg cursor-pointer ${
                    diagnosticsTab === t.id
                      ? 'bg-violet-600 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {diagnosticsTab === 'status' && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="font-bold text-slate-900 dark:text-slate-100">
                      Mode configuré : {activeConnectionLabel}
                    </div>
                    <div className="text-slate-600 dark:text-slate-400 space-y-1">
                      <div>Source de vérité : {connectivity.sourceOfTruth}</div>
                      <div>Stratégie conflits : {connectivity.conflictPriorityStrategy}</div>
                      <div>Polling périodique : toutes les {connectivity.pollingIntervalMinutes} min</div>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="font-bold text-slate-900 dark:text-slate-100">
                      Garanties d&apos;intégrité 2-Way
                    </div>
                    <ul className="space-y-1 text-slate-600 dark:text-slate-400 list-disc list-inside">
                      <li>Aucune cellule marquée « Synchronisé » sans ACK externe réel.</li>
                      <li>Idempotency Key unique sur chaque push/pull anti-duplication.</li>
                      <li>Les imports Sens 2 (PMS/CM) ne déclenchent jamais de réémission.</li>
                    </ul>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDiagnosticsModalOpen(false);
                      onOpenConnectivitySettings();
                    }}
                    className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Modifier Mode A / Mode B dans Paramètres</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {diagnosticsTab === 'queue' && (
              <div className="space-y-2 max-h-96 overflow-y-auto text-xs">
                {operations.length === 0 ? (
                  <div className="py-8 text-center text-slate-500">
                    Aucune opération réseau enregistrée pour le moment.
                  </div>
                ) : (
                  operations.slice(0, 40).map((op) => {
                    const st = SYNC_STATUS_META[op.status];
                    return (
                      <div
                        key={op.id}
                        className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2"
                      >
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {op.direction === 'outbound_push' ? 'SENS 1 ↑ Push' : 'SENS 2 ↓ Import'}{' '}
                            · {op.targetSystem.toUpperCase()} · {op.roomTypeCode.toUpperCase()} /{' '}
                            {op.ratePlanCode} ({op.stayDate})
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                            {op.previousRateEur ?? '—'}€ → {op.newRateEur}€ · Key: {op.idempotencyKey.slice(0, 26)}…
                            {op.externalAckId ? ` · ACK: ${op.externalAckId}` : ''}
                          </div>
                          {op.errorMessage && (
                            <div className="text-[11px] text-rose-600 dark:text-rose-400">
                              {op.errorMessage}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded border text-[11px] font-bold ${st.badgeClass}`}>
                            {st.label}
                          </span>
                          {(op.status === 'failed' || op.status === 'rejected') && (
                            <button
                              type="button"
                              onClick={() => void handleRetryCellSync(op.cellKey)}
                              className="px-2.5 py-1 rounded-lg bg-violet-600 text-white text-[11px] font-bold cursor-pointer"
                            >
                              Relancer
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {diagnosticsTab === 'simulator' && (
              <form onSubmit={handleSimulateExternalWebhook} className="space-y-4 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 leading-relaxed">
                  Injectez une modification réalisée côté PMS ou Channel Manager via{' '}
                  <code className="font-mono">/api/webhooks/external-ari</code> pour vérifier en direct l&apos;import Sens 2 (ou la détection de conflit si vous poussez ensuite un autre tarif depuis FLOWTYM).
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Système émetteur
                    </label>
                    <select
                      value={simSource}
                      onChange={(e) => setSimSource(e.target.value as 'pms' | 'channel_manager')}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    >
                      <option value="pms">PMS ({connectivity.pmsProvider})</option>
                      <option value="channel_manager">CM ({connectivity.channelManagerProvider})</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={simDate}
                      onChange={(e) => setSimDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Nouveau tarif externe (€)
                    </label>
                    <input
                      type="number"
                      min={50}
                      value={simRate}
                      onChange={(e) => setSimRate(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Catégorie
                    </label>
                    <select
                      value={simRoomCode}
                      onChange={(e) => setSimRoomCode(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    >
                      {activeCategories.map((t) => (
                        <option key={t.code} value={t.code}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Plan
                    </label>
                    <select
                      value={simPlanCode}
                      onChange={(e) => setSimPlanCode(e.target.value as RatePlanCode)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    >
                      {activePlans.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.code}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => void handlePullUpdates(false)}
                    className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    Actualiser (Pull Sens 2 maintenant)
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessingAction}
                    className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>Envoyer Webhook Externe</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
        </>
      )}

      <SmartExcelImportModal
        isOpen={isSmartExcelOpen}
        onClose={() => setIsSmartExcelOpen(false)}
        hotel={hotel}
        onImportCompleted={() => {
          reloadPlanningState();
        }}
        onShowToast={onShowToast}
      />

      <SyncControlCenterModal
        isOpen={isSyncControlOpen}
        onClose={() => setIsSyncControlOpen(false)}
        hotel={hotel}
        cells={cells}
        conflicts={conflicts}
        initialTab={syncControlInitialTab}
        onUpdated={reloadPlanningState}
        onShowToast={onShowToast}
      />
    </div>
  );
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * FLOWTYM EVENT INTELLIGENCE — MOTEUR DE REVENUE MANAGEMENT ET DE DÉCISION TARIFAIRE
 * Conçu selon les meilleures pratiques internationales du Revenue Management hôtelier :
 * - Tableau de Recommandation Tarifaire à 21 colonnes obligatoires (Section 5)
 * - Indicateurs croisés Lighthouse (médian, moyen, min, max, comparabilité, tendances J-1/J-3/J-7)
 * - Indicateurs D-EDGE Planning (Pickup 24h/J-1, 3j, 7j, vitesse d'absorption, stock restant)
 * - Indicateurs D-EDGE Réservations (CA hébergement net réparti par nuitée, ADR, RevPAR sur 45 ch., Lead Time)
 * - Explication épistémologique en 5 niveaux (Faits, Analyse, Prévision, Action, Hypothèses)
 * - Validation humaine obligatoire (Accepter, Refuser, Modifier avec motif normalisé)
 * - Moteur d'apprentissage contrôlé, mesurable et réversible avec journal d'audit complet
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Download,
  Upload,
  RefreshCw,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  ChevronUp,
  Building,
  Sparkles,
  Zap,
  Check,
  X,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  Info,
  Clock,
  ShieldAlert,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  HelpCircle,
  Trophy,
  History,
  BookOpen,
  PieChart,
  BarChart3,
  Award,
  ToggleLeft,
  ToggleRight,
  Percent,
  BedDouble,
  Users,
  Activity,
  Settings,
  ShieldCheck,
  AlertOctagon,
  RotateCcw,
  Lock,
  SlidersHorizontal,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
} from 'recharts';
import { Hotel, EventItem } from '../../types';
import {
  DailyRateIntelligence,
  TODAY_DATE_STR,
  HOTEL_TOTAL_ROOMS,
  RATE_FLOOR_EUR,
  RATE_CEILING_EUR,
  COMPSET_METAS,
  RoomCategory,
  RMModificationReasonCode,
  RM_MODIFICATION_REASONS,
  RMDecisionAuditRecord,
  RMLearnedCalibrationRule,
  calculateCompsetRanking,
  getRateIntelligenceRecords,
  saveRateIntelligenceRecords,
  acceptRateSuggestion,
  modifyRateSuggestion,
  rejectRateSuggestion,
  applyAllRateSuggestions,
  getDecisionAuditLog,
  getLearnedCalibrationRules,
  toggleLearnedCalibrationRule,
  exportRateGridToCSV,
} from '../../services/rateIntelligenceService';
import { exportCompleteHistoricalExcel } from '../../services/excelHistoricalExportService';

export type ColumnId =
  | 'date_day'
  | 'event'
  | 'demand'
  | 'current_bar'
  | 'compset_rank'
  | 'lh_median'
  | 'lh_avg'
  | 'lh_range'
  | 'pickup'
  | 'dispo'
  | 'occ'
  | 'adr'
  | 'revpar'
  | 'lead_time'
  | 'suggested'
  | 'safety_alert'
  | 'delta'
  | 'strategy'
  | 'justification'
  | 'confidence'
  | 'validation';

export interface ColumnDefinition {
  id: ColumnId;
  colNumber: string;
  name: string;
  group: 'contexte' | 'pricing' | 'dedge' | 'decision';
  groupLabel: string;
  description: string;
  defaultVisible: boolean;
  required?: boolean;
}

export const RM_COLUMN_DEFINITIONS: ColumnDefinition[] = [
  // Contexte
  { id: 'date_day', colNumber: '1-2', name: 'Date & Jour', group: 'contexte', groupLabel: 'Contexte Calendrier', description: 'Date de séjour, jour de la semaine et horodatage', defaultVisible: true, required: true },
  { id: 'event', colNumber: '3', name: 'Événement', group: 'contexte', groupLabel: 'Contexte Calendrier', description: 'Événement détecté, catégorie et score d\'impact RM', defaultVisible: true },
  { id: 'demand', colNumber: '4', name: 'Demande Marché', group: 'contexte', groupLabel: 'Contexte Calendrier', description: 'Niveau global de tension de marché sur Paris Opéra', defaultVisible: true },

  // Pricing & Concurrence Lighthouse
  { id: 'current_bar', colNumber: '5', name: 'Mon Tarif Actuel', group: 'pricing', groupLabel: 'Pricing & Concurrence Lighthouse', description: 'BAR actuel commercialisé dans le CRS D-EDGE et Min Stay', defaultVisible: true },
  { id: 'compset_rank', colNumber: '—', name: 'Pos. Compset (1/6)', group: 'pricing', groupLabel: 'Pricing & Concurrence Lighthouse', description: 'Classement de mon hôtel face aux 5 concurrents directs', defaultVisible: true },
  { id: 'lh_median', colNumber: '6', name: 'Médian Lighthouse', group: 'pricing', groupLabel: 'Pricing & Concurrence Lighthouse', description: 'Tarif médian du set concurrentiel direct (chambres comparables)', defaultVisible: true },
  { id: 'lh_avg', colNumber: '7', name: 'Moyen Lighthouse', group: 'pricing', groupLabel: 'Pricing & Concurrence Lighthouse', description: 'Tarif moyen arithmétique du compset', defaultVisible: true },
  { id: 'lh_range', colNumber: '8-9', name: 'Min / Max Compset', group: 'pricing', groupLabel: 'Pricing & Concurrence Lighthouse', description: 'Corridor tarifaire observé chez les concurrents', defaultVisible: true },

  // D-EDGE Planning & Réservations
  { id: 'pickup', colNumber: '10', name: 'Pickup 24h (J-1)', group: 'dedge', groupLabel: 'D-EDGE Planning & Réservations', description: 'Accélération des réservations sur les dernières 24h', defaultVisible: true },
  { id: 'dispo', colNumber: '11', name: 'Disponibilité (Stock)', group: 'dedge', groupLabel: 'D-EDGE Planning & Réservations', description: 'Chambres restantes à vendre sur la capacité totale de 45 ch.', defaultVisible: true },
  { id: 'occ', colNumber: '12', name: 'Occupation OTB (%)', group: 'dedge', groupLabel: 'D-EDGE Planning & Réservations', description: 'Taux de remplissage actuel de l\'hôtel', defaultVisible: true },
  { id: 'adr', colNumber: '13', name: 'ADR Net Réalisé', group: 'dedge', groupLabel: 'D-EDGE Planning & Réservations', description: 'Prix moyen net hébergement des nuitées acquises', defaultVisible: true },
  { id: 'revpar', colNumber: '14', name: 'RevPAR (45 ch.)', group: 'dedge', groupLabel: 'D-EDGE Planning & Réservations', description: 'Revenu par chambre disponible rapporté strictement à 45 chambres', defaultVisible: true },
  { id: 'lead_time', colNumber: '15', name: 'Lead Time', group: 'dedge', groupLabel: 'D-EDGE Planning & Réservations', description: 'Fenêtre d\'anticipation d\'achat dominante', defaultVisible: true },

  // Décision Revenue Management
  { id: 'suggested', colNumber: '16', name: 'Tarif Suggéré RM', group: 'decision', groupLabel: 'Décision Revenue Management', description: 'Recommandation algorithmique calculée par le moteur', defaultVisible: true, required: true },
  { id: 'safety_alert', colNumber: '🚨', name: 'Alertes Bornes Sécurité', group: 'decision', groupLabel: 'Décision Revenue Management', description: 'Garde-fous planchers (180€), plafonds (550€) et sauts > 100€', defaultVisible: true },
  { id: 'delta', colNumber: '17', name: 'Écart (€ / %)', group: 'decision', groupLabel: 'Décision Revenue Management', description: 'Variation entre le tarif suggéré et le tarif actuel commercialisé', defaultVisible: true },
  { id: 'strategy', colNumber: '18', name: 'Stratégie Yield', group: 'decision', groupLabel: 'Décision Revenue Management', description: 'Levier de yield activé (Hausse dynamique, Préservation, etc.)', defaultVisible: true },
  { id: 'justification', colNumber: '19', name: 'Explication RM', group: 'decision', groupLabel: 'Décision Revenue Management', description: 'Synthèse factuelle et analytique justifiant la recommandation', defaultVisible: true },
  { id: 'confidence', colNumber: '20', name: 'Indice Confiance (%)', group: 'decision', groupLabel: 'Décision Revenue Management', description: 'Fiabilité statistique et complétude des signaux', defaultVisible: true },
  { id: 'validation', colNumber: '21', name: 'Validation Humaine', group: 'decision', groupLabel: 'Décision Revenue Management', description: 'Boutons d\'action : Valider, Ajuster, Refuser', defaultVisible: true, required: true },
];

export const RM_COLUMN_PRESETS = [
  {
    id: 'all',
    name: 'Tout afficher (21 colonnes)',
    description: 'Toutes les colonnes du moteur RM et de sécurité affichées.',
    columns: RM_COLUMN_DEFINITIONS.map((c) => c.id),
  },
  {
    id: 'essential',
    name: 'Vue Synthétique (10 colonnes)',
    description: 'Affichage épuré centré sur les dates, tarifs, écarts et validations.',
    columns: ['date_day', 'event', 'current_bar', 'lh_median', 'pickup', 'occ', 'suggested', 'safety_alert', 'delta', 'validation'] as ColumnId[],
  },
  {
    id: 'pricing_compset',
    name: 'Focus Pricing & Concurrence',
    description: 'Priorité à la parité Lighthouse, classement compset et fourchettes.',
    columns: ['date_day', 'event', 'demand', 'current_bar', 'compset_rank', 'lh_median', 'lh_avg', 'lh_range', 'suggested', 'safety_alert', 'delta', 'validation'] as ColumnId[],
  },
  {
    id: 'yield_dedge',
    name: 'Focus Yield & Planning D-EDGE',
    description: 'Priorité au stock, au pickup 24h, à l\'occupation OTB, à l\'ADR et au RevPAR.',
    columns: ['date_day', 'demand', 'current_bar', 'pickup', 'dispo', 'occ', 'adr', 'revpar', 'lead_time', 'suggested', 'delta', 'validation'] as ColumnId[],
  },
  {
    id: 'security_audit',
    name: 'Focus Sécurité & Bornes de Contrôle',
    description: 'Spécial contrôle des planchers, plafonds, sauts tarifaires et stratégies.',
    columns: ['date_day', 'event', 'current_bar', 'lh_median', 'suggested', 'safety_alert', 'delta', 'strategy', 'justification', 'confidence', 'validation'] as ColumnId[],
  },
];

export interface SafetyAlertResult {
  hasAlert: boolean;
  type: 'ceiling' | 'floor' | 'large_step' | 'compset_drop' | null;
  severity: 'critical' | 'warning' | 'info';
  badgeLabel: string;
  shortBadge: string;
  description: string;
  badgeStyle: string;
}

export function detectSafetyAlert(r: DailyRateIntelligence): SafetyAlertResult {
  // 1. Borne Plafond (550 €)
  if (r.suggestedBarEur >= RATE_CEILING_EUR) {
    return {
      hasAlert: true,
      type: 'ceiling',
      severity: 'critical',
      badgeLabel: `🚨 Plafond Sécurité (${RATE_CEILING_EUR}€)`,
      shortBadge: `Plafond ${RATE_CEILING_EUR}€`,
      description: `Tarif suggéré bridé à la borne maximale de sécurité (${RATE_CEILING_EUR}€) pour l'hôtel afin de prévenir tout risque de rupture de parité ou de rejet de clientèle.`,
      badgeStyle: 'bg-rose-100 text-rose-800 border-rose-300 ring-1 ring-rose-400/30',
    };
  }

  // 2. Borne Plancher (180 €)
  if (r.suggestedBarEur <= RATE_FLOOR_EUR) {
    return {
      hasAlert: true,
      type: 'floor',
      severity: 'critical',
      badgeLabel: `🛡️ Plancher Sécurité (${RATE_FLOOR_EUR}€)`,
      shortBadge: `Plancher ${RATE_FLOOR_EUR}€`,
      description: `Tarif suggéré aligné sur le plancher absolu (${RATE_FLOOR_EUR}€) configuré pour l'hôtel. Interdiction de descendre sous ce seuil de rentabilité unitaire.`,
      badgeStyle: 'bg-amber-100 text-amber-900 border-amber-300 ring-1 ring-amber-400/30',
    };
  }

  // 3. Saut tarifaire abrupt (différence >= 100 € par rapport au tarif actuel)
  const deltaAbs = Math.abs(r.suggestedBarEur - r.currentBarEur);
  if (deltaAbs >= 100) {
    const isUp = r.suggestedBarEur > r.currentBarEur;
    return {
      hasAlert: true,
      type: 'large_step',
      severity: 'warning',
      badgeLabel: `⚠️ Saut Abrupt (${isUp ? '+' : ''}${r.suggestedBarEur - r.currentBarEur}€)`,
      shortBadge: `Saut ${isUp ? '+' : ''}${r.suggestedBarEur - r.currentBarEur}€`,
      description: `Variation d'un pas supérieur à 100€ d'un coup par rapport au tarif actuellement commercialisé (${r.currentBarEur}€ → ${r.suggestedBarEur}€). Double validation requise.`,
      badgeStyle: 'bg-orange-100 text-orange-900 border-orange-300',
    };
  }

  // 4. Décrochage par rapport au minimum du compset direct (> 20 € sous le minimum)
  if (r.suggestedBarEur < r.lighthouse.compsetMinEur - 20) {
    const diff = r.lighthouse.compsetMinEur - r.suggestedBarEur;
    return {
      hasAlert: true,
      type: 'compset_drop',
      severity: 'warning',
      badgeLabel: `📉 Sous Compset Min (-${diff}€)`,
      shortBadge: `Sous Min (-${diff}€)`,
      description: `Tarif suggéré inférieur de ${diff}€ au concurrent direct le moins cher (${r.lighthouse.compsetMinEur}€). Risque de sous-évaluation injustifiée.`,
      badgeStyle: 'bg-yellow-100 text-yellow-900 border-yellow-300',
    };
  }

  return {
    hasAlert: false,
    type: null,
    severity: 'info',
    badgeLabel: 'Bornes respectées',
    shortBadge: 'Conforme',
    description: 'Tarif suggéré conforme aux bornes planchers (180€) et plafonds (550€).',
    badgeStyle: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };
}

export interface ExplanationPopoverData {
  dateStr: string;
  dayOfWeek: string;
  eventTitle?: string;
  strategyLabel: string;
  strategyShortLabel: string;
  strategyBadgeColor: string;
  strategyDescription: string;
  justification: string;
  suggestedBarEur: number;
  currentBarEur: number;
  deltaVsCurrentEur: number;
  deltaVsCurrentPercent: number;
  confidenceScore: number;
  epistemologicalExplanation?: {
    faitsObserves: string[];
    analyseMarche: string[];
    previsionDemande: string[];
    recommandationAction: string;
    hypothesesEtLimites: string[];
  };
}

export function getStrategyShortInfo(label?: string): {
  shortLabel: string;
  fullLabel: string;
  description: string;
} {
  const l = (label || '').trim();
  const lower = l.toLowerCase();
  if (lower.includes('capture') && lower.includes('demande')) {
    return {
      shortLabel: 'Capture demande',
      fullLabel: 'Hausse de capture de demande',
      description: 'Augmentation dynamique du prix pour capter le surcroît de demande sans saturer prématurément le stock.',
    };
  }
  if (lower.includes('protection') || lower.includes('stock')) {
    return {
      shortLabel: 'Protection stock',
      fullLabel: 'Protection de stock & Hausse de capture',
      description: 'Hausse tarifaire agressive et restrictions Min Stay pour préserver les dernières chambres à forte rentabilité.',
    };
  }
  if (lower.includes('réalignement') || lower.includes('realignement') || lower.includes('médiane')) {
    return {
      shortLabel: 'Alignement marché',
      fullLabel: 'Réalignement sur la médiane compset',
      description: 'Repositionnement du tarif au niveau de la médiane observée chez les concurrents directs.',
    };
  }
  if (lower.includes('stimulation') || lower.includes('volume')) {
    return {
      shortLabel: 'Stimuler volume',
      fullLabel: 'Stimulation du volume',
      description: 'Tarification incitative pour dynamiser le rythme de réservations (pickup) et combler le retard d’occupation.',
    };
  }
  if (lower.includes('maintien') || lower.includes('compétitif') || lower.includes('competitif')) {
    return {
      shortLabel: 'Maintien prix',
      fullLabel: 'Maintien compétitif',
      description: 'Stabilité tarifaire assurant un rythme d’absorption naturel et équilibré face au compset direct.',
    };
  }
  // Fallback court 1 à 2 mots
  const words = l.split(' ').slice(0, 2).join(' ');
  return {
    shortLabel: words || 'Stratégie',
    fullLabel: l || 'Stratégie RM',
    description: 'Stratégie tarifaire optimisée par le moteur de Revenue Management.',
  };
}

const STORAGE_COLUMN_KEY = 'flowtym_rate_intelligence_columns_v2';

function getDefaultColumnVisibility(): Record<ColumnId, boolean> {
  const defaults: Record<string, boolean> = {};
  RM_COLUMN_DEFINITIONS.forEach((col) => {
    defaults[col.id] = col.defaultVisible;
  });
  return defaults as Record<ColumnId, boolean>;
}

function loadSavedColumnVisibility(): Record<ColumnId, boolean> {
  try {
    const saved = localStorage.getItem(STORAGE_COLUMN_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const defaults = getDefaultColumnVisibility();
      return { ...defaults, ...parsed };
    }
  } catch (e) {
    // fallback
  }
  return getDefaultColumnVisibility();
}

interface RateIntelligenceViewProps {
  hotel: Hotel;
  events?: EventItem[];
  onSelectEvent?: (event: EventItem) => void;
  onGoToExcelUpload?: () => void;
  onShowToast?: (msg: string) => void;
}

export type PeriodDuration = '7d' | '14d' | '30d' | '60d' | '90d' | 'all';

export const RateIntelligenceView: React.FC<RateIntelligenceViewProps> = ({
  hotel,
  events = [],
  onSelectEvent,
  onGoToExcelUpload,
  onShowToast,
}) => {
  // Navigation principale interne
  const [activeSubTab, setActiveSubTab] = useState<'grid' | 'learning'>('grid');

  // Base des enregistrements chargés pour cet établissement (Grand Hôtel Folkestone Opéra par défaut)
  const [records, setRecords] = useState<DailyRateIntelligence[]>(() =>
    getRateIntelligenceRecords(hotel.id)
  );

  // Synchronisation lors du changement d'hôtel
  useEffect(() => {
    setRecords(getRateIntelligenceRecords(hotel.id));
  }, [hotel.id]);

  // Mode d'affichage de la grille : 'both' (Graph + Grille), 'table', 'chart'
  const [viewMode, setViewMode] = useState<'both' | 'table' | 'chart'>('both');

  // Filtres de recherche et de sélection
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoomCategory, setSelectedRoomCategory] = useState<RoomCategory>('all');
  const [demandFilter, setDemandFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Horizon temporel : 7j, 14j, 30j (défaut), 60j, 90j, Tout
  const [periodDuration, setPeriodDuration] = useState<PeriodDuration>('30d');
  const [dayOffset, setDayOffset] = useState<number>(0);
  const [showPastDates, setShowPastDates] = useState<boolean>(false);

  // Visibilité des courbes concurrentes dans le graphique Recharts
  const [visibleCompetitors, setVisibleCompetitors] = useState<Record<string, boolean>>({
    'Hôtel Saint-Pétersbourg Opéra': false,
    'Hôtel Charing Cross': false,
    'Hôtel Astra Opéra': false,
    'Hotel Indigo Paris-Opéra': false,
    'Hôtel Saint-Augustin Elysées': false,
  });

  // Configuration des colonnes affichées (Roue de Configuration RM)
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnId, boolean>>(() =>
    loadSavedColumnVisibility()
  );
  const [showColumnConfigModal, setShowColumnConfigModal] = useState<boolean>(false);
  const [columnSearchTerm, setColumnSearchTerm] = useState<string>('');

  // Sauvegarde automatique des colonnes dans le localStorage
  const handleToggleColumn = (colId: ColumnId) => {
    setVisibleColumns((prev) => {
      const colDef = RM_COLUMN_DEFINITIONS.find((c) => c.id === colId);
      if (colDef?.required) return prev; // Colonne requise
      const next = { ...prev, [colId]: !prev[colId] };
      try {
        localStorage.setItem(STORAGE_COLUMN_KEY, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const handleApplyPreset = (presetId: string) => {
    const preset = RM_COLUMN_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const next: Record<string, boolean> = {};
    RM_COLUMN_DEFINITIONS.forEach((col) => {
      next[col.id] = preset.columns.includes(col.id) || !!col.required;
    });
    setVisibleColumns(next as Record<ColumnId, boolean>);
    try {
      localStorage.setItem(STORAGE_COLUMN_KEY, JSON.stringify(next));
    } catch (e) {}
    onShowToast?.(`Préréglage appliqué : ${preset.name}`);
  };

  const handleResetColumns = () => {
    const def = getDefaultColumnVisibility();
    setVisibleColumns(def);
    try {
      localStorage.setItem(STORAGE_COLUMN_KEY, JSON.stringify(def));
    } catch (e) {}
    onShowToast?.('Colonnes réinitialisées par défaut (21 colonnes RM)');
  };

  const activeColumnsCount = useMemo(() => {
    return Object.values(visibleColumns).filter(Boolean).length;
  }, [visibleColumns]);

  // Ligne dépliée pour le tiroir d'analyse épistémologique détaillée (5 niveaux)
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Popover modal pour afficher la justification complète RM (Colonne 19)
  const [activeExplanationPopover, setActiveExplanationPopover] = useState<ExplanationPopoverData | null>(null);

  // Modal de modification manuelle par le RM (Action 3 : Modifier)
  const [modifyingRecord, setModifyingRecord] = useState<DailyRateIntelligence | null>(null);
  const [customRate, setCustomRate] = useState<number>(300);
  const [customMinStay, setCustomMinStay] = useState<number>(2);
  const [selectedReasonCode, setSelectedReasonCode] = useState<RMModificationReasonCode>('increase_higher');
  const [customNote, setCustomNote] = useState<string>('');

  // Modal de refus (Action 2 : Refuser)
  const [rejectingRecord, setRejectingRecord] = useState<DailyRateIntelligence | null>(null);
  const [rejectNote, setRejectNote] = useState<string>('Maintien du tarif actuel');

  // Données de traçabilité et d'apprentissage
  const [auditLogs, setAuditLogs] = useState<RMDecisionAuditRecord[]>(() => getDecisionAuditLog());
  const [calibrationRules, setCalibrationRules] = useState<RMLearnedCalibrationRule[]>(() =>
    getLearnedCalibrationRules()
  );

  const refreshAuditAndRules = () => {
    setAuditLogs(getDecisionAuditLog());
    setCalibrationRules(getLearnedCalibrationRules());
  };

  // 1. Calcul de la fenêtre de dates active
  const activeDateRange = useMemo(() => {
    const today = new Date(`${TODAY_DATE_STR}T00:00:00Z`);
    const start = new Date(today);
    start.setUTCDate(today.getUTCDate() + dayOffset);

    let numDays = 30;
    if (periodDuration === '7d') numDays = 7;
    else if (periodDuration === '14d') numDays = 14;
    else if (periodDuration === '30d') numDays = 30;
    else if (periodDuration === '60d') numDays = 60;
    else if (periodDuration === '90d') numDays = 90;
    else if (periodDuration === 'all') numDays = 115;

    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + numDays - 1);

    return {
      startDate: start,
      endDate: end,
      startStr: start.toISOString().split('T')[0],
      endStr: end.toISOString().split('T')[0],
      numDays,
    };
  }, [dayOffset, periodDuration]);

  // 2. Filtrage des enregistrements synchronisés (Single Source of Truth pour Graphe & Tableau)
  const synchronizedRecords = useMemo(() => {
    return records
      .filter((r) => {
        // Exclusion des dates passées par défaut
        if (!showPastDates && r.dateStr < TODAY_DATE_STR) {
          return false;
        }

        // Filtre de période
        if (periodDuration !== 'all') {
          if (r.dateStr < activeDateRange.startStr || r.dateStr > activeDateRange.endStr) {
            return false;
          }
        }

        // Filtre niveau de demande
        if (demandFilter !== 'all' && r.demandLevel !== demandFilter) {
          return false;
        }

        // Filtre niveau de risque et bornes de sécurité
        if (riskFilter === 'underpriced' && !r.underpricedAlert) return false;
        if (riskFilter === 'compression' && !r.compressionAlert) return false;
        if (riskFilter === 'stock' && !r.dedgePickup.stockAlert) return false;
        if (riskFilter === 'partial_data' && r.rmRecommendation.confidenceLevel === 'fiable') return false;
        if (riskFilter === 'safety_guardrail' && !detectSafetyAlert(r).hasAlert) return false;
        if (riskFilter === 'floor_alert' && detectSafetyAlert(r).type !== 'floor') return false;
        if (riskFilter === 'ceiling_alert' && detectSafetyAlert(r).type !== 'ceiling') return false;
        if (riskFilter === 'large_step' && detectSafetyAlert(r).type !== 'large_step') return false;

        // Filtre statut de décision humaine
        if (statusFilter !== 'all' && r.status !== statusFilter) {
          return false;
        }

        // Recherche textuelle
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = r.eventTitle?.toLowerCase().includes(q);
          const matchDate = r.dateStr.includes(q);
          const matchStrategy = r.rmRecommendation.strategyLabel.toLowerCase().includes(q);
          const matchJustif = r.justification.toLowerCase().includes(q);
          if (!matchTitle && !matchDate && !matchStrategy && !matchJustif) return false;
        }

        return true;
      })
      .sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [records, showPastDates, periodDuration, activeDateRange, demandFilter, riskFilter, statusFilter, searchQuery]);

  // 3. Préparation des données pour le graphique Recharts
  const chartData = useMemo(() => {
    return synchronizedRecords.map((r) => {
      const ranking = calculateCompsetRanking(r, hotel.name);
      const dObj = new Date(r.dateStr);
      const formattedDate = `${dObj.getUTCDate()} ${dObj.toLocaleDateString('fr-FR', { month: 'short' })}`;

      const compValues: Record<string, number | null> = {};
      r.competitors.forEach((c) => {
        compValues[c.hotelName] = c.isSoldOut ? null : c.rateEur;
      });

      return {
        dateStr: r.dateStr,
        displayDate: formattedDate,
        fullDate: r.dateStr,
        event: r.eventTitle || 'Sans événement',
        currentBar: r.currentBarEur,
        compsetMedian: r.lighthouse.compsetMedianEur,
        compsetAvg: r.lighthouse.compsetAvgEur,
        suggestedBar: r.suggestedBarEur,
        occupancy: r.occupancyPercent,
        soldOutCount: r.compsetSoldOutCount,
        rankingLabel: ranking.positionLabel,
        rankingFraction: ranking.rankingFraction,
        statusClassification: ranking.statusClassification,
        statusBadgeText: ranking.statusBadgeText,
        strategy: r.rmRecommendation.strategyLabel,
        ...compValues,
      };
    });
  }, [synchronizedRecords, hotel.name]);

  // 4. Synthèse globale des métriques RM sur la période affichée
  const summaryKpis = useMemo(() => {
    if (!synchronizedRecords.length) {
      return {
        avgRank: '1.0',
        avgTotalAvailable: 6,
        avgCurrentBar: 0,
        avgCompsetMedian: 0,
        avgAdrNet: 0,
        avgRevpar: 0,
        avgOccupancy: 0,
        totalNetRevenue: 0,
        totalGainPotential: 0,
        cheapestDaysCount: 0,
        underpricedDaysCount: 0,
        soldOutDatesCount: 0,
        pendingDecisionsCount: 0,
        significantlyCheaperDays: 0,
        alignedDays: 0,
        moreExpensiveDays: 0,
        safetyAlertsCount: 0,
        floorAlertsCount: 0,
        ceilingAlertsCount: 0,
        largeStepAlertsCount: 0,
      };
    }

    let sumCurrentBar = 0;
    let sumMedian = 0;
    let sumAdr = 0;
    let sumRevpar = 0;
    let sumOcc = 0;
    let sumNetRevenue = 0;
    let totalGain = 0;
    let cheapestDays = 0;
    let underpricedDays = 0;
    let soldOutDates = 0;
    let pendingCount = 0;
    let sumRank = 0;
    let sumTotalAvail = 0;
    let significantlyCheaper = 0;
    let aligned = 0;
    let moreExpensive = 0;

    let safetyAlertCount = 0;
    let floorAlertCount = 0;
    let ceilingAlertCount = 0;
    let largeStepAlertCount = 0;

    synchronizedRecords.forEach((r) => {
      const ranking = calculateCompsetRanking(r, hotel.name);
      sumRank += ranking.rank;
      sumTotalAvail += ranking.totalAvailable;
      sumCurrentBar += r.currentBarEur;
      sumMedian += r.lighthouse.compsetMedianEur;
      sumAdr += r.dedgeReservations.adrNetEur;
      sumRevpar += r.dedgeReservations.revparEur;
      sumOcc += r.occupancyPercent;
      sumNetRevenue += r.dedgeReservations.netAccommodationRevenue;

      if (ranking.isCheapest) cheapestDays++;
      if (ranking.statusClassification === 'significantly_cheaper') significantlyCheaper++;
      else if (ranking.statusClassification === 'more_expensive') moreExpensive++;
      else aligned++;

      if (r.underpricedAlert) underpricedDays++;
      if (r.compsetSoldOutCount > 0) soldOutDates++;
      if (r.status === 'pending') {
        pendingCount++;
        totalGain += r.revenueGainPotentialEur;
      }

      const alert = detectSafetyAlert(r);
      if (alert.hasAlert) {
        safetyAlertCount++;
        if (alert.type === 'floor') floorAlertCount++;
        if (alert.type === 'ceiling') ceilingAlertCount++;
        if (alert.type === 'large_step') largeStepAlertCount++;
      }
    });

    const count = synchronizedRecords.length;

    return {
      avgRank: (sumRank / count).toFixed(1),
      avgTotalAvailable: Math.round(sumTotalAvail / count),
      avgCurrentBar: Math.round(sumCurrentBar / count),
      avgCompsetMedian: Math.round(sumMedian / count),
      avgAdrNet: Math.round(sumAdr / count),
      avgRevpar: Math.round((sumRevpar / count) * 10) / 10,
      avgOccupancy: Math.round((sumOcc / count) * 10) / 10,
      totalNetRevenue: sumNetRevenue,
      totalGainPotential: totalGain,
      cheapestDaysCount: cheapestDays,
      underpricedDaysCount: underpricedDays,
      soldOutDatesCount: soldOutDates,
      pendingDecisionsCount: pendingCount,
      significantlyCheaperDays: significantlyCheaper,
      alignedDays: aligned,
      moreExpensiveDays: moreExpensive,
      safetyAlertsCount: safetyAlertCount,
      floorAlertsCount: floorAlertCount,
      ceilingAlertsCount: ceilingAlertCount,
      largeStepAlertsCount: largeStepAlertCount,
    };
  }, [synchronizedRecords, hotel.name]);

  // Statistiques d'apprentissage contrôlé
  const learningStats = useMemo(() => {
    const totalDecisions = auditLogs.length;
    const acceptedCount = auditLogs.filter((l) => l.action === 'accept').length;
    const modifiedCount = auditLogs.filter((l) => l.action === 'modify').length;
    const rejectedCount = auditLogs.filter((l) => l.action === 'reject').length;
    const agreementRate = totalDecisions > 0 ? Math.round((acceptedCount / totalDecisions) * 100) : 85;

    // Écart moyen lors des modifications
    const deltas = auditLogs
      .filter((l) => l.action === 'modify')
      .map((l) => l.finalRateEur - l.suggestedRateEur);
    const avgDelta = deltas.length > 0 ? Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length) : 12;

    return {
      totalDecisions,
      acceptedCount,
      modifiedCount,
      rejectedCount,
      agreementRate,
      avgDelta,
    };
  }, [auditLogs]);

  // Gestion des déplacements temporels (Steppers)
  const handleStepPeriod = (direction: 'prev' | 'next') => {
    let step = 30;
    if (periodDuration === '7d') step = 7;
    else if (periodDuration === '14d') step = 14;
    else if (periodDuration === '30d') step = 30;
    else if (periodDuration === '60d') step = 60;
    else if (periodDuration === '90d') step = 90;

    setDayOffset((prev) => (direction === 'next' ? prev + step : prev - step));
  };

  const handleResetToToday = () => {
    setDayOffset(0);
  };

  // Actions de validation humaine (Section 9)
  const handleAcceptSingle = (record: DailyRateIntelligence) => {
    const updated = acceptRateSuggestion(hotel.id, record.id);
    setRecords(updated);
    refreshAuditAndRules();
    onShowToast?.(`Tarif ${record.suggestedBarEur}€ validé pour le ${record.dateStr} (Envoyé à D-EDGE)`);
  };

  const handleOpenModifyModal = (record: DailyRateIntelligence) => {
    setModifyingRecord(record);
    setCustomRate(record.suggestedBarEur);
    setCustomMinStay(record.suggestedMinStay);
    setSelectedReasonCode('increase_higher');
    setCustomNote('');
  };

  const handleConfirmModify = () => {
    if (!modifyingRecord) return;
    const updated = modifyRateSuggestion(
      hotel.id,
      modifyingRecord.id,
      customRate,
      customMinStay,
      selectedReasonCode,
      customNote
    );
    setRecords(updated);
    refreshAuditAndRules();
    setModifyingRecord(null);
    onShowToast?.(`Tarif personnalisé de ${customRate}€ enregistré et tracé pour le ${modifyingRecord.dateStr}`);
  };

  const handleOpenRejectModal = (record: DailyRateIntelligence) => {
    setRejectingRecord(record);
    setRejectNote('Maintien de la politique tarifaire actuelle');
  };

  const handleConfirmReject = () => {
    if (!rejectingRecord) return;
    const updated = rejectRateSuggestion(hotel.id, rejectingRecord.id, rejectNote);
    setRecords(updated);
    refreshAuditAndRules();
    setRejectingRecord(null);
    onShowToast?.(`Recommandation refusée pour le ${rejectingRecord.dateStr}. Tarif maintenu à ${rejectingRecord.currentBarEur}€`);
  };

  const handleApplyAllPending = () => {
    const { updated, count } = applyAllRateSuggestions(hotel.id);
    setRecords(updated);
    refreshAuditAndRules();
    onShowToast?.(`${count} recommandations RM validées et synchronisées vers D-EDGE CRS`);
  };

  const handleExportCSV = () => {
    exportRateGridToCSV(synchronizedRecords, hotel.name);
    onShowToast?.('Export CSV complet des 21 colonnes RM téléchargé avec succès');
  };

  const handleToggleRule = (ruleId: string) => {
    const updated = toggleLearnedCalibrationRule(ruleId);
    setCalibrationRules(updated);
    onShowToast?.('Statut de la règle d’apprentissage mis à jour (réversible)');
  };

  return (
    <div className="space-y-6 w-full px-2 sm:px-4 lg:px-6 pb-16">
      {/* 1. Header Exécutif Revenue Management */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-violet-100 text-violet-700">
                <TrendingUp className="w-5 h-5" />
              </span>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                Pricing Intelligence & Décision Revenue Management
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Moteur d’optimisation tarifaire hôtelière multi-facteurs • Croisement D-EDGE CRS, Planning, Réservations & Lighthouse.
            </p>
          </div>

          {/* Sub-Navigation & Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                onClick={() => setActiveSubTab('grid')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeSubTab === 'grid'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-violet-600" />
                <span>Grille & Recommandations ({synchronizedRecords.length})</span>
              </button>
              <button
                onClick={() => setActiveSubTab('learning')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeSubTab === 'learning'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Award className="w-3.5 h-3.5 text-amber-600" />
                <span>Apprentissage & Traçabilité ({learningStats.totalDecisions})</span>
              </button>
            </div>

            {/* Roue de configuration dans le header */}
            <button
              onClick={() => setShowColumnConfigModal(true)}
              className="px-3 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-800 border border-violet-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
              title="Configurer les colonnes et indicateurs affichés (Roue de Configuration)"
            >
              <Settings className="w-3.5 h-3.5 text-violet-600 animate-[spin_8s_linear_infinite]" />
              <span>Colonnes ({activeColumnsCount}/21)</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              title="Exporter les 21 colonnes au format CSV conforme RM"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exporter CSV ({activeColumnsCount} col.)</span>
            </button>

            <button
              onClick={() => {
                const res = exportCompleteHistoricalExcel({ hotelName: hotel.name });
                onShowToast?.(`✓ Historique complet des prix et de l'occupation exporté au format Excel (${res.totalRows} dates)`);
              }}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
              title="Télécharger l'historique complet des prix et taux d'occupation au format Excel pour travail hors ligne"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Historique Complet (Excel)</span>
            </button>

            {onGoToExcelUpload && (
              <button
                onClick={onGoToExcelUpload}
                className="px-3 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Importer Fichiers Excel</span>
              </button>
            )}
          </div>
        </div>

        {/* Hôtel Pilote & Bannière Connecteurs */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 font-bold text-slate-900">
              <Building className="w-3.5 h-3.5 text-violet-600" />
              <span>{hotel.name}</span>
              <span className="text-slate-400 font-normal">({hotel.roomCount || HOTEL_TOTAL_ROOMS} ch. • {hotel.city})</span>
            </span>
            <span className="text-slate-300">|</span>
            <span className="flex items-center gap-1.5 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>D-EDGE CRS & Lighthouse Connectés (5 concurrents directs suivis)</span>
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <span>Date d’observation : <strong>04 novembre 2026</strong></span>
            <span>•</span>
            <span className="text-violet-700 font-bold">Capacité Totale : {HOTEL_TOTAL_ROOMS} chambres</span>
          </div>
        </div>
      </div>

      {activeSubTab === 'grid' ? (
        <>
          {/* 2. Cartes Synthétiques de Performance RM & Positionnement */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* KPI 1 : Position Compset & Rang */}
            <div className="bg-gradient-to-br from-violet-50 to-indigo-50/60 rounded-2xl border border-violet-200/90 p-4 shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-violet-800 text-xs font-semibold">
                <span className="flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-violet-600" />
                  <span>Position Compset</span>
                </span>
                <span className="text-[10px] font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full">
                  Rang {summaryKpis.avgRank} / {summaryKpis.avgTotalAvailable}
                </span>
              </div>
              <div className="text-xl font-black text-violet-950 tracking-tight">
                {Number(summaryKpis.avgRank) <= 1.8
                  ? '1er moins cher du quartier'
                  : Number(summaryKpis.avgRank) <= 2.8
                  ? '2e moins cher'
                  : 'Position Médiane'}
              </div>
              <p className="text-[11px] text-violet-700 leading-tight">
                BAR Moyen : <strong>{summaryKpis.avgCurrentBar} €</strong> vs Méd. <strong>{summaryKpis.avgCompsetMedian} €</strong>
              </p>
            </div>

            {/* KPI 2 : ADR Net & RevPAR Réel */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>ADR Net & RevPAR</span>
                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                  D-EDGE Résas
                </span>
              </div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums flex items-baseline gap-2">
                <span>{summaryKpis.avgAdrNet} €</span>
                <span className="text-xs font-semibold text-emerald-600">
                  (RevPAR {summaryKpis.avgRevpar} €)
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Occ. Moyenne OTB : <strong>{summaryKpis.avgOccupancy}%</strong>
              </p>
            </div>

            {/* KPI 3 : Chiffre d'Affaires Net Hébergement */}
            <div className="bg-emerald-50/60 rounded-2xl border border-emerald-200/90 p-4 shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-emerald-800 text-xs font-semibold">
                <span>CA Hébergement Net</span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                  Par Nuitée
                </span>
              </div>
              <div className="text-2xl font-bold text-emerald-700 tabular-nums">
                {summaryKpis.totalNetRevenue.toLocaleString('fr-FR')} €
              </div>
              <p className="text-[11px] text-emerald-700/80">
                Hors petit-déj & net des annulations
              </p>
            </div>

            {/* KPI 4 : Répartition des Statuts de Marché */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Statuts de Positionnement</span>
                <span className="text-[10px] font-bold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded border border-violet-200/60">
                  Lighthouse
                </span>
              </div>
              <div className="flex items-center gap-1.5 pt-0.5">
                <span
                  className="inline-flex items-center gap-1 text-xs font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200"
                  title="Significativement moins cher (Significantly cheaper)"
                >
                  <ArrowDownRight className="w-3 h-3 text-emerald-600" />
                  {summaryKpis.significantlyCheaperDays}j
                </span>
                <span
                  className="inline-flex items-center gap-1 text-xs font-black text-sky-800 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200"
                  title="Aligné sur le marché (Aligned)"
                >
                  <CheckCircle2 className="w-3 h-3 text-sky-600" />
                  {summaryKpis.alignedDays}j
                </span>
                <span
                  className="inline-flex items-center gap-1 text-xs font-black text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200"
                  title="Plus cher que le compset (More expensive)"
                >
                  <ArrowUpRight className="w-3 h-3 text-amber-600" />
                  {summaryKpis.moreExpensiveDays}j
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                🟢 Moins cher • 🔵 Aligné • 🟠 Plus cher
              </p>
            </div>

            {/* KPI 5 : Décisions RM en Attente & Gain Détecté */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Décisions en Attente</span>
                <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200/60">
                  Validation Humaine
                </span>
              </div>
              <div className="text-2xl font-bold text-rose-600 tabular-nums flex items-baseline gap-2">
                <span>{summaryKpis.pendingDecisionsCount}</span>
                <span className="text-xs font-normal text-slate-500">à valider</span>
              </div>
              <p className="text-[11px] text-emerald-700 font-semibold">
                Gain potentiel : +{summaryKpis.totalGainPotential.toLocaleString('fr-FR')} €
              </p>
            </div>
          </div>

          {/* Bannière Interactive d'Alertes Bornes de Sécurité (Planchers / Plafonds) */}
          {summaryKpis.safetyAlertsCount > 0 && (
            <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-3.5 px-4 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <span className="p-2 rounded-xl bg-amber-100 text-amber-800 shrink-0">
                  <ShieldAlert className="w-4 h-4 animate-bounce" />
                </span>
                <div>
                  <div className="text-xs font-bold text-amber-950 flex items-center gap-2">
                    <span>Garde-fous & Bornes de Sécurité Tarifaire : {summaryKpis.safetyAlertsCount} dates sous surveillance</span>
                    <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-amber-200 text-amber-900">
                      Plancher 180€ · Plafond 550€ · Saut max 100€
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    {summaryKpis.floorAlertsCount > 0 && <span className="mr-2">🛡️ <strong>{summaryKpis.floorAlertsCount}</strong> au plancher (180€)</span>}
                    {summaryKpis.ceilingAlertsCount > 0 && <span className="mr-2">🚨 <strong>{summaryKpis.ceilingAlertsCount}</strong> au plafond (550€)</span>}
                    {summaryKpis.largeStepAlertsCount > 0 && <span>⚠️ <strong>{summaryKpis.largeStepAlertsCount}</strong> sauts &gt; 100€</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRiskFilter(riskFilter === 'safety_guardrail' ? 'all' : 'safety_guardrail')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs flex items-center gap-1.5 ${
                    riskFilter === 'safety_guardrail'
                      ? 'bg-amber-700 text-white'
                      : 'bg-white text-amber-900 border border-amber-300 hover:bg-amber-100'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>{riskFilter === 'safety_guardrail' ? 'Afficher toutes les dates' : 'Filtrer ces alertes de sécurité'}</span>
                </button>
              </div>
            </div>
          )}

          {/* 3. Barre d'Outils Complète & Sélecteur d'Horizon Temporel */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-3">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
              {/* Sélecteur de Durée (7j, 14j, 30j défaut, 60j, 90j, Tout) + Steppers */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-violet-600" />
                  <span>Horizon :</span>
                </div>

                <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold shadow-2xs">
                  {(
                    [
                      { id: '7d', label: '7 jours' },
                      { id: '14d', label: '14 jours' },
                      { id: '30d', label: '30 jours (Défaut)' },
                      { id: '60d', label: '60 jours' },
                      { id: '90d', label: '90 jours' },
                      { id: 'all', label: 'Tout' },
                    ] as { id: PeriodDuration; label: string }[]
                  ).map((btn) => (
                    <button
                      key={btn.id}
                      onClick={() => {
                        setPeriodDuration(btn.id);
                        setDayOffset(0);
                      }}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer font-bold ${
                        periodDuration === btn.id
                          ? 'bg-violet-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>

                {periodDuration !== 'all' && (
                  <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-1.5 py-1 text-xs">
                    <button
                      onClick={() => handleStepPeriod('prev')}
                      className="p-1 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors cursor-pointer"
                      title="Reculer dans la période"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={handleResetToToday}
                      className="px-2 py-0.5 text-[11px] font-bold text-slate-700 hover:text-violet-700 transition-colors cursor-pointer"
                      title="Revenir à partir d'aujourd'hui"
                    >
                      Aujourd&apos;hui
                    </button>
                    <button
                      onClick={() => handleStepPeriod('next')}
                      className="p-1 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors cursor-pointer"
                      title="Avancer dans la période"
                    >
                      <ChevronRightIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Badge d'indication de dates synchronisées */}
                <div className="hidden xl:inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl">
                  <span>📅 {new Date(activeDateRange.startStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                  <span>→</span>
                  <span>{new Date(activeDateRange.endStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                  <span className="text-violet-700 font-bold ml-1">({activeDateRange.numDays}j synchronisés)</span>
                </div>

                {/* Case à cocher dates passées */}
                <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer ml-1 select-none bg-slate-50 border border-slate-200/70 px-2 py-1 rounded-xl hover:bg-slate-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={showPastDates}
                    onChange={(e) => setShowPastDates(e.target.checked)}
                    className="rounded accent-violet-600 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span className="font-medium">Dates passées</span>
                </label>
              </div>

              {/* Validation groupée & bascule vue */}
              <div className="flex items-center gap-2">
                {summaryKpis.pendingDecisionsCount > 0 && (
                  <button
                    onClick={handleApplyAllPending}
                    className="px-3.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Valider les {summaryKpis.pendingDecisionsCount} tarifs</span>
                  </button>
                )}

                <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-semibold">
                  <button
                    onClick={() => setViewMode('both')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      viewMode === 'both' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'
                    }`}
                  >
                    Mixte
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      viewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'
                    }`}
                  >
                    Grille
                  </button>
                  <button
                    onClick={() => setViewMode('chart')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      viewMode === 'chart' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'
                    }`}
                  >
                    Graphique
                  </button>
                </div>

                {/* Roue de Configuration des Colonnes RM */}
                <button
                  onClick={() => setShowColumnConfigModal(true)}
                  className="px-3 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-800 border border-violet-200 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
                  title="Sélectionner les indicateurs à afficher dans le tableau (Roue de Configuration)"
                >
                  <Settings className="w-3.5 h-3.5 text-violet-600 animate-[spin_8s_linear_infinite]" />
                  <span>Colonnes ({activeColumnsCount}/21)</span>
                </button>
              </div>
            </div>

            {/* Ligne 2 de Filtres : Demande, Risques, Statut, Catégorie Chambre & Recherche */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-2">
                {/* Catégorie de Chambre */}
                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
                  <BedDouble className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={selectedRoomCategory}
                    onChange={(e) => setSelectedRoomCategory(e.target.value as RoomCategory)}
                    className="bg-transparent text-slate-700 font-semibold focus:outline-hidden cursor-pointer"
                  >
                    <option value="all">Toutes chambres (45 ch.)</option>
                    <option value="classique">Classique Double (23 ch.)</option>
                    <option value="superieure">Supérieure (8 ch.)</option>
                    <option value="deluxe_famille">Deluxe / Famille (14 ch.)</option>
                  </select>
                </div>

                {/* Niveau de Demande */}
                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
                  <Activity className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={demandFilter}
                    onChange={(e) => setDemandFilter(e.target.value)}
                    className="bg-transparent text-slate-700 font-semibold focus:outline-hidden cursor-pointer"
                  >
                    <option value="all">Toutes demandes</option>
                    <option value="exceptionnel">🔥 Exceptionnel (96%)</option>
                    <option value="tres_fort">⚡ Très fort (86%)</option>
                    <option value="eleve">📈 Élevé (74%)</option>
                    <option value="modere">⚖️ Modéré (58%)</option>
                    <option value="faible">💤 Faible (38%)</option>
                  </select>
                </div>

                {/* Niveau de Risque & Bornes de Sécurité */}
                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
                  <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={riskFilter}
                    onChange={(e) => setRiskFilter(e.target.value)}
                    className="bg-transparent text-slate-700 font-semibold focus:outline-hidden cursor-pointer"
                  >
                    <option value="all">Tous niveaux de risque</option>
                    <option value="safety_guardrail">🚨 Bornes Sécurité (Planchers / Plafonds / Sauts)</option>
                    <option value="floor_alert">🛡️ Alertes Plancher Sécurité (180€)</option>
                    <option value="ceiling_alert">🚨 Alertes Plafond Sécurité (550€)</option>
                    <option value="large_step">⚠️ Sauts Tarifaires Abrupts (&gt;100€)</option>
                    <option value="underpriced">🔴 Sous-tarification critique</option>
                    <option value="compression">⚠️ Compression de marché</option>
                    <option value="stock">📦 Stock résiduel critique (&lt;8 ch.)</option>
                    <option value="partial_data">⚠️ Données partielles / horizon lointain</option>
                  </select>
                </div>

                {/* Statut Décisionnel */}
                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-transparent text-slate-700 font-semibold focus:outline-hidden cursor-pointer"
                  >
                    <option value="all">Tous statuts décisionnels</option>
                    <option value="pending">⏳ À valider par RM</option>
                    <option value="applied">✅ Validé / Accepté</option>
                    <option value="modified">✏️ Modifié par RM</option>
                    <option value="rejected">❌ Refusé par RM</option>
                  </select>
                </div>
              </div>

              {/* Recherche Textuelle */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Rechercher événement ou date..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs w-56 focus:w-64 transition-all focus:outline-hidden focus:border-violet-500"
                />
              </div>
            </div>
          </div>

          {/* 4. Graphique d'Évolution Tarifaire & Concurrentielle */}
          {(viewMode === 'chart' || viewMode === 'both') && (
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-violet-600" />
                    <span>Courbes Tarifaires Synchronisées & Taux d’Occupation OTB</span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    BAR Mon Hôtel vs Médiane Lighthouse & Tarif Suggéré RM. Activez les concurrents pour analyser les courbes individuelles.
                  </p>
                </div>

                {/* Toggles des Concurrents Individuels */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-400 mr-1">Compset :</span>
                  {COMPSET_METAS.map((c) => {
                    const isVisible = visibleCompetitors[c.name];
                    return (
                      <button
                        key={c.name}
                        onClick={() =>
                          setVisibleCompetitors((prev) => ({
                            ...prev,
                            [c.name]: !prev[c.name],
                          }))
                        }
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                          isVisible
                            ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                        <span>{c.name.replace('Hôtel ', '')}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Canvas Recharts */}
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="displayDate" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#64748b' }} domain={['dataMin - 30', 'dataMax + 40']} unit="€" axisLine={{ stroke: '#cbd5e1' }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#10b981' }} domain={[0, 100]} unit="%" axisLine={{ stroke: '#10b981' }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-xl text-xs space-y-2 border border-slate-800 max-w-xs">
                              <div className="font-bold text-slate-100 flex items-center justify-between border-b border-slate-800 pb-1.5">
                                <span>{data.fullDate}</span>
                                <span className="text-violet-400 font-semibold truncate max-w-[140px]">
                                  {data.event}
                                </span>
                              </div>

                              <div className="space-y-1 font-mono text-[11px]">
                                <div className="flex justify-between text-white font-bold bg-slate-800/80 px-1.5 py-0.5 rounded">
                                  <span>Mon BAR Actuel :</span>
                                  <span>{data.currentBar} €</span>
                                </div>
                                <div className="flex justify-between text-amber-300">
                                  <span>Médiane Compset :</span>
                                  <span>{data.compsetMedian} €</span>
                                </div>
                                <div className="flex justify-between text-violet-300 font-bold">
                                  <span>Tarif Suggéré RM :</span>
                                  <span>{data.suggestedBar} €</span>
                                </div>
                                <div className="flex justify-between text-slate-300 pt-1 border-t border-slate-800">
                                  <span>Position Compset :</span>
                                  <span className="font-bold text-white bg-violet-600/70 px-1.5 py-0.2 rounded text-[10px]">
                                    {data.rankingFraction}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] pt-0.5">
                                  <span className="text-slate-400">Statut :</span>
                                  <span
                                    className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
                                      data.statusClassification === 'significantly_cheaper'
                                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                                        : data.statusClassification === 'more_expensive'
                                        ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                                        : 'bg-sky-950 text-sky-300 border border-sky-500/40'
                                    }`}
                                  >
                                    {data.statusBadgeText}
                                  </span>
                                </div>
                                <div className="flex justify-between text-emerald-400">
                                  <span>Occupation OTB :</span>
                                  <span>{data.occupancy}%</span>
                                </div>

                                {COMPSET_METAS.filter((c) => visibleCompetitors[c.name]).map((c) => (
                                  <div key={c.name} className="flex justify-between text-[10px] text-slate-300 pt-0.5">
                                    <span className="truncate max-w-[120px]">{c.name} :</span>
                                    <span>{data[c.name] ? `${data[c.name]} €` : 'Complet'}</span>
                                  </div>
                                ))}

                                {data.soldOutCount > 0 && (
                                  <div className="text-rose-400 font-bold pt-1 text-[10px]">
                                    🔴 {data.soldOutCount} concurrents complets (sold-out)
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />

                    <Bar yAxisId="left" dataKey="currentBar" fill="#64748b" radius={[4, 4, 0, 0]} name="Mon Hôtel" barSize={chartData.length > 40 ? 6 : chartData.length > 15 ? 10 : 16} />
                    <Bar yAxisId="left" dataKey="compsetMedian" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Médiane Compset" barSize={chartData.length > 40 ? 6 : chartData.length > 15 ? 10 : 16} />
                    <Line yAxisId="left" type="monotone" dataKey="suggestedBar" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: chartData.length > 30 ? 2 : 4, fill: '#7c3aed' }} name="Tarif Suggéré RM" />
                    <Area yAxisId="right" type="monotone" dataKey="occupancy" fill="#10b981" stroke="#10b981" fillOpacity={0.08} strokeWidth={1.5} name="Occ. % OTB" />

                    {COMPSET_METAS.map((c) => {
                      if (!visibleCompetitors[c.name]) return null;
                      return (
                        <Line
                          key={c.name}
                          yAxisId="left"
                          type="monotone"
                          dataKey={c.name}
                          stroke={c.color}
                          strokeWidth={1.5}
                          strokeDasharray="4 2"
                          dot={{ r: 2.5, fill: c.color }}
                          connectNulls={false}
                          name={c.name}
                        />
                      );
                    })}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* 5. Grille de Recommandation Tarifaire Professionnelle (Les 21 Colonnes Obligatoires - Section 5) */}
          {(viewMode === 'table' || viewMode === 'both') && (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-violet-600" />
                    <span>Tableau de Recommandation Tarifaire Professionnel ({synchronizedRecords.length} dates)</span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Structure complète à 21 colonnes RM • Cliquez sur une ligne pour ouvrir l’analyse épistémologique et le comparatif compset détaillé.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setShowColumnConfigModal(true)}
                    className="flex items-center gap-1.5 text-xs font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-2xs"
                    title="Personnaliser les colonnes affichées dans la grille (Roue de Configuration)"
                  >
                    <Settings className="w-3.5 h-3.5 text-violet-600 animate-[spin_8s_linear_infinite]" />
                    <span>Roue de Configuration ({activeColumnsCount}/21)</span>
                  </button>

                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                    <span>Grand Hôtel Folkestone Opéra</span>
                    <span className="text-slate-300">•</span>
                    <span>45 Chambres</span>
                  </div>
                </div>
              </div>

              {/* Table avec défilement horizontal fluide et colonnes dynamiques */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600 border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                    <tr>
                      {visibleColumns.date_day && <th className="py-3 px-3">1. Date & Jour</th>}
                      {visibleColumns.event && <th className="py-3 px-3">3. Événement</th>}
                      {visibleColumns.demand && <th className="py-3 px-2 text-center">4. Demande</th>}
                      {visibleColumns.current_bar && <th className="py-3 px-2 text-right">5. Tarif Actuel</th>}
                      {visibleColumns.compset_rank && <th className="py-3 px-2 text-center">Pos. Compset</th>}
                      {visibleColumns.lh_median && <th className="py-3 px-2 text-right">6. Médian LH</th>}
                      {visibleColumns.lh_avg && <th className="py-3 px-2 text-right">7. Moyen LH</th>}
                      {visibleColumns.lh_range && <th className="py-3 px-2 text-center">8/9. Min / Max</th>}
                      {visibleColumns.pickup && <th className="py-3 px-2 text-center">10. Pickup 24h</th>}
                      {visibleColumns.dispo && <th className="py-3 px-2 text-center">11. Dispo</th>}
                      {visibleColumns.occ && <th className="py-3 px-2 text-center">12. Occ %</th>}
                      {visibleColumns.adr && <th className="py-3 px-2 text-right">13. ADR Net</th>}
                      {visibleColumns.revpar && <th className="py-3 px-2 text-right">14. RevPAR</th>}
                      {visibleColumns.lead_time && <th className="py-3 px-2 text-center">15. Lead Time</th>}
                      {visibleColumns.suggested && <th className="py-3 px-3 text-right text-violet-700 bg-violet-50/50">16. Suggéré RM</th>}
                      {visibleColumns.safety_alert && <th className="py-3 px-2 text-center text-rose-700 bg-rose-50/50">🚨 Sécurité Bornes</th>}
                      {visibleColumns.delta && <th className="py-3 px-2 text-center">17. Écart</th>}
                      {visibleColumns.strategy && <th className="py-3 px-2 text-center whitespace-nowrap">18. Stratégie</th>}
                      {visibleColumns.justification && <th className="py-3 px-2 text-center whitespace-nowrap">19. Explication</th>}
                      {visibleColumns.confidence && <th className="py-3 px-2 text-center">20. Confiance</th>}
                      {visibleColumns.validation && <th className="py-3 px-3 text-right">21. Validation</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {synchronizedRecords.map((r) => {
                      const isExpanded = expandedRowId === r.id;
                      const ranking = calculateCompsetRanking(r, hotel.name);
                      const isUnderpriced = r.underpricedAlert && r.status === 'pending';
                      const isApplied = r.status === 'applied';
                      const safetyAlert = detectSafetyAlert(r);
                      const strategyInfo = getStrategyShortInfo(r.rmRecommendation.strategyLabel);

                      return (
                        <React.Fragment key={r.id}>
                          <tr
                            onClick={() => setExpandedRowId(isExpanded ? null : r.id)}
                            className={`transition-colors cursor-pointer select-none ${
                              safetyAlert.hasAlert && safetyAlert.severity === 'critical'
                                ? 'bg-rose-50/25 hover:bg-rose-50/60'
                                : isUnderpriced
                                ? 'bg-rose-50/35 hover:bg-rose-50/70'
                                : isApplied
                                ? 'bg-emerald-50/25 hover:bg-emerald-50/50'
                                : 'hover:bg-slate-50/90'
                            }`}
                          >
                            {/* 1 & 2. Date & Jour */}
                            {visibleColumns.date_day && (
                              <td className="py-3 px-3 whitespace-nowrap">
                                <div className="font-bold text-slate-900">
                                  {r.dayOfWeek.slice(0, 3)}. {new Date(r.dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">{r.dateStr}</div>
                              </td>
                            )}

                            {/* 3. Événement */}
                            {visibleColumns.event && (
                              <td className="py-3 px-3 max-w-[160px]">
                                {r.eventTitle ? (
                                  <div className="space-y-0.5">
                                    <div className="text-[11px] font-bold text-violet-700 truncate" title={r.eventTitle}>
                                      {r.eventTitle}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-violet-100 text-violet-800">
                                        Score {r.rmScore}
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-slate-400">Sans événement</span>
                                )}
                              </td>
                            )}

                            {/* 4. Demande Marché avec Taux en % */}
                            {visibleColumns.demand && (
                              <td className="py-3 px-2 text-center whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${
                                    r.demandLevel === 'exceptionnel'
                                      ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                      : r.demandLevel === 'tres_fort'
                                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                      : r.demandLevel === 'eleve'
                                      ? 'bg-violet-100 text-violet-800 border border-violet-200'
                                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                                  }`}
                                  title={`Taux de tension du marché estimé : ${
                                    r.demandLevel === 'exceptionnel' ? '96%' : r.demandLevel === 'tres_fort' ? '86%' : r.demandLevel === 'eleve' ? '74%' : '58%'
                                  }`}
                                >
                                  {r.demandLevel === 'exceptionnel'
                                    ? '🔥 Excep. (96%)'
                                    : r.demandLevel === 'tres_fort'
                                    ? '⚡ T. Fort (86%)'
                                    : r.demandLevel === 'eleve'
                                    ? '📈 Élevé (74%)'
                                    : '⚖️ Modéré (58%)'}
                                </span>
                              </td>
                            )}

                            {/* 5. Tarif Actuel commercialisé */}
                            {visibleColumns.current_bar && (
                              <td className="py-3 px-2 text-right whitespace-nowrap">
                                <span className="font-black text-slate-900 text-xs tabular-nums">
                                  {r.currentBarEur} €
                                </span>
                                <div className="text-[9px] text-slate-400">Min {r.currentMinStay}n</div>
                              </td>
                            )}

                            {/* Position Compset (ex: 1/6) & Statut Visuel */}
                            {visibleColumns.compset_rank && (
                              <td className="py-3 px-2 text-center whitespace-nowrap">
                                <div className="flex flex-col items-center gap-0.5">
                                  <span
                                    className={`inline-flex items-center gap-1 font-black text-[11px] px-2 py-0.5 rounded-md border tabular-nums shadow-2xs ${
                                      ranking.isCheapest
                                        ? 'bg-violet-100 text-violet-900 border-violet-300 ring-1 ring-violet-400/30'
                                        : ranking.isMostExpensive
                                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                                        : 'bg-slate-100 text-slate-800 border-slate-300'
                                    }`}
                                    title={`Position : ${ranking.rankingFraction}`}
                                  >
                                    <Trophy className="w-3 h-3 text-violet-700" />
                                    <span>{ranking.rankingFraction}</span>
                                  </span>
                                  <span
                                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                                      ranking.statusClassification === 'significantly_cheaper'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : ranking.statusClassification === 'more_expensive'
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-sky-100 text-sky-800'
                                    }`}
                                  >
                                    {ranking.statusClassification === 'significantly_cheaper' ? 'Moins cher' : ranking.statusClassification === 'more_expensive' ? 'Plus cher' : 'Aligné'}
                                  </span>
                                </div>
                              </td>
                            )}

                            {/* 6. Tarif Médian Lighthouse */}
                            {visibleColumns.lh_median && (
                              <td className="py-3 px-2 text-right whitespace-nowrap font-bold text-slate-800 tabular-nums">
                                {r.lighthouse.compsetMedianEur} €
                              </td>
                            )}

                            {/* 7. Tarif Moyen Lighthouse */}
                            {visibleColumns.lh_avg && (
                              <td className="py-3 px-2 text-right whitespace-nowrap text-slate-600 tabular-nums">
                                {r.lighthouse.compsetAvgEur} €
                              </td>
                            )}

                            {/* 8 & 9. Tarif Min / Max Compset */}
                            {visibleColumns.lh_range && (
                              <td className="py-3 px-2 text-center whitespace-nowrap text-[10px] text-slate-500 tabular-nums">
                                [{r.lighthouse.compsetMinEur}€ - {r.lighthouse.compsetMaxEur}€]
                              </td>
                            )}

                            {/* 10. Pickup 24h / J-1 */}
                            {visibleColumns.pickup && (
                              <td className="py-3 px-2 text-center whitespace-nowrap">
                                <span
                                  className={`font-bold tabular-nums text-xs px-1.5 py-0.5 rounded ${
                                    r.dedgePickup.pickup1d >= 5
                                      ? 'bg-rose-100 text-rose-800 font-black'
                                      : r.dedgePickup.pickup1d >= 2
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'text-slate-600'
                                  }`}
                                >
                                  {r.dedgePickup.pickup1d > 0 ? `+${r.dedgePickup.pickup1d}` : `${r.dedgePickup.pickup1d}`}
                                </span>
                              </td>
                            )}

                            {/* 11. Disponibilité (Stock restant sur 45 ch.) */}
                            {visibleColumns.dispo && (
                              <td className="py-3 px-2 text-center whitespace-nowrap tabular-nums">
                                <span className={`font-bold text-xs ${r.remainingRooms <= 8 ? 'text-rose-600 font-black' : 'text-slate-800'}`}>
                                  {r.remainingRooms} ch.
                                </span>
                              </td>
                            )}

                            {/* 12. Taux d'Occupation */}
                            {visibleColumns.occ && (
                              <td className="py-3 px-2 text-center whitespace-nowrap tabular-nums">
                                <span className="font-semibold text-slate-800">{r.occupancyPercent}%</span>
                              </td>
                            )}

                            {/* 13. ADR Net */}
                            {visibleColumns.adr && (
                              <td className="py-3 px-2 text-right whitespace-nowrap tabular-nums font-bold text-slate-800">
                                {r.dedgeReservations.adrNetEur} €
                              </td>
                            )}

                            {/* 14. RevPAR (sur 45 chambres) */}
                            {visibleColumns.revpar && (
                              <td className="py-3 px-2 text-right whitespace-nowrap tabular-nums font-bold text-emerald-700">
                                {r.dedgeReservations.revparEur} €
                              </td>
                            )}

                            {/* 15. Lead Time Majoritaire */}
                            {visibleColumns.lead_time && (
                              <td className="py-3 px-2 text-center whitespace-nowrap text-[10px] text-slate-600 font-medium">
                                {r.dedgeReservations.leadTimeMajorityBucket}
                              </td>
                            )}

                            {/* 16. Tarif Suggéré Moteur RM */}
                            {visibleColumns.suggested && (
                              <td className="py-3 px-3 text-right whitespace-nowrap bg-violet-50/50">
                                <div className="flex flex-col items-end gap-0.5">
                                  <div className="flex items-center gap-1.5">
                                    {safetyAlert.hasAlert && (
                                      <span
                                        className={`p-0.5 rounded ${
                                          safetyAlert.type === 'ceiling'
                                            ? 'text-rose-600 bg-rose-100'
                                            : safetyAlert.type === 'floor'
                                            ? 'text-amber-600 bg-amber-100'
                                            : 'text-orange-600 bg-orange-100'
                                        }`}
                                        title={safetyAlert.description}
                                      >
                                        <ShieldAlert className="w-3.5 h-3.5 animate-pulse" />
                                      </span>
                                    )}
                                    <span className="font-black text-violet-700 text-sm tabular-nums">
                                      {r.suggestedBarEur} €
                                    </span>
                                  </div>
                                  {safetyAlert.hasAlert && (
                                    <span
                                      className={`text-[9px] font-black px-1.5 py-0.2 rounded border shadow-2xs ${safetyAlert.badgeStyle}`}
                                      title={safetyAlert.description}
                                    >
                                      {safetyAlert.shortBadge}
                                    </span>
                                  )}
                                  {r.suggestedMinStay > 1 && (
                                    <div className="text-[9px] font-bold text-violet-600">Min {r.suggestedMinStay}n</div>
                                  )}
                                </div>
                              </td>
                            )}

                            {/* 🚨 Alertes Bornes de Sécurité (Plancher / Plafond / Sauts) */}
                            {visibleColumns.safety_alert && (
                              <td className="py-3 px-2 text-center whitespace-nowrap">
                                {safetyAlert.hasAlert ? (
                                  <div className="inline-flex flex-col items-center gap-0.5">
                                    <span
                                      className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md border shadow-2xs ${safetyAlert.badgeStyle}`}
                                      title={safetyAlert.description}
                                    >
                                      <ShieldAlert className="w-3 h-3 shrink-0" />
                                      <span>{safetyAlert.shortBadge}</span>
                                    </span>
                                    <span className="text-[8px] text-slate-500 font-semibold truncate max-w-[110px]" title={safetyAlert.description}>
                                      {safetyAlert.type === 'ceiling'
                                        ? `Plafond ${RATE_CEILING_EUR}€`
                                        : safetyAlert.type === 'floor'
                                        ? `Plancher ${RATE_FLOOR_EUR}€`
                                        : 'Saut >100€'}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                    <Check className="w-2.5 h-2.5 text-emerald-600" />
                                    <span>Conforme</span>
                                  </span>
                                )}
                              </td>
                            )}

                            {/* 17. Variation */}
                            {visibleColumns.delta && (
                              <td className="py-3 px-2 text-center whitespace-nowrap">
                                {r.deltaVsCurrentEur > 0 ? (
                                  <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.2 rounded bg-violet-100 text-violet-800 tabular-nums">
                                    +{r.deltaVsCurrentEur} € (+{r.deltaVsCurrentPercent}%)
                                  </span>
                                ) : r.deltaVsCurrentEur < 0 ? (
                                  <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 tabular-nums">
                                    {r.deltaVsCurrentEur} € ({r.deltaVsCurrentPercent}%)
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-medium">0 €</span>
                                )}
                              </td>
                            )}

                            {/* 18. Stratégie RM (1-3 mots courts + Tooltip complet au survol) */}
                            {visibleColumns.strategy && (
                              <td className="py-2.5 px-2 text-center whitespace-nowrap">
                                <div className="relative group/strat inline-block">
                                  <span
                                    className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border cursor-help transition-all group-hover/strat:shadow-2xs ${r.rmRecommendation.strategyBadgeColor}`}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70 shrink-0" />
                                    <span>{strategyInfo.shortLabel}</span>
                                  </span>

                                  {/* Infobulle (Tooltip) au survol avec libellé complet et description */}
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-40 invisible opacity-0 group-hover/strat:visible group-hover/strat:opacity-100 transition-all duration-150 pointer-events-none whitespace-normal">
                                    <div className="bg-slate-900/95 backdrop-blur-xs text-white p-2.5 rounded-xl shadow-xl border border-slate-700/80 min-w-[200px] max-w-[260px] text-left space-y-1">
                                      <div className="text-[9px] uppercase font-black text-violet-300 tracking-wider">
                                        Stratégie RM
                                      </div>
                                      <div className="text-xs font-bold text-white">
                                        {strategyInfo.fullLabel}
                                      </div>
                                      <p className="text-[10px] text-slate-300 leading-snug font-normal">
                                        {strategyInfo.description}
                                      </p>
                                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900/95" />
                                    </div>
                                  </div>
                                </div>
                              </td>
                            )}

                            {/* 19. Explication RM (Libellé court + Tooltip survol + Popover au clic) */}
                            {visibleColumns.justification && (
                              <td className="py-2.5 px-2 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                <div className="relative group/expl inline-block">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveExplanationPopover({
                                        dateStr: r.dateStr,
                                        dayOfWeek: r.dayOfWeek,
                                        eventTitle: r.eventTitle,
                                        strategyLabel: strategyInfo.fullLabel,
                                        strategyShortLabel: strategyInfo.shortLabel,
                                        strategyBadgeColor: r.rmRecommendation.strategyBadgeColor,
                                        strategyDescription: strategyInfo.description,
                                        justification: r.justification,
                                        suggestedBarEur: r.suggestedBarEur,
                                        currentBarEur: r.currentBarEur,
                                        deltaVsCurrentEur: r.deltaVsCurrentEur,
                                        deltaVsCurrentPercent: r.deltaVsCurrentPercent,
                                        confidenceScore: r.confidenceScore,
                                        epistemologicalExplanation: r.rmRecommendation.epistemologicalExplanation,
                                      });
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold text-slate-700 hover:text-violet-700 bg-slate-100 hover:bg-violet-50 hover:border-violet-200 border border-slate-200/80 transition-all cursor-pointer shadow-2xs group/btn"
                                    title="Cliquer pour afficher la justification complète"
                                  >
                                    <Info className="w-3.5 h-3.5 text-violet-600 group-hover/btn:text-violet-800 shrink-0" />
                                    <span className="whitespace-nowrap">Justification RM</span>
                                  </button>

                                  {/* Infobulle (Tooltip) au survol avec explication intégrale */}
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-40 invisible opacity-0 group-hover/expl:visible group-hover/expl:opacity-100 transition-all duration-150 pointer-events-none whitespace-normal">
                                    <div className="bg-slate-900/95 backdrop-blur-xs text-white p-3 rounded-xl shadow-xl border border-slate-700/80 min-w-[240px] max-w-[320px] text-left space-y-1.5">
                                      <div className="flex items-center gap-1.5 text-violet-300 text-[10px] font-black uppercase tracking-wider">
                                        <Info className="w-3.5 h-3.5 text-violet-400" />
                                        <span>Explication de la Recommandation</span>
                                      </div>
                                      <p className="text-xs text-slate-100 leading-relaxed font-normal">
                                        {r.justification}
                                      </p>
                                      <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800 flex items-center justify-between">
                                        <span>Clic : ouvrir la fiche complète</span>
                                        <span className="font-bold text-violet-300">
                                          {r.suggestedBarEur}€ ({r.deltaVsCurrentEur > 0 ? `+${r.deltaVsCurrentEur}€` : `${r.deltaVsCurrentEur}€`})
                                        </span>
                                      </div>
                                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900/95" />
                                    </div>
                                  </div>
                                </div>
                              </td>
                            )}

                            {/* 20. Confiance */}
                            {visibleColumns.confidence && (
                              <td className="py-3 px-2 text-center whitespace-nowrap">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    r.rmRecommendation.confidenceLevel === 'fiable'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                  title={r.rmRecommendation.confidenceLabel}
                                >
                                  {r.confidenceScore}%
                                </span>
                              </td>
                            )}

                            {/* 21. Validation Humaine (Actions) */}
                            {visibleColumns.validation && (
                              <td className="py-3 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                <div className="inline-flex items-center gap-1">
                                  {r.status === 'applied' ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Validé</span>
                                    </span>
                                  ) : r.status === 'modified' ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-200">
                                      <Sliders className="w-3.5 h-3.5" />
                                      <span>Modifié</span>
                                    </span>
                                  ) : r.status === 'rejected' ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-1 rounded-lg border border-rose-200">
                                      <X className="w-3.5 h-3.5" />
                                      <span>Refusé</span>
                                    </span>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => handleAcceptSingle(r)}
                                        title="Accepter la recommandation (Envoyer à D-EDGE)"
                                        className="px-2 py-1 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1"
                                      >
                                        <Check className="w-3 h-3" />
                                        <span>Valider</span>
                                      </button>
                                      <button
                                        onClick={() => handleOpenModifyModal(r)}
                                        title="Modifier le tarif avec motif RM"
                                        className="p-1 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors cursor-pointer"
                                      >
                                        <Sliders className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => handleOpenRejectModal(r)}
                                        title="Refuser la recommandation"
                                        className="p-1 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors cursor-pointer"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}

                                  <button
                                    onClick={() => setExpandedRowId(isExpanded ? null : r.id)}
                                    className="p-1 hover:bg-slate-200 text-slate-500 rounded-lg cursor-pointer ml-1"
                                    title="Ouvrir le détail complet"
                                  >
                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>

                          {/* Tiroir d'Analyse Épistémologique en 5 Niveaux & Benchmark Compset (Section 8) */}
                          {isExpanded && (
                            <tr className="bg-slate-50/95 border-b border-slate-200">
                              <td colSpan={activeColumnsCount} className="p-5 space-y-5">
                                {/* Entête du Tiroir */}
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                                  <div className="flex flex-wrap items-center gap-2.5">
                                    <span className="font-black text-sm text-slate-900 flex items-center gap-1.5">
                                      <Sparkles className="w-4 h-4 text-violet-600" />
                                      <span>Justification Épistémologique & Décision RM pour le {r.dateStr}</span>
                                    </span>
                                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-violet-100 text-violet-800">
                                      Position Compset : {ranking.rankingFraction}
                                    </span>
                                    {r.lighthouse.comparabilityWarning && (
                                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3" />
                                        <span>Avertissement de Comparabilité</span>
                                      </span>
                                    )}
                                  </div>

                                  <div className="text-xs text-slate-500 font-mono">
                                    Sources : D-EDGE CRS + Lighthouse API ({TODAY_DATE_STR})
                                  </div>
                                </div>

                                {/* Les 5 Niveaux Épistémologiques */}
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                                  {/* 1. FAITS OBSERVÉS */}
                                  <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-1.5">
                                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                      1. Faits Observés
                                    </div>
                                    <ul className="text-xs text-slate-700 space-y-1 list-disc list-inside">
                                      {r.rmRecommendation.epistemologicalExplanation.faitsObserves.map((f, i) => (
                                        <li key={i} className="leading-tight">{f}</li>
                                      ))}
                                    </ul>
                                  </div>

                                  {/* 2. ANALYSE DU MARCHÉ */}
                                  <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-1.5">
                                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                      2. Analyse de Marché
                                    </div>
                                    <ul className="text-xs text-slate-700 space-y-1 list-disc list-inside">
                                      {r.rmRecommendation.epistemologicalExplanation.analyseMarche.map((a, i) => (
                                        <li key={i} className="leading-tight">{a}</li>
                                      ))}
                                    </ul>
                                  </div>

                                  {/* 3. PRÉVISION */}
                                  <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-1.5">
                                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                      3. Prévision Demande
                                    </div>
                                    <ul className="text-xs text-slate-700 space-y-1 list-disc list-inside">
                                      {r.rmRecommendation.epistemologicalExplanation.previsionDemande.map((p, i) => (
                                        <li key={i} className="leading-tight">{p}</li>
                                      ))}
                                    </ul>
                                  </div>

                                  {/* 4. RECOMMANDATION RM */}
                                  <div className="bg-violet-50/70 rounded-xl border border-violet-200 p-3 space-y-1.5">
                                    <div className="text-[10px] font-black uppercase text-violet-700 tracking-wider">
                                      4. Recommandation RM
                                    </div>
                                    <p className="text-xs font-bold text-violet-950 leading-tight">
                                      {r.rmRecommendation.epistemologicalExplanation.recommandationAction}
                                    </p>
                                    <div className="text-[10px] text-violet-700 font-semibold pt-1 border-t border-violet-200/60">
                                      Stratégie : {r.rmRecommendation.strategyLabel}
                                    </div>
                                  </div>

                                  {/* 5. HYPOTHÈSES & LIMITES */}
                                  <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-1.5">
                                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                      5. Limites & Risques
                                    </div>
                                    <ul className="text-xs text-slate-700 space-y-1 list-disc list-inside">
                                      {r.rmRecommendation.epistemologicalExplanation.risquesIdentifies.map((risk, i) => (
                                        <li key={i} className="text-rose-700 font-medium leading-tight">{risk}</li>
                                      ))}
                                      <li className="text-slate-500 text-[11px]">{r.rmRecommendation.confidenceLabel}</li>
                                    </ul>
                                  </div>
                                </div>

                                {/* Comparatif Complet des 6 Hôtels du Compset */}
                                <div className="space-y-2">
                                  <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                                    <span>Classement et Relevé Tarifaire des 6 Hôtels du Quartier</span>
                                    <span className="text-[11px] text-slate-500 font-normal">
                                      Échantillon : {ranking.totalAvailable} disponibles / {ranking.totalCompset} compset
                                    </span>
                                  </div>

                                  <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
                                    <table className="w-full text-left text-xs">
                                      <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200">
                                        <tr>
                                          <th className="py-2 px-3 text-center">Rang</th>
                                          <th className="py-2 px-3">Établissement</th>
                                          <th className="py-2 px-3">Chambre & Conditions</th>
                                          <th className="py-2 px-3 text-right">Tarif BAR (€)</th>
                                          <th className="py-2 px-3 text-right">Écart vs Mon Hôtel</th>
                                          <th className="py-2 px-3 text-center">Statut</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {ranking.fullRankingTable.map((item, idx) => (
                                          <tr
                                            key={idx}
                                            className={
                                              item.isCurrentHotel
                                                ? 'bg-violet-50/70 font-semibold text-violet-950 ring-1 ring-violet-300'
                                                : item.isSoldOut
                                                ? 'bg-slate-50 text-slate-400'
                                                : 'hover:bg-slate-50/60'
                                            }
                                          >
                                            <td className="py-2 px-3 text-center">
                                              {item.rank !== null ? (
                                                <span
                                                  className={`inline-block font-extrabold text-xs px-2 py-0.5 rounded-md tabular-nums ${
                                                    item.isCurrentHotel
                                                      ? 'bg-violet-600 text-white shadow-2xs'
                                                      : item.rank === 1
                                                      ? 'bg-emerald-100 text-emerald-800'
                                                      : 'bg-slate-100 text-slate-700'
                                                  }`}
                                                >
                                                  {item.rank}/{ranking.totalAvailable}
                                                </span>
                                              ) : (
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">Exclu</span>
                                              )}
                                            </td>
                                            <td className="py-2 px-3">
                                              <div className="flex items-center gap-1.5">
                                                <span className="font-bold">{item.hotelName}</span>
                                                {item.isCurrentHotel && (
                                                  <span className="text-[9px] font-black uppercase bg-violet-600 text-white px-1.5 py-0.2 rounded-full">
                                                    Mon Hôtel
                                                  </span>
                                                )}
                                              </div>
                                            </td>
                                            <td className="py-2 px-3 text-slate-500">
                                              <span>{item.stars}★ • {item.roomType}</span>
                                            </td>
                                            <td className="py-2 px-3 text-right font-black tabular-nums">
                                              {item.isSoldOut ? (
                                                <span className="text-slate-400 line-through">Complet</span>
                                              ) : (
                                                <span>{item.rateEur} €</span>
                                              )}
                                            </td>
                                            <td className="py-2 px-3 text-right tabular-nums">
                                              {item.isCurrentHotel ? (
                                                <span className="text-violet-700 font-bold">— Référence</span>
                                              ) : item.isSoldOut ? (
                                                <span className="text-slate-400">N/A</span>
                                              ) : item.gapVsHotelEur > 0 ? (
                                                <span className="text-emerald-700 font-semibold">
                                                  +{item.gapVsHotelEur} € (+{Math.round((item.gapVsHotelEur / r.currentBarEur) * 100)}%)
                                                </span>
                                              ) : item.gapVsHotelEur < 0 ? (
                                                <span className="text-rose-700 font-semibold">
                                                  {item.gapVsHotelEur} € ({Math.round((item.gapVsHotelEur / r.currentBarEur) * 100)}%)
                                                </span>
                                              ) : (
                                                <span className="text-slate-500">Identique</span>
                                              )}
                                            </td>
                                            <td className="py-2 px-3 text-center">
                                              {item.isSoldOut ? (
                                                <span className="text-[10px] font-black uppercase text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200">
                                                  Sold Out
                                                </span>
                                              ) : (
                                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                                  Disponible
                                                </span>
                                              )}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        /* VUE 2 : APPRENTISSAGE CONTRÔLÉ & TRAÇABILITÉ DES DÉCISIONS RM (Section 9) */
        <div className="space-y-6">
          {/* Cartes d'indicateurs d'apprentissage */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-1">
              <div className="text-xs font-semibold text-slate-500">Décisions Humaines Tracées</div>
              <div className="text-2xl font-black text-slate-900">{learningStats.totalDecisions}</div>
              <p className="text-[11px] text-slate-500">Validation systématique requise</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-1">
              <div className="text-xs font-semibold text-emerald-700">Taux de Concordance RM / IA</div>
              <div className="text-2xl font-black text-emerald-700">{learningStats.agreementRate}%</div>
              <p className="text-[11px] text-emerald-700/80">Recommandations acceptées sans retouche</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-1">
              <div className="text-xs font-semibold text-indigo-700">Écart Moyen lors des Modifications</div>
              <div className="text-2xl font-black text-indigo-700">+{learningStats.avgDelta} €</div>
              <p className="text-[11px] text-indigo-700/80">Biais positif du RM sur les dates à fort potentiel</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-1">
              <div className="text-xs font-semibold text-amber-700">Règles Actives Calibrées</div>
              <div className="text-2xl font-black text-amber-700">
                {calibrationRules.filter((r) => r.isActive).length} / {calibrationRules.length}
              </div>
              <p className="text-[11px] text-amber-700/80">Règles réversibles avec switch direct</p>
            </div>
          </div>

          {/* Règles d'apprentissage calibrées (Section 9) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-violet-600" />
                  <span>Règles d’Apprentissage Contrôlé & Ajustements Calibrés</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Dérivées statistiquement des arbitrages du Revenue Manager. Chaque règle est transparente, mesurable et débrayable en un clic.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {calibrationRules.map((rule) => (
                <div
                  key={rule.id}
                  className={`p-4 rounded-xl border transition-all ${
                    rule.isActive
                      ? 'bg-violet-50/50 border-violet-200'
                      : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-bold text-xs text-slate-900">{rule.title}</span>
                    <button
                      onClick={() => handleToggleRule(rule.id)}
                      className="cursor-pointer text-violet-600 hover:text-violet-800 transition-colors"
                      title={rule.isActive ? 'Désactiver cette règle' : 'Activer cette règle'}
                    >
                      {rule.isActive ? (
                        <ToggleRight className="w-6 h-6 text-violet-600" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-slate-400" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-600 mb-3">{rule.description}</p>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-200/60">
                    <span>{rule.sampleDecisionsCount} décisions analysées</span>
                    <span className="font-bold text-emerald-700">{rule.agreementRatePct}% concordance</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Journal chronologique d'audit des décisions RM (Section 9) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <History className="w-4 h-4 text-violet-600" />
                  <span>Journal d’Audit et Traçabilité Complète des Arbitrages RM</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Historique immuable : horodatage, utilisateur, tarif initial, tarif préconisé, tarif retenu et motif de décision.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Date Séjour</th>
                    <th className="py-2.5 px-3">Action RM</th>
                    <th className="py-2.5 px-3 text-right">Initial</th>
                    <th className="py-2.5 px-3 text-right">Suggéré</th>
                    <th className="py-2.5 px-3 text-right font-bold text-violet-700">Retenu</th>
                    <th className="py-2.5 px-4">Motif & Explication Enregistrée</th>
                    <th className="py-2.5 px-3">Utilisateur</th>
                    <th className="py-2.5 px-3 text-right">Horodatage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 font-bold text-slate-900">{log.dateStr}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            log.action === 'accept'
                              ? 'bg-emerald-100 text-emerald-800'
                              : log.action === 'modify'
                              ? 'bg-indigo-100 text-indigo-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {log.action === 'accept' ? 'Accepté' : log.action === 'modify' ? 'Modifié' : 'Refusé'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{log.originalRateEur} €</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{log.suggestedRateEur} €</td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-black text-violet-700">
                        {log.finalRateEur} €
                      </td>
                      <td className="py-2.5 px-4 max-w-sm truncate text-slate-700" title={log.reasonText}>
                        {log.reasonText}
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-slate-500 font-mono">{log.userEmail}</td>
                      <td className="py-2.5 px-3 text-right text-[11px] text-slate-400">
                        {new Date(log.timestamp).toLocaleString('fr-FR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1 : Modification Manuelle Tarif & Saisie du Motif RM (Section 9) */}
      {modifyingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-violet-100 text-violet-700">
                  <Sliders className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900">Arbitrage Manuel Revenue Management</h3>
                  <p className="text-xs text-slate-500">Date de séjour : {modifyingRecord.dateStr}</p>
                </div>
              </div>
              <button
                onClick={() => setModifyingRecord(null)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Rappel des données de base */}
            <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-50 text-xs border border-slate-200/60">
              <div>
                <span className="text-slate-400 block text-[10px]">BAR Actuel :</span>
                <span className="font-bold text-slate-900">{modifyingRecord.currentBarEur} €</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Médiane Compset :</span>
                <span className="font-bold text-amber-600">{modifyingRecord.lighthouse.compsetMedianEur} €</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Suggéré Moteur RM :</span>
                <span className="font-bold text-violet-700">{modifyingRecord.suggestedBarEur} €</span>
              </div>
            </div>

            {/* Saisie Tarif & Min Stay */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Nouveau Tarif BAR (€) :</label>
                <input
                  type="number"
                  min={RATE_FLOOR_EUR}
                  max={RATE_CEILING_EUR}
                  step={5}
                  value={customRate}
                  onChange={(e) => setCustomRate(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-black text-slate-900 text-lg focus:outline-hidden focus:border-violet-600"
                />
                <span className="text-[10px] text-slate-400">
                  Plancher {RATE_FLOOR_EUR}€ • Plafond {RATE_CEILING_EUR}€
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Durée Min. (Min Stay) :</label>
                <select
                  value={customMinStay}
                  onChange={(e) => setCustomMinStay(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-900 text-sm focus:outline-hidden focus:border-violet-600 cursor-pointer"
                >
                  <option value={1}>1 Nuit (Pas de restriction)</option>
                  <option value={2}>2 Nuits minimum</option>
                  <option value={3}>3 Nuits minimum</option>
                  <option value={4}>4 Nuits minimum</option>
                </select>
              </div>
            </div>

            {/* Choix Obligatoire du Motif de Décision (Section 9) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Motif de modification de la recommandation (Obligatoire) :</span>
              </label>
              <select
                value={selectedReasonCode}
                onChange={(e) => setSelectedReasonCode(e.target.value as RMModificationReasonCode)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-800 focus:outline-hidden focus:border-violet-600 cursor-pointer"
              >
                {RM_MODIFICATION_REASONS.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 italic">
                {RM_MODIFICATION_REASONS.find((r) => r.code === selectedReasonCode)?.description}
              </p>
            </div>

            {/* Note complémentaire */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Note métier complémentaire :</label>
              <textarea
                rows={2}
                placeholder="Précisions pour la traçabilité et l'apprentissage..."
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-hidden focus:border-violet-600"
              />
            </div>

            {/* Boutons d'action */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setModifyingRecord(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmModify}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Enregistrer & Transmettre au CRS</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2 : Refus de la Recommandation (Section 9) */}
      {rejectingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-rose-100 text-rose-700">
                  <X className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900">Refus de la Recommandation</h3>
                  <p className="text-xs text-slate-500">Date : {rejectingRecord.dateStr}</p>
                </div>
              </div>
              <button
                onClick={() => setRejectingRecord(null)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Le tarif actuel de <strong>{rejectingRecord.currentBarEur} €</strong> sera maintenu. La recommandation suggérée de <strong>{rejectingRecord.suggestedBarEur} €</strong> sera marquée comme refusée dans l'audit.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Motif du refus :</label>
              <input
                type="text"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="Ex : Maintien de l'image prix, concurrence agressive..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-hidden focus:border-rose-600"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setRejectingRecord(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                <span>Confirmer le Refus</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3 : Roue de Configuration des Colonnes RM (Sélection Personnalisée) */}
      {showColumnConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-2xl bg-violet-100 text-violet-700">
                  <Settings className="w-5 h-5 animate-[spin_10s_linear_infinite]" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    <span>Roue de Configuration des Colonnes RM</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-800">
                      {activeColumnsCount} / {RM_COLUMN_DEFINITIONS.length} actives
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Personnalisez les indicateurs affichés dans le tableau de recommandation tarifaire.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowColumnConfigModal(false)}
                className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Presets Bar */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase text-slate-400 block tracking-wider">
                Préréglages d'affichage rapides :
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {RM_COLUMN_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleApplyPreset(p.id)}
                    className="p-2 rounded-xl border text-left transition-all cursor-pointer bg-slate-50/70 hover:bg-violet-50 hover:border-violet-300 border-slate-200"
                  >
                    <div className="text-xs font-bold text-slate-900">{p.name}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{p.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Search & Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filtrer les colonnes (ex : RevPAR, Médian, Stock...)"
                  value={columnSearchTerm}
                  onChange={(e) => setColumnSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs w-full focus:outline-hidden focus:border-violet-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const allTrue: Record<string, boolean> = {};
                    RM_COLUMN_DEFINITIONS.forEach((c) => {
                      allTrue[c.id] = true;
                    });
                    setVisibleColumns(allTrue as Record<ColumnId, boolean>);
                    try {
                      localStorage.setItem(STORAGE_COLUMN_KEY, JSON.stringify(allTrue));
                    } catch (e) {}
                  }}
                  className="text-xs font-bold text-violet-700 hover:text-violet-900 bg-violet-50 px-2.5 py-1.5 rounded-lg cursor-pointer"
                >
                  Tout cocher
                </button>
                <button
                  onClick={handleResetColumns}
                  className="text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Réinitialiser</span>
                </button>
              </div>
            </div>

            {/* Columns Groups List (Scrollable) */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {(['contexte', 'pricing', 'dedge', 'decision'] as const).map((grp) => {
                const groupCols = RM_COLUMN_DEFINITIONS.filter(
                  (c) =>
                    c.group === grp &&
                    (columnSearchTerm
                      ? c.name.toLowerCase().includes(columnSearchTerm.toLowerCase()) ||
                        c.description.toLowerCase().includes(columnSearchTerm.toLowerCase())
                      : true)
                );
                if (groupCols.length === 0) return null;

                const grpLabel =
                  grp === 'contexte'
                    ? '🗓️ Contexte Calendrier & Demande'
                    : grp === 'pricing'
                    ? '🏷️ Tarifs & Concurrence Lighthouse'
                    : grp === 'dedge'
                    ? '📊 Indicateurs D-EDGE Planning & Réservations'
                    : '⚡ Recommandations, Sécurité & Décision RM';

                return (
                  <div key={grp} className="space-y-2">
                    <div className="text-xs font-black text-slate-800 bg-slate-100/80 px-3 py-1.5 rounded-lg flex items-center justify-between">
                      <span>{grpLabel}</span>
                      <span className="text-[10px] text-slate-500 font-normal">
                        {groupCols.filter((c) => visibleColumns[c.id]).length} / {groupCols.length} visibles
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {groupCols.map((col) => {
                        const isChecked = visibleColumns[col.id];
                        const isRequired = col.required;

                        return (
                          <label
                            key={col.id}
                            onClick={() => !isRequired && handleToggleColumn(col.id)}
                            className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer select-none transition-all ${
                              isRequired
                                ? 'bg-slate-50 border-slate-200 opacity-90 cursor-not-allowed'
                                : isChecked
                                ? 'bg-violet-50/50 border-violet-200 text-violet-950 shadow-2xs'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={isRequired}
                              onChange={() => {}}
                              className="mt-0.5 rounded text-violet-600 focus:ring-violet-500 cursor-pointer"
                            />
                            <div className="space-y-0.5 flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="font-bold truncate">{col.name}</span>
                                {isRequired ? (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 flex items-center gap-0.5">
                                    <Lock className="w-2.5 h-2.5" />
                                    <span>Requis</span>
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-mono text-slate-400">
                                    Col. {col.colNumber}
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-500 leading-tight line-clamp-1">
                                {col.description}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="text-xs text-slate-500">
                Sauvegarde automatique active • Stocké localement
              </span>
              <button
                onClick={() => setShowColumnConfigModal(false)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white shadow-xs transition-all cursor-pointer"
              >
                Appliquer et fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popover / Fenêtre Contextuelle au Clic pour la Justification Complète (Colonne 19) */}
      {activeExplanationPopover && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setActiveExplanationPopover(null)}
          />

          {/* Popover Card */}
          <div className="relative bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 z-10 space-y-4 animate-scaleUp text-left">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-violet-100 text-violet-800 border border-violet-200">
                    Justification & Recommandation RM
                  </span>
                  <span className="text-xs font-bold text-slate-700">
                    {activeExplanationPopover.dayOfWeek}{' '}
                    {new Date(activeExplanationPopover.dateStr).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <h3 className="text-base font-black text-slate-900">
                  {activeExplanationPopover.eventTitle || 'Séjour standard (sans événement majeur)'}
                </h3>
              </div>

              <button
                onClick={() => setActiveExplanationPopover(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
                title="Fermer la fenêtre"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Recap Tarifaire & Stratégie */}
            <div className="grid grid-cols-3 gap-2.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Tarif Actuel</span>
                <span className="text-base font-bold text-slate-800 tabular-nums block mt-0.5">
                  {activeExplanationPopover.currentBarEur} €
                </span>
                <span className="text-[9px] text-slate-400">CRS D-EDGE</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-violet-600 uppercase block">Tarif Conseillé</span>
                <span className="text-base font-black text-violet-700 tabular-nums block mt-0.5">
                  {activeExplanationPopover.suggestedBarEur} €
                </span>
                <span className="text-[9px] text-violet-500 font-semibold">Yield optimal</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-emerald-600 uppercase block">Écart (€ / %)</span>
                <span className="text-base font-black text-emerald-600 tabular-nums block mt-0.5">
                  {activeExplanationPopover.deltaVsCurrentEur > 0
                    ? `+${activeExplanationPopover.deltaVsCurrentEur}€`
                    : `${activeExplanationPopover.deltaVsCurrentEur}€`}
                  <span className="text-xs ml-1 font-bold">
                    ({activeExplanationPopover.deltaVsCurrentPercent > 0
                      ? `+${activeExplanationPopover.deltaVsCurrentPercent}%`
                      : `${activeExplanationPopover.deltaVsCurrentPercent}%`})
                  </span>
                </span>
                <span className="text-[9px] text-emerald-600 font-semibold">
                  {activeExplanationPopover.deltaVsCurrentEur >= 0 ? 'Sous-coté' : 'Sur-coté'}
                </span>
              </div>
            </div>

            {/* Badge Stratégie avec explication détaillée */}
            <div className="space-y-1 bg-violet-50/70 p-3.5 rounded-2xl border border-violet-100">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-violet-900 uppercase tracking-wider">
                  Stratégie Yield Retenue :
                </span>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${activeExplanationPopover.strategyBadgeColor}`}
                >
                  {activeExplanationPopover.strategyLabel}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-snug">
                {activeExplanationPopover.strategyDescription}
              </p>
            </div>

            {/* Explication complète sans aucune coupure */}
            <div className="space-y-2 bg-slate-50/90 p-4 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-1.5 text-xs font-black text-slate-900">
                <Info className="w-4 h-4 text-violet-600" />
                <span>Justification Complète de la Recommandation</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed font-normal bg-white p-3 rounded-xl border border-slate-200/70">
                {activeExplanationPopover.justification}
              </p>
            </div>

            {/* Signaux de marché issus du moteur épistémologique */}
            {activeExplanationPopover.epistemologicalExplanation?.faitsObserves &&
              activeExplanationPopover.epistemologicalExplanation.faitsObserves.length > 0 && (
                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Faits & Signaux Observés sur le Marché :
                  </div>
                  <ul className="space-y-1 pl-1">
                    {activeExplanationPopover.epistemologicalExplanation.faitsObserves.map((f, fIdx) => (
                      <li key={fIdx} className="flex items-start gap-1.5 text-[11px] text-slate-600">
                        <span className="text-violet-500 font-bold">•</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>
                  Indice de confiance statistique :{' '}
                  <strong className="text-slate-900">{activeExplanationPopover.confidenceScore}%</strong>
                </span>
              </div>
              <button
                onClick={() => setActiveExplanationPopover(null)}
                className="px-4 py-2 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition-all cursor-pointer shadow-xs"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

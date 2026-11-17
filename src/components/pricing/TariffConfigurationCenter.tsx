/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FLOWTYM REVENUE — CENTRE DE CONFIGURATION TARIFAIRE (15 DOMAINES)
 * Gouvernance complète : Établissement & Multi-hôtels, Référence Tarifaire, Chambres & Mapping,
 * Plans Tarifaires, Import 10 étapes, Arbre de Relations, FLEX/NRF, Petit-Déjeuner, Suppléments,
 * Restrictions & Audit.
 */

import React, { useMemo, useRef, useState } from 'react';
import { addDaysIso, getTodayIsoDate } from '../../utils/eventFilterUtils';
import {
  Archive,
  BedDouble,
  Building2,
  CheckCircle2,
  Coffee,
  Copy,
  Download,
  Edit3,
  FileSpreadsheet,
  GitBranch,
  History,
  Layers,
  Lock,
  Plug,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Tag,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  BreakfastInclusionMode,
  CancellationPolicyType,
  CurrencyCode,
  DistributionChannelCode,
  FlexNrfConfig,
  Hotel,
  HotelTariffConfiguration,
  PaymentPolicyType,
  RateImportItem,
  RateImportJob,
  RatePlanConfig,
  RatePlanNature,
  RateReferenceRule,
  RateRestrictionRule,
  RelationCalculationMode,
  RoomCategoryConfig,
  RoundingRuleType,
  SupplementAndPromoItem,
} from '../../types';
import {
  DependencyTreeNode,
  TariffConfigAuditEntry,
  applyGroupTemplateToHotel,
  applyRoundingRule,
  buildImportPreviewDiff,
  buildRateDependencyTree,
  canDeleteRatePlan,
  computeDerivedRateForPlan,
  detectCircularDependencies,
  executeRatePlanImport,
  exportRatePlansToExcel,
  getEffectiveBreakfastPrice,
  getGroupTariffTemplate,
  getHotelTariffConfig,
  getTariffConfigAuditLog,
  parseRatePlansFromSpreadsheetBuffer,
  saveGroupTariffTemplate,
  saveHotelTariffConfig,
  validateRatePlanList,
} from '../../services/tariffConfigurationService';
import {
  applyRestrictionRuleToPlanning,
  recalculateDerivedPlansInPlanning,
} from '../../services/ratePlanningSyncService';
import { RoomMappingEditor } from './RoomMappingEditor';
import { SmartExcelImportModal } from './SmartExcelImportModal';
import { UniversalConnectorCenter } from '../connectivity/UniversalConnectorCenter';

interface TariffConfigurationCenterProps {
  hotel: Hotel;
  initialSubTab?: ConfigSubTab;
  onShowToast: (msg: string) => void;
  onOpenConnectivitySettings: () => void;
  onConfigUpdated: () => void;
}

export type ConfigSubTab =
  | 'hotel_ref'
  | 'connectors'
  | 'rooms'
  | 'plans'
  | 'relations'
  | 'flex_breakfast'
  | 'import_wizard'
  | 'supplements_audit';

const CURRENCIES: CurrencyCode[] = ['EUR', 'USD', 'GBP', 'CHF'];

const NATURE_LABELS: Record<RatePlanNature, string> = {
  reference: 'Tarif de référence',
  derived: 'Tarif dérivé',
  independent: 'Tarif indépendant',
  promotional: 'Tarif promotionnel',
  contractual: 'Tarif contractuel',
};

const CALC_MODE_LABELS: Record<RelationCalculationMode, string> = {
  independent: 'Indépendant (fixe)',
  fixed_minus: 'Montant fixe (-€)',
  fixed_plus: 'Montant fixe (+€)',
  percent_minus: 'Pourcentage (-%)',
  percent_plus: 'Pourcentage (+%)',
  multiplier: 'Coefficient multiplicateur (×)',
  custom_formula: 'Formule personnalisée',
};

const BREAKFAST_LABELS: Record<BreakfastInclusionMode, string> = {
  none: 'Non inclus (Chambre seule)',
  included_1_guest: 'Inclus 1 personne',
  included_2_guests: 'Inclus 2 personnes',
  included_per_occupancy: 'Inclus selon occupation',
  supplement_optional: 'Supplément optionnel',
};

const CANCELLATION_TYPES: CancellationPolicyType[] = [
  'Flexible',
  'Semi-flexible',
  'Non-annulable',
  'Personnalisée',
];

const PAYMENT_TYPES: PaymentPolicyType[] = [
  'Paiement sur place',
  'Prépaiement total à la réservation',
  'Acompte 1ère nuit',
  'Garantie CB sans débit',
  'Facturation société (Corporate)',
];

const ROUNDING_LABELS: Record<RoundingRuleType, string> = {
  nearest_euro: 'Euro le plus proche (ex: 243€)',
  nearest_5: 'Multiple de 5€ (ex: 245€)',
  end_99: 'Terminaison .99 (ex: 242.99€)',
  none: 'Exact à 2 décimales',
};

export const TariffConfigurationCenter: React.FC<TariffConfigurationCenterProps> = ({
  hotel,
  initialSubTab = 'hotel_ref',
  onShowToast,
  onOpenConnectivitySettings,
  onConfigUpdated,
}) => {
  const [subTab, setSubTab] = useState<ConfigSubTab>(initialSubTab);

  React.useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);
  const [config, setConfig] = useState<HotelTariffConfiguration>(() => getHotelTariffConfig(hotel));
  const [groupTemplate, setGroupTemplate] = useState(() => getGroupTariffTemplate());
  const [auditLog, setAuditLog] = useState<TariffConfigAuditEntry[]>(() =>
    getTariffConfigAuditLog(hotel.id)
  );
  const [isRecalculating, setIsRecalculating] = useState(false);

  // Sync local config state when hotel changes
  React.useEffect(() => {
    setConfig(getHotelTariffConfig(hotel));
    setAuditLog(getTariffConfigAuditLog(hotel.id));
  }, [hotel]);

  const commitConfig = (
    next: HotelTariffConfiguration,
    section: string,
    details: string,
    toastMsg?: string
  ) => {
    try {
      const saved = saveHotelTariffConfig(hotel, next, 'Wali Larabi', section, details);
      setConfig(saved);
      setAuditLog(getTariffConfigAuditLog(hotel.id));
      onConfigUpdated();
      if (toastMsg) onShowToast(toastMsg);
    } catch (err: any) {
      onShowToast(err?.message || 'Erreur de validation configuration.');
    }
  };

  // Search states
  const [roomSearch, setRoomSearch] = useState('');
  const [planSearch, setPlanSearch] = useState('');

  // Room Category Form Modal State
  const [editingRoom, setEditingRoom] = useState<RoomCategoryConfig | null>(null);

  // Rate Plan Form Modal State
  const [editingPlan, setEditingPlan] = useState<RatePlanConfig | null>(null);

  // Dependency Simulator State
  const [simRefPrice, setSimRefPrice] = useState<number>(250);

  // 10-Step Import Wizard State
  const [importStep, setImportStep] = useState<number>(1);
  const [importSource, setImportSource] = useState<'pms' | 'channel_manager' | 'excel' | 'csv'>('pms');
  const [importFileName, setImportFileName] = useState<string>('');
  const [importItems, setImportItems] = useState<RateImportItem[]>([]);
  const [externalCats, setExternalCats] = useState<
    { externalCode: string; name: string; physicalRooms: number; maxAdults: number; maxChildren: number }[]
  >([]);
  const [importMode, setImportMode] = useState<RateImportJob['mode']>(
    'add_only'
  );
  const [isFetchingExternal, setIsFetchingExternal] = useState(false);
  const [lastImportSummary, setLastImportSummary] = useState<string | null>(null);
  const [isSmartExcelOpen, setIsSmartExcelOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // New Supplement Form State
  const [newSupName, setNewSupName] = useState('');
  const [newSupCode, setNewSupCode] = useState('');
  const [newSupValue, setNewSupValue] = useState(25);
  const [newSupType, setNewSupType] = useState<'supplement' | 'package' | 'discount'>('supplement');

  // New Restriction Rule State
  const [newRestName, setNewRestName] = useState('Séjour minimum Salon Professionnel');
  const [newRestFrom, setNewRestFrom] = useState<string>(() => addDaysIso(getTodayIsoDate(), 7));
  const [newRestTo, setNewRestTo] = useState<string>(() => addDaysIso(getTodayIsoDate(), 9));
  const [newRestMinStay, setNewRestMinStay] = useState(2);
  const [newRestStopSell, setNewRestStopSell] = useState(false);

  const activePlans = useMemo(
    () => config.ratePlans.filter((p) => p.status !== 'archived'),
    [config.ratePlans]
  );

  const dependencyTree = useMemo(
    () => buildRateDependencyTree(config.ratePlans),
    [config.ratePlans]
  );

  const cycleCheck = useMemo(
    () => detectCircularDependencies(config.ratePlans),
    [config.ratePlans]
  );

  const uniquenessCheck = useMemo(
    () => validateRatePlanList(config.ratePlans),
    [config.ratePlans]
  );

  const filteredRooms = useMemo(() => {
    const q = roomSearch.trim().toLowerCase();
    return config.roomCategories.filter(
      (rc) =>
        !q ||
        rc.name.toLowerCase().includes(q) ||
        rc.code.toLowerCase().includes(q) ||
        rc.pmsRoomId.toLowerCase().includes(q) ||
        rc.cmRoomId.toLowerCase().includes(q)
    );
  }, [config.roomCategories, roomSearch]);

  const filteredPlans = useMemo(() => {
    const q = planSearch.trim().toLowerCase();
    return config.ratePlans.filter(
      (p) =>
        !q ||
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.pmsExternalId.toLowerCase().includes(q) ||
        p.cmExternalId.toLowerCase().includes(q)
    );
  }, [config.ratePlans, planSearch]);

  const handleRecalculateAllDerived = async () => {
    setIsRecalculating(true);
    try {
      const res = await recalculateDerivedPlansInPlanning(hotel);
      onConfigUpdated();
      onShowToast(
        res.syncedCount > 0
          ? `${res.syncedCount} cellule(s) dérivée(s) recalculée(s) & synchronisée(s). Plans indépendants préservés.`
          : 'Tous les tarifs dérivés sont déjà alignés avec les règles actives.'
      );
    } finally {
      setIsRecalculating(false);
    }
  };

  // Handlers: Room Categories
  const openNewRoomModal = () => {
    setEditingRoom({
      id: `rc-${hotel.id}-${Date.now()}`,
      hotelId: hotel.id,
      code: '',
      name: '',
      description: '',
      physicalRooms: 5,
      maxCapacity: 2,
      maxAdults: 2,
      maxChildren: 1,
      standardOccupancy: 2,
      maxOccupancy: 2,
      surfaceSqm: 22,
      isActive: true,
      isArchived: false,
      pmsRoomId: '',
      cmRoomId: '',
      applicableRatePlanCodes: activePlans.map((p) => p.code),
      extraAdultSupplementEur: 40,
      extraChildSupplementEur: 20,
      thirdAdultSupplementEur: 45,
      singleOccupancySupplementEur: -15,
      tripleOccupancySupplementEur: 45,
      baseOffsetEur: 30,
      weightPercent: 15,
      provenance: 'local',
    });
  };

  const handleSaveRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoom) return;
    const cleanCode = editingRoom.code.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    if (!cleanCode || !editingRoom.name.trim()) {
      onShowToast('Le code et le nom de la catégorie sont obligatoires.');
      return;
    }
    const duplicate = config.roomCategories.some(
      (rc) =>
        rc.id !== editingRoom.id &&
        (rc.code.toLowerCase() === cleanCode ||
          (editingRoom.pmsRoomId && rc.pmsRoomId === editingRoom.pmsRoomId) ||
          (editingRoom.cmRoomId && rc.cmRoomId === editingRoom.cmRoomId))
    );
    if (duplicate) {
      onShowToast('Doublon détecté sur le code catégorie ou les identifiants PMS/Channel Manager.');
      return;
    }
    const normalized: RoomCategoryConfig = { ...editingRoom, code: cleanCode };
    const exists = config.roomCategories.some((rc) => rc.id === normalized.id);
    const nextRooms = exists
      ? config.roomCategories.map((rc) => (rc.id === normalized.id ? normalized : rc))
      : [...config.roomCategories, normalized];

    commitConfig(
      { ...config, roomCategories: nextRooms },
      'Chambres & Inventaire',
      `${exists ? 'Mise à jour' : 'Création'} catégorie ${normalized.name} (${normalized.physicalRooms} ch.)`,
      `Catégorie "${normalized.name}" enregistrée.`
    );
    setEditingRoom(null);
  };

  // Handlers: Rate Plans
  const openNewPlanModal = () => {
    setEditingPlan({
      id: `rp-${hotel.id}-${Date.now()}`,
      hotelId: hotel.id,
      code: '',
      name: '',
      description: '',
      planNature: 'derived',
      referencePlanCode: config.globalReferencePlanCode || 'BAR',
      calculationMode: 'percent_minus',
      variationValue: 10,
      relationActive: true,
      currency: config.currency,
      cancellationPolicy: 'Flexible',
      cancellationDetails: 'Annulation sans frais jusqu’à J-1.',
      paymentPolicy: 'Paiement sur place',
      breakfastMode: 'none',
      includedGuests: 2,
      minStayDefault: 1,
      maxStayDefault: 30,
      advanceBookingMinDays: 0,
      advanceBookingMaxDays: 365,
      roomCategoryCodes: config.roomCategories.filter((c) => !c.isArchived).map((c) => c.code),
      channels: ['DIRECT_WEB', 'BOOKING', 'EXPEDIA'],
      pmsExternalId: '',
      cmExternalId: '',
      validFrom: null,
      validTo: null,
      floorEur: 120,
      ceilingEur: 650,
      status: 'active',
      provenance: 'local',
      updatedAt: new Date().toISOString(),
    });
  };

  const handleSavePlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    const cleanCode = editingPlan.code.trim().toUpperCase().replace(/[^A-Z0-9_]+/g, '_');
    if (!cleanCode || !editingPlan.name.trim()) {
      onShowToast('Le code et le nom du plan tarifaire sont obligatoires.');
      return;
    }
    const normalized: RatePlanConfig = {
      ...editingPlan,
      code: cleanCode,
      referencePlanCode:
        editingPlan.planNature === 'independent' || editingPlan.calculationMode === 'independent'
          ? null
          : editingPlan.referencePlanCode,
      updatedAt: new Date().toISOString(),
    };
    const exists = config.ratePlans.some((p) => p.id === normalized.id);
    const nextPlans = exists
      ? config.ratePlans.map((p) => (p.id === normalized.id ? normalized : p))
      : [...config.ratePlans, normalized];

    const uErr = validateRatePlanList(nextPlans);
    if (uErr) {
      onShowToast(uErr);
      return;
    }
    const cyc = detectCircularDependencies(nextPlans);
    if (cyc) {
      onShowToast(`Dépendance circulaire bloquée : ${cyc.join(' → ')}`);
      return;
    }

    commitConfig(
      { ...config, ratePlans: nextPlans },
      'Plans Tarifaires',
      `${exists ? 'Modification' : 'Création'} plan ${normalized.code} (${normalized.planNature})`,
      `Plan tarifaire "${normalized.code}" enregistré.`
    );
    setEditingPlan(null);
  };

  const handleDuplicatePlan = (plan: RatePlanConfig) => {
    const suffix = Math.floor(10 + Math.random() * 89);
    const copyCode = `${plan.code}_COP${suffix}`;
    const copy: RatePlanConfig = {
      ...plan,
      id: `rp-${hotel.id}-${copyCode}-${Date.now()}`,
      code: copyCode,
      name: `${plan.name} (Copie)`,
      pmsExternalId: plan.pmsExternalId ? `${plan.pmsExternalId}-${suffix}` : '',
      cmExternalId: plan.cmExternalId ? `${plan.cmExternalId}-${suffix}` : '',
      isSystemDefault: false,
      updatedAt: new Date().toISOString(),
    };
    commitConfig(
      { ...config, ratePlans: [...config.ratePlans, copy] },
      'Plans Tarifaires',
      `Duplication de ${plan.code} vers ${copyCode}`,
      `Plan "${copyCode}" dupliqué.`
    );
  };

  const handleTogglePlanStatus = (plan: RatePlanConfig, nextStatus: RatePlanConfig['status']) => {
    if (nextStatus !== 'active') {
      const guard = canDeleteRatePlan(config, plan.code);
      if (!guard.allowed && nextStatus === 'archived') {
        onShowToast(guard.reason || 'Impossible d’archiver un plan utilisé comme référence.');
        return;
      }
    }
    const nextPlans = config.ratePlans.map((p) =>
      p.id === plan.id ? { ...p, status: nextStatus, updatedAt: new Date().toISOString() } : p
    );
    commitConfig(
      { ...config, ratePlans: nextPlans },
      'Plans Tarifaires',
      `Statut plan ${plan.code} → ${nextStatus}`,
      `Plan "${plan.code}" passé en statut ${nextStatus}.`
    );
  };

  const handleDeletePlan = (plan: RatePlanConfig) => {
    const guard = canDeleteRatePlan(config, plan.code);
    if (!guard.allowed) {
      onShowToast(guard.reason || 'Suppression bloquée par les dépendances actives.');
      return;
    }
    const nextPlans = config.ratePlans.filter((p) => p.id !== plan.id);
    commitConfig(
      { ...config, ratePlans: nextPlans },
      'Plans Tarifaires',
      `Suppression définitive du plan ${plan.code}`,
      `Plan "${plan.code}" supprimé.`
    );
  };

  // Handlers: 10-Step Import Wizard
  const handleLoadExternalCatalog = async (src: 'pms' | 'channel_manager') => {
    setIsFetchingExternal(true);
    try {
      const resp = await fetch(`/api/external-catalog/${src}?hotelId=${encodeURIComponent(hotel.id)}`);
      const data = await resp.json();
      setImportItems(Array.isArray(data.ratePlans) ? data.ratePlans : []);
      setExternalCats(Array.isArray(data.roomCategories) ? data.roomCategories : []);
      setImportFileName(`Flux API ${data.provider || src.toUpperCase()}`);
      setImportStep(3);
    } catch {
      onShowToast('Impossible de récupérer le catalogue externe.');
    } finally {
      setIsFetchingExternal(false);
    }
  };

  const handleSpreadsheetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    const parsed = parseRatePlansFromSpreadsheetBuffer(buffer, file.name);
    if (parsed.length === 0) {
      onShowToast('Aucun plan tarifaire détecté dans ce fichier (vérifiez les colonnes Code, Nom).');
      return;
    }
    setImportItems(parsed);
    setExternalCats([]);
    setImportFileName(file.name);
    setImportStep(3);
  };

  const handleExecuteImport = () => {
    const res = executeRatePlanImport(hotel, {
      source: importSource,
      fileName: importFileName || undefined,
      mode: importMode,
      items: importItems,
      newRoomCategories: externalCats,
    });
    setConfig(res.config);
    setAuditLog(getTariffConfigAuditLog(hotel.id));
    setLastImportSummary(res.job.summary);
    setImportStep(10);
    onConfigUpdated();
    onShowToast(res.job.summary);
  };

  const importDiff = useMemo(() => {
    const items = buildImportPreviewDiff(config.ratePlans, importItems, importMode);
    return {
      items,
      toAdd: items.filter((i) => i.action === 'add'),
      toUpdate: items.filter((i) => i.action === 'update'),
      toIgnore: items.filter((i) => i.action === 'ignore'),
    };
  }, [config.ratePlans, importItems, importMode]);

  // Breakfast + FLEX/NRF comparative preview matrix
  const flexBreakfastPreview = useMemo(() => {
    const base = 240;
    const nrfPlan = config.ratePlans.find((p) => p.code === config.flexNrf.nrfPlanCode);
    const todayStr = getTodayIsoDate();
    const nrfRate = nrfPlan
      ? computeDerivedRateForPlan({
          referenceRateEur: base,
          targetPlan: nrfPlan,
          config,
          roomCategoryCode: config.roomCategories[0]?.code || 'classique',
          stayDate: todayStr,
        }) ?? Math.round(base * 0.88)
      : Math.round(base * 0.88);
    const bfastPrice = getEffectiveBreakfastPrice({
      mealPlan: config.mealPlan,
      roomCategoryCode: config.roomCategories[0]?.code || 'classique',
      stayDate: todayStr,
      guestsCount: 2,
    });
    return {
      flexNoBfast: base,
      flexWithBfast: Math.round(base + bfastPrice),
      nrfNoBfast: Math.round(nrfRate),
      nrfWithBfast: Math.round(nrfRate + bfastPrice),
      bfastPrice,
    };
  }, [config]);

  const renderDependencyNode = (node: DependencyTreeNode, depth: number = 0) => (
    <div key={node.plan.code} className={depth > 0 ? 'ml-6 pl-4 border-l-2 border-violet-200 dark:border-violet-800/70 mt-2' : 'mt-2'}>
      <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2.5">
          <span className="px-2 py-0.5 rounded bg-violet-50 dark:bg-violet-950/50 border border-violet-200 dark:border-violet-800 font-bold text-violet-700 dark:text-violet-300">
            {node.plan.code}
          </span>
          <div>
            <div className="font-semibold text-slate-900 dark:text-slate-100">{node.plan.name}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">{node.formulaLabel}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-bold tabular-nums text-slate-800 dark:text-slate-100">
            {depth === 0 && node.plan.calculationMode === 'independent'
              ? `${simRefPrice} ${config.currency}`
              : `${
                  computeDerivedRateForPlan({
                    referenceRateEur: simRefPrice,
                    targetPlan: node.plan,
                    config,
                    roomCategoryCode: config.roomCategories[0]?.code || 'classique',
                    stayDate: getTodayIsoDate(),
                  }) ?? simRefPrice
                } ${config.currency}`}
          </span>
          {node.plan.referencePlanCode && (
            <button
              type="button"
              onClick={() => {
                const nextPlans = config.ratePlans.map((p) =>
                  p.id === node.plan.id ? { ...p, relationActive: !p.relationActive } : p
                );
                commitConfig(
                  { ...config, ratePlans: nextPlans },
                  'Relations Tarifaires',
                  `Relation ${node.plan.code} ${!node.plan.relationActive ? 'activée' : 'suspendue'}`
                );
              }}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer whitespace-nowrap ${
                node.plan.relationActive
                  ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500'
              }`}
            >
              {node.plan.relationActive ? 'Relation active' : 'Relation suspendue'}
            </button>
          )}
        </div>
      </div>
      {node.children.map((child) => renderDependencyNode(child, depth + 1))}
    </div>
  );

  const navItems: { id: ConfigSubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'hotel_ref', label: '01. Établissement & Référence', icon: <Building2 className="w-3.5 h-3.5" /> },
    { id: 'connectors', label: '02. Connecteurs & Sync', icon: <Plug className="w-3.5 h-3.5" /> },
    { id: 'rooms', label: '03–04. Chambres & Multi-Mappings', icon: <BedDouble className="w-3.5 h-3.5" /> },
    { id: 'plans', label: '05. Plans Tarifaires', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'relations', label: '06. Relations & Dépendances', icon: <GitBranch className="w-3.5 h-3.5" /> },
    { id: 'flex_breakfast', label: '07–08. FLEX/NRF, Arrondis & PDJ', icon: <Coffee className="w-3.5 h-3.5" /> },
    { id: 'import_wizard', label: '11. Import Excel D-EDGE & CSV', icon: <Upload className="w-3.5 h-3.5" /> },
    { id: 'supplements_audit', label: '09–12. Restrictions, Suppléments & Audit', icon: <Tag className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-4 pb-16">
      {/* HEADER GOVERNANCE & ALERTS */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Paramètres du Planning Tarifaire &amp; Connectivité — {hotel.name}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Centre de paramétrage en 12 domaines : Établissement, Connecteurs universels, Multi-mappings, Plans &amp; Dérivations, Arrondis, FLEX/NRF, Petit-Déjeuner, Imports D-EDGE Excel et Audit.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSmartExcelOpen(true)}
              className="px-3.5 py-2 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 hover:bg-emerald-100/70 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Import Excel Intelligent (D-EDGE)</span>
            </button>
            <button
              type="button"
              onClick={() => void handleRecalculateAllDerived()}
              disabled={isRecalculating}
              className="px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRecalculating ? 'animate-spin' : ''}`} />
              <span>Recalculer les plans dérivés</span>
            </button>
            <button
              type="button"
              onClick={onOpenConnectivitySettings}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plug className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
              <span>Paramètres Sync Globaux</span>
            </button>
          </div>
        </div>

        {(cycleCheck || uniquenessCheck) && (
          <div className="p-3 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{uniquenessCheck || `Dépendance circulaire détectée : ${cycleCheck?.join(' → ')}`}</span>
          </div>
        )}

        {/* SUB-TAB NAVIGATION */}
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSubTab(item.id)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                subTab === item.id
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* TAB 0 : CONNECTEURS UNIVERSELS (PMS / CHANNEL MANAGER / RATE SHOPPER) */}
      {subTab === 'connectors' && (
        <UniversalConnectorCenter hotel={hotel} onShowToast={onShowToast} />
      )}

      {/* ===================================================================== */}
      {/* TAB 1 : ÉTABLISSEMENT, MULTI-HÔTELS & TARIF DE RÉFÉRENCE             */}
      {/* ===================================================================== */}
      {subTab === 'hotel_ref' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Établissement & Multi-hôtels */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                1. Établissement, Devise &amp; Héritage Groupe
              </h3>
              <span className="text-[11px] font-mono text-slate-400">{hotel.id}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Devise de pilotage
                </label>
                <select
                  value={config.currency}
                  onChange={(e) =>
                    commitConfig(
                      { ...config, currency: e.target.value as CurrencyCode },
                      'Établissement',
                      `Devise changée vers ${e.target.value}`,
                      `Devise mise à jour : ${e.target.value}`
                    )
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                >
                  {CURRENCIES.map((cur) => (
                    <option key={cur} value={cur}>
                      {cur}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Gouvernance Multi-Hôtels
                </label>
                <select
                  value={config.inheritanceMode}
                  onChange={(e) =>
                    commitConfig(
                      {
                        ...config,
                        inheritanceMode: e.target.value as 'inherit_group' | 'hotel_override',
                      },
                      'Multi-Hôtels',
                      `Mode gouvernance : ${e.target.value}`,
                      'Mode de gouvernance multi-hôtels mis à jour.'
                    )
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                >
                  <option value="hotel_override">Personnalisation locale (Surcharge hôtel)</option>
                  <option value="inherit_group">Héritage du modèle groupe</option>
                </select>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  Modèle Groupe : {groupTemplate.organizationName}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const updated = applyGroupTemplateToHotel(hotel);
                    setConfig(updated);
                    setAuditLog(getTariffConfigAuditLog(hotel.id));
                    onConfigUpdated();
                    onShowToast('Paramètres standard du groupe appliqués à cet établissement.');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-violet-600 text-white text-[11px] font-bold cursor-pointer"
                >
                  Appliquer le modèle groupe
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                <div>
                  <span className="text-slate-400 block">Réf. Groupe</span>
                  <strong>{groupTemplate.defaultReferencePlanCode}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">FLEX/NRF défaut</span>
                  <strong>-{groupTemplate.defaultFlexNrfValue}%</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">PDJ Groupe</span>
                  <strong>{groupTemplate.defaultBreakfastPriceEur} €</strong>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <label className="text-[11px] text-slate-500">Modifier remise NRF groupe (%) :</label>
                <input
                  type="number"
                  value={groupTemplate.defaultFlexNrfValue}
                  onChange={(e) => {
                    const saved = saveGroupTariffTemplate({
                      ...groupTemplate,
                      defaultFlexNrfValue: Number(e.target.value),
                    });
                    setGroupTemplate(saved);
                  }}
                  className="w-20 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 tabular-nums"
                />
              </div>
            </div>
          </div>

          {/* Panneau Configuration du Tarif de Référence */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                2. Choix libre du Tarif de Référence (Global ou par Catégorie)
              </h3>
              <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() =>
                    commitConfig(
                      { ...config, referenceMode: 'single_global' },
                      'Tarif de Référence',
                      'Bascule en référence unique globale',
                      'Mode Référence Unique activé.'
                    )
                  }
                  className={`px-2.5 py-1 rounded-md cursor-pointer ${
                    config.referenceMode === 'single_global'
                      ? 'bg-violet-600 text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Unique global
                </button>
                <button
                  type="button"
                  onClick={() =>
                    commitConfig(
                      { ...config, referenceMode: 'per_category' },
                      'Tarif de Référence',
                      'Bascule en référence par catégorie de chambre',
                      'Mode Référence par catégorie activé.'
                    )
                  }
                  className={`px-2.5 py-1 rounded-md cursor-pointer ${
                    config.referenceMode === 'per_category'
                      ? 'bg-violet-600 text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Par catégorie
                </button>
              </div>
            </div>

            {config.referenceMode === 'single_global' ? (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Plan tarifaire pilote pour tout l&apos;établissement
                  </label>
                  <select
                    value={config.globalReferencePlanCode}
                    onChange={(e) => {
                      const nextCode = e.target.value;
                      const nextRules = config.referenceRules.map((r, i) =>
                        i === 0 ? { ...r, referencePlanCode: nextCode } : r
                      );
                      commitConfig(
                        { ...config, globalReferencePlanCode: nextCode, referenceRules: nextRules },
                        'Tarif de Référence',
                        `Tarif de référence global changé vers ${nextCode}`,
                        `Nouveau tarif de référence global : ${nextCode}`
                      );
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
                  >
                    {activePlans.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.code} — {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Le moteur RM utilise <strong>{config.globalReferencePlanCode}</strong> comme base de comparaison et de calcul. Les tarifs configurés comme <em>Indépendants</em> (ex: GROUP) ne seront jamais modifiés lors d&apos;une variation de la référence.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 text-xs">
                {config.roomCategories
                  .filter((rc) => rc.isActive && !rc.isArchived)
                  .map((cat) => {
                    const rule = config.referenceRules.find(
                      (r) => r.scope === 'per_category' && r.roomCategoryCode === cat.code
                    );
                    const selectedRef = rule?.referencePlanCode || config.globalReferencePlanCode;
                    return (
                      <div
                        key={cat.code}
                        className="p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-2"
                      >
                        <div>
                          <div className="font-bold text-slate-900 dark:text-slate-100">{cat.name}</div>
                          <div className="text-[11px] text-slate-400">
                            {cat.physicalRooms} ch. · Priorité {rule?.priority ?? 1}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={selectedRef}
                            onChange={(e) => {
                              const nextCode = e.target.value;
                              const existingIdx = config.referenceRules.findIndex(
                                (r) => r.scope === 'per_category' && r.roomCategoryCode === cat.code
                              );
                              const nextRules = [...config.referenceRules];
                              if (existingIdx >= 0) {
                                nextRules[existingIdx] = {
                                  ...nextRules[existingIdx],
                                  referencePlanCode: nextCode,
                                };
                              } else {
                                nextRules.push({
                                  id: `ref-${hotel.id}-${cat.code}`,
                                  hotelId: hotel.id,
                                  scope: 'per_category',
                                  roomCategoryCode: cat.code,
                                  referencePlanCode: nextCode,
                                  currency: config.currency,
                                  validFrom: null,
                                  validTo: null,
                                  priority: nextRules.length + 1,
                                  isActive: true,
                                });
                              }
                              commitConfig(
                                { ...config, referenceRules: nextRules },
                                'Tarif de Référence',
                                `Référence catégorie ${cat.code} → ${nextCode}`,
                                `Référence pour ${cat.name} : ${nextCode}`
                              );
                            }}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                          >
                            {activePlans.map((p) => (
                              <option key={p.code} value={p.code}>
                                {p.code} — {p.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2 : CHAMBRES, INVENTAIRE, CAPACITÉS & MAPPING PMS/CM             */}
      {/* ===================================================================== */}
      {subTab === 'rooms' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Inventaire des Chambres, Occupation &amp; Mapping PMS / Channel Manager
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Total actif :{' '}
                <strong className="tabular-nums">
                  {config.roomCategories
                    .filter((c) => c.isActive && !c.isArchived)
                    .reduce((acc, c) => acc + c.physicalRooms, 0)}
                </strong>{' '}
                chambres physiques réparties sur {config.roomCategories.filter((c) => !c.isArchived).length} catégories.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={roomSearch}
                  onChange={(e) => setRoomSearch(e.target.value)}
                  placeholder="Rechercher chambre / ID PMS..."
                  className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                />
              </div>
              <button
                type="button"
                onClick={openNewRoomModal}
                className="px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nouvelle catégorie</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 pr-3">Catégorie</th>
                  <th className="py-2.5 px-3">Chambres</th>
                  <th className="py-2.5 px-3">Capacité (Ad./Enf.)</th>
                  <th className="py-2.5 px-3">Suppl. Occupation</th>
                  <th className="py-2.5 px-3">ID PMS</th>
                  <th className="py-2.5 px-3">ID Channel Manager</th>
                  <th className="py-2.5 pl-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredRooms.map((rc) => (
                  <tr key={rc.id} className={rc.isArchived ? 'opacity-50' : ''}>
                    <td className="py-3 pr-3">
                      <div className="font-bold text-slate-900 dark:text-slate-100">{rc.name}</div>
                      <div className="text-[11px] font-mono text-slate-400">
                        {rc.code} · Offset {rc.baseOffsetEur >= 0 ? '+' : ''}
                        {rc.baseOffsetEur}€
                      </div>
                    </td>
                    <td className="py-3 px-3 font-bold tabular-nums">{rc.physicalRooms}</td>
                    <td className="py-3 px-3 tabular-nums">
                      Std {rc.standardOccupancy} · Max {rc.maxOccupancy} ({rc.maxAdults}A / {rc.maxChildren}E)
                    </td>
                    <td className="py-3 px-3 text-[11px] tabular-nums">
                      Single {rc.singleOccupancySupplementEur}€ · 3e Ad. +{rc.extraAdultSupplementEur}€ · Enf. +{rc.extraChildSupplementEur}€
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      {rc.pmsRoomId || 'Non mappé'}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      {rc.cmRoomId || 'Non mappé'}
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingRoom(rc)}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                          title="Modifier catégorie & mapping"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {!rc.isArchived && config.roomCategories.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const nextRooms = config.roomCategories.map((r) =>
                                r.id === rc.id ? { ...r, isArchived: true, isActive: false } : r
                              );
                              commitConfig(
                                { ...config, roomCategories: nextRooms },
                                'Chambres',
                                `Archivage catégorie ${rc.name}`,
                                `Catégorie "${rc.name}" archivée.`
                              );
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-500 hover:text-rose-600 cursor-pointer"
                            title="Archiver cette catégorie"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-2">
            <RoomMappingEditor
              hotel={hotel}
              config={config}
              onCommitMappings={(nextRooms, nextMappings, details, toastMsg) =>
                commitConfig(
                  { ...config, roomCategories: nextRooms, roomMappings: nextMappings },
                  'Mapping Chambres',
                  details,
                  toastMsg
                )
              }
              onShowToast={onShowToast}
            />
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3 : GESTION INTELLIGENTE DES PLANS TARIFAIRES                     */}
      {/* ===================================================================== */}
      {subTab === 'plans' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Plans Tarifaires, Conditions d&apos;Annulation &amp; Paiement
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {activePlans.length} plan(s) configuré(s) · Protection automatique contre la suppression des plans référencés.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={planSearch}
                  onChange={(e) => setPlanSearch(e.target.value)}
                  placeholder="Rechercher plan / code..."
                  className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                />
              </div>
              <button
                type="button"
                onClick={() => exportRatePlansToExcel(hotel, config.ratePlans)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exporter Excel (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={openNewPlanModal}
                className="px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Créer un plan</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {filteredPlans.map((plan) => {
              const delGuard = canDeleteRatePlan(config, plan.code);
              const isRef =
                config.globalReferencePlanCode === plan.code ||
                (config.referenceMode === 'per_category' &&
                  config.referenceRules.some((r) => r.isActive && r.referencePlanCode === plan.code));

              return (
                <div
                  key={plan.id}
                  className={`p-4 rounded-xl border space-y-3 text-xs ${
                    plan.status === 'archived'
                      ? 'border-slate-200/70 dark:border-slate-800 opacity-55 bg-slate-50 dark:bg-slate-900'
                      : isRef
                      ? 'border-violet-300 dark:border-violet-800 bg-violet-50/30 dark:bg-violet-950/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-[11px]">
                          {plan.code}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                          {plan.name}
                        </span>
                        {isRef && (
                          <span className="px-2 py-0.5 rounded bg-violet-600 text-white text-[10px] font-bold">
                            RÉFÉRENCE ACTIVE
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        {NATURE_LABELS[plan.planNature]} · {CALC_MODE_LABELS[plan.calculationMode]}
                        {plan.referencePlanCode ? ` vs ${plan.referencePlanCode}` : ''}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded border text-[10px] font-bold ${
                        plan.status === 'active'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {plan.status === 'active' ? 'Actif' : plan.status === 'inactive' ? 'Inactif' : 'Archivé'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50/70 dark:bg-slate-800/40 p-2.5 rounded-lg">
                    <div>
                      <span className="text-slate-400 block">Annulation</span>
                      <strong>{plan.cancellationPolicy}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Paiement</span>
                      <strong className="truncate block">{plan.paymentPolicy}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Petit-Déjeuner</span>
                      <strong className="truncate block">{BREAKFAST_LABELS[plan.breakfastMode]}</strong>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
                    <span className="font-mono text-slate-400">
                      PMS: {plan.pmsExternalId || '—'} · CM: {plan.cmExternalId || '—'} · Prov: {plan.provenance}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditingPlan(plan)}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold cursor-pointer"
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicatePlan(plan)}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                        title="Dupliquer ce plan"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleTogglePlanStatus(
                            plan,
                            plan.status === 'active' ? 'inactive' : 'active'
                          )
                        }
                        className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        {plan.status === 'active' ? 'Désactiver' : 'Activer'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePlan(plan)}
                        disabled={!delGuard.allowed}
                        title={delGuard.allowed ? 'Supprimer définitivement' : delGuard.reason}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-rose-600 disabled:opacity-35 cursor-pointer"
                      >
                        {delGuard.allowed ? <Trash2 className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4 : RELATIONS ENTRE PLANS & GRAPHE VISUEL DE DÉPENDANCES          */}
      {/* ===================================================================== */}
      {subTab === 'relations' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Arbre Visuel des Dépendances &amp; Simulateur de Formules
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Visualisez les dérivations multi-niveaux (A → B → C), activez/suspendez une relation sans supprimer le plan, et testez vos formules.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-slate-500">Simuler tarif racine :</span>
              <input
                type="number"
                min={80}
                max={1500}
                value={simRefPrice}
                onChange={(e) => setSimRefPrice(Number(e.target.value) || 200)}
                className="w-24 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold tabular-nums"
              />
              <span className="font-bold">{config.currency}</span>
            </div>
          </div>

          <div className="space-y-2">{dependencyTree.map((root) => renderDependencyNode(root, 0))}</div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 5 : CONFIGURATION AVANCÉE FLEX / NRF & PETIT-DÉJEUNER             */}
      {/* ===================================================================== */}
      {subTab === 'flex_breakfast' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* FLEX / NRF */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Configuration Avancée FLEX / NRF
              </h3>
              <label className="inline-flex items-center gap-2 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.flexNrf.autoSyncFlexToNrf}
                  onChange={(e) =>
                    commitConfig(
                      {
                        ...config,
                        flexNrf: { ...config.flexNrf, autoSyncFlexToNrf: e.target.checked },
                      },
                      'FLEX / NRF',
                      `Auto-sync FLEX→NRF : ${e.target.checked ? 'Activé' : 'Désactivé'}`
                    )
                  }
                />
                <span>Sync auto FLEX → NRF</span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-500 mb-1">Plan FLEX source</label>
                <select
                  value={config.flexNrf.flexPlanCode}
                  onChange={(e) =>
                    commitConfig(
                      { ...config, flexNrf: { ...config.flexNrf, flexPlanCode: e.target.value } },
                      'FLEX / NRF',
                      `Plan FLEX → ${e.target.value}`
                    )
                  }
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                >
                  {activePlans.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.code}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-500 mb-1">Plan NRF cible</label>
                <select
                  value={config.flexNrf.nrfPlanCode}
                  onChange={(e) =>
                    commitConfig(
                      { ...config, flexNrf: { ...config.flexNrf, nrfPlanCode: e.target.value } },
                      'FLEX / NRF',
                      `Plan NRF → ${e.target.value}`
                    )
                  }
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                >
                  {activePlans.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.code}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-500 mb-1">Méthode calcul</label>
                <select
                  value={config.flexNrf.method}
                  onChange={(e) =>
                    commitConfig(
                      {
                        ...config,
                        flexNrf: {
                          ...config.flexNrf,
                          method: e.target.value as FlexNrfConfig['method'],
                        },
                      },
                      'FLEX / NRF',
                      `Méthode FLEX/NRF → ${e.target.value}`
                    )
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  <option value="percent_discount">Pourcentage (-%)</option>
                  <option value="fixed_discount">Montant fixe (-€)</option>
                  <option value="independent">Indépendant</option>
                  <option value="custom_formula">Formule personnalisée</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-500 mb-1">Valeur défaut</label>
                <input
                  type="number"
                  value={config.flexNrf.defaultValue}
                  onChange={(e) =>
                    commitConfig(
                      {
                        ...config,
                        flexNrf: { ...config.flexNrf, defaultValue: Number(e.target.value) },
                      },
                      'FLEX / NRF',
                      `Valeur NRF → ${e.target.value}`
                    )
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 tabular-nums font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-500 mb-1">Plancher NRF ({config.currency})</label>
                <input
                  type="number"
                  value={config.flexNrf.nrfFloorEur}
                  onChange={(e) =>
                    commitConfig(
                      {
                        ...config,
                        flexNrf: { ...config.flexNrf, nrfFloorEur: Number(e.target.value) },
                      },
                      'FLEX / NRF',
                      `Plancher NRF → ${e.target.value}`
                    )
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 tabular-nums font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-500 mb-1">Règle d&apos;arrondi NRF</label>
              <select
                value={config.flexNrf.roundingRule}
                onChange={(e) =>
                  commitConfig(
                    {
                      ...config,
                      flexNrf: { ...config.flexNrf, roundingRule: e.target.value as RoundingRuleType },
                    },
                    'FLEX / NRF',
                    `Arrondi NRF → ${e.target.value}`
                  )
                }
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                {Object.entries(ROUNDING_LABELS).map(([k, lbl]) => (
                  <option key={k} value={k}>
                    {lbl}
                  </option>
                ))}
              </select>
            </div>

            {/* Règles période & demande FLEX/NRF */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 space-y-2">
              <div className="font-bold text-slate-800 dark:text-slate-100">
                Règles de modulation par Période &amp; Forte Demande
              </div>
              {config.flexNrf.periodRules.map((pr) => (
                <div key={pr.id} className="flex items-center justify-between text-[11px]">
                  <span>
                    {pr.label} ({pr.startDate} → {pr.endDate})
                  </span>
                  <strong className="text-violet-600 dark:text-violet-400">-{pr.discountPercent}%</strong>
                </div>
              ))}
              {config.flexNrf.demandRules.map((dr) => (
                <div key={dr.id} className="flex items-center justify-between text-[11px]">
                  <span>
                    {dr.label} (Score {dr.minDemandScore}–{dr.maxDemandScore})
                  </span>
                  <strong className="text-violet-600 dark:text-violet-400">-{dr.discountPercent}%</strong>
                </div>
              ))}
            </div>
          </div>

          {/* PETIT-DÉJEUNER & APERÇU COMPARATIF */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Configuration Petit-Déjeuner &amp; Prestations Incluses
              </h3>
              <label className="inline-flex items-center gap-2 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.mealPlan.normalizeInRmEngine}
                  onChange={(e) =>
                    commitConfig(
                      {
                        ...config,
                        mealPlan: { ...config.mealPlan, normalizeInRmEngine: e.target.checked },
                      },
                      'Petit-Déjeuner',
                      `Normalisation RM hors PDJ : ${e.target.checked}`
                    )
                  }
                />
                <span>Normaliser dans moteur RM</span>
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block font-semibold text-slate-500 mb-1">Prix Adulte ({config.currency})</label>
                <input
                  type="number"
                  value={config.mealPlan.publicAdultPriceEur}
                  onChange={(e) => {
                    const price = Number(e.target.value);
                    const updatedPlans = config.ratePlans.map((p) =>
                      p.code === 'BB' ? { ...p, variationValue: price } : p
                    );
                    commitConfig(
                      {
                        ...config,
                        ratePlans: updatedPlans,
                        mealPlan: { ...config.mealPlan, publicAdultPriceEur: price },
                      },
                      'Petit-Déjeuner',
                      `Prix PDJ adulte → ${price}€`
                    );
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-500 mb-1">Prix Enfant</label>
                <input
                  type="number"
                  value={config.mealPlan.childPriceEur}
                  onChange={(e) =>
                    commitConfig(
                      {
                        ...config,
                        mealPlan: { ...config.mealPlan, childPriceEur: Number(e.target.value) },
                      },
                      'Petit-Déjeuner',
                      `Prix PDJ enfant → ${e.target.value}€`
                    )
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-500 mb-1">Coût interne</label>
                <input
                  type="number"
                  step="0.5"
                  value={config.mealPlan.internalAdultCostEur}
                  onChange={(e) =>
                    commitConfig(
                      {
                        ...config,
                        mealPlan: {
                          ...config.mealPlan,
                          internalAdultCostEur: Number(e.target.value),
                        },
                      },
                      'Petit-Déjeuner',
                      `Coût interne PDJ → ${e.target.value}€`
                    )
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-500 mb-1">Base calcul</label>
                <select
                  value={config.mealPlan.pricingBasis}
                  onChange={(e) =>
                    commitConfig(
                      {
                        ...config,
                        mealPlan: {
                          ...config.mealPlan,
                          pricingBasis: e.target.value as 'per_person' | 'per_room',
                        },
                      },
                      'Petit-Déjeuner',
                      `Base PDJ → ${e.target.value}`
                    )
                  }
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  <option value="per_room">Par chambre / forfait</option>
                  <option value="per_person">Par personne</option>
                </select>
              </div>
            </div>

            {/* Aperçu comparatif 4 quadrants */}
            <div className="p-4 rounded-xl border border-violet-200 dark:border-violet-800/70 bg-violet-50/40 dark:bg-violet-950/20 space-y-2.5">
              <div className="font-bold text-violet-900 dark:text-violet-200">
                Aperçu comparatif automatique (base 240 {config.currency})
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] text-slate-500">FLEX sans PDJ</div>
                  <div className="font-bold text-sm tabular-nums mt-0.5">{flexBreakfastPreview.flexNoBfast}€</div>
                </div>
                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] text-slate-500">FLEX avec PDJ</div>
                  <div className="font-bold text-sm tabular-nums mt-0.5 text-emerald-700 dark:text-emerald-300">
                    {flexBreakfastPreview.flexWithBfast}€
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] text-slate-500">NRF sans PDJ</div>
                  <div className="font-bold text-sm tabular-nums mt-0.5">{flexBreakfastPreview.nrfNoBfast}€</div>
                </div>
                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] text-slate-500">NRF avec PDJ</div>
                  <div className="font-bold text-sm tabular-nums mt-0.5 text-violet-700 dark:text-violet-300">
                    {flexBreakfastPreview.nrfWithBfast}€
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 6 : ASSISTANT D'IMPORTATION EN 10 ÉTAPES                         */}
      {/* ===================================================================== */}
      {subTab === 'import_wizard' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-5 text-xs">
          <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/50 dark:bg-emerald-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Import Excel Planning Tarifaire &amp; Inventaire (D-EDGE Planning &amp; Multi-Formats)
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                Détecte automatiquement Price (EUR) vs Left for sale, cellules fusionnées, anomalies, modèles de mapping réutilisables et aperçu Diff avant application.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsSmartExcelOpen(true)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Ouvrir l&apos;Import Excel 6 Étapes</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Assistant d&apos;Importation de Plans Tarifaires (10 Étapes) — PMS / Channel Manager / Excel / CSV
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Étape {importStep} / 10 — Contrôle strict anti-doublons &amp; traçabilité de provenance.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setImportStep(1);
                setImportItems([]);
                setLastImportSummary(null);
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
            >
              Recommencer
            </button>
          </div>

          {/* Barre de progression 10 étapes */}
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-1">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full ${
                  s <= importStep ? 'bg-violet-600' : 'bg-slate-200 dark:bg-slate-800'
                }`}
              />
            ))}
          </div>

          {importStep === 1 && (
            <div className="space-y-4">
              <div className="font-bold text-slate-800 dark:text-slate-100">
                Étape 1 : Choisissez la source d&apos;importation des plans tarifaires
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { id: 'pms' as const, title: 'PMS (Opera / Mews)', desc: 'Catalogue plans & chambres PMS' },
                  { id: 'channel_manager' as const, title: 'Channel Manager (D-EDGE)', desc: 'Plans distribués OTA/Web' },
                  { id: 'excel' as const, title: 'Fichier Excel (.xlsx)', desc: 'Grille tarifaire tableur' },
                  { id: 'csv' as const, title: 'Fichier CSV (.csv)', desc: 'Export structuré séparateur ; ou ,' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setImportSource(opt.id);
                      setImportStep(2);
                    }}
                    className={`p-4 rounded-xl border text-left space-y-1 cursor-pointer transition-colors ${
                      importSource === opt.id
                        ? 'border-violet-500 bg-violet-50/40 dark:bg-violet-950/30'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-bold text-slate-900 dark:text-slate-100">{opt.title}</div>
                    <div className="text-[11px] text-slate-500">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {importStep === 2 && (
            <div className="space-y-4">
              <div className="font-bold text-slate-800 dark:text-slate-100">
                Étape 2 : Récupération des données depuis {importSource.toUpperCase()}
              </div>
              {(importSource === 'pms' || importSource === 'channel_manager') ? (
                <button
                  type="button"
                  onClick={() => void handleLoadExternalCatalog(importSource)}
                  disabled={isFetchingExternal}
                  className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold flex items-center gap-2 cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${isFetchingExternal ? 'animate-spin' : ''}`} />
                  <span>Charger les plans tarifaires depuis {importSource.toUpperCase()}</span>
                </button>
              ) : (
                <div className="space-y-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => void handleSpreadsheetUpload(e)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold flex items-center gap-2 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Sélectionner un fichier {importSource.toUpperCase()}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {importStep >= 3 && importStep <= 9 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-bold text-slate-800 dark:text-slate-100">
                  Étapes 3–9 : Validation des {importItems.length} plan(s) détecté(s) ({importFileName})
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Gestion doublons :</span>
                  <select
                    value={importMode}
                    onChange={(e) =>
                      setImportMode(e.target.value as RateImportJob['mode'])
                    }
                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                  >
                    <option value="add_only">Ajouter uniquement les nouveaux</option>
                    <option value="update_existing">Mettre à jour les existants</option>
                    <option value="ignore_existing">Ignorer tous les doublons</option>
                  </select>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 grid grid-cols-3 gap-3 text-center">
                <div>
                  <span className="text-slate-500 block">À ajouter</span>
                  <strong className="text-base text-emerald-600 tabular-nums">{importDiff.toAdd.length}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">À mettre à jour</span>
                  <strong className="text-base text-violet-600 tabular-nums">{importDiff.toUpdate.length}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Ignorés (doublons)</span>
                  <strong className="text-base text-slate-500 tabular-nums">{importDiff.toIgnore.length}</strong>
                </div>
              </div>

              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {importItems.map((it) => (
                  <div
                    key={it.externalCode}
                    className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div>
                      <strong className="text-slate-900 dark:text-slate-100">{it.externalCode}</strong> — {it.name}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {it.planNature} · {it.cancellationPolicy} · {it.breakfastIncluded ? 'PDJ inclus' : 'Sans PDJ'}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleExecuteImport}
                  className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmer et exécuter l&apos;import (Étape 9)</span>
                </button>
              </div>
            </div>
          )}

          {importStep === 10 && (
            <div className="p-5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-2">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5" />
                <span>Étape 10 : Importation terminée</span>
              </div>
              <p className="text-slate-700 dark:text-slate-200">{lastImportSummary}</p>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 7 : SUPPLÉMENTS, RESTRICTIONS & AUDIT CONFIG                      */}
      {/* ===================================================================== */}
      {subTab === 'supplements_audit' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 text-xs">
          {/* Suppléments & Promotions */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Suppléments, Packages &amp; Promotions (Exclus du tarif de référence)
            </h3>

            <div className="space-y-2">
              {config.supplementsAndPromos.map((s) => (
                <div
                  key={s.id}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="font-bold text-slate-900 dark:text-slate-100">
                      {s.name} ({s.code})
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {s.itemType.toUpperCase()} · {s.value}
                      {s.pricingType === 'percent' ? '%' : ` ${config.currency}`} ·{' '}
                      {s.combinable ? 'Cumulable' : 'Non cumulable'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = config.supplementsAndPromos.map((x) =>
                        x.id === s.id ? { ...x, isActive: !x.isActive } : x
                      );
                      commitConfig(
                        { ...config, supplementsAndPromos: next },
                        'Suppléments',
                        `${s.code} ${!s.isActive ? 'activé' : 'désactivé'}`
                      );
                    }}
                    className={`px-2.5 py-1 rounded-lg border font-semibold cursor-pointer ${
                      s.isActive
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {s.isActive ? 'Actif' : 'Inactif'}
                  </button>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <input
                type="text"
                placeholder="Nom (ex: Spa Duo)"
                value={newSupName}
                onChange={(e) => setNewSupName(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
              <input
                type="text"
                placeholder="Code (SPA_DUO)"
                value={newSupCode}
                onChange={(e) => setNewSupCode(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
              <input
                type="number"
                value={newSupValue}
                onChange={(e) => setNewSupValue(Number(e.target.value))}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 tabular-nums"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newSupName.trim() || !newSupCode.trim()) return;
                  const item: SupplementAndPromoItem = {
                    id: `sup-${Date.now()}`,
                    hotelId: hotel.id,
                    code: newSupCode.trim().toUpperCase(),
                    name: newSupName.trim(),
                    category: 'autre',
                    itemType: newSupType,
                    pricingType: 'fixed_eur',
                    value: newSupValue,
                    validFrom: null,
                    validTo: null,
                    roomCategoryCodes: config.roomCategories.map((c) => c.code),
                    ratePlanCodes: activePlans.map((p) => p.code),
                    conditions: 'Paramétré depuis Centre Tarifaire',
                    combinable: true,
                    excludeFromReferenceCalc: true,
                    isActive: true,
                  };
                  commitConfig(
                    { ...config, supplementsAndPromos: [...config.supplementsAndPromos, item] },
                    'Suppléments',
                    `Ajout ${item.code}`,
                    `Supplément "${item.name}" ajouté.`
                  );
                  setNewSupName('');
                  setNewSupCode('');
                }}
                className="px-3 py-1.5 rounded-lg bg-violet-600 text-white font-bold cursor-pointer"
              >
                + Ajouter
              </button>
            </div>
          </div>

          {/* Restrictions + Audit */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Règles de Restrictions Tarifaires (Min/Max Stay, Stop-Sell)
              </h3>
              {config.restrictionRules.map((rule) => (
                <div
                  key={rule.id}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2"
                >
                  <div>
                    <div className="font-bold text-slate-900 dark:text-slate-100">{rule.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {rule.dateFrom} → {rule.dateTo} · MinStay {rule.minStay} ·{' '}
                      {rule.stopSell ? 'Stop-Sell' : 'Ouvert'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await applyRestrictionRuleToPlanning(hotel, rule);
                      onConfigUpdated();
                      onShowToast(
                        `Restriction appliquée au planning (${res.syncedCount} cellule(s) synchronisée(s)).`
                      );
                    }}
                    className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-bold cursor-pointer"
                  >
                    Appliquer au Planning &amp; Sync
                  </button>
                </div>
              ))}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <input
                  type="text"
                  value={newRestName}
                  onChange={(e) => setNewRestName(e.target.value)}
                  className="col-span-2 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
                <input
                  type="date"
                  value={newRestFrom}
                  onChange={(e) => setNewRestFrom(e.target.value)}
                  className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
                <input
                  type="date"
                  value={newRestTo}
                  onChange={(e) => setNewRestTo(e.target.value)}
                  className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
                <input
                  type="number"
                  min={1}
                  value={newRestMinStay}
                  onChange={(e) => setNewRestMinStay(Number(e.target.value))}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 tabular-nums"
                />
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newRestStopSell}
                    onChange={(e) => setNewRestStopSell(e.target.checked)}
                  />
                  <span>Stop-Sell</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const rule: RateRestrictionRule = {
                      id: `rst-${Date.now()}`,
                      hotelId: hotel.id,
                      name: newRestName.trim() || 'Règle restriction',
                      dateFrom: newRestFrom,
                      dateTo: newRestTo,
                      roomCategoryCodes: config.roomCategories.map((c) => c.code),
                      ratePlanCodes: activePlans.map((p) => p.code),
                      minStay: newRestMinStay,
                      maxStay: 14,
                      cta: false,
                      ctd: false,
                      stopSell: newRestStopSell,
                      advanceBookingMinDays: 0,
                      allowedArrivalDays: [0, 1, 2, 3, 4, 5, 6],
                      allowedDepartureDays: [0, 1, 2, 3, 4, 5, 6],
                      isActive: true,
                      createdAt: new Date().toISOString(),
                    };
                    commitConfig(
                      { ...config, restrictionRules: [rule, ...config.restrictionRules] },
                      'Restrictions',
                      `Création règle ${rule.name}`,
                      'Règle de restriction enregistrée.'
                    );
                  }}
                  className="col-span-2 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-violet-600 text-white font-bold cursor-pointer"
                >
                  + Enregistrer la règle
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-slate-100">
                <History className="w-4 h-4 text-violet-600" />
                <span>Historique &amp; Audit de Configuration ({auditLog.length})</span>
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {auditLog.length === 0 ? (
                  <div className="py-4 text-center text-slate-400">
                    Aucune modification enregistrée sur cette session.
                  </div>
                ) : (
                  auditLog.slice(0, 20).map((entry) => (
                    <div key={entry.id} className="py-2 flex items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-100">{entry.section}</span> —{' '}
                        <span className="text-slate-600 dark:text-slate-300">{entry.details}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 shrink-0">
                        {entry.createdAt.slice(11, 19)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL ÉDITION CATÉGORIE DE CHAMBRE                                    */}
      {/* ===================================================================== */}
      {editingRoom && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/70 flex items-center justify-center p-4"
          onClick={() => setEditingRoom(null)}
        >
          <form
            onSubmit={handleSaveRoom}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 text-xs max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Paramétrage Catégorie de Chambre &amp; Mapping Externe
              </h3>
              <button
                type="button"
                onClick={() => setEditingRoom(null)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-500 mb-1">Code interne</label>
                <input
                  type="text"
                  value={editingRoom.code}
                  onChange={(e) => setEditingRoom({ ...editingRoom, code: e.target.value })}
                  placeholder="suite_junior"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-500 mb-1">Nom affiché</label>
                <input
                  type="text"
                  value={editingRoom.name}
                  onChange={(e) => setEditingRoom({ ...editingRoom, name: e.target.value })}
                  placeholder="Suite Junior Opéra"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-500 mb-1">Chambres physiques</label>
                <input
                  type="number"
                  min={1}
                  value={editingRoom.physicalRooms}
                  onChange={(e) =>
                    setEditingRoom({ ...editingRoom, physicalRooms: Number(e.target.value) })
                  }
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-500 mb-1">Chambres commercialisables</label>
                <input
                  type="number"
                  min={0}
                  value={editingRoom.sellableRooms ?? editingRoom.physicalRooms}
                  onChange={(e) =>
                    setEditingRoom({ ...editingRoom, sellableRooms: Number(e.target.value) })
                  }
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-500 mb-1">Écart tarif base (€)</label>
                <input
                  type="number"
                  value={editingRoom.baseOffsetEur}
                  onChange={(e) =>
                    setEditingRoom({ ...editingRoom, baseOffsetEur: Number(e.target.value) })
                  }
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-500 mb-1">ID Chambre PMS</label>
                <input
                  type="text"
                  value={editingRoom.pmsRoomId}
                  onChange={(e) => setEditingRoom({ ...editingRoom, pmsRoomId: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-500 mb-1">ID Channel Manager</label>
                <input
                  type="text"
                  value={editingRoom.cmRoomId}
                  onChange={(e) => setEditingRoom({ ...editingRoom, cmRoomId: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingRoom(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold cursor-pointer"
              >
                Enregistrer catégorie
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL ÉDITION / CRÉATION PLAN TARIFAIRE                               */}
      {/* ===================================================================== */}
      {editingPlan && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/70 flex items-center justify-center p-4"
          onClick={() => setEditingPlan(null)}
        >
          <form
            onSubmit={handleSavePlan}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 text-xs max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Configuration Complète du Plan Tarifaire
              </h3>
              <button
                type="button"
                onClick={() => setEditingPlan(null)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-500 mb-1">Code plan</label>
                <input
                  type="text"
                  value={editingPlan.code}
                  onChange={(e) => setEditingPlan({ ...editingPlan, code: e.target.value })}
                  placeholder="CORP_GOLD"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold uppercase"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-500 mb-1">Libellé complet</label>
                <input
                  type="text"
                  value={editingPlan.name}
                  onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                  placeholder="Tarif Corporate VIP -15%"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-500 mb-1">Nature du plan</label>
                <select
                  value={editingPlan.planNature}
                  onChange={(e) =>
                    setEditingPlan({ ...editingPlan, planNature: e.target.value as RatePlanNature })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  {Object.entries(NATURE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-500 mb-1">Mode de calcul</label>
                <select
                  value={editingPlan.calculationMode}
                  onChange={(e) =>
                    setEditingPlan({
                      ...editingPlan,
                      calculationMode: e.target.value as RelationCalculationMode,
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  {Object.entries(CALC_MODE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-500 mb-1">Plan parent (référence)</label>
                <select
                  value={editingPlan.referencePlanCode || ''}
                  disabled={editingPlan.calculationMode === 'independent'}
                  onChange={(e) =>
                    setEditingPlan({
                      ...editingPlan,
                      referencePlanCode: e.target.value || null,
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-50"
                >
                  <option value="">Aucun</option>
                  {activePlans
                    .filter((p) => p.code !== editingPlan.code)
                    .map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.code}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {editingPlan.calculationMode === 'custom_formula' ? (
              <div>
                <label className="block font-semibold text-slate-500 mb-1">
                  Formule personnalisée (utilisez REF pour le tarif parent, ex: REF * 0.85 - 5)
                </label>
                <input
                  type="text"
                  value={editingPlan.customFormula || ''}
                  onChange={(e) => setEditingPlan({ ...editingPlan, customFormula: e.target.value })}
                  placeholder="REF * 0.85 - 5"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                />
              </div>
            ) : (
              editingPlan.calculationMode !== 'independent' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-500 mb-1">Valeur de variation</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingPlan.variationValue}
                      onChange={(e) =>
                        setEditingPlan({ ...editingPlan, variationValue: Number(e.target.value) })
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-500 mb-1">Petit-Déjeuner</label>
                    <select
                      value={editingPlan.breakfastMode}
                      onChange={(e) =>
                        setEditingPlan({
                          ...editingPlan,
                          breakfastMode: e.target.value as BreakfastInclusionMode,
                        })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    >
                      {Object.entries(BREAKFAST_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block font-semibold text-slate-500 mb-1">Annulation</label>
                <select
                  value={editingPlan.cancellationPolicy}
                  onChange={(e) =>
                    setEditingPlan({
                      ...editingPlan,
                      cancellationPolicy: e.target.value as CancellationPolicyType,
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  {CANCELLATION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-500 mb-1">Paiement</label>
                <select
                  value={editingPlan.paymentPolicy}
                  onChange={(e) =>
                    setEditingPlan({
                      ...editingPlan,
                      paymentPolicy: e.target.value as PaymentPolicyType,
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  {PAYMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-500 mb-1">ID Externe PMS</label>
                <input
                  type="text"
                  value={editingPlan.pmsExternalId}
                  onChange={(e) => setEditingPlan({ ...editingPlan, pmsExternalId: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-500 mb-1">ID Externe CM</label>
                <input
                  type="text"
                  value={editingPlan.cmExternalId}
                  onChange={(e) => setEditingPlan({ ...editingPlan, cmExternalId: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-500 mb-1">Règle d&apos;arrondi du plan</label>
                <select
                  value={editingPlan.roundingRule || 'nearest_euro'}
                  onChange={(e) =>
                    setEditingPlan({ ...editingPlan, roundingRule: e.target.value as RoundingRuleType })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  {Object.entries(ROUNDING_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-500 mb-1">Priorité de règle (1 = prioritaire)</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={editingPlan.rulePriority ?? 10}
                  onChange={(e) =>
                    setEditingPlan({ ...editingPlan, rulePriority: Number(e.target.value) || 10 })
                  }
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 tabular-nums"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingPlan(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Enregistrer le plan</span>
              </button>
            </div>
          </form>
        </div>
      )}

      <SmartExcelImportModal
        isOpen={isSmartExcelOpen}
        onClose={() => setIsSmartExcelOpen(false)}
        hotel={hotel}
        onShowToast={onShowToast}
        onImportCompleted={(report) => {
          setConfig(getHotelTariffConfig(hotel));
          setAuditLog(getTariffConfigAuditLog(hotel.id));
          onConfigUpdated();
          onShowToast(report.summary);
        }}
      />
    </div>
  );
};

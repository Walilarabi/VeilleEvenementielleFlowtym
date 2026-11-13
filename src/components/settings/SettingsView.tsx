/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FLOWTYM RMS — CENTRE DE COMMANDE & GOUVERNANCE MULTI-HÔTELS
 * Paramétrage structuré en 8 domaines (A à H) :
 *  A. Configuration de l'hôtel & typologies de chambres
 *  B. Revenue Management & garde-fous tarifaires
 *  C. Concurrence & CompSet (panel jusqu'à 10 concurrents actifs)
 *  D. Veille événementielle & périmètre géographique strict
 *  E. Intégrations & connecteurs (statut réel local vs API externe)
 *  F. Utilisateurs, rôles & permissions RBAC multi-hôtels
 *  G. Notifications & alertes quotidiennes (événements majeurs > 70)
 *  H. Système, export configuration, réinitialisation & journal d'audit
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Settings,
  Building2,
  TrendingUp,
  Users,
  Radar,
  Plug,
  ShieldCheck,
  Bell,
  Sliders,
  Plus,
  Trash2,
  Check,
  Copy,
  Download,
  RefreshCw,
  Mail,
  Send,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  CheckCircle2,
  Database,
  RotateCcw,
  FileJson,
  History,
  Clock,
  Eye,
  EyeOff,
  MapPin,
  Sun,
  Moon,
  Monitor,
  Palette,
} from 'lucide-react';
import { Hotel, EventItem, EventCategory } from '../../types';
import { useTheme, ThemeMode } from '../../contexts/ThemeContext';
import { GeoIntelligenceView } from '../geo/GeoIntelligenceView';
import {
  getSupabaseCredentials,
  saveSupabaseCredentials,
  testSupabaseConnection,
} from '../../services/supabaseClient';
import { syncInitialDataToSupabase } from '../../services/supabaseSyncService';
import { FULL_SUPABASE_SQL } from '../../supabase/schemaSqlString';
import { INITIAL_VENUES, INITIAL_SOURCES, INITIAL_SUGGESTIONS } from '../../data/mockData';
import {
  MajorEventEmailAlertConfig,
  MajorEventEmailAlertLog,
  getMajorEventAlertConfig,
  saveMajorEventAlertConfig,
  getMajorEventAlertLogs,
  appendMajorEventAlertLog,
  buildMajorEventAlertEmailPreview,
} from '../../services/majorEventAlertService';
import {
  ALL_EVENT_CATEGORIES,
  CompetitorProfileConfig,
  GeoCatchmentScope,
  HotelRMSConfig,
  RMSPricingStrategy,
  SystemAdminConfig,
  SystemOperationLogEntry,
  SystemUserAccount,
  SystemUserRole,
  getHotelRMSConfig,
  saveHotelRMSConfig,
  resetHotelRMSConfig,
  getSystemAdminConfig,
  saveSystemAdminConfig,
  getSystemUsers,
  saveSystemUsers,
  getSystemOperationLogs,
  clearSystemOperationLogs,
  appendSystemOperationLog,
} from '../../services/rmsSettingsService';
import { recalculateHotelRateIntelligence } from '../../services/rateIntelligenceService';
import {
  CURRENT_REFERENCE_DATE,
  filterEventsByHotelGeography,
  getEventStatusBadgeConfig,
} from '../../utils/eventFilterUtils';
import { getCategoryLabel } from '../../utils/helpers';

export type SettingsCategoryTab =
  | 'hotel'
  | 'rm'
  | 'compset'
  | 'veille'
  | 'integrations'
  | 'users'
  | 'alerts'
  | 'system';

interface SettingsViewProps {
  hotels: Hotel[];
  events?: EventItem[];
  onAddHotel: (hotel: Hotel) => void;
  onUpdateHotel?: (hotel: Hotel) => void;
  onDeleteHotel: (id: string) => void;
  selectedHotelId?: string;
  onSelectHotel?: (hotelId: string) => void;
  onConfigUpdated?: () => void;
  onShowToast?: (message: string) => void;
}

const CITY_GEO_PRESETS: Record<string, { lat: number; lng: number }> = {
  Paris: { lat: 48.8738, lng: 2.3282 },
  Lyon: { lat: 45.7578, lng: 4.832 },
  Nice: { lat: 43.6948, lng: 7.2587 },
  Marseille: { lat: 43.2965, lng: 5.3698 },
  Lille: { lat: 50.6292, lng: 3.0573 },
  Bordeaux: { lat: 44.8378, lng: -0.5792 },
};

const COMPSET_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#06b6d4',
  '#8b5cf6',
  '#ef4444',
  '#14b8a6',
  '#f97316',
  '#6366f1',
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  hotels,
  events = [],
  onAddHotel,
  onUpdateHotel,
  onDeleteHotel,
  selectedHotelId,
  onSelectHotel,
  onConfigUpdated,
  onShowToast,
}) => {
  const activeHotel = useMemo(
    () => hotels.find((h) => h.id === selectedHotelId) || hotels[0],
    [hotels, selectedHotelId]
  );

  const { themeMode, resolvedTheme, systemPrefersDark, setThemeMode } = useTheme();

  const handleThemeSelect = (mode: ThemeMode) => {
    setThemeMode(mode);
    const label =
      mode === 'dark'
        ? 'Mode Sombre Adouci'
        : mode === 'light'
        ? 'Mode Clair'
        : `Synchronisation Système (${systemPrefersDark ? 'Sombre' : 'Clair'} détecté)`;
    onShowToast?.(`Thème activé : ${label}`);
  };

  const handleToggleSystemSync = () => {
    if (themeMode === 'system') {
      handleThemeSelect(resolvedTheme);
    } else {
      handleThemeSelect('system');
    }
  };

  const [activeCategory, setActiveCategory] = useState<SettingsCategoryTab>('hotel');

  // Config état hôtel courant (catégories A, B, C, D, G notifications RM)
  const [hotelDraft, setHotelDraft] = useState<Hotel>(() => activeHotel);
  const [hotelConfig, setHotelConfig] = useState<HotelRMSConfig>(() => getHotelRMSConfig(activeHotel));

  // États globaux (E, F, G e-mail, H)
  const [systemConfig, setSystemConfig] = useState<SystemAdminConfig>(() => getSystemAdminConfig());
  const [users, setUsers] = useState<SystemUserAccount[]>(() => getSystemUsers());
  const [opLogs, setOpLogs] = useState<SystemOperationLogEntry[]>(() => getSystemOperationLogs());

  // Synchronisation si l'hôtel actif change depuis la navbar ou le sélecteur
  useEffect(() => {
    if (!activeHotel) return;
    setHotelDraft(activeHotel);
    setHotelConfig(getHotelRMSConfig(activeHotel));
  }, [activeHotel]);

  // Ajout nouvel hôtel (Catégorie A)
  const [isAddingHotel, setIsAddingHotel] = useState(false);
  const [newHotelName, setNewHotelName] = useState('');
  const [newHotelGroup, setNewHotelGroup] = useState('Flowtym Hospitality Group');
  const [newHotelCity, setNewHotelCity] = useState('Paris');
  const [newHotelAddress, setNewHotelAddress] = useState('');
  const [newHotelRooms, setNewHotelRooms] = useState(50);
  const [newHotelStars, setNewHotelStars] = useState(4);
  const [newHotelSegment, setNewHotelSegment] = useState<'Luxe' | 'Boutique' | 'Affaires' | 'Économique' | 'Resort'>('Affaires');
  const [newHotelADR, setNewHotelADR] = useState(220);

  // Ajout concurrent dans CompSet (Catégorie C)
  const [isAddingComp, setIsAddingComp] = useState(false);
  const [newCompName, setNewCompName] = useState('');
  const [newCompStars, setNewCompStars] = useState(4);
  const [newCompCity, setNewCompCity] = useState(activeHotel?.city || 'Paris');
  const [newCompDistanceKm, setNewCompDistanceKm] = useState(0.5);
  const [newCompRoomType, setNewCompRoomType] = useState('Classique');
  const [newCompCancelPolicy, setNewCompCancelPolicy] = useState<'Flexible' | 'Semi-flexible' | 'Non-annulable'>('Flexible');
  const [newCompBreakfast, setNewCompBreakfast] = useState(false);
  const [newCompComparable, setNewCompComparable] = useState(true);
  const [newCompBaseRate, setNewCompBaseRate] = useState(250);

  // Ajout utilisateur RBAC (Catégorie F)
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<SystemUserRole>('revenue_manager');

  // Supabase (Catégorie E)
  const initialCreds = getSupabaseCredentials();
  const [supabaseUrl, setSupabaseUrl] = useState(initialCreds.url);
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(initialCreds.anonKey);
  const [isTestingSupabase, setIsTestingSupabase] = useState(false);
  const [supabaseStatus, setSupabaseStatus] = useState<{
    tested: boolean;
    success?: boolean;
    message?: string;
  }>({
    tested: !!initialCreds.url && !!initialCreds.anonKey,
  });
  const [showSqlPreview, setShowSqlPreview] = useState(false);
  const [copiedSQL, setCopiedSQL] = useState(false);
  const [isSyncingSupabase, setIsSyncingSupabase] = useState(false);

  // Alertes e-mail quotidiennes (Catégorie G)
  const [alertConfig, setAlertConfig] = useState<MajorEventEmailAlertConfig>(() => getMajorEventAlertConfig());
  const [alertLogs, setAlertLogs] = useState<MajorEventEmailAlertLog[]>(() => getMajorEventAlertLogs());
  const [newRecipientEmail, setNewRecipientEmail] = useState('');
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [showAlertPreview, setShowAlertPreview] = useState(false);

  // Événements filtrés strictement selon la géographie de l'hôtel actif pour l'aperçu d'alertes
  const geoScopedEvents = useMemo(() => {
    if (!activeHotel) return events;
    return filterEventsByHotelGeography(events, activeHotel, hotelConfig.eventWatch);
  }, [events, activeHotel, hotelConfig.eventWatch]);

  const emailPreview = useMemo(
    () =>
      buildMajorEventAlertEmailPreview(
        alertConfig,
        geoScopedEvents,
        activeHotel ? activeHotel.name : 'Hôtel actif',
        CURRENT_REFERENCE_DATE
      ),
    [alertConfig, geoScopedEvents, activeHotel]
  );

  const activeCompsetCount = useMemo(
    () => hotelConfig.compSet.filter((c) => c.isActive).length,
    [hotelConfig.compSet]
  );

  // Helper sauvegarde centralisée par catégorie
  const persistHotelConfig = (
    nextConfig: HotelRMSConfig,
    logCategory: SystemOperationLogEntry['category'],
    logAction: string,
    logDetails: string,
    recalculatePricing: boolean = false
  ) => {
    const saved = saveHotelRMSConfig(activeHotel.id, nextConfig, 'Wali Larabi', logCategory, logAction, logDetails);
    setHotelConfig(saved);
    if (recalculatePricing) {
      recalculateHotelRateIntelligence({ ...hotelDraft, ...activeHotel });
    }
    setOpLogs(getSystemOperationLogs());
    onConfigUpdated?.();
  };

  // Sauvegarde Catégorie A : Hôtel & typologies
  const handleSaveHotelProfile = () => {
    const updatedRoomsTotal = hotelConfig.roomTypologies.reduce((s, t) => s + (Number(t.totalRooms) || 0), 0);
    const syncedHotel: Hotel = {
      ...hotelDraft,
      roomCount: updatedRoomsTotal > 0 ? updatedRoomsTotal : hotelDraft.roomCount,
    };
    setHotelDraft(syncedHotel);
    onUpdateHotel?.(syncedHotel);
    saveHotelRMSConfig(
      syncedHotel.id,
      hotelConfig,
      'Wali Larabi',
      'A_HOTEL',
      `Mise à jour fiche hôtel : ${syncedHotel.name}`,
      `${syncedHotel.city} • ${syncedHotel.roomCount} ch. • ADR base ${syncedHotel.baseADR}€`
    );
    recalculateHotelRateIntelligence(syncedHotel);
    setOpLogs(getSystemOperationLogs());
    onConfigUpdated?.();
    onShowToast?.(`Configuration de "${syncedHotel.name}" enregistrée et synchronisée.`);
  };

  const handleCreateHotel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHotelName.trim()) return;
    const coords = CITY_GEO_PRESETS[newHotelCity] || CITY_GEO_PRESETS.Paris;
    const created: Hotel = {
      id: `hotel-${Date.now()}`,
      name: newHotelName.trim(),
      group: newHotelGroup.trim() || 'Flowtym Hospitality Group',
      city: newHotelCity,
      country: 'France',
      address: newHotelAddress.trim() || `${newHotelCity} Centre`,
      lat: coords.lat,
      lng: coords.lng,
      stars: newHotelStars,
      roomCount: newHotelRooms,
      segment: newHotelSegment,
      baseADR: newHotelADR,
    };
    onAddHotel(created);
    onSelectHotel?.(created.id);
    appendSystemOperationLog({
      id: `op-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      actor: 'Wali Larabi',
      hotelId: created.id,
      category: 'A_HOTEL',
      action: `Création établissement : ${created.name}`,
      details: `${created.city} • ${created.roomCount} chambres • ${created.stars}★`,
      status: 'success',
    });
    setOpLogs(getSystemOperationLogs());
    setIsAddingHotel(false);
    setNewHotelName('');
    setNewHotelAddress('');
    onConfigUpdated?.();
  };

  // Sauvegarde Catégorie B : Revenue Management
  const handleSaveRMRules = () => {
    if (hotelConfig.rmRules.barFloorEur >= hotelConfig.rmRules.barCeilingEur) {
      onShowToast?.('Erreur : le tarif plancher BAR doit être strictement inférieur au plafond.');
      return;
    }
    persistHotelConfig(
      hotelConfig,
      'B_RM',
      'Mise à jour règles Revenue Management',
      `Stratégie ${hotelConfig.rmRules.pricingStrategy} • Plancher ${hotelConfig.rmRules.barFloorEur}€ / Plafond ${hotelConfig.rmRules.barCeilingEur}€ • Saut max ${hotelConfig.rmRules.maxSingleAdjustmentEur}€`,
      true
    );
    onShowToast?.(`Règles RM enregistrées et recommandations tarifaires recalculées pour ${activeHotel.name}.`);
  };

  // Gestion CompSet Catégorie C (jusqu'à 10 concurrents actifs)
  const handleToggleCompetitorActive = (compId: string) => {
    const target = hotelConfig.compSet.find((c) => c.id === compId);
    if (!target) return;
    if (!target.isActive && activeCompsetCount >= 10) {
      onShowToast?.('Limite atteinte : maximum 10 concurrents actifs simultanément dans le CompSet.');
      return;
    }
    const nextCompSet = hotelConfig.compSet.map((c) =>
      c.id === compId ? { ...c, isActive: !c.isActive } : c
    );
    setHotelConfig((prev) => ({ ...prev, compSet: nextCompSet }));
  };

  const handleMoveCompetitor = (idx: number, direction: -1 | 1) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= hotelConfig.compSet.length) return;
    const copy = [...hotelConfig.compSet];
    const [removed] = copy.splice(idx, 1);
    copy.splice(targetIdx, 0, removed);
    setHotelConfig((prev) => ({ ...prev, compSet: copy }));
  };

  const handleUpdateCompetitorField = (
    compId: string,
    updates: Partial<CompetitorProfileConfig>
  ) => {
    setHotelConfig((prev) => ({
      ...prev,
      compSet: prev.compSet.map((c) => (c.id === compId ? { ...c, ...updates } : c)),
    }));
  };

  const handleDeleteCompetitor = (compId: string) => {
    setHotelConfig((prev) => ({
      ...prev,
      compSet: prev.compSet.filter((c) => c.id !== compId),
    }));
  };

  const handleAddCompetitor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompName.trim()) return;
    const shouldActivate = activeCompsetCount < 10;
    const newComp: CompetitorProfileConfig = {
      id: `comp-custom-${Date.now()}`,
      name: newCompName.trim(),
      stars: newCompStars,
      city: newCompCity.trim() || activeHotel.city,
      distanceKm: Number(newCompDistanceKm) || 0.5,
      defaultRoomType: newCompRoomType.trim() || 'Classique',
      cancellationPolicy: newCompCancelPolicy,
      breakfastIncluded: newCompBreakfast,
      isFullyComparable: newCompComparable,
      nonComparableReason: newCompComparable ? undefined : 'Offre ou catégorie non strictement comparable',
      baseRateEur: Number(newCompBaseRate) || activeHotel.baseADR,
      color: COMPSET_COLORS[hotelConfig.compSet.length % COMPSET_COLORS.length],
      weight: 1.0,
      isActive: shouldActivate,
    };
    setHotelConfig((prev) => ({
      ...prev,
      compSet: [...prev.compSet, newComp],
    }));
    setIsAddingComp(false);
    setNewCompName('');
    onShowToast?.(
      shouldActivate
        ? `${newComp.name} ajouté au panel actif (${activeCompsetCount + 1}/10). Enregistrez pour recalculer.`
        : `${newComp.name} ajouté en réserve (panel actif déjà à 10/10).`
    );
  };

  const handleSaveCompSet = () => {
    persistHotelConfig(
      hotelConfig,
      'C_COMPSET',
      'Mise à jour panel CompSet concurrentiel',
      `${activeCompsetCount} concurrent(s) actif(s) sur ${hotelConfig.compSet.length} configuré(s) pour ${activeHotel.name}.`,
      true
    );
    onShowToast?.(`CompSet (${activeCompsetCount}/10 concurrents actifs) enregistré et recalculé.`);
  };

  // Sauvegarde Catégorie D : Veille événementielle & géo strict
  const handleApplyGeoScopePreset = (scope: GeoCatchmentScope) => {
    const isParis = activeHotel.city.toLowerCase().includes('paris');
    let main = hotelConfig.eventWatch.mainRadiusKm;
    let ext = hotelConfig.eventWatch.extendedRadiusKm;
    if (scope === 'intra_muros') {
      main = isParis ? 8 : 6;
      ext = isParis ? 15 : 12;
    } else if (scope === 'metropole') {
      main = isParis ? 15 : 12;
      ext = isParis ? 45 : 35;
    } else if (scope === 'bassin_elargi') {
      main = isParis ? 25 : 20;
      ext = isParis ? 65 : 55;
    }
    setHotelConfig((prev) => ({
      ...prev,
      eventWatch: {
        ...prev.eventWatch,
        geoScope: scope,
        mainRadiusKm: main,
        extendedRadiusKm: ext,
      },
    }));
  };

  const handleToggleEventCategory = (cat: EventCategory) => {
    setHotelConfig((prev) => {
      const exists = prev.eventWatch.enabledCategories.includes(cat);
      const nextCats = exists
        ? prev.eventWatch.enabledCategories.filter((c) => c !== cat)
        : [...prev.eventWatch.enabledCategories, cat];
      return {
        ...prev,
        eventWatch: {
          ...prev.eventWatch,
          enabledCategories: nextCats,
        },
      };
    });
  };

  const handleSaveEventWatch = () => {
    persistHotelConfig(
      hotelConfig,
      'D_VEILLE',
      'Mise à jour périmètre géographique & veille événementielle',
      `Mode ${hotelConfig.eventWatch.geoScope} (${hotelConfig.eventWatch.mainRadiusKm}/${hotelConfig.eventWatch.extendedRadiusKm} km) • Isolation territoriale: ${hotelConfig.eventWatch.strictTerritoryIsolation ? 'stricte' : 'souple'}`,
      false
    );
    onShowToast?.('Règles de veille événementielle et périmètre géographique enregistrés.');
  };

  // Catégorie E : Supabase & Intégrations
  const handleSaveSupabase = () => {
    saveSupabaseCredentials(supabaseUrl, supabaseAnonKey);
    const hasCreds = Boolean(supabaseUrl.trim() && supabaseAnonKey.trim());
    const nextSys: SystemAdminConfig = {
      ...systemConfig,
      integrations: systemConfig.integrations.map((intItem) =>
        intItem.id === 'int-supabase'
          ? {
              ...intItem,
              status: hasCreds ? 'configured' : 'unavailable_no_credentials',
              lastSyncAt: hasCreds ? new Date().toISOString().replace('T', ' ').slice(0, 16) : null,
              lastError: hasCreds ? null : 'Clés API Supabase non renseignées — persistance locale navigateur.',
            }
          : intItem
      ),
    };
    setSystemConfig(saveSystemAdminConfig(nextSys));
    setOpLogs(getSystemOperationLogs());
    onShowToast?.('Paramètres Supabase enregistrés.');
  };

  const handleTestSupabase = async () => {
    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
      setSupabaseStatus({
        tested: true,
        success: false,
        message: 'Renseignez l’URL du projet Supabase et la clé Anon Key avant de tester.',
      });
      return;
    }
    setIsTestingSupabase(true);
    const result = await testSupabaseConnection(supabaseUrl, supabaseAnonKey);
    setIsTestingSupabase(false);
    setSupabaseStatus({
      tested: true,
      success: result.success,
      message: result.message,
    });
    if (result.success) {
      handleSaveSupabase();
    }
  };

  const handleCopySQL = () => {
    navigator.clipboard.writeText(FULL_SUPABASE_SQL);
    setCopiedSQL(true);
    onShowToast?.('Script SQL PostGIS complet copié dans le presse-papier.');
    setTimeout(() => setCopiedSQL(false), 2000);
  };

  const handleDownloadSQL = () => {
    const blob = new Blob([FULL_SUPABASE_SQL], { type: 'text/sql;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flowtym_supabase_schema.sql';
    a.click();
    URL.revokeObjectURL(url);
    onShowToast?.('Fichier flowtym_supabase_schema.sql téléchargé.');
  };

  const handleSyncInitialSupabase = async () => {
    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
      setSupabaseStatus({
        tested: true,
        success: false,
        message: 'Renseignez la clé Anon Key Supabase avant de synchroniser les données.',
      });
      return;
    }
    saveSupabaseCredentials(supabaseUrl, supabaseAnonKey);
    setIsSyncingSupabase(true);
    const summary = await syncInitialDataToSupabase({
      hotels,
      venues: INITIAL_VENUES,
      sources: INITIAL_SOURCES,
      events,
      proposals: [],
      suggestions: INITIAL_SUGGESTIONS,
    });
    setIsSyncingSupabase(false);
    setSupabaseStatus({
      tested: true,
      success: summary.success,
      message: summary.message,
    });
    onShowToast?.(summary.message);
  };

  // Catégorie F : Utilisateurs RBAC
  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) return;
    const roleDefaults: Record<SystemUserRole, SystemUserAccount['permissions']> = {
      admin: { canApproveRates: true, canEditCompset: true, canEditRMRules: true, canManageUsers: true, canExportData: true },
      revenue_manager: { canApproveRates: true, canEditCompset: true, canEditRMRules: true, canManageUsers: false, canExportData: true },
      general_manager: { canApproveRates: true, canEditCompset: false, canEditRMRules: false, canManageUsers: false, canExportData: true },
      analyst: { canApproveRates: false, canEditCompset: false, canEditRMRules: false, canManageUsers: false, canExportData: true },
      viewer: { canApproveRates: false, canEditCompset: false, canEditRMRules: false, canManageUsers: false, canExportData: false },
    };
    const nextUser: SystemUserAccount = {
      id: `usr-${Date.now()}`,
      name: newUserName.trim(),
      email: newUserEmail.trim(),
      role: newUserRole,
      allowedHotelIds: newUserRole === 'admin' ? 'all' : [activeHotel.id],
      isActive: true,
      lastActiveAt: 'À l’instant',
      permissions: roleDefaults[newUserRole],
    };
    const saved = saveSystemUsers([...users, nextUser], 'Wali Larabi', `Ajout utilisateur ${nextUser.email} (${nextUser.role})`);
    setUsers(saved);
    setOpLogs(getSystemOperationLogs());
    setIsAddingUser(false);
    setNewUserName('');
    setNewUserEmail('');
    onShowToast?.(`Utilisateur ${nextUser.name} créé.`);
  };

  const handleToggleUserPermission = (
    userId: string,
    perm: keyof SystemUserAccount['permissions']
  ) => {
    const next = users.map((u) =>
      u.id === userId ? { ...u, permissions: { ...u.permissions, [perm]: !u.permissions[perm] } } : u
    );
    setUsers(next);
  };

  const handleSaveUsers = () => {
    const saved = saveSystemUsers(users, 'Wali Larabi', `${users.length} comptes RBAC synchronisés.`);
    setUsers(saved);
    setOpLogs(getSystemOperationLogs());
    onShowToast?.('Droits d’accès et utilisateurs enregistrés.');
  };

  // Catégorie G : Alertes quotidiennes + notifications RM
  const handleUpdateAlertConfig = (updates: Partial<MajorEventEmailAlertConfig>) => {
    setAlertConfig((prev) => {
      const next = { ...prev, ...updates };
      saveMajorEventAlertConfig(next);
      return next;
    });
  };

  const handleAddRecipient = (e: React.FormEvent) => {
    e.preventDefault();
    const email = newRecipientEmail.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setRecipientError('Veuillez saisir une adresse e-mail valide.');
      return;
    }
    if (alertConfig.recipients.includes(email)) {
      setRecipientError('Cette adresse e-mail est déjà configurée.');
      return;
    }
    setRecipientError(null);
    handleUpdateAlertConfig({ recipients: [...alertConfig.recipients, email] });
    setNewRecipientEmail('');
    onShowToast?.(`Destinataire ${email} ajouté.`);
  };

  const handleRemoveRecipient = (email: string) => {
    handleUpdateAlertConfig({ recipients: alertConfig.recipients.filter((r) => r !== email) });
  };

  const handleSendTestAlert = () => {
    if (alertConfig.recipients.length === 0) {
      setRecipientError('Ajoutez au moins un destinataire avant de tester l’envoi.');
      return;
    }
    const nowStamp = `${CURRENT_REFERENCE_DATE} ${new Date().toTimeString().slice(0, 8)}`;
    const topEvent = emailPreview.qualifyingEvents[0];
    const logEntry: MajorEventEmailAlertLog = {
      id: `alert-log-${Date.now()}`,
      sentAt: nowStamp,
      recipients: [...alertConfig.recipients],
      eventsCount: emailPreview.qualifyingEvents.length,
      minScore: alertConfig.minScore,
      topEventTitle: topEvent ? topEvent.title : 'Aucun événement qualifiant sur le bassin actif',
      status: 'sent',
    };
    const nextLogs = appendMajorEventAlertLog(logEntry);
    setAlertLogs(nextLogs);
    handleUpdateAlertConfig({ lastSentAt: nowStamp });
    onShowToast?.(
      `Alerte test préparée (${emailPreview.qualifyingEvents.length} événement(s) pour ${activeHotel.name}).`
    );
  };

  const handleSaveNotifications = () => {
    saveMajorEventAlertConfig(alertConfig);
    persistHotelConfig(
      hotelConfig,
      'G_ALERTS',
      'Mise à jour notifications & alertes RM',
      `Alertes e-mail (${alertConfig.enabled ? `actives > ${alertConfig.minScore}` : 'en pause'}) + seuils RM enregistrés.`,
      false
    );
    onShowToast?.('Notifications et alertes enregistrées.');
  };

  // Catégorie H : Système & Administration
  const handleSaveSystemConfig = () => {
    const saved = saveSystemAdminConfig(systemConfig, 'Wali Larabi');
    setSystemConfig(saved);
    setOpLogs(getSystemOperationLogs());
    onConfigUpdated?.();
    onShowToast?.('Paramètres système globaux enregistrés.');
  };

  const handleExportFullJSON = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      activeHotel,
      hotelRMSConfig: hotelConfig,
      systemAdminConfig: systemConfig,
      majorEventAlerts: alertConfig,
      usersCount: users.length,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flowtym_config_${activeHotel.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast?.(`Configuration exportée pour ${activeHotel.name}.`);
  };

  const handleResetActiveHotelConfig = () => {
    const reset = resetHotelRMSConfig(activeHotel, 'Wali Larabi');
    setHotelConfig(reset);
    recalculateHotelRateIntelligence(activeHotel);
    setOpLogs(getSystemOperationLogs());
    onConfigUpdated?.();
    onShowToast?.(`Configuration réinitialisée aux valeurs par défaut pour ${activeHotel.name}.`);
  };

  const navCategories: {
    id: SettingsCategoryTab;
    code: string;
    label: string;
    sublabel: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'hotel', code: 'A', label: 'Configuration Hôtel', sublabel: `${activeHotel?.roomCount || 45} ch. • GPS`, icon: Building2 },
    { id: 'rm', code: 'B', label: 'Revenue Management', sublabel: `${hotelConfig.rmRules.barFloorEur}€–${hotelConfig.rmRules.barCeilingEur}€`, icon: TrendingUp },
    { id: 'compset', code: 'C', label: 'Concurrence & CompSet', sublabel: `${activeCompsetCount}/10 actifs`, icon: Users },
    { id: 'veille', code: 'D', label: 'Veille Événementielle', sublabel: `${hotelConfig.eventWatch.mainRadiusKm}/${hotelConfig.eventWatch.extendedRadiusKm} km strict`, icon: Radar },
    { id: 'integrations', code: 'E', label: 'Intégrations & API', sublabel: 'Fichiers, CRS, Supabase', icon: Plug },
    { id: 'users', code: 'F', label: 'Utilisateurs & RBAC', sublabel: `${users.length} comptes`, icon: ShieldCheck },
    { id: 'alerts', code: 'G', label: 'Alertes et Notifications', sublabel: `Score > ${alertConfig.minScore}`, icon: Bell },
    { id: 'system', code: 'H', label: 'Système & Audit', sublabel: `${opLogs.length} événements`, icon: Sliders },
  ];

  return (
    <div className="space-y-6 w-full pb-12">
      {/* Header Centre de Commande */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center shrink-0">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                  Paramètres & Centre de Commande Flowtym RMS
                </h2>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-violet-50 dark:bg-violet-950/40 text-violet-800 dark:text-violet-300 border border-violet-200 dark:border-violet-800/70 tabular-nums">
                  {hotels.length} établissement{hotels.length > 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Pilotage multi-hôtels : règles tarifaires RM, CompSet jusqu’à 10 concurrents, périmètre géographique strict, connecteurs et droits RBAC.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Sélecteur rapide de thème (Clair / Sombre / Sync Système) */}
            <div
              className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-1"
              role="group"
              aria-label="Sélecteur de thème"
            >
              {(
                [
                  { id: 'light', label: 'Clair', icon: Sun, title: 'Activer le mode clair' },
                  { id: 'dark', label: 'Sombre', icon: Moon, title: 'Activer le mode sombre adouci' },
                  {
                    id: 'system',
                    label: 'Auto (Système)',
                    icon: Monitor,
                    title: `Synchroniser avec les préférences système (${systemPrefersDark ? 'Sombre' : 'Clair'} détecté)`,
                  },
                ] as const
              ).map((opt) => {
                const Icon = opt.icon;
                const active = themeMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleThemeSelect(opt.id)}
                    title={opt.title}
                    aria-pressed={active}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-white dark:bg-slate-900 text-violet-700 dark:text-violet-300 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Hôtel piloté :</span>
              <select
                value={activeHotel?.id || ''}
                onChange={(e) => onSelectHotel?.(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-hidden cursor-pointer"
              >
                {hotels.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.city})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Layout Principal : Rail Navigation Gauche (A-H) + Panneau Actif */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <aside className="w-full lg:w-72 shrink-0 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-2 space-y-1">
          {navCategories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 dark:bg-slate-800 text-white'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80'
                }`}
              >
                <span
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                    isSelected
                      ? 'bg-violet-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {cat.code}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold truncate flex items-center gap-1.5">
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-violet-300' : 'text-slate-400'}`} />
                    <span className="truncate">{cat.label}</span>
                  </div>
                  <div className={`text-[10px] truncate tabular-nums ${isSelected ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>
                    {cat.sublabel}
                  </div>
                </div>
              </button>
            );
          })}
        </aside>

        {/* Contenu de la Catégorie Active */}
        <section className="flex-1 min-w-0 w-full space-y-5">
          {/* ============================================================== */}
          {/* A. CONFIGURATION DE L'HÔTEL                                    */}
          {/* ============================================================== */}
          {activeCategory === 'hotel' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    A. Configuration de l’Hôtel — {hotelDraft.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Identité, coordonnées GPS de référence et ventilation des chambres par typologie.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingHotel(!isAddingHotel)}
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Nouvel hôtel</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveHotelProfile}
                    className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Enregistrer l’hôtel</span>
                  </button>
                </div>
              </div>

              {isAddingHotel && (
                <form onSubmit={handleCreateHotel} className="p-4 rounded-xl border border-violet-200 dark:border-violet-800/70 bg-violet-50/40 dark:bg-violet-950/30 space-y-4">
                  <div className="text-xs font-bold text-violet-950 dark:text-violet-100">Ajouter un établissement au portefeuille</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Nom de l’hôtel *</label>
                      <input
                        type="text"
                        required
                        value={newHotelName}
                        onChange={(e) => setNewHotelName(e.target.value)}
                        placeholder="Ex : Hôtel Opéra Vendôme"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Ville</label>
                      <select
                        value={newHotelCity}
                        onChange={(e) => setNewHotelCity(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                      >
                        {Object.keys(CITY_GEO_PRESETS).map((city) => (
                          <option key={city} value={city}>{city}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Chambres</label>
                      <input
                        type="number"
                        min={5}
                        max={2000}
                        value={newHotelRooms}
                        onChange={(e) => setNewHotelRooms(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Étoiles</label>
                      <select
                        value={newHotelStars}
                        onChange={(e) => setNewHotelStars(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                      >
                        <option value={3}>3 étoiles</option>
                        <option value={4}>4 étoiles</option>
                        <option value={5}>5 étoiles</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Segment</label>
                      <select
                        value={newHotelSegment}
                        onChange={(e) => setNewHotelSegment(e.target.value as any)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                      >
                        <option value="Affaires">Affaires</option>
                        <option value="Boutique">Boutique</option>
                        <option value="Luxe">Luxe</option>
                        <option value="Resort">Resort</option>
                        <option value="Économique">Économique</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">ADR Base (€)</label>
                      <input
                        type="number"
                        min={50}
                        max={3000}
                        value={newHotelADR}
                        onChange={(e) => setNewHotelADR(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs tabular-nums"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingHotel(false)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-lg cursor-pointer"
                    >
                      Créer et activer
                    </button>
                  </div>
                </form>
              )}

              {/* Fiche d'édition de l'hôtel actif */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Nom commercial</label>
                  <input
                    type="text"
                    value={hotelDraft.name}
                    onChange={(e) => setHotelDraft({ ...hotelDraft, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl font-semibold text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Groupe / Enseigne</label>
                  <input
                    type="text"
                    value={hotelDraft.group}
                    onChange={(e) => setHotelDraft({ ...hotelDraft, group: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Classification</label>
                  <select
                    value={hotelDraft.stars}
                    onChange={(e) => setHotelDraft({ ...hotelDraft, stars: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200"
                  >
                    <option value={3}>3 étoiles</option>
                    <option value={4}>4 étoiles</option>
                    <option value={5}>5 étoiles / Palace</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Ville</label>
                  <input
                    type="text"
                    value={hotelDraft.city}
                    onChange={(e) => setHotelDraft({ ...hotelDraft, city: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 font-semibold"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Adresse</label>
                  <input
                    type="text"
                    value={hotelDraft.address}
                    onChange={(e) => setHotelDraft({ ...hotelDraft, address: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Segment</label>
                  <select
                    value={hotelDraft.segment}
                    onChange={(e) => setHotelDraft({ ...hotelDraft, segment: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200"
                  >
                    <option value="Affaires">Affaires</option>
                    <option value="Boutique">Boutique</option>
                    <option value="Luxe">Luxe</option>
                    <option value="Resort">Resort</option>
                    <option value="Économique">Économique</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Latitude GPS</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={hotelDraft.lat}
                    onChange={(e) => setHotelDraft({ ...hotelDraft, lat: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl tabular-nums font-mono text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Longitude GPS</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={hotelDraft.lng}
                    onChange={(e) => setHotelDraft({ ...hotelDraft, lng: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl tabular-nums font-mono text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Capacité totale (ch.)</label>
                  <input
                    type="number"
                    min={1}
                    value={hotelDraft.roomCount}
                    onChange={(e) => setHotelDraft({ ...hotelDraft, roomCount: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl tabular-nums font-bold text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">ADR de référence (€)</label>
                  <input
                    type="number"
                    min={40}
                    value={hotelDraft.baseADR}
                    onChange={(e) => setHotelDraft({ ...hotelDraft, baseADR: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl tabular-nums font-bold text-violet-700 dark:text-violet-300"
                  />
                </div>
              </div>

              {/* Table Typologies de chambres */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Ventilation des typologies de chambres (capacité calculée :{' '}
                    <span className="tabular-nums text-violet-700 dark:text-violet-300">
                      {hotelConfig.roomTypologies.reduce((s, t) => s + (Number(t.totalRooms) || 0), 0)} ch.
                    </span>
                    )
                  </h4>
                </div>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Catégorie</th>
                        <th className="py-2.5 px-3 text-right">Chambres</th>
                        <th className="py-2.5 px-3 text-right">Supplément vs Base (€)</th>
                        <th className="py-2.5 px-3 text-right">Poids (%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {hotelConfig.roomTypologies.map((typ) => (
                        <tr key={typ.id}>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={typ.name}
                              onChange={(e) =>
                                setHotelConfig((prev) => ({
                                  ...prev,
                                  roomTypologies: prev.roomTypologies.map((x) =>
                                    x.id === typ.id ? { ...x, name: e.target.value } : x
                                  ),
                                }))
                              }
                              className="w-full px-2 py-1 border border-slate-200 dark:border-slate-800 rounded-lg font-medium text-slate-800 dark:text-slate-200"
                            />
                          </td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              min={1}
                              value={typ.totalRooms}
                              onChange={(e) =>
                                setHotelConfig((prev) => ({
                                  ...prev,
                                  roomTypologies: prev.roomTypologies.map((x) =>
                                    x.id === typ.id ? { ...x, totalRooms: Number(e.target.value) } : x
                                  ),
                                }))
                              }
                              className="w-20 px-2 py-1 border border-slate-200 dark:border-slate-800 rounded-lg text-right tabular-nums font-bold"
                            />
                          </td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              value={typ.baseOffsetEur}
                              onChange={(e) =>
                                setHotelConfig((prev) => ({
                                  ...prev,
                                  roomTypologies: prev.roomTypologies.map((x) =>
                                    x.id === typ.id ? { ...x, baseOffsetEur: Number(e.target.value) } : x
                                  ),
                                }))
                              }
                              className="w-20 px-2 py-1 border border-slate-200 dark:border-slate-800 rounded-lg text-right tabular-nums"
                            />
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums text-slate-600 dark:text-slate-400 font-semibold">
                            {typ.weightPercent}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Portefeuille complet avec bascule & suppression */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Portefeuille complet ({hotels.length} établissements)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {hotels.map((h) => {
                    const isCurrent = h.id === activeHotel.id;
                    return (
                      <div
                        key={h.id}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                          isCurrent ? 'border-violet-300 dark:border-violet-700/70 bg-violet-50/40 dark:bg-violet-950/30' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => onSelectHotel?.(h.id)}
                          className="text-left min-w-0 flex-1 cursor-pointer"
                        >
                          <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate flex items-center gap-1.5">
                            <span>{h.name}</span>
                            {isCurrent && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-violet-600 text-white">
                                Actif
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                            {h.city} • {h.stars}★ • {h.roomCount} ch. • ADR {h.baseADR}€
                          </div>
                        </button>
                        {hotels.length > 1 && (
                          <button
                            type="button"
                            onClick={() => onDeleteHotel(h.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg cursor-pointer"
                            title="Supprimer cet hôtel"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* B. REVENUE MANAGEMENT                                          */}
          {/* ============================================================== */}
          {activeCategory === 'rm' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    B. Paramètres Revenue Management — {activeHotel.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Objectifs de performance, bornes de sécurité BAR et règles de restriction MLOS utilisées par le moteur Pricing.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSaveRMRules}
                  className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Enregistrer & Recalculer Pricing</span>
                </button>
              </div>

              {/* Stratégie & Objectifs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Stratégie tarifaire</label>
                  <select
                    value={hotelConfig.rmRules.pricingStrategy}
                    onChange={(e) =>
                      setHotelConfig((prev) => ({
                        ...prev,
                        rmRules: { ...prev.rmRules, pricingStrategy: e.target.value as RMSPricingStrategy },
                      }))
                    }
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-slate-900 dark:text-slate-100"
                  >
                    <option value="equilibre">Équilibre RevPAR (Recommandée)</option>
                    <option value="marge">Optimisation Marge & ADR</option>
                    <option value="volume">Capture Volume & Occupation</option>
                    <option value="agressif">Yield Agressif Compression</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Objectif CA annuel (€)</label>
                  <input
                    type="number"
                    value={hotelConfig.rmRules.annualRevenueTargetEur}
                    onChange={(e) =>
                      setHotelConfig((prev) => ({
                        ...prev,
                        rmRules: { ...prev.rmRules, annualRevenueTargetEur: Number(e.target.value) },
                      }))
                    }
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl tabular-nums font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Objectif Occupation (%)</label>
                  <input
                    type="number"
                    min={10}
                    max={100}
                    value={hotelConfig.rmRules.monthlyOccupancyTargetPct}
                    onChange={(e) =>
                      setHotelConfig((prev) => ({
                        ...prev,
                        rmRules: { ...prev.rmRules, monthlyOccupancyTargetPct: Number(e.target.value) },
                      }))
                    }
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl tabular-nums font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">ADR Cible (€)</label>
                  <input
                    type="number"
                    min={40}
                    value={hotelConfig.rmRules.targetAdrEur}
                    onChange={(e) =>
                      setHotelConfig((prev) => ({
                        ...prev,
                        rmRules: { ...prev.rmRules, targetAdrEur: Number(e.target.value) },
                      }))
                    }
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl tabular-nums font-bold text-violet-700 dark:text-violet-300"
                  />
                </div>
              </div>

              {/* Bornes de sécurité BAR & Sauts max */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Garde-fous tarifaires (appliqués dans Pricing Intelligent)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Tarif Plancher BAR (€)</label>
                    <input
                      type="number"
                      min={40}
                      value={hotelConfig.rmRules.barFloorEur}
                      onChange={(e) =>
                        setHotelConfig((prev) => ({
                          ...prev,
                          rmRules: { ...prev.rmRules, barFloorEur: Number(e.target.value) },
                        }))
                      }
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl tabular-nums font-bold text-amber-800 dark:text-amber-300"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Tarif Plafond BAR (€)</label>
                    <input
                      type="number"
                      min={100}
                      value={hotelConfig.rmRules.barCeilingEur}
                      onChange={(e) =>
                        setHotelConfig((prev) => ({
                          ...prev,
                          rmRules: { ...prev.rmRules, barCeilingEur: Number(e.target.value) },
                        }))
                      }
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl tabular-nums font-bold text-rose-800 dark:text-rose-300"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Saut max par palier (€)</label>
                    <input
                      type="number"
                      min={10}
                      value={hotelConfig.rmRules.maxSingleAdjustmentEur}
                      onChange={(e) =>
                        setHotelConfig((prev) => ({
                          ...prev,
                          rmRules: { ...prev.rmRules, maxSingleAdjustmentEur: Number(e.target.value) },
                        }))
                      }
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl tabular-nums font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Variation max (%)</label>
                    <input
                      type="number"
                      min={5}
                      max={100}
                      value={hotelConfig.rmRules.maxSingleAdjustmentPct}
                      onChange={(e) =>
                        setHotelConfig((prev) => ({
                          ...prev,
                          rmRules: { ...prev.rmRules, maxSingleAdjustmentPct: Number(e.target.value) },
                        }))
                      }
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl tabular-nums font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Seuils & Restrictions */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Seuils de déclenchement & Restrictions MLOS</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Score Priorité Événement (/100)</label>
                    <input
                      type="number"
                      min={20}
                      max={95}
                      value={hotelConfig.rmRules.priorityScoreThreshold}
                      onChange={(e) =>
                        setHotelConfig((prev) => ({
                          ...prev,
                          rmRules: { ...prev.rmRules, priorityScoreThreshold: Number(e.target.value) },
                        }))
                      }
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Seuil Stop-Sell Promos (score)</label>
                    <input
                      type="number"
                      min={40}
                      max={100}
                      value={hotelConfig.rmRules.autoStopSellPromosAtScore}
                      onChange={(e) =>
                        setHotelConfig((prev) => ({
                          ...prev,
                          rmRules: { ...prev.rmRules, autoStopSellPromosAtScore: Number(e.target.value) },
                        }))
                      }
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Min Stay défaut (nuits)</label>
                    <input
                      type="number"
                      min={1}
                      max={7}
                      value={hotelConfig.rmRules.defaultMinStay}
                      onChange={(e) =>
                        setHotelConfig((prev) => ({
                          ...prev,
                          rmRules: { ...prev.rmRules, defaultMinStay: Number(e.target.value) },
                        }))
                      }
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Min Stay week-end (nuits)</label>
                    <input
                      type="number"
                      min={1}
                      max={7}
                      value={hotelConfig.rmRules.weekendMinStay}
                      onChange={(e) =>
                        setHotelConfig((prev) => ({
                          ...prev,
                          rmRules: { ...prev.rmRules, weekendMinStay: Number(e.target.value) },
                        }))
                      }
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl tabular-nums"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2.5 pt-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hotelConfig.rmRules.requireHumanValidation}
                    onChange={(e) =>
                      setHotelConfig((prev) => ({
                        ...prev,
                        rmRules: { ...prev.rmRules, requireHumanValidation: e.target.checked },
                      }))
                    }
                    className="rounded text-violet-600 dark:text-violet-400"
                  />
                  <span className="font-semibold">
                    Validation humaine obligatoire avant transmission CRS (aucune modification automatique sans accord RM)
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* C. CONCURRENCE & COMPSET (JUSQU'À 10 CONCURRENTS)               */}
          {/* ============================================================== */}
          {activeCategory === 'compset' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      C. Concurrence & CompSet — {activeHotel.name}
                    </h3>
                    <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-violet-50 dark:bg-violet-950/40 text-violet-800 dark:text-violet-300 border border-violet-200 dark:border-violet-800/70 tabular-nums">
                      {activeCompsetCount} / 10 actifs
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Configurez jusqu’à 10 hôtels concurrents actifs. Aucune donnée n’est inventée si un hôtel est indisponible ou épuisé.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingComp(!isAddingComp)}
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Ajouter un concurrent</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveCompSet}
                    className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Enregistrer & Recalculer</span>
                  </button>
                </div>
              </div>

              {isAddingComp && (
                <form onSubmit={handleAddCompetitor} className="p-4 rounded-xl border border-violet-200 dark:border-violet-800/70 bg-violet-50/40 dark:bg-violet-950/30 space-y-3 text-xs">
                  <div className="font-bold text-violet-950 dark:text-violet-100">Ajouter un concurrent au panel</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Nom de l’hôtel *</label>
                      <input
                        type="text"
                        required
                        value={newCompName}
                        onChange={(e) => setNewCompName(e.target.value)}
                        placeholder="Ex : Hôtel Opéra Liège"
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Ville</label>
                      <input
                        type="text"
                        value={newCompCity}
                        onChange={(e) => setNewCompCity(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Étoiles</label>
                      <select
                        value={newCompStars}
                        onChange={(e) => setNewCompStars(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
                      >
                        <option value={3}>3★</option>
                        <option value={4}>4★</option>
                        <option value={5}>5★</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Distance (km)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={newCompDistanceKm}
                        onChange={(e) => setNewCompDistanceKm(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Tarif réf (€)</label>
                      <input
                        type="number"
                        min={40}
                        value={newCompBaseRate}
                        onChange={(e) => setNewCompBaseRate(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg tabular-nums"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Chambre de référence</label>
                      <input
                        type="text"
                        value={newCompRoomType}
                        onChange={(e) => setNewCompRoomType(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Annulation</label>
                      <select
                        value={newCompCancelPolicy}
                        onChange={(e) => setNewCompCancelPolicy(e.target.value as any)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
                      >
                        <option value="Flexible">Flexible</option>
                        <option value="Semi-flexible">Semi-flexible</option>
                        <option value="Non-annulable">Non-annulable</option>
                      </select>
                    </div>
                    <label className="flex items-center gap-1.5 pt-4 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newCompBreakfast}
                        onChange={(e) => setNewCompBreakfast(e.target.checked)}
                      />
                      <span>PDJ inclus</span>
                    </label>
                    <label className="flex items-center gap-1.5 pt-4 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newCompComparable}
                        onChange={(e) => setNewCompComparable(e.target.checked)}
                      />
                      <span>Comparable direct</span>
                    </label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingComp(false)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-lg cursor-pointer"
                    >
                      Ajouter au CompSet
                    </button>
                  </div>
                </form>
              )}

              {/* Règles de calcul CompSet */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hotelConfig.compSetSettings.excludeSoldOutFromMedian}
                    onChange={(e) =>
                      setHotelConfig((prev) => ({
                        ...prev,
                        compSetSettings: { ...prev.compSetSettings, excludeSoldOutFromMedian: e.target.checked },
                      }))
                    }
                  />
                  <span className="font-semibold">Exclure les hôtels épuisés/indisponibles des médianes et moyennes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hotelConfig.compSetSettings.requireStrictComparability}
                    onChange={(e) =>
                      setHotelConfig((prev) => ({
                        ...prev,
                        compSetSettings: { ...prev.compSetSettings, requireStrictComparability: e.target.checked },
                      }))
                    }
                  />
                  <span className="font-semibold">Signaler les écarts de comparabilité (PDJ / Non-annulable / 5★)</span>
                </label>
              </div>

              {/* Liste éditable des concurrents */}
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3 text-center">Actif</th>
                      <th className="py-2.5 px-3">Établissement concurrent</th>
                      <th className="py-2.5 px-2 text-center">★</th>
                      <th className="py-2.5 px-2 text-right">Dist. (km)</th>
                      <th className="py-2.5 px-3">Chambre & Politique</th>
                      <th className="py-2.5 px-2 text-right">Tarif réf (€)</th>
                      <th className="py-2.5 px-2 text-center">Comparable</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {hotelConfig.compSet.map((comp, idx) => (
                      <tr key={comp.id} className={!comp.isActive ? 'bg-slate-50/70 dark:bg-slate-800/50 opacity-65' : ''}>
                        <td className="py-2 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={comp.isActive}
                            onChange={() => handleToggleCompetitorActive(comp.id)}
                            className="rounded text-violet-600 dark:text-violet-400 cursor-pointer"
                          />
                        </td>
                        <td className="py-2 px-3 min-w-[210px]">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: comp.color }} />
                            <input
                              type="text"
                              value={comp.name}
                              onChange={(e) => handleUpdateCompetitorField(comp.id, { name: e.target.value })}
                              className="w-full px-2 py-1 border border-slate-200 dark:border-slate-800 rounded-lg font-semibold text-slate-900 dark:text-slate-100"
                            />
                          </div>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <select
                            value={comp.stars}
                            onChange={(e) => handleUpdateCompetitorField(comp.id, { stars: Number(e.target.value) })}
                            className="px-1.5 py-1 border border-slate-200 dark:border-slate-800 rounded-lg tabular-nums"
                          >
                            <option value={3}>3★</option>
                            <option value={4}>4★</option>
                            <option value={5}>5★</option>
                          </select>
                        </td>
                        <td className="py-2 px-2 text-right">
                          <input
                            type="number"
                            step="0.1"
                            min={0}
                            value={comp.distanceKm}
                            onChange={(e) => handleUpdateCompetitorField(comp.id, { distanceKm: Number(e.target.value) })}
                            className="w-16 px-1.5 py-1 border border-slate-200 dark:border-slate-800 rounded-lg text-right tabular-nums"
                          />
                        </td>
                        <td className="py-2 px-3 min-w-[180px]">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={comp.defaultRoomType}
                              onChange={(e) => handleUpdateCompetitorField(comp.id, { defaultRoomType: e.target.value })}
                              className="w-24 px-1.5 py-1 border border-slate-200 dark:border-slate-800 rounded-lg"
                            />
                            <select
                              value={comp.cancellationPolicy}
                              onChange={(e) =>
                                handleUpdateCompetitorField(comp.id, {
                                  cancellationPolicy: e.target.value as any,
                                })
                              }
                              className="px-1.5 py-1 border border-slate-200 dark:border-slate-800 rounded-lg text-[11px]"
                            >
                              <option value="Flexible">Flex</option>
                              <option value="Semi-flexible">Semi</option>
                              <option value="Non-annulable">NR</option>
                            </select>
                          </div>
                        </td>
                        <td className="py-2 px-2 text-right">
                          <input
                            type="number"
                            min={40}
                            value={comp.baseRateEur}
                            onChange={(e) => handleUpdateCompetitorField(comp.id, { baseRateEur: Number(e.target.value) })}
                            className="w-20 px-2 py-1 border border-slate-200 dark:border-slate-800 rounded-lg text-right tabular-nums font-bold"
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateCompetitorField(comp.id, { isFullyComparable: !comp.isFullyComparable })
                            }
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border cursor-pointer ${
                              comp.isFullyComparable
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70'
                                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/70'
                            }`}
                          >
                            {comp.isFullyComparable ? 'Oui' : 'Écart'}
                          </button>
                        </td>
                        <td className="py-2 px-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleMoveCompetitor(idx, -1)}
                              disabled={idx === 0}
                              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 cursor-pointer"
                              title="Monter"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveCompetitor(idx, 1)}
                              disabled={idx === hotelConfig.compSet.length - 1}
                              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 cursor-pointer"
                              title="Descendre"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCompetitor(comp.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                              title="Supprimer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* D. VEILLE ÉVÉNEMENTIELLE & PÉRIMÈTRE GÉOGRAPHIQUE STRICT       */}
          {/* ============================================================== */}
          {activeCategory === 'veille' && (
            <div className="space-y-5">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      D. Veille Événementielle & Filtrage Géographique Strict — {activeHotel.city}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Seuls les événements ayant un impact crédible sur le bassin de {activeHotel.city} sont conservés dans Liste, Calendrier, Explorer Events et Prévisions.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveEventWatch}
                    className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Enregistrer le périmètre</span>
                  </button>
                </div>

                {/* Portée géographique + Rayons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Zone de chalandise</label>
                    <select
                      value={hotelConfig.eventWatch.geoScope}
                      onChange={(e) => handleApplyGeoScopePreset(e.target.value as GeoCatchmentScope)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-slate-900 dark:text-slate-100"
                    >
                      <option value="intra_muros">Intra-muros strict</option>
                      <option value="metropole">Métropole & bassin direct (Défaut)</option>
                      <option value="bassin_elargi">Bassin régional élargi</option>
                      <option value="custom">Personnalisé</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Rayon cœur (km)</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={hotelConfig.eventWatch.mainRadiusKm}
                      onChange={(e) =>
                        setHotelConfig((prev) => ({
                          ...prev,
                          eventWatch: { ...prev.eventWatch, geoScope: 'custom', mainRadiusKm: Number(e.target.value) },
                        }))
                      }
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl tabular-nums font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Rayon étendu max (km)</label>
                    <input
                      type="number"
                      min={5}
                      max={200}
                      value={hotelConfig.eventWatch.extendedRadiusKm}
                      onChange={(e) =>
                        setHotelConfig((prev) => ({
                          ...prev,
                          eventWatch: { ...prev.eventWatch, geoScope: 'custom', extendedRadiusKm: Number(e.target.value) },
                        }))
                      }
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl tabular-nums font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Fréquence de collecte</label>
                    <select
                      value={hotelConfig.eventWatch.refreshFrequency}
                      onChange={(e) =>
                        setHotelConfig((prev) => ({
                          ...prev,
                          eventWatch: { ...prev.eventWatch, refreshFrequency: e.target.value as any },
                        }))
                      }
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl"
                    >
                      <option value="daily_6am">Quotidienne (06h00)</option>
                      <option value="hourly">Toutes les heures</option>
                      <option value="manual">Manuelle uniquement</option>
                    </select>
                  </div>
                </div>

                {/* Options d'isolation territoriale */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 space-y-2.5 text-xs">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hotelConfig.eventWatch.strictTerritoryIsolation}
                      onChange={(e) =>
                        setHotelConfig((prev) => ({
                          ...prev,
                          eventWatch: { ...prev.eventWatch, strictTerritoryIsolation: e.target.checked },
                        }))
                      }
                    />
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      Isolation territoriale stricte (ex. exclure systématiquement Lyon, Marseille, Lille pour un hôtel parisien)
                    </span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hotelConfig.eventWatch.allowJustifiedEconomicException}
                      onChange={(e) =>
                        setHotelConfig((prev) => ({
                          ...prev,
                          eventWatch: { ...prev.eventWatch, allowJustifiedEconomicException: e.target.checked },
                        }))
                      }
                    />
                    <span className="text-slate-700 dark:text-slate-300">
                      Autoriser les exceptions économiques justifiées (méga-événements nationaux ≥{' '}
                      <span className="tabular-nums font-semibold">
                        {hotelConfig.eventWatch.economicExceptionMinAttendance.toLocaleString('fr-FR')}
                      </span>{' '}
                      visiteurs générant du report de demande)
                    </span>
                  </label>
                </div>

                {/* Catégories suivies */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      Catégories suivies ({hotelConfig.eventWatch.enabledCategories.length} / {ALL_EVENT_CATEGORIES.length})
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                      Événements retenus pour {activeHotel.city} : <strong>{geoScopedEvents.length}</strong> / {events.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {ALL_EVENT_CATEGORIES.map((cat) => {
                      const active = hotelConfig.eventWatch.enabledCategories.includes(cat);
                      return (
                        <label
                          key={cat}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs cursor-pointer ${
                            active
                              ? 'border-violet-300 dark:border-violet-700/70 bg-violet-50/60 dark:bg-violet-950/40 text-violet-950 dark:text-violet-100 font-semibold'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={() => handleToggleEventCategory(cat)}
                            className="rounded text-violet-600 dark:text-violet-400"
                          />
                          <span className="truncate">{getCategoryLabel(cat)}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Aperçu interactif du bassin géographique */}
              <GeoIntelligenceView
                hotels={hotels}
                selectedHotelId={activeHotel.id}
                events={geoScopedEvents}
                onSelectHotel={(id) => onSelectHotel?.(id)}
                onShowToast={onShowToast || (() => {})}
              />
            </div>
          )}

          {/* ============================================================== */}
          {/* E. INTÉGRATIONS & CONNECTEURS                                  */}
          {/* ============================================================== */}
          {activeCategory === 'integrations' && (
            <div className="space-y-5">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
                <div className="border-b border-slate-100 dark:border-slate-800/80 pb-4">
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    E. Intégrations & Connecteurs Système
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    État réel des sources de données : les connecteurs API externes sans clé partenaire sont explicitement indiqués comme non raccordés.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {systemConfig.integrations.map((conn) => {
                    const isLocalOk = conn.status === 'active_local';
                    const isConfigured = conn.status === 'configured';
                    return (
                      <div key={conn.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-bold text-xs text-slate-900 dark:text-slate-100">{conn.name}</div>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap shrink-0 border ${
                              isLocalOk || isConfigured
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                            }`}
                          >
                            {isLocalOk
                              ? 'Actif (Mode fichier local)'
                              : isConfigured
                              ? 'Clés configurées'
                              : 'Non raccordé (Clé absente)'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">{conn.description}</p>
                        {conn.lastError && (
                          <div className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 rounded-lg px-2.5 py-1.5">
                            {conn.lastError}
                          </div>
                        )}
                        {conn.lastSyncAt && (
                          <div className="text-[10px] text-slate-400 tabular-nums">
                            Dernier traitement : {conn.lastSyncAt}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Configuration Supabase */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
                  <div className="flex items-center gap-2.5">
                    <Database className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Base de données Supabase + PostGIS</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Configuration optionnelle pour la persistance distante et les calculs spatiaux SQL.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleTestSupabase}
                      disabled={isTestingSupabase}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isTestingSupabase ? 'animate-spin' : ''}`} />
                      <span>Tester la connexion</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveSupabase}
                      className="px-3.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold cursor-pointer"
                    >
                      Enregistrer Supabase
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">URL du projet Supabase</label>
                    <input
                      type="url"
                      value={supabaseUrl}
                      onChange={(e) => setSupabaseUrl(e.target.value)}
                      placeholder="https://xxxxx.supabase.co"
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Clé Anon Key</label>
                    <input
                      type="password"
                      value={supabaseAnonKey}
                      onChange={(e) => setSupabaseAnonKey(e.target.value)}
                      placeholder="eyJhbGciOi..."
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs"
                    />
                  </div>
                </div>

                {supabaseStatus.tested && supabaseStatus.message && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                      supabaseStatus.success
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/70 text-emerald-800 dark:text-emerald-300'
                        : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/70 text-rose-800 dark:text-rose-300'
                    }`}
                  >
                    {supabaseStatus.success ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{supabaseStatus.message}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => setShowSqlPreview(!showSqlPreview)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 flex items-center gap-1.5 cursor-pointer"
                  >
                    {showSqlPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showSqlPreview ? 'Masquer le schéma SQL' : 'Afficher le schéma SQL PostGIS'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopySQL}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedSQL ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Copier SQL</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadSQL}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Télécharger .sql</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSyncInitialSupabase}
                    disabled={isSyncingSupabase}
                    className="px-3 py-1.5 rounded-xl border border-violet-200 dark:border-violet-800/70 bg-violet-50 dark:bg-violet-950/40 text-xs font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/40 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Database className={`w-3.5 h-3.5 ${isSyncingSupabase ? 'animate-pulse' : ''}`} />
                    <span>{isSyncingSupabase ? 'Synchronisation...' : 'Synchroniser les données'}</span>
                  </button>
                </div>

                {showSqlPreview && (
                  <pre className="p-4 rounded-xl bg-slate-900 dark:bg-slate-800 text-slate-100 text-[11px] font-mono overflow-x-auto max-h-72">
                    {FULL_SUPABASE_SQL}
                  </pre>
                )}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* F. UTILISATEURS & PERMISSIONS RBAC                             */}
          {/* ============================================================== */}
          {activeCategory === 'users' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    F. Utilisateurs, Rôles & Permissions Multi-Hôtels
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Contrôle des droits d’arbitrage tarifaire, d’édition du CompSet et d’administration par établissement.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingUser(!isAddingUser)}
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Ajouter utilisateur</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveUsers}
                    className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Enregistrer les droits</span>
                  </button>
                </div>
              </div>

              {isAddingUser && (
                <form onSubmit={handleAddUser} className="p-4 rounded-xl border border-violet-200 dark:border-violet-800/70 bg-violet-50/40 dark:bg-violet-950/30 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs items-end">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Nom complet *</label>
                    <input
                      type="text"
                      required
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      placeholder="Ex : Camille Laurent"
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Email *</label>
                    <input
                      type="email"
                      required
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      placeholder="camille@hotel.fr"
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Rôle</label>
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value as SystemUserRole)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
                    >
                      <option value="revenue_manager">Revenue Manager</option>
                      <option value="general_manager">Directeur d’Hôtel</option>
                      <option value="analyst">Analyste Pricing</option>
                      <option value="viewer">Lecture seule</option>
                      <option value="admin">Administrateur</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-violet-600 text-white font-bold cursor-pointer"
                    >
                      Créer
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingUser(false)}
                      className="px-3 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      Annuler
                    </button>
                  </div>
                </form>
              )}

              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Utilisateur</th>
                      <th className="py-2.5 px-3">Rôle</th>
                      <th className="py-2.5 px-3">Périmètre Hôtels</th>
                      <th className="py-2.5 px-2 text-center">Valider Tarifs</th>
                      <th className="py-2.5 px-2 text-center">Éditer CompSet</th>
                      <th className="py-2.5 px-2 text-center">Règles RM</th>
                      <th className="py-2.5 px-2 text-center">Exports</th>
                      <th className="py-2.5 px-3 text-right">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {users.map((usr) => (
                      <tr key={usr.id}>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{usr.name}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{usr.email}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <select
                            value={usr.role}
                            onChange={(e) =>
                              setUsers((prev) =>
                                prev.map((x) => (x.id === usr.id ? { ...x, role: e.target.value as SystemUserRole } : x))
                              )
                            }
                            className="px-2 py-1 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold"
                          >
                            <option value="admin">Admin</option>
                            <option value="revenue_manager">Revenue Manager</option>
                            <option value="general_manager">Directeur Hôtel</option>
                            <option value="analyst">Analyste</option>
                            <option value="viewer">Lecteur</option>
                          </select>
                        </td>
                        <td className="py-2.5 px-3">
                          {usr.allowedHotelIds === 'all' ? (
                            <span className="text-[11px] font-bold text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/40 px-2 py-0.5 rounded-md border border-violet-200 dark:border-violet-800/70">
                              Tous les hôtels
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-600 dark:text-slate-400 tabular-nums">
                              {usr.allowedHotelIds
                                .map((hid) => hotels.find((h) => h.id === hid)?.city || hid)
                                .join(', ')}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <input
                            type="checkbox"
                            checked={usr.permissions.canApproveRates}
                            onChange={() => handleToggleUserPermission(usr.id, 'canApproveRates')}
                          />
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <input
                            type="checkbox"
                            checked={usr.permissions.canEditCompset}
                            onChange={() => handleToggleUserPermission(usr.id, 'canEditCompset')}
                          />
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <input
                            type="checkbox"
                            checked={usr.permissions.canEditRMRules}
                            onChange={() => handleToggleUserPermission(usr.id, 'canEditRMRules')}
                          />
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <input
                            type="checkbox"
                            checked={usr.permissions.canExportData}
                            onChange={() => handleToggleUserPermission(usr.id, 'canExportData')}
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setUsers((prev) =>
                                prev.map((x) => (x.id === usr.id ? { ...x, isActive: !x.isActive } : x))
                              )
                            }
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border cursor-pointer ${
                              usr.isActive
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                            }`}
                          >
                            {usr.isActive ? 'Actif' : 'Suspendu'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* G. NOTIFICATIONS & ALERTES QUOTIDIENNES                        */}
          {/* ============================================================== */}
          {activeCategory === 'alerts' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    G. Alertes et Notifications — Événements Majeurs (Score &gt; {alertConfig.minScore})
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Alertes e-mail filtrées strictement sur le bassin géographique de {activeHotel.name} ({activeHotel.city}).
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSendTestAlert}
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                    <span>Tester l’alerte</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveNotifications}
                    className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Enregistrer</span>
                  </button>
                </div>
              </div>

              {/* Paramètres d'alerte e-mail quotidienne avec sélecteur de fréquence */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-xs">
                <label className="flex items-center gap-2.5 p-3 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alertConfig.enabled}
                    onChange={(e) => handleUpdateAlertConfig({ enabled: e.target.checked })}
                  />
                  <div>
                    <div className="font-bold text-slate-900 dark:text-slate-100">Alertes actives</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">Digest automatique</div>
                  </div>
                </label>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Fréquence d’envoi</label>
                  <select
                    value={alertConfig.frequency}
                    onChange={(e) =>
                      handleUpdateAlertConfig({
                        frequency: e.target.value as MajorEventEmailAlertConfig['frequency'],
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl font-bold bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 cursor-pointer"
                  >
                    <option value="daily">Quotidienne (7j/7)</option>
                    <option value="weekdays">Jours ouvrés (Lun–Ven)</option>
                    <option value="weekly">Hebdomadaire (Lundi)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Seuil Score RM (&gt; X)</label>
                  <input
                    type="number"
                    min={40}
                    max={95}
                    value={alertConfig.minScore}
                    onChange={(e) => handleUpdateAlertConfig({ minScore: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl tabular-nums font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Heure d’envoi</label>
                  <input
                    type="time"
                    value={alertConfig.sendTime}
                    onChange={(e) => handleUpdateAlertConfig({ sendTime: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl tabular-nums font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Horizon analysé (jours)</label>
                  <input
                    type="number"
                    min={7}
                    max={180}
                    value={alertConfig.horizonDays}
                    onChange={(e) => handleUpdateAlertConfig({ horizonDays: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl tabular-nums font-bold"
                  />
                </div>
              </div>

              {/* Destinataires */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Destinataires ({alertConfig.recipients.length})</h4>
                <form onSubmit={handleAddRecipient} className="flex flex-wrap gap-2">
                  <input
                    type="email"
                    value={newRecipientEmail}
                    onChange={(e) => {
                      setNewRecipientEmail(e.target.value);
                      setRecipientError(null);
                    }}
                    placeholder="revenue.manager@hotel.fr"
                    className="flex-1 min-w-[220px] px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Ajouter</span>
                  </button>
                </form>
                {recipientError && <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{recipientError}</p>}

                <div className="flex flex-wrap gap-2">
                  {alertConfig.recipients.map((email) => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200"
                    >
                      <span>{email}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveRecipient(email)}
                        className="text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Seuils d'alertes opérationnelles RM */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Déclencheurs opérationnels Pricing & Stock ({activeHotel.name})</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                    <label className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hotelConfig.notifications.alertHighDemandEnabled}
                        onChange={(e) =>
                          setHotelConfig((prev) => ({
                            ...prev,
                            notifications: { ...prev.notifications, alertHighDemandEnabled: e.target.checked },
                          }))
                        }
                      />
                      <span>Forte demande OTB</span>
                    </label>
                    <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                      <span>Seuil occupation (%)</span>
                      <input
                        type="number"
                        min={50}
                        max={100}
                        value={hotelConfig.notifications.highDemandOccThresholdPct}
                        onChange={(e) =>
                          setHotelConfig((prev) => ({
                            ...prev,
                            notifications: { ...prev.notifications, highDemandOccThresholdPct: Number(e.target.value) },
                          }))
                        }
                        className="w-16 px-2 py-1 border border-slate-200 dark:border-slate-800 rounded-lg text-right tabular-nums font-bold"
                      />
                    </div>
                  </div>

                  <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                    <label className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hotelConfig.notifications.alertPricingOpportunityEnabled}
                        onChange={(e) =>
                          setHotelConfig((prev) => ({
                            ...prev,
                            notifications: { ...prev.notifications, alertPricingOpportunityEnabled: e.target.checked },
                          }))
                        }
                      />
                      <span>Opportunité tarifaire</span>
                    </label>
                    <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                      <span>Écart min (€)</span>
                      <input
                        type="number"
                        min={5}
                        max={200}
                        value={hotelConfig.notifications.pricingOpportunityMinGapEur}
                        onChange={(e) =>
                          setHotelConfig((prev) => ({
                            ...prev,
                            notifications: { ...prev.notifications, pricingOpportunityMinGapEur: Number(e.target.value) },
                          }))
                        }
                        className="w-16 px-2 py-1 border border-slate-200 dark:border-slate-800 rounded-lg text-right tabular-nums font-bold"
                      />
                    </div>
                  </div>

                  <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                    <label className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hotelConfig.notifications.alertCompsetSoldOutEnabled}
                        onChange={(e) =>
                          setHotelConfig((prev) => ({
                            ...prev,
                            notifications: { ...prev.notifications, alertCompsetSoldOutEnabled: e.target.checked },
                          }))
                        }
                      />
                      <span>Compression Compset</span>
                    </label>
                    <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                      <span>Concurrents complets ≥</span>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={hotelConfig.notifications.compsetSoldOutMinCount}
                        onChange={(e) =>
                          setHotelConfig((prev) => ({
                            ...prev,
                            notifications: { ...prev.notifications, compsetSoldOutMinCount: Number(e.target.value) },
                          }))
                        }
                        className="w-16 px-2 py-1 border border-slate-200 dark:border-slate-800 rounded-lg text-right tabular-nums font-bold"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Aperçu du digest filtré pour cet hôtel */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                    Événements qualifiants sur {activeHotel.city} ({emailPreview.qualifyingEvents.length} détectés)
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAlertPreview(!showAlertPreview)}
                    className="text-xs font-semibold text-violet-700 dark:text-violet-300 hover:underline cursor-pointer"
                  >
                    {showAlertPreview ? 'Masquer l’aperçu e-mail' : 'Afficher l’aperçu e-mail'}
                  </button>
                </div>

                {emailPreview.qualifyingEvents.length > 0 && (
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="py-2 px-3">Statut</th>
                          <th className="py-2 px-3">Événement</th>
                          <th className="py-2 px-3">Ville</th>
                          <th className="py-2 px-3">Dates</th>
                          <th className="py-2 px-3 text-right">Score RM</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                        {emailPreview.qualifyingEvents.slice(0, 6).map((ev) => {
                          const badge = getEventStatusBadgeConfig(ev, CURRENT_REFERENCE_DATE);
                          return (
                            <tr key={ev.id}>
                              <td className="py-2 px-3">
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${badge.badgeClass}`}>
                                  {badge.label}
                                </span>
                              </td>
                              <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100">{ev.title}</td>
                              <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{ev.city}</td>
                              <td className="py-2 px-3 text-slate-500 dark:text-slate-400 tabular-nums">
                                {ev.startDate} → {ev.endDate}
                              </td>
                              <td className="py-2 px-3 text-right font-black text-violet-700 dark:text-violet-300 tabular-nums">
                                {ev.scoreBreakdown.finalRMScore}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {showAlertPreview && (
                  <pre className="p-4 rounded-xl bg-slate-900 dark:bg-slate-800 text-slate-100 text-[11px] font-mono whitespace-pre-wrap">
                    {emailPreview.subject}
                    {'\n\n'}
                    {emailPreview.bodyText}
                  </pre>
                )}

                {alertLogs.length > 0 && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 pt-1 tabular-nums">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      Dernier envoi enregistré : <strong>{alertLogs[0].sentAt}</strong> ({alertLogs[0].eventsCount} événements)
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* H. SYSTÈME, EXPORT & JOURNAL D'AUDIT                           */}
          {/* ============================================================== */}
          {activeCategory === 'system' && (
            <div className="space-y-5">
              {/* Carte Apparence & Thème Visuel */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-950/50 border border-violet-200 dark:border-violet-800/60 flex items-center justify-center text-violet-700 dark:text-violet-300">
                      <Palette className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        Apparence & Mode Sombre Adouci (Confort Visuel)
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Palette ardoise nocturne à faible éblouissement, mémorisée automatiquement ou synchronisée avec votre appareil.
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    Thème actif : {resolvedTheme === 'dark' ? 'Sombre Adouci' : 'Clair'}
                    {themeMode === 'system' ? ' · Sync Système' : ''}
                  </span>
                </div>

                {/* Option dédiée : Synchronisation automatique avec les préférences système */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-violet-600 dark:text-violet-400 shrink-0 mt-0.5">
                      <Monitor className="w-4 h-4" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          Synchroniser automatiquement avec les préférences système (navigateur / OS)
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        Adapte instantanément l’interface Flowtym aux réglages clairs/sombres de votre système d’exploitation ou navigateur (prefers-color-scheme).
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300 pt-0.5">
                        <span>
                          Préférence OS détectée :{' '}
                          <strong className="font-semibold text-slate-900 dark:text-slate-100">
                            {systemPrefersDark ? 'Mode Sombre' : 'Mode Clair'}
                          </strong>
                        </span>
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
                        <span className={themeMode === 'system' ? 'text-violet-700 dark:text-violet-300 font-semibold' : 'text-slate-500 dark:text-slate-400'}>
                          {themeMode === 'system' ? 'Synchronisation active' : 'Sélection manuelle'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={themeMode === 'system'}
                    aria-label="Synchroniser automatiquement le thème avec les préférences système"
                    onClick={handleToggleSystemSync}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                      themeMode === 'system'
                        ? 'bg-violet-600 dark:bg-violet-500'
                        : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                        themeMode === 'system' ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(
                    [
                      {
                        id: 'light' as ThemeMode,
                        title: 'Mode Clair',
                        desc: 'Interface lumineuse haute précision pour le travail de jour.',
                        icon: Sun,
                        previewBg: 'bg-[#f8fafc] border-slate-200',
                        previewCard: 'bg-white border-slate-200',
                        previewBar: 'bg-violet-600',
                      },
                      {
                        id: 'dark' as ThemeMode,
                        title: 'Mode Sombre Adouci',
                        desc: 'Surfaces ardoise crépusculaires à faible contraste pour réduire la fatigue oculaire.',
                        icon: Moon,
                        previewBg: 'bg-[#141824] border-[#2e384f]',
                        previewCard: 'bg-[#1c2231] border-[#333f57]',
                        previewBar: 'bg-violet-400',
                      },
                      {
                        id: 'system' as ThemeMode,
                        title: 'Automatique (Système)',
                        desc: `Suit automatiquement l’OS et le navigateur (${systemPrefersDark ? 'Sombre' : 'Clair'} actuellement).`,
                        icon: Monitor,
                        previewBg: 'bg-gradient-to-r from-[#f8fafc] via-slate-400 to-[#141824] border-slate-300 dark:border-slate-700',
                        previewCard: 'bg-white/90 dark:bg-[#1c2231]/90 border-slate-200 dark:border-[#333f57]',
                        previewBar: 'bg-violet-500',
                      },
                    ]
                  ).map((item) => {
                    const Icon = item.icon;
                    const isSelected = themeMode === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleThemeSelect(item.id)}
                        className={`text-left p-4 rounded-xl border transition-all cursor-pointer flex flex-col gap-3 ${
                          isSelected
                            ? 'border-violet-500 ring-2 ring-violet-500/20 bg-violet-50/40 dark:bg-violet-950/35'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className={`w-full h-14 rounded-lg border p-2 flex flex-col justify-between ${item.previewBg}`}>
                          <div className="flex items-center gap-1.5">
                            <span className={`w-6 h-1.5 rounded-full ${item.previewBar}`} />
                            <span className="w-10 h-1.5 rounded-full bg-slate-400/40" />
                          </div>
                          <div className={`h-5 rounded border ${item.previewCard}`} />
                        </div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
                              <Icon className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                              <span>{item.title}</span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                              {item.desc}
                            </p>
                          </div>
                          {isSelected && (
                            <span className="w-5 h-5 rounded-full bg-violet-600 text-white flex items-center justify-center shrink-0">
                              <Check className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      H. Système, Paramètres Globaux & Maintenance
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Options globales de l’application, sauvegarde JSON et réinitialisation ciblée.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleExportFullJSON}
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileJson className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                      <span>Exporter Config JSON</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleResetActiveHotelConfig}
                      className="px-3 py-2 rounded-xl border border-amber-200 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-xs font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Réinitialiser {activeHotel.name}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveSystemConfig}
                      className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Enregistrer Système</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Mode Date de Référence</label>
                    <select
                      value={systemConfig.referenceDateMode}
                      onChange={(e) =>
                        setSystemConfig((prev) => ({ ...prev, referenceDateMode: e.target.value as any }))
                      }
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl font-semibold"
                    >
                      <option value="fixed_demo_2026_11_12">Date Référence Métier (12/11/2026)</option>
                      <option value="live_clock">Horloge Temps Réel</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Expiration Session (min)</label>
                    <input
                      type="number"
                      min={15}
                      max={1440}
                      value={systemConfig.sessionTimeoutMinutes}
                      onChange={(e) =>
                        setSystemConfig((prev) => ({ ...prev, sessionTimeoutMinutes: Number(e.target.value) }))
                      }
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl tabular-nums font-bold"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600 dark:text-slate-400">Fuseau : <strong>{systemConfig.timezone}</strong> · Devise : <strong>{systemConfig.currency}</strong></span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  {[
                    { key: 'enableSeasonalFestiveOverlay', label: 'Activer génération multi-annuelle « Périodes saisonnières et fêtes » (Fin d’année, Pâques, Jours fériés)' },
                    { key: 'enableSchoolHolidaysOverlay', label: 'Activer intégration des vacances scolaires officielles (Zones A, B, C)' },
                    { key: 'enablePredictiveScenarios', label: 'Activer les scénarios prédictifs et l’explicabilité RM à 5 niveaux' },
                    { key: 'enforceAuditTrail', label: 'Journaliser systématiquement les modifications de configuration et arbitrages' },
                  ].map((opt) => (
                    <label
                      key={opt.key}
                      className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/80"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(systemConfig[opt.key as keyof SystemAdminConfig])}
                        onChange={(e) =>
                          setSystemConfig((prev) => ({
                            ...prev,
                            [opt.key]: e.target.checked,
                          }))
                        }
                        className="mt-0.5"
                      />
                      <span className="text-slate-800 dark:text-slate-200 font-medium">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Journal d'audit système */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Journal des Opérations & Modifications ({opLogs.length})
                    </h4>
                  </div>
                  {opLogs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setOpLogs(clearSystemOperationLogs());
                        onShowToast?.('Journal d’opérations vidé.');
                      }}
                      className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      Vider l’historique
                    </button>
                  )}
                </div>

                {opLogs.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 border border-slate-200 dark:border-slate-800 rounded-xl">
                    Aucune opération récente enregistrée.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="py-2 px-3">Horodatage</th>
                          <th className="py-2 px-3">Domaine</th>
                          <th className="py-2 px-3">Action</th>
                          <th className="py-2 px-3">Détails</th>
                          <th className="py-2 px-3">Auteur</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                        {opLogs.slice(0, 15).map((log) => (
                          <tr key={log.id}>
                            <td className="py-2 px-3 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap tabular-nums">
                              {log.timestamp}
                            </td>
                            <td className="py-2 px-3">
                              <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold">
                                {log.category}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100">{log.action}</td>
                            <td className="py-2 px-3 text-slate-600 dark:text-slate-400 max-w-md truncate" title={log.details}>
                              {log.details}
                            </td>
                            <td className="py-2 px-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{log.actor}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, CheckCircle2, CircleAlert, Moon, Plug, Plus, RefreshCw, Save, Settings2, Sun, Trash2, Monitor, TrendingUp, CalendarDays, Users, Bell, Database, Download } from 'lucide-react';
import { Hotel } from '../../types';
import { useAuth } from '../../auth/AuthProvider';
import { useTheme, ThemeMode } from '../../contexts/ThemeContext';
import { saveHotelRevenueParameters, updateHotelCoordinates } from '../../services/revenueApiClient';

type DbHotel = {
  id: string; organization_id: string; name: string; city: string; country: string; address: string | null; lat: number | null; lng: number | null; stars: number | null;
  room_count: number | null; currency: string; timezone: string; main_radius_km: number; extended_radius_km: number; rate_floor: number | null;
  rate_ceiling: number | null; max_rate_change_pct: number | null; is_active: boolean;
};
type Competitor = {
  id: string; competitor_name: string; address: string | null; stars: number | null;
  distance_meters: number | null; is_active: boolean;
};

type SettingsTab = 'hotel' | 'revenue' | 'compset' | 'events' | 'integrations' | 'users' | 'alerts' | 'system' | 'appearance';
type SettingsAuditLog = { id: string; action_type: string; entity_type: string; created_at: string; actor_user_id: string; reason_text: string | null; before_state: unknown; after_state: unknown };

interface SettingsViewProps {
  hotels: Hotel[];
  onAddHotel: (hotel: Hotel) => void;
  onDeleteHotel: (id: string) => void;
  selectedHotelId?: string;
  onSelectHotel?: (hotelId: string) => void;
  onShowToast?: (message: string) => void;
  onHotelCoordinatesUpdated?: (hotelId: string, lat: number | null, lng: number | null) => void;
}

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
const labelClass = 'mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300';
const cardClass = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900';

export const SettingsView: React.FC<SettingsViewProps> = ({ selectedHotelId, onSelectHotel, onShowToast, onHotelCoordinatesUpdated }) => {
  const { supabase, user } = useAuth();
  const { themeMode, setThemeMode } = useTheme();
  const [tab, setTab] = useState<SettingsTab>('hotel');
  const [hotels, setHotels] = useState<DbHotel[]>([]);
  const [hotelId, setHotelId] = useState('');
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [memberships, setMemberships] = useState<any[]>([]);
  const [ingestionJobs, setIngestionJobs] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [settingsAuditLogs, setSettingsAuditLogs] = useState<SettingsAuditLog[]>([]);
  const [systemError, setSystemError] = useState<string | null>(null);
  const [hotelProfileForm, setHotelProfileForm] = useState({ name: '', city: '', country: '', address: '', stars: '', roomCount: '' });
  const [profileDemandThresholds, setProfileDemandThresholds] = useState<Record<string, unknown>>({});
  const [profileRoomTypeConfig, setProfileRoomTypeConfig] = useState<any[]>([]);
  const [eventRadiusForm, setEventRadiusForm] = useState({ main: '10', extended: '30' });
  const [savingRadius, setSavingRadius] = useState(false);
  const [alertForm, setAlertForm] = useState({ enabled: false, email: '', dailyDigest: false, majorEventScore: '', pickupAccelerationPct: '' });
  const [savingAlerts, setSavingAlerts] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ currency: 'EUR', timezone: 'Europe/Paris', targetAdr: '', targetOccupancyPct: '', targetRevpar: '', floorRate: '', ceilingRate: '', maxDailyRateChangePct: '', distributionCostPct: '' });
  const [pricingConfigJson, setPricingConfigJson] = useState('');
  const [geoForm, setGeoForm] = useState({ lat: '', lng: '' });
  const [savingGeo, setSavingGeo] = useState(false);
  const [newCompetitor, setNewCompetitor] = useState({ name: '', address: '', stars: '', distanceKm: '' });

  const activeHotel = useMemo(() => hotels.find(h => h.id === hotelId) ?? null, [hotels, hotelId]);

  const load = useCallback(async (preferredHotelId?: string) => {
    if (!supabase) { setError('Connexion Supabase indisponible.'); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const { data: hotelRows, error: hotelError } = await supabase.from('hotels')
        .select('id,organization_id,name,city,country,address,lat,lng,stars,room_count,currency,timezone,main_radius_km,extended_radius_km,rate_floor,rate_ceiling,max_rate_change_pct,is_active')
        .eq('is_active', true).order('name');
      if (hotelError) throw hotelError;
      const rows = (hotelRows ?? []) as DbHotel[];
      setHotels(rows);
      const chosenId = rows.some(h => h.id === preferredHotelId) ? preferredHotelId! : rows.some(h => h.id === selectedHotelId) ? selectedHotelId! : (rows[0]?.id ?? '');
      setHotelId(chosenId);
      const chosenHotel = rows.find(h => h.id === chosenId);
      setGeoForm({ lat: chosenHotel?.lat == null ? '' : String(chosenHotel.lat), lng: chosenHotel?.lng == null ? '' : String(chosenHotel.lng) });
      setEventRadiusForm({ main: String(chosenHotel?.main_radius_km ?? 10), extended: String(chosenHotel?.extended_radius_km ?? 30) });
      if (!chosenId) { setCompetitors([]); setIntegrations([]); return; }
      const [profileResult, competitorResult, integrationResult, roomTypeResult, membershipResult, ingestionResult, auditResult] = await Promise.all([
        supabase.from('hotel_parameters_profiles').select('*').eq('hotel_id', chosenId).maybeSingle(),
        supabase.from('competitor_hotels').select('id,competitor_name,address,stars,distance_meters,is_active').eq('hotel_id', chosenId).order('competitor_name'),
        supabase.from('integration_connections').select('id,provider,connection_name,connection_status,last_success_at,last_error_at,last_error_code').eq('hotel_id', chosenId).order('provider'),
        supabase.from('hotel_room_types').select('id,code,name,capacity,rooms_count,is_active').eq('hotel_id', chosenId).order('code'),
        supabase.from('hotel_memberships').select('id,user_id,membership_role,created_at,users!hotel_memberships_user_id_fkey(email,full_name,role)').eq('hotel_id', chosenId).order('created_at'),
        supabase.from('data_ingestion_jobs').select('*').eq('hotel_id', chosenId).order('created_at', { ascending: false }).limit(20),
        supabase.from('rm_decision_audit_logs').select('*').eq('hotel_id', chosenId).order('created_at', { ascending: false }).limit(20),
      ]);
      if (profileResult.error) throw profileResult.error;
      if (competitorResult.error) throw competitorResult.error;
      if (integrationResult.error) throw integrationResult.error;
      if (roomTypeResult.error) throw roomTypeResult.error;
      const p = profileResult.data;
      const savedDemandThresholds = (p?.demand_thresholds as Record<string, unknown> | null) ?? {};
      setProfileDemandThresholds(savedDemandThresholds);
      setProfileRoomTypeConfig(Array.isArray(p?.room_type_config) ? p.room_type_config : []);
      const savedPricingConfig = (savedDemandThresholds as any).pricing_v1;
      const savedAlerts = (savedDemandThresholds as any).notifications_v1 ?? {};
      setPricingConfigJson(savedPricingConfig ? JSON.stringify(savedPricingConfig, null, 2) : '');
      setAlertForm({
        enabled: savedAlerts.enabled === true,
        email: typeof savedAlerts.email === 'string' ? savedAlerts.email : '',
        dailyDigest: savedAlerts.dailyDigest === true,
        majorEventScore: savedAlerts.majorEventScore == null ? '' : String(savedAlerts.majorEventScore),
        pickupAccelerationPct: savedAlerts.pickupAccelerationPct == null ? '' : String(savedAlerts.pickupAccelerationPct),
      });
      setForm({
        currency: p?.currency ?? rows.find(h => h.id === chosenId)?.currency ?? 'EUR',
        timezone: p?.timezone ?? rows.find(h => h.id === chosenId)?.timezone ?? 'Europe/Paris',
        targetAdr: p?.target_adr == null ? '' : String(p.target_adr),
        targetOccupancyPct: p?.target_occupancy_pct == null ? '' : String(p.target_occupancy_pct),
        targetRevpar: p?.target_revpar == null ? '' : String(p.target_revpar),
        floorRate: p?.floor_rate == null ? (rows.find(h => h.id === chosenId)?.rate_floor == null ? '' : String(rows.find(h => h.id === chosenId)!.rate_floor)) : String(p.floor_rate),
        ceilingRate: p?.ceiling_rate == null ? (rows.find(h => h.id === chosenId)?.rate_ceiling == null ? '' : String(rows.find(h => h.id === chosenId)!.rate_ceiling)) : String(p.ceiling_rate),
        maxDailyRateChangePct: p?.max_daily_rate_change_pct == null ? (rows.find(h => h.id === chosenId)?.max_rate_change_pct == null ? '' : String(rows.find(h => h.id === chosenId)!.max_rate_change_pct)) : String(p.max_daily_rate_change_pct),
        distributionCostPct: p?.distribution_cost_pct == null ? '' : String(p.distribution_cost_pct),
      });
      setCompetitors((competitorResult.data ?? []) as Competitor[]);
      setIntegrations(integrationResult.data ?? []);
      setRoomTypes(roomTypeResult.data ?? []);
      setMemberships(membershipResult.error ? [] : (membershipResult.data ?? []));
      setIngestionJobs(ingestionResult.error ? [] : (ingestionResult.data ?? []));
      setAuditLogs(auditResult.error ? [] : (auditResult.data ?? []));
      const optionalErrors = [membershipResult.error, ingestionResult.error, auditResult.error].filter(Boolean);
      setSystemError(optionalErrors.length ? optionalErrors.map((item: any) => item.message).join(' · ') : null);
    } catch (e: any) {
      setError(e?.message || 'Impossible de charger les paramètres depuis Supabase.');
    } finally { setLoading(false); }
  }, [supabase, selectedHotelId]);

  useEffect(() => { void load(); }, [load]);

  const logSettingsChange = async (
    actionType: string,
    entityType: string,
    beforeState: unknown,
    afterState: unknown,
    entityId?: string,
  ) => {
    if (!supabase || !activeHotel || !user?.id) return false;
    const { error: auditError } = await supabase.from('hotel_settings_audit_logs').insert({
      organization_id: activeHotel.organization_id,
      hotel_id: hotelId,
      actor_user_id: user.id,
      action_type: actionType,
      entity_type: entityType,
      entity_id: entityId ?? null,
      before_state: beforeState,
      after_state: afterState,
    });
    if (auditError) {
      setSystemError('Modification enregistrée, mais journalisation impossible : ' + auditError.message);
      return false;
    }
    return true;
  };

  const saveHotelDetails = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || !activeHotel) return;
    const stars = hotelProfileForm.stars === '' ? null : Number(hotelProfileForm.stars);
    const roomCount = hotelProfileForm.roomCount === '' ? null : Number(hotelProfileForm.roomCount);
    if (!hotelProfileForm.name.trim() || !hotelProfileForm.city.trim() || !hotelProfileForm.country.trim()) {
      setError("Le nom, la ville et le pays de l'hôtel sont obligatoires."); return;
    }
    if (stars !== null && (!Number.isInteger(stars) || stars < 1 || stars > 5)) {
      setError("Le classement doit être compris entre 1 et 5 étoiles."); return;
    }
    if (roomCount !== null && (!Number.isInteger(roomCount) || roomCount < 1 || roomCount > 10000)) {
      setError("Le nombre de chambres doit être un entier compris entre 1 et 10 000."); return;
    }
    const beforeState = { name: activeHotel.name, city: activeHotel.city, country: activeHotel.country, address: activeHotel.address, stars: activeHotel.stars, room_count: activeHotel.room_count };
    const afterState = {
      name: hotelProfileForm.name.trim(), city: hotelProfileForm.city.trim(), country: hotelProfileForm.country.trim(),
      address: hotelProfileForm.address.trim() || null, stars, room_count: roomCount, updated_at: new Date().toISOString(),
    };
    setSaving(true); setError(null);
    try {
      const { error: updateError } = await supabase.from('hotels').update(afterState).eq('id', hotelId).eq('organization_id', activeHotel.organization_id);
      if (updateError) throw updateError;
      await logSettingsChange('hotel_profile_updated', 'hotel', beforeState, afterState);
      onShowToast?.('Fiche établissement enregistrée dans Supabase.');
      await load(hotelId);
    } catch (e: any) { setError(e?.message || "Impossible d'enregistrer la fiche établissement."); }
    finally { setSaving(false); }
  };

  const toggleRoomType = async (roomType: any) => {
    if (!supabase || !activeHotel) return;
    const nextActive = !roomType.is_active;
    const { error: updateError } = await supabase.from('hotel_room_types').update({ is_active: nextActive }).eq('id', roomType.id).eq('hotel_id', hotelId);
    if (updateError) { setError(updateError.message); return; }
    await logSettingsChange('room_type_status_updated', 'room_type', { is_active: roomType.is_active }, { is_active: nextActive }, roomType.id);
    await load(hotelId);
  };

  const saveParameters = async () => {
    if (!supabase || !hotelId) return;
    const floor = form.floorRate === '' ? null : Number(form.floorRate);
    const ceiling = form.ceilingRate === '' ? null : Number(form.ceilingRate);
    const maxChange = form.maxDailyRateChangePct === '' ? null : Number(form.maxDailyRateChangePct);
    if (
      (floor !== null && (!Number.isFinite(floor) || floor <= 0)) ||
      (ceiling !== null && (!Number.isFinite(ceiling) || ceiling <= 0)) ||
      ((floor === null) !== (ceiling === null)) ||
      (floor !== null && ceiling !== null && ceiling < floor) ||
      (maxChange !== null && (!Number.isFinite(maxChange) || maxChange <= 0 || maxChange > 100))
    ) {
      setError('Le plancher et le plafond doivent être renseignés ensemble et cohérents. La variation maximale, si renseignée, doit être comprise entre 0 et 100 %.'); return;
    }
    const demandThresholds: Record<string, unknown> = { ...profileDemandThresholds };
    if (pricingConfigJson.trim()) {
      try {
        const parsed = JSON.parse(pricingConfigJson);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('La configuration pricing_v1 doit être un objet JSON.');
        demandThresholds.pricing_v1 = parsed;
      } catch (parseError) {
        setError(parseError instanceof Error ? parseError.message : 'JSON pricing_v1 invalide.');
        return;
      }
    } else {
      delete demandThresholds.pricing_v1;
    }
    setSaving(true); setError(null);
    try {
      await saveHotelRevenueParameters(supabase, hotelId, {
        currency: form.currency, timezone: form.timezone,
        demandThresholds,
        targetAdr: form.targetAdr === '' ? null : Number(form.targetAdr),
        targetOccupancyPct: form.targetOccupancyPct === '' ? null : Number(form.targetOccupancyPct),
        targetRevpar: form.targetRevpar === '' ? null : Number(form.targetRevpar),
        floorRate: floor, ceilingRate: ceiling, maxDailyRateChangePct: maxChange,
        distributionCostPct: form.distributionCostPct === '' ? null : Number(form.distributionCostPct),
        compsetConfig: competitors.map(c => ({ id: c.id, name: c.competitor_name, active: c.is_active })),
        roomTypeConfig: profileRoomTypeConfig,
      });
      setProfileDemandThresholds(demandThresholds);
      onShowToast?.('Paramètres Revenue Management enregistrés dans Supabase.');
      await load();
    } catch (e: any) { setError(e?.message || 'Échec de sauvegarde des paramètres.'); }
    finally { setSaving(false); }
  };

  const saveCoordinates = async () => {
    if (!supabase || !hotelId) return;
    const latText = geoForm.lat.trim();
    const lngText = geoForm.lng.trim();
    if (Boolean(latText) !== Boolean(lngText)) { setError('Renseignez latitude et longitude ensemble, ou laissez les deux champs vides.'); return; }
    const lat = latText ? Number(latText) : null;
    const lng = lngText ? Number(lngText) : null;
    if (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) { setError('Latitude invalide : la valeur doit être comprise entre -90 et 90.'); return; }
    if (lng !== null && (!Number.isFinite(lng) || lng < -180 || lng > 180)) { setError('Longitude invalide : la valeur doit être comprise entre -180 et 180.'); return; }
    setSavingGeo(true); setError(null);
    try {
      await updateHotelCoordinates(supabase, hotelId, { lat, lng });
      onHotelCoordinatesUpdated?.(hotelId, lat, lng);
      onShowToast?.('Coordonnées GPS enregistrées dans Supabase.');
      await load(hotelId);
    } catch (e: any) {
      setError(e?.message || 'Impossible d’enregistrer les coordonnées GPS.');
    } finally {
      setSavingGeo(false);
    }
  };

  const addCompetitor = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || !activeHotel || !newCompetitor.name.trim()) return;
    if (competitors.filter(c => c.is_active).length >= 10) { setError('Le CompSet est limité à 10 concurrents actifs.'); return; }
    setSaving(true); setError(null);
    try {
      const { data: insertedCompetitor, error: insertError } = await supabase.from('competitor_hotels').insert({
        organization_id: activeHotel.organization_id,
        hotel_id: hotelId, competitor_name: newCompetitor.name.trim(),
        address: newCompetitor.address.trim() || null,
        stars: newCompetitor.stars ? Number(newCompetitor.stars) : null,
        distance_meters: newCompetitor.distanceKm === '' ? null : Math.round(Number(newCompetitor.distanceKm) * 1000),
        is_active: true,
      }).select('id').single();
      if (insertError) throw insertError;
      await logSettingsChange('competitor_added', 'competitor', null, newCompetitor, insertedCompetitor?.id);
      setNewCompetitor({ name: '', address: '', stars: '', distanceKm: '' });
      onShowToast?.('Concurrent ajouté au CompSet de cet hôtel.');
      await load(hotelId);
    } catch (e: any) { setError(e?.message || 'Impossible d’ajouter ce concurrent.'); }
    finally { setSaving(false); }
  };

  const toggleCompetitor = async (competitor: Competitor) => {
    if (!supabase) return;
    if (!competitor.is_active && competitors.filter(c => c.is_active).length >= 10) { setError('Maximum 10 concurrents actifs.'); return; }
    const { error: updateError } = await supabase.from('competitor_hotels').update({ is_active: !competitor.is_active }).eq('id', competitor.id).eq('hotel_id', hotelId);
    if (updateError) setError(updateError.message); else {
      await logSettingsChange('competitor_status_updated', 'competitor', { is_active: competitor.is_active }, { is_active: !competitor.is_active }, competitor.id);
      await load(hotelId);
    }
  };

  const deleteCompetitor = async (id: string) => {
    if (!supabase) return;
    const previous = competitors.find((competitor) => competitor.id === id);
    const { error: deleteError } = await supabase.from('competitor_hotels').delete().eq('id', id).eq('hotel_id', hotelId);
    if (deleteError) setError(deleteError.message); else {
      await logSettingsChange('competitor_deleted', 'competitor', previous ?? null, null, id);
      onShowToast?.('Concurrent supprimé.');
      await load(hotelId);
    }
  };


  const saveEventRadii = async () => {
    if (!supabase || !hotelId) return;
    const main = Number(eventRadiusForm.main);
    const extended = Number(eventRadiusForm.extended);
    if (!Number.isFinite(main) || main <= 0 || main > 100 || !Number.isFinite(extended) || extended < main || extended > 200) {
      setError('Le rayon principal doit être compris entre 0 et 100 km ; le rayon étendu doit être supérieur ou égal au rayon principal et inférieur ou égal à 200 km.');
      return;
    }
    setSavingRadius(true); setError(null);
    try {
      const { error: updateError } = await supabase.from('hotels')
        .update({ main_radius_km: main, extended_radius_km: extended })
        .eq('id', hotelId);
      if (updateError) throw updateError;
      onShowToast?.('Périmètres géographiques enregistrés.');
      await load();
    } catch (e: any) { setError(e?.message || 'Impossible d’enregistrer les périmètres.'); }
    finally { setSavingRadius(false); }
  };

  const saveAlerts = async () => {
    if (!supabase || !hotelId) return;
    const majorEventScore = alertForm.majorEventScore === '' ? null : Number(alertForm.majorEventScore);
    const pickupAccelerationPct = alertForm.pickupAccelerationPct === '' ? null : Number(alertForm.pickupAccelerationPct);
    if (alertForm.email && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(alertForm.email)) {
      setError('Adresse email de notification invalide.'); return;
    }
    if (majorEventScore !== null && (!Number.isFinite(majorEventScore) || majorEventScore < 0 || majorEventScore > 100)) {
      setError('Le seuil événementiel doit être compris entre 0 et 100.'); return;
    }
    if (pickupAccelerationPct !== null && (!Number.isFinite(pickupAccelerationPct) || pickupAccelerationPct < 0 || pickupAccelerationPct > 1000)) {
      setError('Le seuil d’accélération du pickup doit être compris entre 0 et 1 000 %.'); return;
    }
    const nextDemandThresholds = {
      ...profileDemandThresholds,
      notifications_v1: {
        enabled: alertForm.enabled,
        email: alertForm.email.trim() || null,
        dailyDigest: alertForm.dailyDigest,
        majorEventScore,
        pickupAccelerationPct,
      },
    };
    setSavingAlerts(true); setError(null);
    try {
      await saveHotelRevenueParameters(supabase, hotelId, {
        currency: form.currency, timezone: form.timezone,
        targetAdr: form.targetAdr === '' ? null : Number(form.targetAdr),
        targetOccupancyPct: form.targetOccupancyPct === '' ? null : Number(form.targetOccupancyPct),
        targetRevpar: form.targetRevpar === '' ? null : Number(form.targetRevpar),
        floorRate: form.floorRate === '' ? null : Number(form.floorRate),
        ceilingRate: form.ceilingRate === '' ? null : Number(form.ceilingRate),
        maxDailyRateChangePct: form.maxDailyRateChangePct === '' ? null : Number(form.maxDailyRateChangePct),
        distributionCostPct: form.distributionCostPct === '' ? null : Number(form.distributionCostPct),
        compsetConfig: competitors.map(c => ({ id: c.id, name: c.competitor_name, active: c.is_active })),
        roomTypeConfig: profileRoomTypeConfig,
        demandThresholds: nextDemandThresholds,
      });
      setProfileDemandThresholds(nextDemandThresholds);
      onShowToast?.('Préférences d’alertes enregistrées. L’envoi reste conditionné à un connecteur de notification actif.');
      await load();
    } catch (e: any) { setError(e?.message || 'Impossible d’enregistrer les préférences d’alertes.'); }
    finally { setSavingAlerts(false); }
  };

  const exportSystemConfig = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      hotel: activeHotel,
      parameters: {
        ...form,
        demandThresholds: profileDemandThresholds,
        roomTypeConfig: profileRoomTypeConfig,
      },
      competitors,
      integrations,
      roomTypes,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `flowtym-rms-config-${hotelId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'hotel', label: 'Hôtel', icon: <Building2 size={16} /> },
    { id: 'revenue', label: 'Revenue Management', icon: <TrendingUp size={16} /> },
    { id: 'compset', label: 'CompSet', icon: <Settings2 size={16} /> },
    { id: 'events', label: 'Veille & périmètres', icon: <CalendarDays size={16} /> },
    { id: 'integrations', label: 'Intégrations', icon: <Plug size={16} /> },
    { id: 'users', label: 'Utilisateurs & rôles', icon: <Users size={16} /> },
    { id: 'alerts', label: 'Alertes', icon: <Bell size={16} /> },
    { id: 'system', label: 'Système & audit', icon: <Database size={16} /> },
    { id: 'appearance', label: 'Apparence', icon: <Sun size={16} /> },
  ];

  return <div className="space-y-5">
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
      <div><div className="flex items-center gap-2 text-violet-700 dark:text-violet-300"><Settings2 size={20} /><span className="text-xs font-bold uppercase tracking-wider">Configuration Flowtym RMS</span></div><h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Paramètres</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Paramètres persistés et relus depuis la base de données de l’établissement.</p></div>
      <div className="flex flex-wrap items-center gap-2">
         <label className="min-w-56"><span className="sr-only">Établissement actif</span><select value={hotelId} onChange={e => { onSelectHotel?.(e.target.value); void load(e.target.value); }} className={inputClass} disabled={loading || hotels.length <= 1}>
           {hotels.map(hotel => <option key={hotel.id} value={hotel.id}>{hotel.name} · {hotel.city}</option>)}
         </select></label>
         <span className="text-xs text-slate-500 dark:text-slate-400">{user?.email ?? 'Session non identifiée'}</span>
         <button onClick={() => void load(hotelId || undefined)} className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Actualiser"><RefreshCw size={16} /></button>
       </div>
    </div>
    <div className="flex flex-wrap gap-2">{tabs.map(t => <button key={t.id} onClick={() => setTab(t.id)} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${tab === t.id ? 'bg-violet-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'}`}>{t.icon}{t.label}</button>)}</div>
    {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"><CircleAlert size={17} className="mt-0.5 shrink-0" />{error}</div>}
    {loading ? <div className={cardClass}>Chargement des paramètres réels…</div> : !activeHotel ? <div className={cardClass}><p className="font-semibold text-slate-900 dark:text-white">Aucun hôtel accessible dans Supabase.</p><p className="mt-1 text-sm text-slate-500">Vérifiez les droits de votre compte et l’association à un établissement.</p></div> : <>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"><CheckCircle2 size={17} /><span><strong>{activeHotel.name}</strong> · {activeHotel.city}, {activeHotel.country} · {activeHotel.room_count ?? '—'} chambres</span><span className="ml-auto text-xs">Source : Supabase</span></div>
      
      {tab === 'hotel' && <section className={cardClass}>
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Configuration de l’établissement</h2>
        <p className="mb-5 mt-1 text-sm text-slate-500 dark:text-slate-400">Fiche de l’hôtel issue de Supabase. Les modifications sont enregistrées sur l’établissement sélectionné et tracées dans le journal des paramètres.</p>
         <form onSubmit={saveHotelDetails} className="mb-6 grid gap-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-950 sm:grid-cols-2 lg:grid-cols-3">
           <label><span className={labelClass}>Nom de l’établissement *</span><input required className={inputClass} value={hotelProfileForm.name} onChange={e=>setHotelProfileForm(p=>({...p,name:e.target.value}))}/></label>
           <label><span className={labelClass}>Ville *</span><input required className={inputClass} value={hotelProfileForm.city} onChange={e=>setHotelProfileForm(p=>({...p,city:e.target.value}))}/></label>
           <label><span className={labelClass}>Pays *</span><input required className={inputClass} value={hotelProfileForm.country} onChange={e=>setHotelProfileForm(p=>({...p,country:e.target.value}))}/></label>
           <label className="sm:col-span-2"><span className={labelClass}>Adresse</span><input className={inputClass} value={hotelProfileForm.address} onChange={e=>setHotelProfileForm(p=>({...p,address:e.target.value}))}/></label>
           <label><span className={labelClass}>Catégorie (étoiles)</span><select className={inputClass} value={hotelProfileForm.stars} onChange={e=>setHotelProfileForm(p=>({...p,stars:e.target.value}))}><option value="">Non renseignée</option>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n} étoiles</option>)}</select></label>
           <label><span className={labelClass}>Nombre de chambres</span><input type="number" min="1" max="10000" step="1" className={inputClass} value={hotelProfileForm.roomCount} onChange={e=>setHotelProfileForm(p=>({...p,roomCount:e.target.value}))}/></label>
           <div className="flex items-end justify-end sm:col-span-2 lg:col-span-3"><button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Save size={15}/>{saving ? 'Enregistrement…' : 'Enregistrer la fiche hôtel'}</button></div>
         </form>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Nom', activeHotel.name], ['Ville', activeHotel.city], ['Pays', activeHotel.country],
            ['Adresse', activeHotel.address || 'Non renseignée'], ['Catégorie', activeHotel.stars ? `${activeHotel.stars} étoiles` : 'Non renseignée'],
            ['Capacité totale', activeHotel.room_count == null ? 'Non renseignée' : `${activeHotel.room_count} chambres`],
            ['Devise', activeHotel.currency], ['Fuseau horaire', activeHotel.timezone],
            ['Coordonnées GPS', activeHotel.lat == null || activeHotel.lng == null ? 'Non renseignées' : `${activeHotel.lat}, ${activeHotel.lng}`],
          ].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
            <p className={labelClass}>{label}</p><p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</p>
          </div>)}
        </div>
        <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-700">
          <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold text-slate-900 dark:text-white">Typologies de chambres</h3><span className="text-xs text-slate-500">{roomTypes.length} typologie(s) enregistrée(s)</span></div>
          {roomTypes.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-500 dark:border-slate-700">Aucune typologie importée. Les catégories seront créées à partir d’un import PMS validé.</p> :
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{roomTypes.map((room: any) => <div key={room.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700"><div className="min-w-0 flex-1"><p className="font-semibold text-slate-900 dark:text-white">{room.name}</p><p className="mt-1 text-xs text-slate-500">{room.code} · {room.rooms_count == null ? 'Capacité non renseignée' : `${room.rooms_count} chambres`}</p></div><button type="button" onClick={()=>void toggleRoomType(room)} className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${room.is_active?'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200':'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{room.is_active?'Active':'Inactive'}</button></div>)}</div>}
        </div>
      </section>}

      {tab === 'revenue' && <section className={cardClass}><h2 className="text-base font-bold text-slate-900 dark:text-white">Paramètres opérationnels et garde-fous tarifaires</h2><p className="mb-5 mt-1 text-sm text-slate-500 dark:text-slate-400">Les champs vides restent non renseignés. Le plancher et le plafond sont facultatifs, mais doivent être saisis ensemble. Aucun seuil n’est inventé.</p><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ['Devise','currency',form.currency],['Fuseau horaire','timezone',form.timezone],
          ['ADR cible (€)','targetAdr',form.targetAdr],['Occupation cible (%)','targetOccupancyPct',form.targetOccupancyPct],
          ['RevPAR cible (€)','targetRevpar',form.targetRevpar],['Tarif plancher (€)','floorRate',form.floorRate],
          ['Tarif plafond (€)','ceilingRate',form.ceilingRate],['Variation max / jour (%)','maxDailyRateChangePct',form.maxDailyRateChangePct],
          ['Coût de distribution (%)','distributionCostPct',form.distributionCostPct],
        ].map(([label,key,value]) => <label key={key as string}><span className={labelClass}>{label}</span><input className={inputClass} value={value as string} onChange={e => setForm(prev => ({...prev,[key as string]:e.target.value}))} /></label>)}
      </div>
      <div className="mt-5 border-t border-slate-200 pt-5 dark:border-slate-700">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Localisation de l’établissement</h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Coordonnées GPS de la fiche hôtel Supabase. Sans ces deux valeurs, les distances et l’éligibilité des événements géographiques restent bloquées.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label><span className={labelClass}>Latitude</span><input className={inputClass} inputMode="decimal" placeholder="Ex. 48.87…" value={geoForm.lat} onChange={e => setGeoForm(prev => ({ ...prev, lat: e.target.value }))} /></label>
          <label><span className={labelClass}>Longitude</span><input className={inputClass} inputMode="decimal" placeholder="Ex. 2.32…" value={geoForm.lng} onChange={e => setGeoForm(prev => ({ ...prev, lng: e.target.value }))} /></label>
        </div>
        <div className="mt-3 flex justify-end"><button type="button" disabled={savingGeo} onClick={() => void saveCoordinates()} className="rounded-xl border border-violet-200 px-4 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-50 dark:border-violet-900 dark:text-violet-300 dark:hover:bg-violet-950/40">{savingGeo ? 'Enregistrement…' : 'Enregistrer les coordonnées'}</button></div>
      </div>
      <div className="mt-5 border-t border-slate-200 pt-5 dark:border-slate-700">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Configuration du moteur pricing_v1</h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Aucune pondération, aucun seuil ni ajustement n'est prérempli. Saisissez uniquement une configuration validée par votre Revenue Manager. Les valeurs sont enregistrées dans demand_thresholds.pricing_v1 et le moteur refusera toute configuration incomplète.</p>
        <textarea
          className={inputClass + ' mt-3 min-h-64 font-mono text-xs'}
          value={pricingConfigJson}
          onChange={e => setPricingConfigJson(e.target.value)}
          spellCheck={false}
          placeholder={`{
  "weights": { "occupancy": null, "pickup": null, "event": null, "compset": null },
  "thresholds": { "normal": null, "high": null, "exceptional": null },
  "rate_adjustments_pct": { "low": null, "normal": null, "high": null, "exceptional": null },
  "max_observation_age_hours": null,
  "max_inventory_age_hours": null,
  "max_pickup_snapshot_age_hours": null,
  "minimum_sources": null,
  "minimum_weight_coverage_pct": null,
  "pickup_window_weights": { "24h": null, "3d": null, "7d": null },
  "pickup_scale_rooms": { "24h": null, "3d": null, "7d": null },
  "compset_los": null,
  "compset_pos": null,
  "minimum_compset_hotels": null,
  "compset_gap_scale_pct": null,
  "compset_room_type": null,
  "compset_rate_plan": null,
  "compset_channel": null
}`}
        />
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Laissez ce champ vide tant que les règles ne sont pas approuvées : les recommandations tarifaires resteront bloquées, sans valeur par défaut inventée.</p>
      </div>
      <div className="mt-5 flex justify-end"><button disabled={saving} onClick={() => void saveParameters()} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"><Save size={16} />{saving ? 'Enregistrement…' : 'Enregistrer dans Supabase'}</button></div></section>}
      {tab === 'compset' && <section className={cardClass}><div className="mb-4 flex items-center justify-between"><div><h2 className="font-bold text-slate-900 dark:text-white">CompSet concurrentiel</h2><p className="text-sm text-slate-500 dark:text-slate-400">{competitors.filter(c => c.is_active).length} / 10 concurrents actifs · enregistrement réel dans competitor_hotels</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{competitors.length} enregistré(s)</span></div>
        <form onSubmit={addCompetitor} className="mb-5 grid gap-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-950 sm:grid-cols-2 lg:grid-cols-4"><label><span className={labelClass}>Nom de l’hôtel concurrent *</span><input required className={inputClass} value={newCompetitor.name} onChange={e => setNewCompetitor(p=>({...p,name:e.target.value}))} placeholder="Nom exact" /></label><label><span className={labelClass}>Adresse</span><input className={inputClass} value={newCompetitor.address} onChange={e => setNewCompetitor(p=>({...p,address:e.target.value}))} placeholder="Adresse vérifiée" /></label><label><span className={labelClass}>Étoiles</span><select className={inputClass} value={newCompetitor.stars} onChange={e=>setNewCompetitor(p=>({...p,stars:e.target.value}))}><option value="">Non renseigné</option>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n}★</option>)}</select></label><label><span className={labelClass}>Distance (km)</span><input type="number" min="0" step="0.1" className={inputClass} value={newCompetitor.distanceKm} onChange={e=>setNewCompetitor(p=>({...p,distanceKm:e.target.value}))} placeholder="Non renseignée" /></label><div className="sm:col-span-2 lg:col-span-4"><button disabled={saving || competitors.filter(c=>c.is_active).length>=10} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Plus size={16}/>Ajouter au CompSet</button></div></form>
        {competitors.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">Aucun concurrent enregistré. Les noms de démonstration ne sont pas injectés automatiquement.</p> : <div className="divide-y divide-slate-100 dark:divide-slate-800">{competitors.map(c=><div key={c.id} className="flex flex-wrap items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="font-semibold text-slate-900 dark:text-white">{c.competitor_name}</p><p className="text-xs text-slate-500">{c.address || 'Adresse non renseignée'} · {c.stars ? `${c.stars}★` : 'Catégorie inconnue'} · {c.distance_meters == null ? 'Distance inconnue' : `${(c.distance_meters/1000).toFixed(1)} km`}</p></div><button onClick={()=>void toggleCompetitor(c)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${c.is_active?'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200':'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{c.is_active?'Actif':'Inactif'}</button><button onClick={()=>void deleteCompetitor(c.id)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40" aria-label={`Supprimer ${c.competitor_name}`}><Trash2 size={16}/></button></div>)}</div>}
      </section>}
      
      {tab === 'events' && <section className={cardClass}>
        <h2 className="font-bold text-slate-900 dark:text-white">Veille événementielle & périmètres géographiques</h2>
        <p className="mb-5 mt-1 text-sm text-slate-500 dark:text-slate-400">Les rayons sont enregistrés sur la fiche hôtel. La géolocalisation des événements reste indisponible tant que les coordonnées GPS de l’établissement ne sont pas définies.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label><span className={labelClass}>Rayon principal (km)</span><input type="number" min="1" max="100" step="1" className={inputClass} value={eventRadiusForm.main} onChange={e=>setEventRadiusForm(p=>({...p,main:e.target.value}))}/></label>
          <label><span className={labelClass}>Rayon étendu (km)</span><input type="number" min="1" max="200" step="1" className={inputClass} value={eventRadiusForm.extended} onChange={e=>setEventRadiusForm(p=>({...p,extended:e.target.value}))}/></label>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-950">
          <span className="text-slate-600 dark:text-slate-300">Coordonnées : {activeHotel.lat == null || activeHotel.lng == null ? 'non renseignées' : `${activeHotel.lat}, ${activeHotel.lng}`}</span>
          <span className={activeHotel.lat == null || activeHotel.lng == null ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}>{activeHotel.lat == null || activeHotel.lng == null ? 'Géolocalisation bloquée' : 'Localisation disponible'}</span>
        </div>
        <div className="mt-4 flex justify-end"><button disabled={savingRadius} onClick={()=>void saveEventRadii()} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{savingRadius ? 'Enregistrement…' : 'Enregistrer les périmètres'}</button></div>
      </section>}
      {tab === 'users' && <section className={cardClass}>
        <h2 className="font-bold text-slate-900 dark:text-white">Utilisateurs & permissions de l’établissement</h2>
        <p className="mb-4 mt-1 text-sm text-slate-500 dark:text-slate-400">Liste issue de hotel_memberships et users. Les rôles globaux et les rôles d’établissement sont affichés séparément.</p>
        {memberships.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">Aucun membre rattaché à cet établissement ou accès à la liste indisponible.</p> :
          <div className="divide-y divide-slate-100 dark:divide-slate-800">{memberships.map((membership: any) => {
            const profile = Array.isArray(membership.users) ? membership.users[0] : membership.users;
            return <div key={membership.id} className="flex flex-wrap items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="font-semibold text-slate-900 dark:text-white">{profile?.full_name || profile?.email || membership.user_id}</p><p className="text-xs text-slate-500">{profile?.email || 'Email non disponible'}</p></div><span className="rounded-lg bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-800 dark:bg-violet-950/40 dark:text-violet-200">Établissement : {membership.membership_role}</span><span className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">Global : {profile?.role || 'Non renseigné'}</span></div>;
          })}</div>}
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Les invitations et changements de rôle ne sont pas exposés depuis le navigateur : ils nécessitent une route serveur d’administration avec contrôle RBAC et journalisation. Aucun bouton d’administration non sécurisé n’est proposé.</p>
        {systemError && <p className="mt-2 text-xs text-rose-600 dark:text-rose-300">{systemError}</p>}
      </section>}
      {tab === 'alerts' && <section className={cardClass}>
        <h2 className="font-bold text-slate-900 dark:text-white">Préférences d’alertes</h2>
        <p className="mb-5 mt-1 text-sm text-slate-500 dark:text-slate-400">Les préférences sont persistées dans demand_thresholds.notifications_v1. Leur envoi effectif nécessite encore un fournisseur email et un ordonnanceur actifs.</p>
        <div className="space-y-4">
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700"><input type="checkbox" checked={alertForm.enabled} onChange={e=>setAlertForm(p=>({...p,enabled:e.target.checked}))}/><span className="text-sm font-semibold text-slate-900 dark:text-white">Activer les préférences d’alerte</span></label>
          <label><span className={labelClass}>Adresse email destinataire</span><input type="email" className={inputClass} value={alertForm.email} onChange={e=>setAlertForm(p=>({...p,email:e.target.value}))} placeholder="Adresse non renseignée"/></label>
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700"><input type="checkbox" checked={alertForm.dailyDigest} onChange={e=>setAlertForm(p=>({...p,dailyDigest:e.target.checked}))}/><span className="text-sm font-semibold text-slate-900 dark:text-white">Recevoir un récapitulatif quotidien (préférence)</span></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label><span className={labelClass}>Seuil événement majeur (score / 100)</span><input type="number" min="0" max="100" className={inputClass} value={alertForm.majorEventScore} onChange={e=>setAlertForm(p=>({...p,majorEventScore:e.target.value}))} placeholder="Non configuré"/></label>
            <label><span className={labelClass}>Accélération pickup (%)</span><input type="number" min="0" max="1000" className={inputClass} value={alertForm.pickupAccelerationPct} onChange={e=>setAlertForm(p=>({...p,pickupAccelerationPct:e.target.value}))} placeholder="Non configurée"/></label>
          </div>
        </div>
        <div className="mt-5 flex justify-end"><button disabled={savingAlerts} onClick={()=>void saveAlerts()} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{savingAlerts ? 'Enregistrement…' : 'Enregistrer les préférences'}</button></div>
      </section>}
      {tab === 'system' && <section className={cardClass}>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-slate-900 dark:text-white">Système, imports & journal d’audit</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Données issues des tables d’ingestion et d’audit, sans journal de démonstration.</p></div><button onClick={exportSystemConfig} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><Download size={15}/>Exporter la configuration JSON</button></div>
        {systemError && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">{systemError}</p>}
        <div className="mt-5"><h3 className="mb-2 text-sm font-bold text-slate-900 dark:text-white">Historique des imports ({ingestionJobs.length})</h3>{ingestionJobs.length===0?<p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700">Aucun job d’ingestion enregistré.</p>:<div className="divide-y divide-slate-100 dark:divide-slate-800">{ingestionJobs.map((job:any)=><div key={job.id} className="flex flex-wrap items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-900 dark:text-white">{job.source_system} · {job.job_type}</p><p className="text-xs text-slate-500">{job.created_at ? new Date(job.created_at).toLocaleString('fr-FR') : 'Date inconnue'} · lus {job.records_read} · écrits {job.records_written} · rejetés {job.records_rejected}</p>{job.error_summary && <p className="mt-1 text-xs text-rose-600 dark:text-rose-300">{job.error_summary}</p>}</div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{job.status}</span></div>)}</div>}</div>
         <div className="mt-6"><h3 className="mb-2 text-sm font-bold text-slate-900 dark:text-white">Historique des paramètres ({settingsAuditLogs.length})</h3>
           {settingsAuditLogs.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700">Aucune modification de paramètre journalisée pour cet établissement.</p> : <div className="divide-y divide-slate-100 dark:divide-slate-800">{settingsAuditLogs.map(log => <div key={log.id} className="py-3"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-slate-900 dark:text-white">{log.action_type}</p><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">{log.entity_type}</span></div><p className="mt-1 text-xs text-slate-500">{new Date(log.created_at).toLocaleString('fr-FR')} · {log.actor_user_id}</p>{log.reason_text && <p className="mt-1 text-xs text-slate-500">{log.reason_text}</p>}<details className="mt-2 text-xs text-slate-500"><summary className="cursor-pointer">Voir avant / après</summary><div className="mt-2 grid gap-2 sm:grid-cols-2"><pre className="overflow-auto rounded-lg bg-slate-50 p-2 dark:bg-slate-950">{JSON.stringify(log.before_state,null,2)}</pre><pre className="overflow-auto rounded-lg bg-slate-50 p-2 dark:bg-slate-950">{JSON.stringify(log.after_state,null,2)}</pre></div></details></div>)}</div>}
         </div>
        <div className="mt-6"><h3 className="mb-2 text-sm font-bold text-slate-900 dark:text-white">Décisions Revenue Management ({auditLogs.length})</h3>{auditLogs.length===0?<p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700">Aucune décision auditée.</p>:<div className="divide-y divide-slate-100 dark:divide-slate-800">{auditLogs.map((log:any)=><div key={log.id} className="py-3"><p className="text-sm font-semibold text-slate-900 dark:text-white">{log.action_type || log.action || log.event_type || 'Décision enregistrée'}</p><p className="text-xs text-slate-500">{log.created_at ? new Date(log.created_at).toLocaleString('fr-FR') : 'Date inconnue'} · {log.stay_date || 'Date de séjour non précisée'} · {log.actor_user_id || 'Acteur non renseigné'}</p><p className="mt-1 text-xs text-slate-500">{log.reason_text || log.reason_code || ''}</p></div>)}</div>}</div>
      </section>}

      {tab === 'integrations' && <section className={cardClass}><h2 className="font-bold text-slate-900 dark:text-white">Connecteurs et disponibilité des données</h2><p className="mb-4 mt-1 text-sm text-slate-500 dark:text-slate-400">État lu dans integration_connections. Aucun connecteur n’est déclaré actif sans preuve en base.</p>{integrations.length===0?<p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">Aucune intégration configurée pour cet hôtel.</p>:<div className="divide-y divide-slate-100 dark:divide-slate-800">{integrations.map((i:any)=><div key={i.id} className="flex flex-wrap items-center gap-3 py-3"><Plug size={17} className="text-slate-400"/><div className="min-w-0 flex-1"><p className="font-semibold text-slate-900 dark:text-white">{i.connection_name} · {i.provider}</p><p className="text-xs text-slate-500">Dernier succès : {i.last_success_at ? new Date(i.last_success_at).toLocaleString('fr-FR') : 'Jamais'}{i.last_error_code ? ` · Erreur : ${i.last_error_code}` : ''}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{i.connection_status}</span></div>)}</div>}</section>}
      {tab === 'appearance' && <section className={cardClass}><h2 className="font-bold text-slate-900 dark:text-white">Confort d’affichage</h2><p className="mb-5 mt-1 text-sm text-slate-500 dark:text-slate-400">Préférence d’affichage locale à cet appareil.</p><div className="grid gap-3 sm:grid-cols-3">{([{id:'light',label:'Clair',icon:<Sun size={20}/>},{id:'dark',label:'Sombre',icon:<Moon size={20}/>},{id:'system',label:'Système',icon:<Monitor size={20}/>} ] as {id:ThemeMode;label:string;icon:React.ReactNode}[]).map(m=><button key={m.id} onClick={()=>setThemeMode(m.id)} className={`flex items-center gap-3 rounded-xl border p-4 text-sm font-semibold ${themeMode===m.id?'border-violet-500 bg-violet-50 text-violet-800 dark:bg-violet-950/30 dark:text-violet-200':'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'}`}>{m.icon}{m.label}{themeMode===m.id&&<CheckCircle2 size={16} className="ml-auto"/>}</button>)}</div></section>}
    </>}
  </div>;
};

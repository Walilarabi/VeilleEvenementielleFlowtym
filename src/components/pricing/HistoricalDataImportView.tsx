/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * FLOWTYM REVENUE — INTERFACE D'IMPORTATION DES DONNÉES HISTORIQUES (SECTION 2 & 3)
 * Modèle Excel officiel téléchargeable (3 onglets, A à BZ)
 * Prévisualisation, contrôle des formats, détection des incohérences, rapport d'erreurs ligne par ligne
 * Historisation des imports et persistance multi-tenant.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { resolveAccessibleRmsHotel } from '../../services/lighthouseImportService';
import { importHotelHistoricalRows } from '../../services/revenueApiClient';
import {
  FileSpreadsheet,
  Upload,
  Download,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  Database,
  Building,
  RefreshCw,
  Info,
  Check,
  FileCheck,
  TrendingUp,
} from 'lucide-react';
import { Hotel } from '../../types';
import {
  generateOfficialFlowtymHistoricalWorkbook,
  parseAndValidateHistoricalExcel,
  OFFICIAL_DAILY_COLUMNS,
} from '../../services/historicalDataService';
import { HistoricalDailyRecord, HistoricalDemandSnapshot, HistoricalImportLog } from '../../types/historicalData';

interface HistoricalDataImportViewProps {
  hotel: Hotel;
  onShowToast: (msg: string) => void;
  onDataImported?: () => void;
}

export const HistoricalDataImportView: React.FC<HistoricalDataImportViewProps> = ({
  hotel,
  onShowToast,
  onDataImported,
}) => {
  const [activeTab, setActiveTab] = useState<'import' | 'history' | 'dictionary'>('import');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { supabase } = useAuth();
  const [databaseHotelId, setDatabaseHotelId] = useState<string | null>(null);
  const [currentHistory, setCurrentHistory] = useState<HistoricalDailyRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);

  const [previewData, setPreviewData] = useState<{
    fileName: string;
    fileSizeKb: number;
    fileSizeBytes: number;
    records: HistoricalDailyRecord[];
    snapshots: HistoricalDemandSnapshot[];
    log: HistoricalImportLog;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadDatabaseHistory = async () => {
      setIsLoadingHistory(true);
      setDatabaseHotelId(null);

      if (!supabase) {
        if (!cancelled) {
          setPersistenceError('Session Supabase indisponible. Les données historiques ne peuvent pas être chargées.');
          setIsLoadingHistory(false);
        }
        return;
      }

      try {
        const dbHotel = await resolveAccessibleRmsHotel(supabase, {
          name: hotel.name,
          city: hotel.city,
          country: hotel.country,
        });
        const { data, error } = await supabase
          .from('hotel_historical_daily')
          .select('id,stay_date,raw_record')
          .eq('hotel_id', dbHotel.id)
          .order('stay_date', { ascending: true })
          .limit(5000);
        if (error) throw new Error(`Lecture de l'historique Supabase impossible : ${error.message}`);

        const restored = (data ?? []).flatMap((row: any) => {
          const rawRecord = row.raw_record;
          if (!rawRecord || typeof rawRecord !== 'object' || typeof rawRecord.dateStr !== 'string') return [];
          return [{
            ...rawRecord,
            id: row.id,
            hotelId: dbHotel.id,
            dateStr: row.stay_date,
          } as HistoricalDailyRecord];
        });

        if (!cancelled) {
          setDatabaseHotelId(dbHotel.id);
          setCurrentHistory(restored);
          setPersistenceError(
            restored.length < (data?.length ?? 0)
              ? 'Certaines lignes historiques anciennes ne contiennent pas leur enregistrement source complet ; elles sont masquées plutôt que reconstituées artificiellement.'
              : null,
          );
        }
      } catch (error) {
        if (!cancelled) {
          setPersistenceError(error instanceof Error ? error.message : 'Impossible de charger les données historiques.');
        }
      } finally {
        if (!cancelled) setIsLoadingHistory(false);
      }
    };

    void loadDatabaseHistory();
    return () => { cancelled = true; };
  }, [supabase, hotel.name, hotel.city, hotel.country]);

  // Téléchargement du Modèle Officiel FLOWTYM à 3 onglets
  const handleDownloadOfficialTemplate = () => {
    try {
      const u8array = generateOfficialFlowtymHistoricalWorkbook();
      const blob = new Blob([u8array.buffer as ArrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `flowtym_modele_historique_${hotel.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_3ans.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      onShowToast('✓ Modèle Excel officiel FLOWTYM (3 onglets, A à BZ) téléchargé avec succès');
    } catch (err) {
      console.error(err);
      onShowToast('Erreur lors du téléchargement du modèle');
    }
  };

  // Traitement du fichier déposé
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      onShowToast('Veuillez sélectionner un fichier Excel (.xlsx ou .xls)');
      return;
    }
    if (!databaseHotelId) {
      onShowToast('Hôtel Supabase non résolu : import désactivé pour éviter une écriture sur un identifiant fictif.');
      return;
    }

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        const result = parseAndValidateHistoricalExcel(buffer, file.name, databaseHotelId);

        setPreviewData({
          fileName: file.name,
          fileSizeKb: Math.round(file.size / 1024),
          fileSizeBytes: file.size,
          records: result.records,
          snapshots: result.snapshots,
          log: result.log,
        });

        if (result.isValid) {
          onShowToast(`✓ Fichier "${file.name}" pré-analysé : ${result.records.length} dates et ${result.snapshots.length} snapshots OTB`);
        } else {
          onShowToast(`Attention : des anomalies ont été détectées dans "${file.name}"`);
        }
      } catch (err) {
        console.error(err);
        onShowToast(err instanceof Error ? err.message : 'Erreur lors de la lecture du fichier Excel');
      } finally {
        setIsProcessing(false);
      }
    };
    reader.onerror = () => {
      setIsProcessing(false);
      onShowToast('Erreur lors de la lecture du fichier Excel');
    };
    reader.readAsArrayBuffer(file);
  };

  // Confirmation : les lignes quotidiennes et snapshots OTB sont enregistrés via l'API Revenue protégée par JWT.
  const handleConfirmInjection = async () => {
    if (!previewData) return;
    if (!supabase || !databaseHotelId) {
      onShowToast('Import bloqué : session ou hôtel Supabase non vérifié.');
      return;
    }
    if (previewData.log.errorsCount > 0 || previewData.records.length === 0) {
      onShowToast("Import bloqué : corrigez les erreurs du fichier avant confirmation.");
      return;
    }

    setIsProcessing(true);
    try {
      const dbHotel = await resolveAccessibleRmsHotel(supabase, {
        name: hotel.name,
        city: hotel.city,
        country: hotel.country,
      });
      if (dbHotel.id !== databaseHotelId) {
        throw new Error("L'hôtel sélectionné a changé. Rechargez l'écran avant de relancer l'import.");
      }

      const rows = previewData.records.map((record) => {
        const date = new Date(`${record.dateStr}T12:00:00Z`);
        return {
          stay_date: record.dateStr,
          day_of_week: date.getUTCDay(),
          week_of_year: record.weekOfYear,
          month_of_year: record.month,
          year_of_stay: record.year,
          is_holiday: record.isHoliday,
          is_school_holiday: record.isSchoolHoliday,
          school_holiday_zone: record.schoolHolidayZone || null,
          season: record.season,
          day_type: record.dayType,
          event_name: record.eventName || null,
          event_category: record.eventCategory || null,
          event_start_date: record.eventStartDate || null,
          event_end_date: record.eventEndDate || null,
          event_visitors: record.eventEstimatedVisitors ?? null,
          event_distance_km: record.eventDistanceKm ?? null,
          total_marketable_rooms: record.totalMarketableRooms,
          available_rooms: record.availableRoomsForSale,
          rooms_sold: record.roomsSold,
          complimentary_rooms: record.complimentaryRooms,
          out_of_order_rooms: record.outOfOrderRooms,
          occupancy_pct: record.occupancyPercent,
          reservations_count: record.reservationsCount,
          guests_count: record.guestsCount,
          adr_net: record.adrNetEur,
          revpar: record.revparEur,
          accommodation_revenue: record.accommodationRevenueEur,
          total_revenue: record.totalHotelRevenueEur ?? null,
          distribution_cost: record.avgDistributionCostEur ?? null,
          commission_pct: record.avgCommissionPercent ?? null,
          net_adr: record.avgNetRateAfterCommissionsEur,
          otb_j90: record.otbJ90 ?? null,
          otb_j60: record.otbJ60 ?? null,
          otb_j30: record.otbJ30 ?? null,
          otb_j14: record.otbJ14 ?? null,
          otb_j7: record.otbJ7 ?? null,
          otb_j3: record.otbJ3 ?? null,
          otb_j1: record.otbJ1 ?? null,
          pickup_j90_j60: record.pickupJ90toJ60 ?? null,
          pickup_j60_j30: record.pickupJ60toJ30 ?? null,
          pickup_j30_j14: record.pickupJ30toJ14 ?? null,
          pickup_j14_j7: record.pickupJ14toJ7 ?? null,
          pickup_j7_j3: record.pickupJ7toJ3 ?? null,
          pickup_j3_j1: record.pickupJ3toJ1 ?? null,
          pickup_j1_arrival: record.pickupJ1toArrival ?? null,
          lead_time_days: record.avgLeadTimeDays ?? null,
          cancellations_count: record.cancellationsCount ?? null,
          cancellation_rate_pct: record.cancellationRatePercent ?? null,
          direct_reservations: record.directReservations ?? null,
          booking_reservations: record.bookingReservations ?? null,
          expedia_reservations: record.expediaReservations ?? null,
          gds_reservations: record.gdsReservations ?? null,
          group_reservations: record.groupReservations ?? null,
          corporate_reservations: record.corporateReservations ?? null,
          other_ota_reservations: record.otherOtaReservations ?? null,
          public_bar: record.publicBarEur ?? null,
          compset_avg: record.compsetAvgEur ?? null,
          compset_min: record.compsetMinEur ?? null,
          compset_max: record.compsetMaxEur ?? null,
          rate_position_index: record.ratePositionIndex ?? null,
          currency: dbHotel.currency,
          raw_record: { ...record, hotelId: dbHotel.id },
        };
      });

      const snapshots = previewData.snapshots.map((snapshot) => ({
        observation_date: snapshot.observationDate,
        arrival_date: snapshot.arrivalDate,
        days_before_arrival: snapshot.daysBeforeArrival,
        rooms_booked_otb: snapshot.roomsBookedOtb,
        rooms_available: snapshot.roomsAvailable,
        projected_occupancy_pct: snapshot.projectedOccupancyPercent,
        booked_adr: snapshot.bookedAdrEur ?? null,
        booked_revenue: snapshot.bookedRevenueEur ?? null,
        pickup_since_previous: snapshot.pickupSincePrevSnapshot ?? null,
        cancellations_since_previous: snapshot.cancellationsSincePrevSnapshot ?? null,
        public_rate: snapshot.publicRateAtSnapshotEur ?? null,
        compset_rate: snapshot.compsetRateAtSnapshotEur ?? null,
      }));

      const imported = await importHotelHistoricalRows(supabase, databaseHotelId, {
        fileName: previewData.fileName,
        fileSizeBytes: previewData.fileSizeBytes,
        sourceName: `flowtym-excel:${previewData.fileName}`,
        detectedColumns: previewData.log.detectedColumns,
        rows,
        snapshots,
      });

      const { data, error } = await supabase
        .from('hotel_historical_daily')
        .select('id,stay_date,raw_record')
        .eq('hotel_id', databaseHotelId)
        .order('stay_date', { ascending: true })
        .limit(5000);
      if (error) throw new Error(`Import enregistré, mais rechargement de l'historique impossible : ${error.message}`);

      const restored = (data ?? []).flatMap((row: any) => {
        const rawRecord = row.raw_record;
        if (!rawRecord || typeof rawRecord !== 'object' || typeof rawRecord.dateStr !== 'string') return [];
        return [{ ...rawRecord, id: row.id, hotelId: databaseHotelId, dateStr: row.stay_date } as HistoricalDailyRecord];
      });
      setCurrentHistory(restored);
      setPreviewData(null);
      setPersistenceError(null);
      onShowToast(`✓ ${imported.imported} journées et ${imported.snapshotsImported} snapshots OTB enregistrés dans Supabase pour ${hotel.name}.`);
      if (onDataImported) onDataImported();
    } catch (error) {
      console.error(error);
      onShowToast(`Échec de l'import historique : ${error instanceof Error ? error.message : 'erreur inconnue'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {isLoadingHistory && (
        <div role="status" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          Chargement de l'historique réel depuis Supabase…
        </div>
      )}
      {persistenceError && (
        <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <strong>Données historiques :</strong> {persistenceError}
        </div>
      )}
      {/* 1. Header & Navigation des sous-onglets */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-violet-100 text-violet-700">
                <Database className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                Données Historiques & Apprentissage Prédictif
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Importez l’historique certifié de l’établissement (N-1, N-2, N-3) pour calibrer le moteur de prédiction et de tarification dynamique.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleDownloadOfficialTemplate}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
              title="Télécharger le modèle Excel officiel à 3 onglets (Quotidien A à BZ, Snapshots, Profil)"
            >
              <Download className="w-4 h-4" />
              <span>Modèle Excel Officiel FLOWTYM</span>
            </button>
          </div>
        </div>

        {/* Barre d'onglets internes */}
        <div className="flex items-center gap-2 border-b border-slate-100 pt-2 text-xs font-bold">
          <button
            onClick={() => setActiveTab('import')}
            className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'import'
                ? 'border-violet-600 text-violet-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Importer un Fichier Excel</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'border-violet-600 text-violet-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Historique Enregistré ({currentHistory.length} jours)</span>
          </button>
          <button
            onClick={() => setActiveTab('dictionary')}
            className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'dictionary'
                ? 'border-violet-600 text-violet-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Dictionnaire des Données (78 Colonnes)</span>
          </button>
        </div>
      </div>

      {/* 2. ONGLET : IMPORT & DRAG AND DROP */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          {/* Zone de Drop */}
          <div
            onClick={() => {
              if (!databaseHotelId || isLoadingHistory || isProcessing) {
                onShowToast('Import indisponible tant que l’hôtel réel n’est pas résolu dans Supabase.');
                return;
              }
              fileInputRef.current?.click();
            }}
            className="border-2 border-dashed border-violet-200 hover:border-violet-400 bg-violet-50/40 hover:bg-violet-50/70 transition-all rounded-3xl p-8 text-center cursor-pointer space-y-3 group"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx,.xls"
              className="hidden"
            />
            <div className="w-12 h-12 rounded-2xl bg-violet-100 text-violet-600 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform shadow-xs">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">
                Glissez-déposez votre export historique Excel (.xlsx) ou cliquez pour parcourir
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-lg mx-auto">
                Conforme au modèle officiel FLOWTYM. Analyse automatique des 3 onglets, détection des doublons et recalcul instantané du RevPAR.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold text-violet-700 bg-white px-3 py-1 rounded-full border border-violet-200">
              <Building className="w-3.5 h-3.5" />
              <span>Établissement cible : {hotel.name} (45 chambres)</span>
            </div>
          </div>

          {/* Prévisualisation après analyse du fichier */}
          {previewData && (
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-2xs space-y-5 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-5 h-5 text-emerald-600" />
                    <h3 className="text-base font-bold text-slate-900">
                      Rapport d'Analyse Pré-Import : {previewData.fileName}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Période couverte : <strong>{previewData.log.dateRange}</strong> • Taille : {previewData.fileSizeKb} Ko
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPreviewData(null)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleConfirmInjection}
                    disabled={!previewData.log.recordsCount || previewData.log.errorsCount > 0 || !databaseHotelId || isProcessing}
                    className="px-4 py-2 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition-all shadow-2xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>Confirmer l'Importation ({previewData.records.length} dates)</span>
                  </button>
                </div>
              </div>

              {/* Métriques clés détectées */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Dates Valides</div>
                  <div className="text-xl font-black text-slate-900">{previewData.records.length}</div>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Snapshots OTB</div>
                  <div className="text-xl font-black text-indigo-700">{previewData.log.snapshotsCount}</div>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Colonnes Reconnues</div>
                  <div className="text-xl font-black text-emerald-700">{previewData.log.detectedColumns.length} / 78</div>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Avertissements</div>
                  <div className={`text-xl font-black ${previewData.log.warningsCount > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
                    {previewData.log.warningsCount}
                  </div>
                </div>
              </div>

              {/* Tableau d'erreurs et d'ajustements si existants */}
              {previewData.log.errorsList.length > 0 && (
                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2">
                  <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Contrôles de cohérence et recalculs automatiques ({previewData.log.errorsList.length}) :</span>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1 text-[11px] text-amber-800">
                    {previewData.log.errorsList.slice(0, 8).map((err, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="font-mono font-bold bg-amber-200/60 px-1 rounded">Ligne {err.rowNumber}</span>
                        <span className="font-semibold">{err.column} :</span>
                        <span>{err.message}</span>
                      </div>
                    ))}
                    {previewData.log.errorsList.length > 8 && (
                      <div className="text-[10px] italic text-amber-700">
                        + {previewData.log.errorsList.length - 8} autres lignes vérifiées et corrigées automatiquement.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Aperçu des 5 premières lignes */}
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-2">Jour</th>
                      <th className="py-2.5 px-2 text-center">Événement</th>
                      <th className="py-2.5 px-2 text-center">Occ %</th>
                      <th className="py-2.5 px-2 text-right">Ch. Vendues</th>
                      <th className="py-2.5 px-2 text-right">ADR HT</th>
                      <th className="py-2.5 px-2 text-right">RevPAR HT</th>
                      <th className="py-2.5 px-2 text-right">CA Héberg.</th>
                      <th className="py-2.5 px-2 text-center">Pickup J-7</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewData.records.slice(0, 5).map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3 font-bold text-slate-900">{r.dateStr}</td>
                        <td className="py-2.5 px-2 text-slate-600">{r.dayOfWeek}</td>
                        <td className="py-2.5 px-2 text-center">
                          {r.eventName ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-800">
                              {r.eventName.slice(0, 20)}...
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold text-slate-800">{r.occupancyPercent != null ? `${r.occupancyPercent}%` : '—'}</td>
                        <td className="py-2.5 px-2 text-right">{r.roomsSold} / {r.totalMarketableRooms}</td>
                        <td className="py-2.5 px-2 text-right font-bold text-slate-900">{r.adrNetEur != null ? `${r.adrNetEur} €` : '—'}</td>
                        <td className="py-2.5 px-2 text-right font-black text-emerald-700">{r.revparEur != null ? `${r.revparEur} €` : '—'}</td>
                        <td className="py-2.5 px-2 text-right tabular-nums">{r.accommodationRevenueEur != null ? `${r.accommodationRevenueEur.toLocaleString('fr-FR')} €` : '—'}</td>
                        <td className="py-2.5 px-2 text-center font-semibold text-slate-700">{r.pickupJ14toJ7 ?? 'N/D'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. ONGLET : HISTORIQUE ACTUELLEMENT ENREGISTRÉ */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-violet-600" />
                <span>Base Historique Active ({currentHistory.length} jours enregistrés)</span>
              </h3>
              <p className="text-xs text-slate-500">
                Période couverte : {currentHistory.length > 0 ? `${currentHistory[0].dateStr} — ${currentHistory[currentHistory.length - 1].dateStr}` : 'Aucune donnée'}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-2xl max-h-[500px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-2">Jour</th>
                  <th className="py-3 px-2 text-center">Saison</th>
                  <th className="py-3 px-2 text-center">Événement</th>
                  <th className="py-3 px-2 text-center">Occ %</th>
                  <th className="py-3 px-2 text-right">Ch. Vendues</th>
                  <th className="py-3 px-2 text-right">ADR Net</th>
                  <th className="py-3 px-2 text-right">RevPAR Net</th>
                  <th className="py-3 px-2 text-right">CA Héberg.</th>
                  <th className="py-3 px-2 text-center">Snapshot J-30</th>
                  <th className="py-3 px-2 text-center">Snapshot J-7</th>
                  <th className="py-3 px-2 text-right">Tarif Public</th>
                  <th className="py-3 px-2 text-right">Compset Médian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentHistory.slice(-60).reverse().map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">{r.dateStr}</td>
                    <td className="py-2.5 px-2 text-slate-600">{r.dayOfWeek.slice(0, 3)}</td>
                    <td className="py-2.5 px-2 text-center">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        r.season === 'Haute' ? 'bg-rose-100 text-rose-800' : r.season === 'Moyenne' ? 'bg-amber-100 text-amber-800' : r.season === 'Basse' ? 'bg-slate-100 text-slate-700' : 'bg-slate-50 text-slate-400'
                      }`}>
                        {r.season ?? 'Non renseignée'}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      {r.eventName ? (
                        <span className="text-[10px] font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-md border border-violet-200">
                          {r.eventName.slice(0, 24)}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px]">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-center font-bold text-slate-800">{r.occupancyPercent}%</td>
                    <td className="py-2.5 px-2 text-right">{r.roomsSold} / {r.totalMarketableRooms}</td>
                    <td className="py-2.5 px-2 text-right font-bold text-slate-900">{r.adrNetEur} €</td>
                    <td className="py-2.5 px-2 text-right font-black text-emerald-700">{r.revparEur} €</td>
                    <td className="py-2.5 px-2 text-right tabular-nums">{r.accommodationRevenueEur.toLocaleString('fr-FR')} €</td>
                    <td className="py-2.5 px-2 text-center">{r.otbJ30 ?? '—'}</td>
                    <td className="py-2.5 px-2 text-center">{r.otbJ7 ?? '—'}</td>
                    <td className="py-2.5 px-2 text-right text-slate-700">{r.publicBarEur ? `${r.publicBarEur} €` : '—'}</td>
                    <td className="py-2.5 px-2 text-right font-medium text-indigo-700">{r.compsetAvgEur ? `${r.compsetAvgEur} €` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. ONGLET : DICTIONNAIRE DES DONNÉES (78 COLONNES) */}
      {activeTab === 'dictionary' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-2xs space-y-4">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              <span>Dictionnaire de Données Officiel FLOWTYM (78 Colonnes, A à BZ)</span>
            </h3>
            <p className="text-xs text-slate-500">
              Spécification exhaustive des indicateurs de l'onglet 1 "Historique Quotidien", types de données, contraintes et contrôles de cohérence.
            </p>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">Col.</th>
                  <th className="py-3 px-4">Nom de l'Indicateur</th>
                  <th className="py-3 px-3">Importance</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-4">Valeur Exemple</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {OFFICIAL_DAILY_COLUMNS.map((col) => (
                  <tr key={col.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono font-bold text-violet-700">{col.letter}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-900">{col.name}</td>
                    <td className="py-2.5 px-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        col.importance === 'Obligatoire'
                          ? 'bg-rose-100 text-rose-800'
                          : col.importance === 'Très important'
                          ? 'bg-violet-100 text-violet-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {col.importance}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{col.type}</td>
                    <td className="py-2.5 px-4 font-medium text-slate-700">{String(col.example)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

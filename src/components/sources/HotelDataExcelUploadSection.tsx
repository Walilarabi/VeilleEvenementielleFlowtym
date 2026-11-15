/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  TrendingUp,
  Activity,
  Server,
  FileCheck,
  RefreshCw,
} from 'lucide-react';
import type { Hotel } from '../../types';
import * as XLSX from 'xlsx';
import { useAuth } from '../../auth/AuthProvider';
import { parseLighthouseExcelFile } from '../../services/lighthouseAnalysisEngine';
import type { LighthouseExtractionDataset } from '../../services/lighthouseAnalysisEngine';
import { persistLighthouseExtraction, resolveAccessibleRmsHotel } from '../../services/lighthouseImportService';
import { parsePmsPlanningWorkbook, persistPmsPlanningImport } from '../../services/pmsPlanningImportService';
import type { PmsPlanningImport } from '../../services/pmsPlanningImportService';

export type ExcelSourceType = 'lighthouse' | 'dedge' | 'pms';

export interface UploadedDataRecord {
  id: string;
  sourceType: ExcelSourceType;
  fileName: string;
  uploadedAt: string;
  rowCount: number;
  dateRange: string;
  status: 'synced' | 'pending' | 'running' | 'partial' | 'failed';
  fileSize: string;
  sourceObservedAt?: string;
}

interface HotelDataExcelUploadSectionProps {
  hotel?: Hotel;
  onShowToast?: (msg: string) => void;
  onDataImported?: (sourceType: ExcelSourceType, rowCount: number) => void;
  onNavigateToPricing?: () => void;
}

export const HotelDataExcelUploadSection: React.FC<HotelDataExcelUploadSectionProps> = ({
  hotel,
  onShowToast,
  onDataImported,
  onNavigateToPricing,
}) => {
  const { supabase, user } = useAuth();
  const [selectedChannel, setSelectedChannel] = useState<ExcelSourceType>('lighthouse');
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    size: string;
    rows: any[][];
    headers: string[];
    sourceType: ExcelSourceType;
    rowCount: number;
    previewSummary: string;
    canImport: boolean;
    blockedReason?: string;
    parsedLighthouse?: LighthouseExtractionDataset;
    parsedPms?: PmsPlanningImport;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<{ phase: string; completed: number; total: number } | null>(null);
  const [records, setRecords] = useState<UploadedDataRecord[]>([]);

  const formatFileSize = (bytes: number) => bytes >= 1024 * 1024
    ? (bytes / (1024 * 1024)).toFixed(2) + ' Mo'
    : (bytes / 1024).toFixed(1) + ' Ko';

  const loadHistory = async () => {
    if (!supabase || !hotel) { setRecords([]); return; }
    setIsHistoryLoading(true);
    setHistoryError(null);
    try {
      const dbHotel = await resolveAccessibleRmsHotel(supabase, {
        name: hotel.name, city: hotel.city, country: hotel.country,
      });
      const [extractionsResult, jobsResult] = await Promise.all([
        supabase.from('lighthouse_extractions')
          .select('id,file_name,observed_at,created_at,stay_start,stay_end,records_count,source_status')
          .eq('hotel_id', dbHotel.id).order('observed_at', { ascending: false }).limit(20),
        supabase.from('data_ingestion_jobs')
          .select('id,source_system,status,records_read,records_written,created_at,metadata')
          .eq('hotel_id', dbHotel.id).order('created_at', { ascending: false }).limit(20),
      ]);
      if (extractionsResult.error) throw extractionsResult.error;
      if (jobsResult.error) throw jobsResult.error;
      const lighthouseRecords: UploadedDataRecord[] = (extractionsResult.data ?? []).map((row: any) => ({
        id: row.id,
        sourceType: 'lighthouse',
        fileName: row.file_name || 'Export Lighthouse',
        uploadedAt: row.created_at || row.observed_at || '',
        sourceObservedAt: row.observed_at || undefined,
        rowCount: Number(row.records_count ?? 0),
        dateRange: row.stay_start && row.stay_end ? row.stay_start + ' — ' + row.stay_end : 'Non renseignée',
        status: row.source_status === 'imported' ? 'synced' : 'pending',
        fileSize: '—',
      }));
      const jobRecords: UploadedDataRecord[] = (jobsResult.data ?? [])
        .filter((job: any) => String(job.source_system).toLowerCase() !== 'lighthouse')
        .map((job: any) => {
          const source = String(job.source_system ?? '').toLowerCase();
          const sourceType: ExcelSourceType = source.includes('dedge') ? 'dedge' : 'pms';
          const meta = (job.metadata ?? {}) as Record<string, any>;
          const status: UploadedDataRecord['status'] = job.status === 'completed' ? 'synced'
            : job.status === 'failed' ? 'failed'
            : job.status === 'running' || job.status === 'queued' ? 'running'
            : job.status === 'partial' ? 'partial' : 'pending';
          return {
            id: job.id,
            sourceType,
            fileName: meta.fileName || (sourceType === 'pms' ? 'Import PMS' : 'Import D-EDGE'),
            uploadedAt: job.created_at || '',
            sourceObservedAt: meta.sourceUpdatedAt || undefined,
            rowCount: Number(job.records_written ?? job.records_read ?? 0),
            dateRange: meta.stayStart && meta.stayEnd ? meta.stayStart + ' — ' + meta.stayEnd : 'Non renseignée',
            status,
            fileSize: typeof meta.fileSize === 'string' ? meta.fileSize : '—',
          };
        });
      setRecords([...lighthouseRecords, ...jobRecords]
        .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
        .slice(0, 20));
    } catch (error: any) {
      setHistoryError(error?.message || "Impossible de charger l'historique réel des imports.");
      setRecords([]);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => { void loadHistory(); }, [hotel?.id, supabase, user?.id]);

  const handleDownloadTemplate = (type: ExcelSourceType) => {
    const guidance: Record<ExcelSourceType, string> = {
      lighthouse: "Utilisez l'export natif Lighthouse, avec les onglets Aperçu, Tarifs et les comparaisons vs. Hier / 3 jours / 7 jours. Les fichiers d'exemple synthétiques ont été retirés.",
      dedge: "Le format D-EDGE sera validé à partir du premier export réel de réservations. Aucun modèle fictif n'est proposé.",
      pms: "Utilisez l'export Topsys Planning original, onglet Planning, avec les dates en colonnes et les lignes Left for sale / Price (EUR).",
    };
    onShowToast?.(guidance[type]);
  };

  const handleFileDrop = async (files: FileList | null) => {
    if (!files?.length) return;
    const file = files[0];
    const extension = file.name.toLowerCase().split('.').pop();
    if (!['xlsx', 'xls', 'csv'].includes(extension || '')) {
      setImportError('Veuillez sélectionner un fichier Excel (.xlsx, .xls) ou CSV (.csv).');
      return;
    }
    setIsProcessing(true);
    setImportError(null);
    setSelectedFile(null);
    try {
      const buffer = await file.arrayBuffer();
      const dbHotel = supabase && hotel ? await resolveAccessibleRmsHotel(supabase, {
        name: hotel.name, city: hotel.city, country: hotel.country,
      }) : null;
      const hotelTimezone = dbHotel?.timezone || 'Europe/Paris';
      if (selectedChannel === 'lighthouse') {
        const parsed = parseLighthouseExcelFile(buffer, file.name, hotelTimezone);
        const competitorNames = [...new Set(parsed.records.flatMap((record) => record.competitors.map((item) => item.name)))];
        const headers = ['Date', 'Demande (/100)', 'Médiane Lighthouse', 'Folkestone Opéra', ...competitorNames];
        const rows = parsed.records.slice(0, 5).map((record) => [
          record.dateStr,
          record.demandIndex === null ? '—' : record.demandIndex,
          record.lighthouseMedianEur,
          record.folkestone.rate ?? record.folkestone.statusLabel,
          ...competitorNames.map((name) => {
            const competitor = record.competitors.find((item) => item.name === name);
            return competitor?.rate ?? competitor?.statusLabel ?? '—';
          }),
        ]);
        const observationCount = parsed.records.reduce((sum, record) => sum + record.competitors.length, 0);
        setSelectedFile({
          name: file.name, size: formatFileSize(file.size), rows, headers, sourceType: selectedChannel,
          rowCount: parsed.records.length,
          previewSummary: parsed.records.length + ' dates · ' + competitorNames.length + ' concurrents · ' + observationCount + ' observations · demande renseignée ' + parsed.records.filter((record) => record.demandIndex !== null).length + '/' + parsed.records.length,
          canImport: parsed.records.length > 0,
          parsedLighthouse: parsed,
        });
      } else if (selectedChannel === 'pms') {
        const parsed = parsePmsPlanningWorkbook(buffer, file.name, hotelTimezone);
        const firstRoom = parsed.roomTypes[0];
        const headers = ['Date', 'Typologie', 'Stock restant', 'Statut stock', 'Plans tarifaires'];
        const rows = firstRoom.inventory.slice(0, 5).map((item) => [
          item.stayDate, firstRoom.name, item.remainingSellableRooms ?? '—', item.status, firstRoom.ratePlans.length,
        ]);
        setSelectedFile({
          name: file.name, size: formatFileSize(file.size), rows, headers, sourceType: selectedChannel,
          rowCount: parsed.summary.inventoryCells + parsed.summary.rateCells,
          previewSummary: parsed.summary.dates + ' dates · ' + parsed.summary.roomTypes + ' typologies · ' + parsed.summary.ratePlans + ' plans tarifaires · ' + parsed.summary.rateCells + ' cellules tarifaires',
          canImport: true,
          parsedPms: parsed,
        });
      } else {
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) throw new Error("Aucun onglet trouvé dans le fichier D-EDGE.");
        const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: '' }) as unknown[][];
        const headerIndex = matrix.findIndex((row) => row.filter((value) => String(value ?? '').trim() !== '').length >= 3);
        if (headerIndex < 0) throw new Error("Aucune ligne d'en-tête exploitable dans le fichier D-EDGE.");
        const headers = matrix[headerIndex].map((value) => String(value ?? '').trim());
        const rows = matrix.slice(headerIndex + 1, headerIndex + 6).filter((row) => row.some((value) => String(value ?? '').trim() !== ''));
        setSelectedFile({
          name: file.name, size: formatFileSize(file.size), rows, headers, sourceType: selectedChannel,
          rowCount: Math.max(0, matrix.length - headerIndex - 1),
          previewSummary: 'Aperçu brut de ' + sheetName + ' · mapping métier non validé',
          canImport: false,
          blockedReason: "Le mapping D-EDGE n'est pas validé : le fichier est analysé en aperçu uniquement et aucune réservation n'est importée.",
        });
      }
    } catch (error: any) {
      setImportError(error?.message || "Le fichier n'a pas pu être analysé.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmInjection = async () => {
    if (!selectedFile) return;
    if (!selectedFile.canImport || (!selectedFile.parsedLighthouse && !selectedFile.parsedPms)) {
      setImportError(selectedFile.blockedReason || "Ce type de fichier n'est pas encore autorisé à écrire dans Supabase.");
      return;
    }
    if (!supabase || !user || !hotel) {
      setImportError("Connexion authentifiée et hôtel sélectionné requis pour importer.");
      return;
    }
    setIsProcessing(true);
    setImportError(null);
    setImportProgress({ phase: "Préparation", completed: 0, total: 1 });
    try {
      const dbHotel = await resolveAccessibleRmsHotel(supabase, {
        name: hotel.name, city: hotel.city, country: hotel.country,
      });
      if (selectedFile.sourceType === 'lighthouse' && selectedFile.parsedLighthouse) {
        const parsed = selectedFile.parsedLighthouse;
        const persisted = await persistLighthouseExtraction(supabase, dbHotel, parsed, user.id);
        await loadHistory();
        onDataImported?.('lighthouse', persisted.observationsInserted);
      } else if (selectedFile.sourceType === 'pms' && selectedFile.parsedPms) {
        const persisted = await persistPmsPlanningImport(
          supabase,
          dbHotel,
          selectedFile.parsedPms,
          user.id,
          (progress) => setImportProgress({
            phase: progress.phase === 'catalog' ? 'Référentiels' : progress.phase === 'inventory' ? 'Inventaire' : progress.phase === 'rates' ? 'Plans tarifaires' : 'Finalisation',
            completed: progress.completed,
            total: progress.total,
          }),
        );
        await loadHistory();
        onDataImported?.('pms', persisted.inventoryRowsWritten + persisted.rateObservationsWritten);
      } else {
        throw new Error("Aucun importeur persistant n'est disponible pour ce fichier.");
      }
      setSelectedFile(null);
      setImportProgress(null);
    } catch (error: any) {
      setImportError(error?.message || "Échec de la persistance des données.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-2xs space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-violet-600/10 text-violet-700 dark:text-violet-300 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </span>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                Importation contrôlée des sources de données
              </h3>
              <span className="text-[10px] font-bold uppercase bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/70">
                Lighthouse et Topsys importables · D-EDGE à mapper
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-3xl leading-relaxed">
            Importez un export <strong>Lighthouse</strong> (tarifs concurrents, médiane et indice de demande persistés), un planning <strong>Topsys</strong> (stocks et observations tarifaires par typologie / plan) ou prévisualisez un export <strong>D-EDGE</strong> (réservations et pickup : mapping à valider avant toute écriture).
          </p>
        </div>

        {hotel && (
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800/80 px-3.5 py-2 rounded-xl text-right shrink-0">
            <div className="text-[10px] text-slate-400 font-semibold uppercase">Établissement Cible</div>
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100">{hotel.name}</div>
          </div>
        )}
      </div>

      {/* Direct Link to Pricing Intelligence View */}
      {onNavigateToPricing && (
        <div className="bg-gradient-to-r from-violet-500/10 via-indigo-500/10 to-transparent dark:bg-none dark:bg-slate-900 border border-violet-200 dark:border-violet-800/70 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-2xs shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Pricing Intelligence — Positionnement & Recommandations
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Analyse concurrentielle, positionnement tarifaire et recommandations de prix optimisées par Flowtym RM.
              </p>
            </div>
          </div>
          <button
            onClick={onNavigateToPricing}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs shrink-0 cursor-pointer"
          >
            <span>Ouvrir Pricing Intelligence</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 3 Source Channel Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Lighthouse Channel */}
        <div
          onClick={() => {
            setSelectedChannel('lighthouse');
            setSelectedFile(null);
          }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2 relative ${
            selectedChannel === 'lighthouse'
              ? 'bg-amber-50/50 dark:bg-amber-950/35 border-amber-400 dark:border-amber-700/70 shadow-xs ring-1 ring-amber-300 dark:ring-amber-500/25'
              : 'bg-slate-50/60 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">1. Lighthouse Rate Insight</span>
            </div>
            {selectedChannel === 'lighthouse' && (
              <span className="w-2 h-2 rounded-full bg-amber-600" />
            )}
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
            Tarifs compset, sold-out concurrents, parité tarifaire et relevés OTA.
          </p>
          <div className="pt-2 border-t border-slate-200/50 dark:border-slate-800/70 flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Formats : .xlsx, .csv</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDownloadTemplate('lighthouse');
              }}
              className="text-[10px] font-bold text-amber-700 dark:text-amber-300 hover:underline flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              <span>Format attendu</span>
            </button>
          </div>
        </div>

        {/* D-EDGE Channel */}
        <div
          onClick={() => {
            setSelectedChannel('dedge');
            setSelectedFile(null);
          }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2 relative ${
            selectedChannel === 'dedge'
              ? 'bg-indigo-50/50 dark:bg-indigo-950/35 border-indigo-400 dark:border-indigo-700/70 shadow-xs ring-1 ring-indigo-300 dark:ring-indigo-500/25'
              : 'bg-slate-50/60 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">2. D-EDGE CRS & Distribution</span>
            </div>
            {selectedChannel === 'dedge' && (
              <span className="w-2 h-2 rounded-full bg-indigo-600" />
            )}
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
            Réservations, modifications, annulations, OTB, Pickup, Booking Pace et Lead Time (import désactivé tant que le mapping n'est pas validé).
          </p>
          <div className="pt-2 border-t border-slate-200/50 dark:border-slate-800/70 flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Formats : .xlsx, .csv</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDownloadTemplate('dedge');
              }}
              className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 hover:underline flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              <span>Format attendu</span>
            </button>
          </div>
        </div>

        {/* PMS Night Audit Channel */}
        <div
          onClick={() => {
            setSelectedChannel('pms');
            setSelectedFile(null);
          }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2 relative ${
            selectedChannel === 'pms'
              ? 'bg-violet-50/50 dark:bg-violet-950/35 border-violet-400 dark:border-violet-700/70 shadow-xs ring-1 ring-violet-300 dark:ring-violet-500/25'
              : 'bg-slate-50/60 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">3. Topsys Planning & Inventaire</span>
            </div>
            {selectedChannel === 'pms' && (
              <span className="w-2 h-2 rounded-full bg-violet-600" />
            )}
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
            Stock restant par date et typologie, prix par plan tarifaire. Les réservations, OTB et pickup ne sont pas contenus dans ce planning.
          </p>
          <div className="pt-2 border-t border-slate-200/50 dark:border-slate-800/70 flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Opera, Protel, Mews</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDownloadTemplate('pms');
              }}
              className="text-[10px] font-bold text-violet-700 dark:text-violet-300 hover:underline flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              <span>Modèle Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragActive(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          handleFileDrop(e.dataTransfer.files);
        }}
        className={`border-2 border-dashed rounded-3xl p-8 text-center transition-all ${
          dragActive
            ? 'border-violet-600 bg-violet-50/60 dark:bg-violet-950/40 scale-[1.005]'
            : 'border-slate-200 dark:border-slate-800 hover:border-violet-300 dark:hover:border-violet-600/70 bg-slate-50/40 dark:bg-slate-800/40'
        }`}
      >
        <div className="max-w-md mx-auto space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-center mx-auto text-violet-600 dark:text-violet-400">
            {isProcessing ? (
              <RefreshCw className="w-6 h-6 animate-spin text-violet-600 dark:text-violet-400" />
            ) : (
              <Upload className="w-6 h-6" />
            )}
          </div>

          <div>
            <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
              Déposez votre fichier Excel pour :{' '}
              <span className="text-violet-700 dark:text-violet-300">
                {selectedChannel === 'lighthouse'
                  ? 'Lighthouse Rate Insight'
                  : selectedChannel === 'dedge'
                  ? 'D-EDGE CRS'
                  : 'PMS Night Audit'}
              </span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Glissez-déposez un fichier <strong>.xlsx</strong>, <strong>.xls</strong> ou <strong>.csv</strong> ou cliquez ci-dessous
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <label className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" />
              <span>Sélectionner un fichier</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => handleFileDrop(e.target.files)}
              />
            </label>

            <button
              onClick={() => handleDownloadTemplate(selectedChannel)}
              className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span>Voir le format attendu</span>
            </button>
          </div>
        </div>
      </div>

      {importError && !selectedFile && <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{importError}</p>}

      {/* Preview Table of Uploaded File */}
      {selectedFile && (
        <div className="border border-violet-200 dark:border-violet-800/70 bg-violet-50/30 dark:bg-violet-950/30 rounded-2xl p-5 space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-violet-200/60 pb-3">
            <div className="flex items-center gap-2.5">
              <FileCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Prévisualisation des données : <span className="font-mono">{selectedFile.name}</span>
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Canal : <strong>{selectedFile.sourceType.toUpperCase()}</strong> · Taille : {selectedFile.size} · {selectedFile.canImport ? 'Structure reconnue' : 'Aperçu uniquement'} · {selectedFile.rowCount.toLocaleString('fr-FR')} lignes analysées
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedFile(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-900 rounded-lg cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmInjection}
                disabled={!selectedFile.canImport || isProcessing}
                className="px-4 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{selectedFile.canImport ? 'Valider et enregistrer dans Supabase' : 'Import non disponible'}</span>
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300">{selectedFile.previewSummary}</p>
          {selectedFile.blockedReason && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{selectedFile.blockedReason}</p>}
          {importError && <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{importError}</p>}
          {isProcessing && importProgress && <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200"><div className="flex justify-between"><span>{importProgress.phase}</span><span>{importProgress.total > 0 ? Math.round(importProgress.completed / importProgress.total * 100) : 0}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-900"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: (importProgress.total > 0 ? Math.min(100, importProgress.completed / importProgress.total * 100) : 0) + '%' }} /></div></div>}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs bg-white dark:bg-slate-900 rounded-xl border border-violet-100 dark:border-violet-900/60 overflow-hidden">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  {selectedFile.headers.map((h, i) => (
                    <th key={i} className="py-2.5 px-3 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-700 dark:text-slate-300">
                {selectedFile.rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-violet-50/40 transition-colors">
                    {row.map((cell: any, cIdx: number) => (
                      <td key={cIdx} className="py-2.5 px-3 whitespace-nowrap">
                        {cIdx === 4 && selectedFile.sourceType === 'lighthouse' ? (
                          <span className="font-bold text-slate-900 dark:text-slate-100">{cell}</span>
                        ) : cell === 'Complet' || cell === 'Sold-Out' || cell === 'Épuisé' ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300">
                            {cell}
                          </span>
                        ) : typeof cell === 'string' && cell.startsWith('+') ? (
                          <span className="text-emerald-700 dark:text-emerald-300 font-bold">{cell}</span>
                        ) : (
                          cell
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Uploads History Table */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Historique des Fichiers Excel Importés ({records.length})
            </h4>
          </div>
          <span className="text-[11px] text-slate-400">
            Journal Supabase en lecture seule · aucune suppression manuelle
          </span>
        </div>
        {historyError && <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{historyError}</p>}
        {isHistoryLoading && <p className="text-xs text-slate-500 dark:text-slate-400">Chargement de l'historique Supabase…</p>}

        <div className="overflow-x-auto border border-slate-200/90 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-2xs">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-400">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
              <tr>
                <th className="py-3 px-4">Date Import</th>
                <th className="py-3 px-4">Canal / Source</th>
                <th className="py-3 px-4">Nom du Fichier</th>
                <th className="py-3 px-4 text-center">Observations enregistrées</th>
                <th className="py-3 px-4">Période Couverte</th>
                <th className="py-3 px-4 text-center">Statut import</th>
                <th className="py-3 px-4 text-right">Traçabilité</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {records.length === 0 ? (
               <tr><td colSpan={7} className="py-8 text-center text-xs text-slate-400">{isHistoryLoading ? 'Chargement…' : 'Aucun import réel enregistré pour cet établissement.'}</td></tr>
             ) : records.map((rec) => (
                <tr key={rec.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/60 transition-colors">
                  <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {rec.uploadedAt ? new Date(rec.uploadedAt).toLocaleString('fr-FR') : '—'}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        rec.sourceType === 'lighthouse'
                          ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300'
                          : rec.sourceType === 'dedge'
                          ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300'
                          : 'bg-violet-100 dark:bg-violet-900/40 text-violet-800 dark:text-violet-300'
                      }`}
                    >
                      {rec.sourceType === 'lighthouse'
                        ? 'Lighthouse'
                        : rec.sourceType === 'dedge'
                        ? 'D-EDGE CRS'
                        : 'PMS Audit'}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono font-medium text-slate-900 dark:text-slate-100 truncate max-w-xs">
                    {rec.fileName}
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                    {rec.rowCount} lignes
                  </td>
                  <td className="py-3 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">{rec.dateRange}</td>
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                      rec.status === 'synced' ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/70'
                      : rec.status === 'failed' ? 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/70'
                      : rec.status === 'running' ? 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/70'
                      : rec.status === 'partial' ? 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/70'
                      : 'text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                    }`}>
                      {rec.status === 'synced' ? 'Synchronisé' : rec.status === 'failed' ? 'Échec' : rec.status === 'running' ? 'En cours' : rec.status === 'partial' ? 'Partiel' : 'En attente'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap text-[10px] text-slate-400">Journal conservé</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

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
  Database,
  ArrowRight,
  TrendingUp,
  Activity,
  Server,
  FileCheck,
  Trash2,
  RefreshCw,
  Info,
} from 'lucide-react';
import { Hotel } from '../../types';
import { exportLighthouseWorkbookToXLSX } from '../../services/lighthouseAnalysisEngine';

export type ExcelSourceType = 'lighthouse' | 'dedge' | 'pms';

export interface UploadedDataRecord {
  id: string;
  sourceType: ExcelSourceType;
  fileName: string;
  uploadedAt: string;
  rowCount: number;
  dateRange: string;
  status: 'synced' | 'pending';
  fileSize: string;
}

interface HotelDataExcelUploadSectionProps {
  hotel?: Hotel;
  onShowToast?: (msg: string) => void;
  onDataImported?: (sourceType: ExcelSourceType, rowCount: number) => void;
  onNavigateToPricing?: () => void;
}

const STORAGE_KEY = 'flowtym_uploaded_excel_records';

export const HotelDataExcelUploadSection: React.FC<HotelDataExcelUploadSectionProps> = ({
  hotel,
  onShowToast,
  onDataImported,
  onNavigateToPricing,
}) => {
  const [selectedChannel, setSelectedChannel] = useState<ExcelSourceType>('lighthouse');
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    size: string;
    rows: any[];
    headers: string[];
    sourceType: ExcelSourceType;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Upload history in local storage
  const [records, setRecords] = useState<UploadedDataRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load upload history', e);
    }
    // Default initial demonstration logs
    return [
      {
        id: 'rec-init-lh',
        sourceType: 'lighthouse',
        fileName: 'folkestone-opéra_bookingdotcom_lowest_los1_2guests.xlsx',
        uploadedAt: '06/11/2026 à 08:30',
        rowCount: 60,
        dateRange: '10/11/2026 — 08/01/2027',
        status: 'synced',
        fileSize: '48.2 Ko',
      },
      {
        id: 'rec-init-de',
        sourceType: 'dedge',
        fileName: 'dedge_crs_inventory_paris_opera.csv',
        uploadedAt: '05/11/2026 à 17:40',
        rowCount: 61,
        dateRange: '01/11/2026 — 31/12/2026',
        status: 'synced',
        fileSize: '24.6 Ko',
      },
      {
        id: 'rec-init-pms',
        sourceType: 'pms',
        fileName: 'cloture_night_audit_opera_pms.xlsx',
        uploadedAt: '05/11/2026 à 06:10',
        rowCount: 90,
        dateRange: '01/10/2026 — 31/12/2026',
        status: 'synced',
        fileSize: '62.1 Ko',
      },
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch (e) {
      console.error('Failed to save upload history', e);
    }
  }, [records]);

  // Download Sample Excel/CSV Templates
  const handleDownloadTemplate = (type: ExcelSourceType) => {
    if (type === 'lighthouse') {
      const u8array = exportLighthouseWorkbookToXLSX();
      const blob = new Blob([u8array.buffer as ArrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'folkestone-opéra_bookingdotcom_lowest_los1_2guests.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      if (onShowToast) {
        onShowToast('Export officiel Lighthouse (5 onglets) téléchargé : folkestone-opéra_bookingdotcom_lowest_los1_2guests.xlsx');
      }
      return;
    }

    let csvContent = '';
    let fileName = '';

    if (type === 'dedge') {
      fileName = 'modele_import_dedge_crs_inventory.csv';
      csvContent =
        'Date,Hotel_Code,Chambres_Total,Chambres_Vendues_OTB,Stock_Disponible,Tarif_BAR_EUR,Min_Stay_Nuits,Stop_Sell_Actif\n' +
        '2026-11-18,FR-PAR-FOLKESTONE-08,45,36,9,285,2,Non\n' +
        '2026-11-19,FR-PAR-FOLKESTONE-08,45,39,6,320,2,Non\n' +
        '2026-11-20,FR-PAR-FOLKESTONE-08,45,41,4,340,3,Non\n' +
        '2026-11-21,FR-PAR-FOLKESTONE-08,45,43,2,360,3,Oui\n';
    } else {
      fileName = 'modele_import_pms_night_audit.csv';
      csvContent =
        'Date_Sejour,Taux_Occupation_OTB_Pct,Chambres_Occupees,Stock_Restant,ADR_Portefeuille_EUR,Pickup_24h_Nuits,Pickup_72h_Nuits,Pickup_7j_Nuits,Annulations_24h\n' +
        '2026-11-18,80.0,36,9,268.50,5,11,18,0\n' +
        '2026-11-19,86.7,39,6,282.00,4,9,16,1\n' +
        '2026-11-20,91.1,41,4,295.40,6,14,22,0\n' +
        '2026-11-21,95.5,43,2,315.00,3,8,15,0\n';
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (onShowToast) {
      onShowToast(`Modèle Excel / CSV téléchargé : ${fileName}`);
    }
  };

  // Simulate file upload and parsing
  const handleFileDrop = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const isExcelOrCsv =
      file.name.endsWith('.xlsx') ||
      file.name.endsWith('.xls') ||
      file.name.endsWith('.csv');

    if (!isExcelOrCsv) {
      if (onShowToast) onShowToast('Veuillez déposer un fichier Excel (.xlsx, .xls) ou CSV (.csv)');
      return;
    }

    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      let headers: string[] = [];
      let rows: any[] = [];

      if (selectedChannel === 'lighthouse') {
        headers = ['Date', 'Concurrent', 'Étoiles', 'Chambre', 'Tarif BAR', 'Disponibilité', 'Canal'];
        rows = [
          ['2026-11-18', 'Hôtel Saint-Pétersbourg Opéra', '4★', 'Classique', '345€', 'Complet', 'Booking.com'],
          ['2026-11-18', 'Hôtel Charing Cross', '4★', 'Supérieure', '310€', 'Disponible', 'Site Direct'],
          ['2026-11-19', 'Hôtel Saint-Pétersbourg Opéra', '4★', 'Classique', '360€', 'Complet', 'Booking.com'],
          ['2026-11-19', 'Hôtel Astra Opéra', '4★', 'Standard', '295€', 'Disponible', 'Expedia'],
          ['2026-11-20', 'Hotel Indigo Paris-Opéra', '4★', 'Deluxe', '385€', 'Disponible', 'Site Direct'],
        ];
      } else if (selectedChannel === 'dedge') {
        headers = ['Date', 'Hotel Code', 'Total Ch.', 'OTB Vendues', 'Stock Dispo', 'Tarif BAR', 'Min Stay'];
        rows = [
          ['2026-11-18', 'FR-PAR-FOLKESTONE-08', '45', '36 (80%)', '9 ch.', '285€', '2 nuits'],
          ['2026-11-19', 'FR-PAR-FOLKESTONE-08', '45', '39 (87%)', '6 ch.', '320€', '2 nuits'],
          ['2026-11-20', 'FR-PAR-FOLKESTONE-08', '45', '41 (91%)', '4 ch.', '340€', '3 nuits'],
          ['2026-11-21', 'FR-PAR-FOLKESTONE-08', '45', '43 (96%)', '2 ch.', '360€', '3 nuits'],
        ];
      } else {
        headers = ['Date Séjour', 'Occ. %', 'Ch. Louées', 'Stock Dispo', 'ADR Portefeuille', 'Pickup 24h', 'Pickup 7j'];
        rows = [
          ['2026-11-18', '80.0%', '36 ch.', '9 ch.', '268.50€', '+5 nuits', '+18 nuits'],
          ['2026-11-19', '86.7%', '39 ch.', '6 ch.', '282.00€', '+4 nuits', '+16 nuits'],
          ['2026-11-20', '91.1%', '41 ch.', '4 ch.', '295.40€', '+6 nuits', '+22 nuits'],
          ['2026-11-21', '95.5%', '43 ch.', '2 ch.', '315.00€', '+3 nuits', '+15 nuits'],
        ];
      }

      setSelectedFile({
        name: file.name,
        size: `${(file.size / 1024).toFixed(1)} Ko`,
        rows,
        headers,
        sourceType: selectedChannel,
      });

      if (onShowToast) {
        onShowToast(`Fichier "${file.name}" pré-analysé avec succès`);
      }
    }, 600);
  };

  const handleConfirmInjection = () => {
    if (!selectedFile) return;

    const newRec: UploadedDataRecord = {
      id: `rec-${Date.now()}`,
      sourceType: selectedFile.sourceType,
      fileName: selectedFile.name,
      uploadedAt: `${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
      rowCount: selectedFile.rows.length * 15, // simulation of parsed rows
      dateRange: '15/11/2026 — 31/12/2026',
      status: 'synced',
      fileSize: selectedFile.size,
    };

    setRecords((prev) => [newRec, ...prev]);

    if (onDataImported) {
      onDataImported(selectedFile.sourceType, newRec.rowCount);
    }

    if (onShowToast) {
      onShowToast(
        `Données ${selectedFile.sourceType.toUpperCase()} injectées avec succès (${newRec.rowCount} lignes synchronisées)`
      );
    }

    setSelectedFile(null);
  };

  const handleDeleteRecord = (id: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== id));
    if (onShowToast) onShowToast('Historique d’importation mis à jour');
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
                Importation des Fichiers Excel & CSV (Mode Alternatif Hors-API)
              </h3>
              <span className="text-[10px] font-bold uppercase bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/70">
                En attente d&apos;API D-EDGE & Lighthouse
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-3xl leading-relaxed">
            Dans l&apos;attente de l&apos;activation technique des accès API directs, importez manuellement vos exports de veille tarifaire <strong>Lighthouse</strong>, vos extractions d&apos;inventaire <strong>D-EDGE CRS</strong> et vos rapports de clôture <strong>PMS Night Audit</strong> (Opera, Protel, Mews, Medialog).
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
              <span>Modèle Excel</span>
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
            Stock restant, inventaire chambres, tarifs BAR actuels et restrictions Min Stay.
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
              <span>Modèle Excel</span>
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
              <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">3. PMS Night Audit & Pickup</span>
            </div>
            {selectedChannel === 'pms' && (
              <span className="w-2 h-2 rounded-full bg-violet-600" />
            )}
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
            Clôture journalière, OTB %, Pickup 24h/72h/7d, lead times et annulations.
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
              <span>Télécharger le modèle vierge</span>
            </button>
          </div>
        </div>
      </div>

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
                  Canal : <strong>{selectedFile.sourceType.toUpperCase()}</strong> · Taille : {selectedFile.size} · Schéma vérifié
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
                className="px-4 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Valider et Injecter dans le Moteur RM</span>
              </button>
            </div>
          </div>

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
                        ) : cell === 'Complet' || cell === 'Sold-Out' ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300">
                            {cell}
                          </span>
                        ) : cell.startsWith('+') ? (
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
            Les données importées écrasent et enrichissent la mémoire de prévision
          </span>
        </div>

        <div className="overflow-x-auto border border-slate-200/90 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-2xs">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-400">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
              <tr>
                <th className="py-3 px-4">Date Import</th>
                <th className="py-3 px-4">Canal / Source</th>
                <th className="py-3 px-4">Nom du Fichier</th>
                <th className="py-3 px-4 text-center">Lignes Traitées</th>
                <th className="py-3 px-4">Période Couverte</th>
                <th className="py-3 px-4 text-center">Statut RM</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {records.map((rec) => (
                <tr key={rec.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/60 transition-colors">
                  <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {rec.uploadedAt}
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
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/70">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>Synchronisé</span>
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <button
                      onClick={() => handleDeleteRecord(rec.id)}
                      title="Supprimer cet historique d'import"
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

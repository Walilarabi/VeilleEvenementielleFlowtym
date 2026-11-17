/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Assistant d'Import Excel / CSV Intelligent en 6 Étapes (D-EDGE Planning & Multi-Format)
 * Supporte Price (EUR), Left for sale, restrictions, modèles de mapping réutilisables et diff non destructif.
 */

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Layers,
  Play,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  DedgeImportAnalysis,
  DedgeImportReport,
  Hotel,
  ImportDiffRow,
  ImportTemplateMapping,
} from '../../types';
import {
  analyzeSpreadsheetBuffer,
  buildSampleDedgePlanningWorkbook,
  deleteImportMappingTemplate,
  downloadDedgeImportReportCsv,
  downloadSampleDedgePlanningWorkbook,
  executeDedgeImport,
  generateDedgeImportDiff,
  getImportMappingTemplates,
  saveImportMappingTemplate,
} from '../../services/connectors/dedgeExcelImportEngine';
import { getHotelTariffConfig } from '../../services/tariffConfigurationService';
import { getTodayIsoDate } from '../../utils/eventFilterUtils';

interface SmartExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  hotel: Hotel;
  onImportCompleted: (report: DedgeImportReport) => void;
  onShowToast?: (msg: string) => void;
}

const STEPS = [
  { id: 1, label: '1. Fichier' },
  { id: 2, label: '2. Analyse' },
  { id: 3, label: '3. Mapping' },
  { id: 4, label: '4. Diff' },
  { id: 5, label: '5. Confirmation' },
  { id: 6, label: '6. Rapport' },
];

export const SmartExcelImportModal: React.FC<SmartExcelImportModalProps> = ({
  isOpen,
  onClose,
  hotel,
  onImportCompleted,
  onShowToast,
}) => {
  const [step, setStep] = useState<number>(1);
  const [isDragging, setIsDragging] = useState(false);
  const [analysis, setAnalysis] = useState<DedgeImportAnalysis | null>(null);
  const [roomMappings, setRoomMappings] = useState<Record<string, string>>({});
  const [planMappings, setPlanMappings] = useState<Record<string, string>>({});
  const [templates, setTemplates] = useState<ImportTemplateMapping[]>(() =>
    getImportMappingTemplates(hotel.id)
  );
  const [templateName, setTemplateName] = useState('Modèle D-EDGE Planning');
  const [autoCreateMissingRooms, setAutoCreateMissingRooms] = useState(true);
  const [autoCreateMissingPlans, setAutoCreateMissingPlans] = useState(true);
  const [overwriteExisting, setOverwriteExisting] = useState(true);
  const [confirmedExecute, setConfirmedExecute] = useState(false);
  const [report, setReport] = useState<DedgeImportReport | null>(null);
  const [diffFilter, setDiffFilter] = useState<'all' | 'new' | 'modified' | 'rejected'>('all');

  const config = useMemo(() => getHotelTariffConfig(hotel), [hotel]);

  const diffRows: ImportDiffRow[] = useMemo(() => {
    if (!analysis) return [];
    return generateDedgeImportDiff(hotel, analysis, roomMappings, planMappings);
  }, [analysis, hotel, roomMappings, planMappings]);

  const diffStats = useMemo(() => {
    return {
      newCount: diffRows.filter((r) => r.changeType === 'new').length,
      modifiedCount: diffRows.filter((r) => r.changeType === 'modified').length,
      unchangedCount: diffRows.filter((r) => r.changeType === 'unchanged').length,
      rejectedCount: diffRows.filter((r) => r.changeType === 'rejected').length,
    };
  }, [diffRows]);

  if (!isOpen) return null;

  const processBuffer = (buf: ArrayBuffer | Uint8Array, fileName: string) => {
    const res = analyzeSpreadsheetBuffer(buf, fileName, hotel);
    setAnalysis(res);
    const initialRooms: Record<string, string> = {};
    res.detectedRooms.forEach((r) => {
      initialRooms[r.externalLabel] = r.suggestedInternalCode;
    });
    const initialPlans: Record<string, string> = {};
    res.detectedPlans.forEach((p) => {
      initialPlans[p.externalLabel] = p.suggestedInternalCode;
    });
    setRoomMappings(initialRooms);
    setPlanMappings(initialPlans);
    setConfirmedExecute(false);
    setReport(null);
    setStep(2);
    onShowToast?.(`Fichier analysé : ${res.stats.validRatePoints} tarifs & ${res.stats.validInventoryPoints} stocks détectés.`);
  };

  const handleFileSelected = async (file: File) => {
    const buf = await file.arrayBuffer();
    processBuffer(buf, file.name);
  };

  const handleLoadSampleDedge = () => {
    const today = getTodayIsoDate();
    const bytes = buildSampleDedgePlanningWorkbook(today, 14);
    processBuffer(bytes, `H2258 - FOLKESTONE OPERA - Planning (Sample ${today}).xlsx`);
  };

  const handleApplyTemplate = (tpl: ImportTemplateMapping) => {
    setRoomMappings((prev) => ({ ...prev, ...tpl.roomCodeMappings }));
    setPlanMappings((prev) => ({ ...prev, ...tpl.planCodeMappings }));
    onShowToast?.(`Modèle de mapping « ${tpl.name} » appliqué.`);
  };

  const handleSaveTemplate = () => {
    if (!analysis) return;
    const next = saveImportMappingTemplate(hotel.id, {
      name: templateName,
      providerPreset: analysis.detectedProvider,
      roomColumnName: analysis.detectedColumns.roomColumn,
      ratePlanColumnName: analysis.detectedColumns.planColumn,
      dataTypeColumnName: analysis.detectedColumns.dataTypeColumn,
      priceTypeValue: 'Price (EUR)',
      inventoryTypeValue: 'Left for sale',
      roomCodeMappings: roomMappings,
      planCodeMappings: planMappings,
      defaultCurrency: config.currency,
    });
    setTemplates(next);
    onShowToast?.(`Modèle « ${templateName} » enregistré pour ${hotel.name}.`);
  };

  const handleExecuteImport = () => {
    if (!analysis || !confirmedExecute) return;
    const res = executeDedgeImport(hotel, {
      analysis,
      roomCodeMappings: roomMappings,
      planCodeMappings: planMappings,
      autoCreateMissingRooms,
      autoCreateMissingPlans,
      overwriteExisting,
    });
    setReport(res.report);
    setStep(6);
    onImportCompleted(res.report);
  };

  const visibleDiff = diffRows
    .filter((d) => (diffFilter === 'all' ? d.changeType !== 'unchanged' : d.changeType === diffFilter))
    .slice(0, 120);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Import Excel / CSV Intelligent D-EDGE Planning &amp; Multi-Format
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {hotel.name} · Détection automatique <span className="font-mono">Price (EUR)</span> &amp;{' '}
                <span className="font-mono">Left for sale</span> sans écrasement silencieux
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stepper 6 étapes */}
        <div className="px-6 py-2.5 bg-slate-50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto">
          {STEPS.map((s) => {
            const active = step === s.id;
            const done = step > s.id;
            return (
              <button
                key={s.id}
                type="button"
                disabled={s.id > 1 && !analysis}
                onClick={() => {
                  if (s.id <= step || (analysis && s.id <= 5)) setStep(s.id);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-violet-600 text-white'
                    : done
                    ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* ÉTAPE 1 : UPLOAD */}
          {step === 1 && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) void handleFileSelected(f);
                }}
                className={`border-2 border-dashed rounded-2xl p-8 text-center space-y-3 transition-colors ${
                  isDragging
                    ? 'border-violet-500 bg-violet-50/70 dark:bg-violet-950/30'
                    : 'border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/30'
                }`}
              >
                <Upload className="w-8 h-8 text-violet-600 dark:text-violet-400 mx-auto" />
                <div className="space-y-1">
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Glissez votre export Excel D-EDGE Planning ou CSV ici
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Formats acceptés : <span className="font-mono">.xlsx</span>, <span className="font-mono">.xls</span>,{' '}
                    <span className="font-mono">.csv</span> (ex : <span className="font-mono">H2258 - FOLKESTONE OPERA - Planning (4).xlsx</span>)
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <label className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Choisir un fichier local</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleFileSelected(f);
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => downloadSampleDedgePlanningWorkbook(getTodayIsoDate())}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Télécharger modèle D-EDGE (.xlsx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleLoadSampleDedge}
                    className="px-4 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Tester avec matrice D-EDGE exemple</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="font-bold text-slate-900 dark:text-slate-100">Détection D-EDGE Planning</div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Sépare automatiquement les lignes <span className="font-mono">Price (EUR)</span> vers les tarifs journaliers et <span className="font-mono">Left for sale</span> vers le stock disponible.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="font-bold text-slate-900 dark:text-slate-100">Cellules fusionnées &amp; anomalies</div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Propage les chambres fusionnées, ignore les cellules vides et signale doublons ou valeurs incohérentes avant écriture.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="font-bold text-slate-900 dark:text-slate-100">Zéro écrasement silencieux</div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Chaque modification passe par un Diff complet (nouveau vs modifié) et une confirmation explicite.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ÉTAPE 2 : ANALYSE STRUCTURELLE */}
          {step === 2 && analysis && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] text-slate-500">Format détecté</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    {analysis.detectedProvider === 'dedge_planning' ? 'D-EDGE Planning' : 'Matrice Générique'}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] text-slate-500">Période couverte</div>
                  <div className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    {analysis.dateRange.start || '—'} → {analysis.dateRange.end || '—'}
                  </div>
                  <div className="text-[10px] text-slate-400">{analysis.dateRange.totalDates} jours</div>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] text-slate-500">Points Tarifs (Price)</div>
                  <div className="text-lg font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {analysis.stats.validRatePoints}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] text-slate-500">Points Stock (Left for sale)</div>
                  <div className="text-lg font-mono font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                    {analysis.stats.validInventoryPoints}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] text-slate-500">Anomalies / Doublons</div>
                  <div className={`text-lg font-mono font-bold tabular-nums ${analysis.anomalies.length > 0 ? 'text-amber-600' : 'text-slate-700 dark:text-slate-200'}`}>
                    {analysis.anomalies.length}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-violet-600" />
                    <span>Catégories de chambres détectées ({analysis.detectedRooms.length})</span>
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {analysis.detectedRooms.map((r) => (
                      <div key={r.externalLabel} className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/70">
                        <span className="font-medium text-slate-800 dark:text-slate-200">{r.externalLabel}</span>
                        <span className="font-mono text-[11px] text-slate-500">{r.rowCount} lignes</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="font-bold text-slate-900 dark:text-slate-100">
                    Plans &amp; Types de données détectés
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {analysis.detectedPlans.map((p) => (
                      <div key={p.externalLabel} className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/70">
                        <span className="font-medium text-slate-800 dark:text-slate-200">{p.externalLabel}</span>
                        <span className="font-mono text-[11px] text-violet-600 dark:text-violet-400">→ {p.suggestedInternalCode}</span>
                      </div>
                    ))}
                    {analysis.detectedDataTypes.map((dt) => (
                      <div key={dt.label} className="flex items-center justify-between py-1 text-[11px] text-slate-500">
                        <span>Type : <span className="font-mono text-slate-800 dark:text-slate-200">{dt.label}</span></span>
                        <span className="font-semibold uppercase">{dt.metricType} ({dt.count})</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {analysis.anomalies.length > 0 && (
                <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-800/70 bg-amber-50/70 dark:bg-amber-950/30 space-y-1.5 text-xs">
                  <div className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>{analysis.anomalies.length} anomalie(s) isolée(s) — ne bloqueront pas les données valides</span>
                  </div>
                  <div className="max-h-28 overflow-y-auto space-y-1 text-[11px] text-amber-800 dark:text-amber-300">
                    {analysis.anomalies.slice(0, 15).map((a) => (
                      <div key={a.id}>
                        Ligne {a.rowIndex} ({a.sheetName}) : {a.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ÉTAPE 3 : MAPPING INTERACTIF & MODÈLES RÉUTILISABLES */}
          {step === 3 && analysis && (
            <div className="space-y-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-slate-700 dark:text-slate-200">Modèles enregistrés :</span>
                  {templates.length === 0 ? (
                    <span className="text-slate-400">Aucun modèle sauvegardé</span>
                  ) : (
                    templates.map((tpl) => (
                      <div key={tpl.id} className="inline-flex items-center gap-1 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-white dark:bg-slate-900">
                        <button
                          type="button"
                          onClick={() => handleApplyTemplate(tpl)}
                          className="font-semibold text-violet-700 dark:text-violet-300 hover:underline cursor-pointer"
                        >
                          {tpl.name}
                        </button>
                        <button
                          type="button"
                          onClick={() => setTemplates(deleteImportMappingTemplate(hotel.id, tpl.id))}
                          className="text-slate-400 hover:text-rose-500 cursor-pointer"
                          title="Supprimer ce modèle"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Nom du modèle..."
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleSaveTemplate}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>Enregistrer modèle</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="font-bold text-slate-900 dark:text-slate-100">
                    Correspondance Catégories de Chambres
                  </div>
                  {analysis.detectedRooms.map((r) => (
                    <div key={r.externalLabel} className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-slate-700 dark:text-slate-300">{r.externalLabel}</span>
                      <select
                        value={roomMappings[r.externalLabel] || r.suggestedInternalCode}
                        onChange={(e) =>
                          setRoomMappings((prev) => ({ ...prev, [r.externalLabel]: e.target.value }))
                        }
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                      >
                        {config.roomCategories.map((rc) => (
                          <option key={rc.code} value={rc.code}>
                            {rc.name} ({rc.code})
                          </option>
                        ))}
                        {!config.roomCategories.some((rc) => rc.code === r.suggestedInternalCode) && (
                          <option value={r.suggestedInternalCode}>
                            + Créer : {r.suggestedInternalCode}
                          </option>
                        )}
                      </select>
                    </div>
                  ))}
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="font-bold text-slate-900 dark:text-slate-100">
                    Correspondance Plans Tarifaires
                  </div>
                  {analysis.detectedPlans.map((p) => (
                    <div key={p.externalLabel} className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-slate-700 dark:text-slate-300">{p.externalLabel}</span>
                      <select
                        value={planMappings[p.externalLabel] || p.suggestedInternalCode}
                        onChange={(e) =>
                          setPlanMappings((prev) => ({ ...prev, [p.externalLabel]: e.target.value }))
                        }
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                      >
                        {config.ratePlans.map((rp) => (
                          <option key={rp.code} value={rp.code}>
                            {rp.code} — {rp.name}
                          </option>
                        ))}
                        {!config.ratePlans.some((rp) => rp.code === p.suggestedInternalCode) && (
                          <option value={p.suggestedInternalCode}>
                            + Créer : {p.suggestedInternalCode}
                          </option>
                        )}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ÉTAPE 4 : PRÉVISUALISATION DIFF */}
          {step === 4 && (
            <div className="space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {[
                    { id: 'all', label: `Impactées (${diffStats.newCount + diffStats.modifiedCount})` },
                    { id: 'new', label: `Nouvelles (${diffStats.newCount})` },
                    { id: 'modified', label: `Modifiées (${diffStats.modifiedCount})` },
                    { id: 'rejected', label: `Rejetées (${diffStats.rejectedCount})` },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setDiffFilter(f.id as any)}
                      className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                        diffFilter === f.id
                          ? 'bg-violet-600 text-white'
                          : 'border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <span className="text-slate-400 tabular-nums">
                  {diffStats.unchangedCount} cellule(s) déjà identiques non modifiées
                </span>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-800/70 text-[11px] font-semibold text-slate-600 dark:text-slate-300 sticky top-0">
                    <tr>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Chambre</th>
                      <th className="px-3 py-2">Plan</th>
                      <th className="px-3 py-2">Donnée</th>
                      <th className="px-3 py-2 text-right">Actuel FLOWTYM</th>
                      <th className="px-3 py-2 text-right">Fichier Excel</th>
                      <th className="px-3 py-2">Statut Diff</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                    {visibleDiff.map((row, idx) => (
                      <tr key={`${row.cellKey}-${row.metricType}-${idx}`}>
                        <td className="px-3 py-1.5 font-mono">{row.stayDate}</td>
                        <td className="px-3 py-1.5 font-medium">{row.roomName}</td>
                        <td className="px-3 py-1.5 font-mono">{row.planCode}</td>
                        <td className="px-3 py-1.5 uppercase text-slate-500">{row.metricType}</td>
                        <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                          {row.existingValue !== null ? row.existingValue : '—'}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono font-bold tabular-nums">
                          {row.incomingValue}
                        </td>
                        <td className="px-3 py-1.5">
                          <span
                            className={`px-2 py-0.5 rounded font-semibold ${
                              row.changeType === 'new'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300'
                                : row.changeType === 'modified'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300'
                            }`}
                          >
                            {row.changeType === 'new'
                              ? 'Nouveau'
                              : row.changeType === 'modified'
                              ? `Modifié (${row.deltaEur && row.deltaEur > 0 ? '+' : ''}${row.deltaEur ?? ''})`
                              : 'Rejeté'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {visibleDiff.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-3 py-6 text-center text-slate-400">
                          Aucune différence à afficher pour ce filtre.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ÉTAPE 5 : CONFIRMATION EXPLICITE */}
          {step === 5 && analysis && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl border border-violet-200 dark:border-violet-800/70 bg-violet-50/70 dark:bg-violet-950/30 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    Validation requise avant mise à jour du Planning Tarifaire
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                    <strong>{diffStats.newCount + diffStats.modifiedCount}</strong> cellule(s) vont être créées ou mises à jour dans{' '}
                    <strong>{hotel.name}</strong> à partir de <span className="font-mono">{analysis.fileName}</span>. Aucun envoi automatique vers le PMS / OTA n&apos;est déclenché sans validation manuelle dans le Planning.
                  </p>
                </div>
              </div>

              <div className="space-y-2.5 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoCreateMissingRooms}
                    onChange={(e) => setAutoCreateMissingRooms(e.target.checked)}
                    className="rounded text-violet-600"
                  />
                  <span>Créer automatiquement les catégories de chambres détectées non encore mappées</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoCreateMissingPlans}
                    onChange={(e) => setAutoCreateMissingPlans(e.target.checked)}
                    className="rounded text-violet-600"
                  />
                  <span>Créer automatiquement les plans tarifaires détectés absents de la configuration</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={overwriteExisting}
                    onChange={(e) => setOverwriteExisting(e.target.checked)}
                    className="rounded text-violet-600"
                  />
                  <span>Mettre à jour les cellules existantes dont le tarif/stock diffère du fichier Excel</span>
                </label>
              </div>

              <label className="flex items-center gap-2.5 p-3.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 font-bold text-emerald-900 dark:text-emerald-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmedExecute}
                  onChange={(e) => setConfirmedExecute(e.target.checked)}
                  className="rounded text-emerald-600"
                />
                <span>Je confirme avoir vérifié le diff et j&apos;autorise l&apos;importation dans FLOWTYM.</span>
              </label>
            </div>
          )}

          {/* ÉTAPE 6 : RAPPORT DÉTAILLÉ */}
          {step === 6 && report && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-sm text-emerald-950 dark:text-emerald-100">
                      Importation exécutée avec succès (Job {report.jobId})
                    </div>
                    <p className="text-emerald-800 dark:text-emerald-300 mt-0.5">{report.summary}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => downloadDedgeImportReportCsv(report)}
                  className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 font-bold text-emerald-800 dark:text-emerald-200 inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Télécharger Rapport CSV</span>
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: 'Tarifs MAJ', val: report.updatedRatesCount },
                  { label: 'Stocks Left for sale', val: report.updatedInventoryCount },
                  { label: 'Chambres créées', val: report.createdRoomsCount },
                  { label: 'Plans créés', val: report.createdPlansCount },
                  { label: 'Anomalies isolées', val: report.anomaliesCount },
                ].map((k) => (
                  <div key={k.label} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="text-[11px] text-slate-500">{k.label}</div>
                    <div className="text-lg font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                      {k.val}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            {step > 1 && step < 6 && (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Étape précédente</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              {step === 6 ? 'Fermer et voir le Planning' : 'Annuler'}
            </button>
            {step >= 2 && step < 5 && (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>Étape suivante</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            {step === 5 && (
              <button
                type="button"
                disabled={!confirmedExecute}
                onClick={handleExecuteImport}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Exécuter l&apos;importation</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * HUB CENTRAL : RAPPORTS MENSUELS, PRÉVISIONS VS RÉALISÉ & AUTOMATISATIONS RM
 * Consolidation des rapports propriétaires, graphiques par typologies, alertes Slack et export Excel
 */

import React, { useState } from 'react';
import {
  FileText,
  TrendingUp,
  Mail,
  MessageSquare,
  FileSpreadsheet,
  Download,
  Calendar,
  Building2,
  Sparkles,
  Layers,
  ShieldAlert,
  Clock,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { MonthlyOwnerReportView } from './MonthlyOwnerReportView';
import { ActualVsForecastRoomTypeChart } from '../forecast/ActualVsForecastRoomTypeChart';
import { WeeklyMondayDigestConfigModal } from '../automations/WeeklyMondayDigestConfigModal';
import { SlackParityMonitorModal } from '../automations/SlackParityMonitorModal';
import { exportCompleteHistoricalExcel } from '../../services/excelHistoricalExportService';
import { getSlackParityConfig, getParityDiscrepancies } from '../../services/parityMonitoringService';
import { getMondayDigestConfig } from '../../services/automatedDigestsService';
import { Hotel } from '../../types';

export type ReportSubTab = 'owner_report' | 'forecast_vs_actual' | 'automations' | 'excel_export';

interface ReportsAndAutomationsHubProps {
  hotel?: Hotel;
  onShowToast: (msg: string) => void;
  defaultSubTab?: ReportSubTab;
}

export const ReportsAndAutomationsHub: React.FC<ReportsAndAutomationsHubProps> = ({
  hotel,
  onShowToast,
  defaultSubTab = 'owner_report',
}) => {
  const [activeSubTab, setActiveSubTab] = useState<ReportSubTab>(defaultSubTab);
  const [isMondayModalOpen, setIsMondayModalOpen] = useState(false);
  const [isSlackModalOpen, setIsSlackModalOpen] = useState(false);

  // Quick export state
  const [exportRange, setExportRange] = useState<'all' | '90d' | '30d'>('all');
  const [isExporting, setIsExporting] = useState(false);

  const parityConfig = getSlackParityConfig();
  const parityDiscrepancies = getParityDiscrepancies();
  const mondayConfig = getMondayDigestConfig();

  const handleTriggerExcelExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      let startDate: string | undefined = undefined;
      let endDate: string | undefined = undefined;

      if (exportRange === '30d') {
        startDate = '2026-10-01';
        endDate = '2026-11-04';
      } else if (exportRange === '90d') {
        startDate = '2026-11-04';
        endDate = '2027-02-04';
      }

      const res = exportCompleteHistoricalExcel({
        hotelName: hotel?.name || 'Grand Hôtel Folkestone Opéra',
        startDate,
        endDate,
      });

      setIsExporting(false);
      onShowToast(`✓ ${res.totalRows} dates de prix et d'occupation exportées dans "${res.filename}"`);
    }, 400);
  };

  return (
    <div className="space-y-6">
      {/* Sub-Navigation Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-2 shadow-2xs flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setActiveSubTab('owner_report')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'owner_report'
              ? 'bg-violet-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Rapport Mensuel Propriétaires</span>
        </button>

        <button
          onClick={() => setActiveSubTab('forecast_vs_actual')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'forecast_vs_actual'
              ? 'bg-violet-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Réservations Réelles vs Prévisions (Typologies)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('automations')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'automations'
              ? 'bg-violet-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>Automatisations (Brief Lundi & Slack)</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </button>

        <button
          onClick={() => setActiveSubTab('excel_export')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'excel_export'
              ? 'bg-violet-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          <span>Export Historique Complet Excel</span>
        </button>
      </div>

      {/* VIEW 1: RAPPORT MENSUEL PROPRIÉTAIRES */}
      {activeSubTab === 'owner_report' && (
        <MonthlyOwnerReportView onShowToast={onShowToast} />
      )}

      {/* VIEW 2: RÉSERVATIONS RÉELLES VS PRÉVISIONS */}
      {activeSubTab === 'forecast_vs_actual' && (
        <div className="space-y-6">
          <ActualVsForecastRoomTypeChart hotel={hotel} />
        </div>
      )}

      {/* VIEW 3: AUTOMATISATIONS RM (BRIEF LUNDI & ALERTES SLACK) */}
      {activeSubTab === 'automations' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-violet-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-sm space-y-3">
            <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-xs font-semibold text-violet-200">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Automatisations & Connecteurs de Notification</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              Centre d&apos;Automatisation des Briefings & Alertes RM
            </h2>
            <p className="text-xs sm:text-sm text-violet-200/90 max-w-2xl leading-relaxed">
              Programmez l&apos;envoi autonome de vos synthèses du lundi matin et connectez votre canal Slack pour être alerté en temps réel lors de toute rupture de parité ou de compression de marché.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1: Brief Hebdomadaire du Lundi Matin */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-2xs space-y-5 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center">
                    <Mail className="w-6 h-6" />
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    mondayConfig.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {mondayConfig.enabled ? '● Actif (Tous les lundis)' : 'Inactif'}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Brief Hebdomadaire Automatisé du Lundi Matin
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Résume chaque lundi matin à <strong>{mondayConfig.timeOfDay}</strong> les performances de la semaine passée (TO, ADR, RevPAR, Pickup 7j) et prépare vos recommandations tarifaires pour la semaine à venir.
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 text-xs space-y-1.5 text-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Heure d&apos;envoi :</span>
                    <strong className="text-slate-800">Chaque lundi à {mondayConfig.timeOfDay}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Destinataires :</span>
                    <strong className="text-violet-700 truncate max-w-[200px]">{mondayConfig.recipients.join(', ')}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Dernier envoi :</span>
                    <span>{mondayConfig.lastSentAt || 'En attente'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                <button
                  onClick={() => setIsMondayModalOpen(true)}
                  className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Configurer & Tester le Brief</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Card 2: Surveillance Parité & Alertes Slack */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-2xs space-y-5 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    parityConfig.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {parityConfig.enabled ? '● Surveillance IA Active' : 'Inactif'}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Alertes Automatiques Slack (Ruptures de Parité IA)
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Notifie immédiatement votre canal Slack <strong>{parityConfig.channel}</strong> dès qu&apos;une fuite grossiste ou une sous-cotation OTA non consentie est détectée par l&apos;IA.
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 text-xs space-y-1.5 text-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Canal Slack configuré :</span>
                    <strong className="text-violet-700">{parityConfig.channel}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Écarts sous surveillance :</span>
                    <strong className="text-rose-700 font-bold">{parityDiscrepancies.length} dates sous-cotées</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Seuil d&apos;alerte :</span>
                    <span>Écart &ge; {parityConfig.triggerThresholdEur} €</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                <button
                  onClick={() => setIsSlackModalOpen(true)}
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Gérer les Alertes Slack & Parité</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 4: EXPORT HISTORIQUE COMPLET EXCEL */}
      {activeSubTab === 'excel_export' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Exportation Complète des Prix & Taux d&apos;Occupation (Excel)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Téléchargez l&apos;intégralité de vos séries temporelles pour travailler et analyser vos données hors ligne
                  </p>
                </div>
              </div>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full">
              Format Universel Excel FR (UTF-8 avec BOM)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              onClick={() => setExportRange('all')}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer space-y-2 ${
                exportRange === 'all'
                  ? 'border-emerald-500 bg-emerald-50/40 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Année Complète (365 jours)</span>
                <span className="text-xs font-black text-emerald-700">Recommandé</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Historique complet des prix, nuitées vendues, TO %, ADR, RevPAR, concurrence Lighthouse et statut de parité.
              </p>
            </div>

            <div
              onClick={() => setExportRange('90d')}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer space-y-2 ${
                exportRange === '90d'
                  ? 'border-emerald-500 bg-emerald-50/40 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">90 prochains jours</span>
                <span className="text-[11px] text-slate-500">Saison Haute</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Focus sur la période de commercialisation active, compression événementielle et recommandations tarifaires.
              </p>
            </div>

            <div
              onClick={() => setExportRange('30d')}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer space-y-2 ${
                exportRange === '30d'
                  ? 'border-emerald-500 bg-emerald-50/40 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Derniers 30 jours (Clôture)</span>
                <span className="text-[11px] text-slate-500">Audit Réalisé</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Contrôle comptable et réconciliation des chiffres d&apos;affaires hébergement réalisés avec le PMS.
              </p>
            </div>
          </div>

          {/* Detailed Columns preview */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
            <span className="font-bold text-slate-800 block">
              24 Colonnes incluses dans le fichier tableur :
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 text-[11px] text-slate-600">
              <span>• Date & Jour séjour</span>
              <span>• Titre événement & Score</span>
              <span>• Demande Marché (%)</span>
              <span>• Taux d&apos;occupation OTB (%)</span>
              <span>• Chambres réservées & Stock</span>
              <span>• Mon tarif BAR actuel (€)</span>
              <span>• Tarif suggéré RM (€)</span>
              <span>• Écart conseillé (€ et %)</span>
              <span>• ADR net réalisé (€)</span>
              <span>• RevPAR calculé (45 ch.)</span>
              <span>• Médiane & Moyenne Compset</span>
              <span>• Min & Max Compset</span>
              <span>• Rang Compset (1/6)</span>
              <span>• Statut Parité Tarifaire</span>
              <span>• Stratégie RM appliquée</span>
              <span>• Statut validation humaine</span>
            </div>
          </div>

          <button
            onClick={handleTriggerExcelExport}
            disabled={isExporting}
            className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? 'Génération du fichier...' : 'Télécharger le fichier Excel (.csv UTF-8)'}</span>
          </button>
        </div>
      )}

      {/* Modals */}
      <WeeklyMondayDigestConfigModal
        isOpen={isMondayModalOpen}
        onClose={() => setIsMondayModalOpen(false)}
        onShowToast={onShowToast}
      />

      <SlackParityMonitorModal
        isOpen={isSlackModalOpen}
        onClose={() => setIsSlackModalOpen(false)}
        onShowToast={onShowToast}
      />
    </div>
  );
};

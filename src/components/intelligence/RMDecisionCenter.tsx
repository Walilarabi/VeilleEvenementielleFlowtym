/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  Zap,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  Sliders,
  DollarSign,
  History,
  ShieldCheck,
  ShieldAlert,
  AlertOctagon,
  Lock,
  Building2,
  ExternalLink,
  Flame,
  ArrowRight,
  Filter,
  Check,
  X,
  Edit3,
  LayoutGrid,
  Table as TableIcon,
  ChevronDown,
  ChevronUp,
  Info,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { RMAlertItem, RMDecisionRecord, RMDecisionAction, Hotel, EventItem } from '../../types';
import {
  getStoredRMAlerts,
  getStoredRMDecisions,
  recordRMDecision,
  evaluateRMSafety,
  formatDemandWithPercentage,
  RM_HOTEL_SAFETY_LIMITS,
  RMSafetyEvaluation,
} from '../../services/rmDecisionService';
import { RMPerformanceTrendChart } from './RMPerformanceTrendChart';

interface RMDecisionCenterProps {
  hotel: Hotel;
  events: EventItem[];
  onSelectEvent: (event: EventItem) => void;
  onShowToast: (msg: string) => void;
}

export const RMDecisionCenter: React.FC<RMDecisionCenterProps> = ({
  hotel,
  events,
  onSelectEvent,
  onShowToast,
}) => {
  const [alerts, setAlerts] = useState<RMAlertItem[]>(() => getStoredRMAlerts(hotel.id));
  const [decisions, setDecisions] = useState<RMDecisionRecord[]>(() => getStoredRMDecisions(hotel.id));

  // Reload when hotel changes
  useEffect(() => {
    setAlerts(getStoredRMAlerts(hotel.id));
    setDecisions(getStoredRMDecisions(hotel.id));
  }, [hotel.id]);

  // Active tab inside Decision Center: 'alerts' | 'trends' | 'history'
  const [activeTab, setActiveTab] = useState<'alerts' | 'trends' | 'history'>('alerts');
  const [showInlineTrendInAlerts, setShowInlineTrendInAlerts] = useState<boolean>(true);

  // View mode for alerts: 'table' (default) | 'cards'
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Filter for alerts
  const [statusFilter, setStatusFilter] = useState<'active' | 'all' | 'processed'>('active');
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | 'critique' | 'haute' | 'moyenne' | 'safety'>('all');
  const [safetyFilterOnly, setSafetyFilterOnly] = useState<boolean>(false);

  // Expanded rows in Table View
  const [expandedRowIds, setExpandedRowIds] = useState<Record<string, boolean>>({});

  const toggleRowExpanded = (id: string) => {
    setExpandedRowIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Modal state for modifying rate
  const [modifyingAlert, setModifyingAlert] = useState<RMAlertItem | null>(null);
  const [customRateInput, setCustomRateInput] = useState<number>(300);
  const [customCommentInput, setCustomCommentInput] = useState<string>('');

  // Evaluated alerts with safety guardrails and demand percentages
  const evaluatedAlerts = useMemo(() => {
    return alerts.map((a) => {
      const safety = evaluateRMSafety(a.recommendedRate, a.currentRate, a.compsetAverageRate);
      const demandInfo = formatDemandWithPercentage(a.demandLevel);
      return {
        alert: a,
        safety,
        demandInfo,
      };
    });
  }, [alerts]);

  // Safety counts
  const safetyViolationsCount = evaluatedAlerts.filter((item) => item.safety.hasViolation).length;
  const ceilingBreachCount = evaluatedAlerts.filter((item) => item.safety.type === 'ceiling_breach').length;
  const floorBreachCount = evaluatedAlerts.filter((item) => item.safety.type === 'floor_breach').length;
  const largeStepCount = evaluatedAlerts.filter((item) => item.safety.type === 'large_step').length;

  // Filtering
  const filteredAlertsWithSafety = useMemo(() => {
    return evaluatedAlerts.filter(({ alert: a, safety }) => {
      if (statusFilter === 'active' && a.status !== 'active') return false;
      if (statusFilter === 'processed' && a.status === 'active') return false;
      if (urgencyFilter === 'safety') {
        if (!safety.hasViolation) return false;
      } else if (urgencyFilter !== 'all' && a.urgency !== urgencyFilter) {
        return false;
      }
      if (safetyFilterOnly && !safety.hasViolation) return false;
      return true;
    });
  }, [evaluatedAlerts, statusFilter, urgencyFilter, safetyFilterOnly]);

  // KPI calculations
  const activeAlertsCount = alerts.filter((a) => a.status === 'active').length;
  const acceptedDecisionsCount = decisions.filter((d) => d.action === 'accepted' || d.action === 'modified').length;
  const totalGainPotential = alerts
    .filter((a) => a.status === 'active')
    .reduce((sum, a) => sum + a.gapEur * (hotel.roomCount || 45) * 0.85, 0);

  // Actions
  const handleAccept = (alert: RMAlertItem) => {
    const { updatedAlerts, newDecision } = recordRMDecision(
      hotel.id,
      alert,
      'accepted',
      alert.recommendedRate,
      'Wali Larabi (Head of RM)',
      'Recommandation acceptée : alignement sur le tarif conseillé'
    );
    setAlerts(updatedAlerts);
    setDecisions((prev) => [newDecision, ...prev]);
    onShowToast(`Recommandation acceptée : ${alert.recommendedRate}€ appliqué pour le ${alert.dateStr}`);
  };

  const handleOpenModifyModal = (alert: RMAlertItem) => {
    setModifyingAlert(alert);
    setCustomRateInput(alert.recommendedRate);
    setCustomCommentInput('');
  };

  const handleConfirmModify = () => {
    if (!modifyingAlert) return;
    const { updatedAlerts, newDecision } = recordRMDecision(
      hotel.id,
      modifyingAlert,
      'modified',
      customRateInput,
      'Wali Larabi (Head of RM)',
      customCommentInput || `Tarif personnalisé fixé à ${customRateInput}€`
    );
    setAlerts(updatedAlerts);
    setDecisions((prev) => [newDecision, ...prev]);
    onShowToast(`Tarif modifié et appliqué à ${customRateInput}€`);
    setModifyingAlert(null);
  };

  const handleReject = (alert: RMAlertItem) => {
    const { updatedAlerts, newDecision } = recordRMDecision(
      hotel.id,
      alert,
      'rejected',
      alert.currentRate,
      'Wali Larabi (Head of RM)',
      'Recommandation rejetée : maintien de la grille actuelle'
    );
    setAlerts(updatedAlerts);
    setDecisions((prev) => [newDecision, ...prev]);
    onShowToast(`Recommandation rejetée pour le ${alert.dateStr}`);
  };

  const handlePostpone = (alert: RMAlertItem) => {
    const { updatedAlerts, newDecision } = recordRMDecision(
      hotel.id,
      alert,
      'postponed',
      alert.currentRate,
      'Wali Larabi (Head of RM)',
      'Décision reportée à J-7 après observation du pickup'
    );
    setAlerts(updatedAlerts);
    setDecisions((prev) => [newDecision, ...prev]);
    onShowToast(`Décision reportée de 48h`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Hero */}
      <div className="bg-gradient-to-r from-violet-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-xs font-semibold text-violet-200">
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>Centre de Décision Revenue Management · Pilotage Tarifaire</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              Opportunités & Alertes de Sous-Tarification
            </h2>
            <p className="text-xs sm:text-sm text-violet-200/90 max-w-2xl leading-relaxed">
              Détection en temps réel des risques de sous-tarification, des tensions compset et des opportunités de yield basées sur des sources vérifiées pour <strong>{hotel.name}</strong>.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="bg-white/10 border border-white/20 rounded-2xl px-4 py-2.5 text-center">
              <div className="text-[10px] uppercase font-bold text-violet-300">Alertes Actives</div>
              <div className="text-xl font-black text-amber-400 mt-0.5">{activeAlertsCount}</div>
              <div className="text-[10px] text-violet-300">À traiter</div>
            </div>

            <div className="bg-white/10 border border-white/20 rounded-2xl px-4 py-2.5 text-center">
              <div className="text-[10px] uppercase font-bold text-violet-300">Gain Potentiel</div>
              <div className="text-xl font-black text-emerald-400 mt-0.5">+{Math.round(totalGainPotential).toLocaleString('fr-FR')}€</div>
              <div className="text-[10px] text-violet-300">Sur la période</div>
            </div>

            <div className="bg-white/10 border border-white/20 rounded-2xl px-4 py-2.5 text-center">
              <div className="text-[10px] uppercase font-bold text-violet-300">Décisions Prises</div>
              <div className="text-xl font-black text-white mt-0.5">{decisions.length}</div>
              <div className="text-[10px] text-violet-300">Auditées & tracées</div>
            </div>
          </div>
        </div>

        {/* Subtabs: Alertes Actives vs Trajectoire ADR/RevPAR vs Journal d'Audit */}
        <div className="pt-2 border-t border-white/10 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('alerts')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'alerts' ? 'bg-white text-slate-900 shadow-xs' : 'text-violet-200 hover:bg-white/10'
            }`}
          >
            Alertes & Recommandations RM ({activeAlertsCount})
          </button>
          <button
            onClick={() => setActiveTab('trends')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'trends' ? 'bg-white text-slate-900 shadow-xs' : 'text-violet-200 hover:bg-white/10'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-violet-600" />
            <span>Évolution ADR & RevPAR (Recharts)</span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-violet-100 text-violet-800">
              Historique + Prévisionnel
            </span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'history' ? 'bg-white text-slate-900 shadow-xs' : 'text-violet-200 hover:bg-white/10'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Journal d&apos;Historique des Décisions ({decisions.length})</span>
          </button>
        </div>
      </div>

      {/* Main Tab 1: Alertes & Recommandations */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          {/* Quick Inline Trend Widget Toggle */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-violet-100 text-violet-700">
                <TrendingUp className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <span>Trajectoire de Performance : ADR Net & RevPAR Réalisé vs Prévisionnel</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
                    45 chambres · D-EDGE & Night Audit
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Visualisez immédiatement l'impact des décisions tarifaires sur vos indicateurs clés avant arbitrage.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowInlineTrendInAlerts(!showInlineTrendInAlerts)}
                className="text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
              >
                {showInlineTrendInAlerts ? 'Réduire le graphique' : 'Afficher le graphique'}
              </button>
              <button
                onClick={() => setActiveTab('trends')}
                className="text-xs font-bold text-violet-700 hover:text-violet-900 bg-violet-50 hover:bg-violet-100 border border-violet-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
              >
                Ouvrir en plein écran →
              </button>
            </div>
          </div>

          {showInlineTrendInAlerts && (
            <div className="animate-fadeIn">
              <RMPerformanceTrendChart hotel={hotel} />
            </div>
          )}
          {/* Bannière de Contrôle des Bornes de Sécurité Tarifaire */}
          <div className="bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-indigo-500/10 border border-amber-200/90 rounded-2xl p-4 shadow-2xs space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-amber-100 text-amber-900 shrink-0 border border-amber-300">
                  <ShieldAlert className="w-5 h-5 text-amber-700 animate-pulse" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                      <span>Système d'Alertes Visuelles & Bornes de Sécurité RM</span>
                    </h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-900 text-white tracking-wider">
                      {hotel.name} · {hotel.roomCount || 45} ch.
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Garde-fous stricts configurés :{' '}
                    <span className="font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      Plancher min : {RM_HOTEL_SAFETY_LIMITS.RATE_FLOOR_EUR}€
                    </span>{' '}
                    ·{' '}
                    <span className="font-bold text-rose-800 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                      Plafond max : {RM_HOTEL_SAFETY_LIMITS.RATE_CEILING_EUR}€
                    </span>{' '}
                    ·{' '}
                    <span className="font-bold text-orange-800 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">
                      Saut unitaire max : {RM_HOTEL_SAFETY_LIMITS.MAX_SINGLE_STEP_EUR}€
                    </span>
                    . Les tarifs suggérés en incohérence ou atteignant une borne sont automatiquement surlignés avec icônes d'avertissement.
                  </p>
                </div>
              </div>

              {/* Compteurs de bornes & Bouton Filtre Rapide */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <span
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold border flex items-center gap-1 ${
                    ceilingBreachCount > 0 ? 'bg-rose-100 text-rose-800 border-rose-300 ring-1 ring-rose-400' : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                  title="Tarifs atteignant ou dépassant le tarif plafond configuré (550€)"
                >
                  <AlertOctagon className="w-3.5 h-3.5 text-rose-600" />
                  <span>{ceilingBreachCount} Plafond (550€)</span>
                </span>

                <span
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold border flex items-center gap-1 ${
                    floorBreachCount > 0 ? 'bg-amber-100 text-amber-800 border-amber-300 ring-1 ring-amber-400' : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                  title="Tarifs atteignant le tarif plancher minimal garanti (180€)"
                >
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                  <span>{floorBreachCount} Plancher (180€)</span>
                </span>

                <span
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold border flex items-center gap-1 ${
                    largeStepCount > 0 ? 'bg-orange-100 text-orange-800 border-orange-300' : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                  title="Sauts tarifaires unitaires supérieurs à 100€"
                >
                  <Zap className="w-3.5 h-3.5 text-orange-600" />
                  <span>{largeStepCount} Saut &gt; 100€</span>
                </span>

                <button
                  onClick={() => setSafetyFilterOnly(!safetyFilterOnly)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                    safetyFilterOnly
                      ? 'bg-rose-600 text-white ring-2 ring-rose-400'
                      : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-300'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>{safetyFilterOnly ? 'Voir toutes les alertes' : `Filtrer alertes bornes (${safetyViolationsCount})`}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Filters Bar & View Switcher */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-700">Statut :</span>
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer transition-all ${
                  statusFilter === 'active' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Actives ({activeAlertsCount})
              </button>
              <button
                onClick={() => setStatusFilter('processed')}
                className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer transition-all ${
                  statusFilter === 'processed' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Traitées ({alerts.length - activeAlertsCount})
              </button>
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer transition-all ${
                  statusFilter === 'all' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Toutes ({alerts.length})
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Filtre Urgence & Bornes */}
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-700">Filtre Priorité :</span>
                <select
                  value={urgencyFilter}
                  onChange={(e) => setUrgencyFilter(e.target.value as any)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 font-semibold text-slate-700 focus:outline-hidden cursor-pointer"
                >
                  <option value="all">Toutes alertes</option>
                  <option value="safety">🚨 Bornes de Sécurité Uniquement ({safetyViolationsCount})</option>
                  <option value="critique">Critique</option>
                  <option value="haute">Haute</option>
                  <option value="moyenne">Moyenne</option>
                </select>
              </div>

              {/* View Switcher: Table vs Cards */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    viewMode === 'table' ? 'bg-white text-violet-800 shadow-2xs ring-1 ring-slate-200' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Vue Grille / Table de Recommandation Tarifaire"
                >
                  <TableIcon className="w-3.5 h-3.5 text-violet-600" />
                  <span>Table Recommandation RM</span>
                </button>
                <button
                  onClick={() => setViewMode('cards')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    viewMode === 'cards' ? 'bg-white text-violet-800 shadow-2xs ring-1 ring-slate-200' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Vue Fiches Détaillées"
                >
                  <LayoutGrid className="w-3.5 h-3.5 text-violet-600" />
                  <span>Fiches Détaillées</span>
                </button>
              </div>
            </div>
          </div>

          {/* Empty State */}
          {filteredAlertsWithSafety.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-8 text-center text-slate-500 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <div className="font-bold text-slate-900">Aucune alerte tarifaire sur ce filtre</div>
              <p className="text-xs">
                {safetyFilterOnly
                  ? 'Toutes les recommandations actuelles sont parfaitement conformes aux bornes de sécurité.'
                  : 'Toutes les alertes ont été traitées ou aucun enregistrement ne correspond aux critères.'}
              </p>
              {safetyFilterOnly && (
                <button
                  onClick={() => setSafetyFilterOnly(false)}
                  className="mt-2 text-xs font-bold text-violet-600 hover:text-violet-800 cursor-pointer"
                >
                  Réinitialiser le filtre sécurité →
                </button>
              )}
            </div>
          ) : viewMode === 'table' ? (
            /* VUE TABLE DE RECOMMANDATION TARIFAIRE RM AVEC ALERTES VISUELLES & SURLIGNAGE */
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] font-black uppercase text-slate-600 tracking-wider">
                      <th className="py-3 px-3">Date & Échéance</th>
                      <th className="py-3 px-3">Événement & Tension</th>
                      <th className="py-3 px-2 text-center whitespace-nowrap">Demande Marché (%)</th>
                      <th className="py-3 px-3 text-right whitespace-nowrap">Tarif Actuel</th>
                      <th className="py-3 px-3 text-right whitespace-nowrap">Tarif Suggéré RM</th>
                      <th className="py-3 px-2 text-center whitespace-nowrap">Écart (€ / %)</th>
                      <th className="py-3 px-3 text-right whitespace-nowrap">Moyenne Compset</th>
                      <th className="py-3 px-3">🚨 Bornes de Sécurité (Plancher/Plafond)</th>
                      <th className="py-3 px-2 text-center whitespace-nowrap">Confiance</th>
                      <th className="py-3 px-3 text-right">Validation Humaine</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAlertsWithSafety.map(({ alert, safety, demandInfo }) => {
                      const isExpanded = !!expandedRowIds[alert.id];
                      const isCritique = alert.urgency === 'critique';

                      return (
                        <React.Fragment key={alert.id}>
                          <tr
                            className={`transition-colors ${
                              safety.rowHighlightClass
                                ? safety.rowHighlightClass
                                : alert.status !== 'active'
                                ? 'bg-slate-50/60 opacity-75'
                                : 'hover:bg-slate-50/80'
                            }`}
                          >
                            {/* Date & Échéance */}
                            <td className="py-3 px-3 whitespace-nowrap align-middle">
                              <div className="space-y-0.5">
                                <div className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                                  <span>
                                    {new Date(alert.dateStr).toLocaleDateString('fr-FR', {
                                      weekday: 'short',
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric',
                                    })}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                      isCritique
                                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                        : alert.urgency === 'haute'
                                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                                    }`}
                                  >
                                    {alert.urgency}
                                  </span>
                                  {alert.status !== 'active' && (
                                    <span className="text-[9px] font-bold text-slate-500 capitalize">
                                      ({alert.status})
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Événement & Tension */}
                            <td className="py-3 px-3 align-middle max-w-[220px]">
                              <div className="font-bold text-slate-900 truncate" title={alert.eventTitle}>
                                {alert.eventTitle}
                              </div>
                              <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5 truncate">
                                <span>{alert.venueName}</span>
                                {alert.soldOutCompetitorsCount > 0 && (
                                  <span className="font-bold text-rose-600 bg-rose-50 px-1 rounded">
                                    {alert.soldOutCompetitorsCount} complets
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Demande Marché avec Taux en % (Amélioration 1) */}
                            <td className="py-3 px-2 text-center whitespace-nowrap align-middle">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border ${demandInfo.colorClass}`}
                                title={`Tension de marché estimée à ${demandInfo.percent}% sur Paris Opéra`}
                              >
                                {demandInfo.badge}
                              </span>
                            </td>

                            {/* Tarif Actuel */}
                            <td className="py-3 px-3 text-right whitespace-nowrap align-middle">
                              <span className="font-bold text-slate-800 text-sm tabular-nums">
                                {alert.currentRate} €
                              </span>
                              <div className="text-[9px] text-slate-400">CRS D-EDGE</div>
                            </td>

                            {/* Tarif Suggéré RM avec Surlignage Sécurité (Amélioration 2) */}
                            <td className="py-3 px-3 text-right whitespace-nowrap align-middle">
                              <div className="flex flex-col items-end">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm tabular-nums ${safety.cellHighlightClass}`}
                                >
                                  {safety.type === 'ceiling_breach' && (
                                    <AlertOctagon className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
                                  )}
                                  {safety.type === 'floor_breach' && (
                                    <Lock className="w-3.5 h-3.5 text-amber-600" />
                                  )}
                                  {safety.type === 'large_step' && (
                                    <Zap className="w-3.5 h-3.5 text-orange-600" />
                                  )}
                                  {safety.type === 'safe' && (
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                  )}
                                  <span>{alert.recommendedRate} €</span>
                                </span>

                                {/* Label contextuel sous le prix */}
                                {safety.type === 'ceiling_breach' && (
                                  <span className="text-[9px] font-bold text-rose-600 mt-0.5">
                                    🚨 Plafond Max ({RM_HOTEL_SAFETY_LIMITS.RATE_CEILING_EUR}€)
                                  </span>
                                )}
                                {safety.type === 'floor_breach' && (
                                  <span className="text-[9px] font-bold text-amber-700 mt-0.5">
                                    ⚠️ Plancher Min ({RM_HOTEL_SAFETY_LIMITS.RATE_FLOOR_EUR}€)
                                  </span>
                                )}
                                {safety.type === 'large_step' && (
                                  <span className="text-[9px] font-bold text-orange-700 mt-0.5">
                                    ⚡ Saut unitaire &gt; 100€
                                  </span>
                                )}
                                {safety.type === 'safe' && (
                                  <span className="text-[9px] font-semibold text-emerald-600 mt-0.5">
                                    🛡️ Conforme
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Écart (€ / %) */}
                            <td className="py-3 px-2 text-center whitespace-nowrap align-middle">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-lg text-xs font-black tabular-nums ${
                                  alert.gapEur > 0
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : alert.gapEur < 0
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-slate-50 text-slate-700 border border-slate-200'
                                }`}
                              >
                                {alert.gapEur > 0 ? `+${alert.gapEur}€` : `${alert.gapEur}€`}
                                <span className="text-[10px] font-bold opacity-80 ml-1">
                                  ({alert.gapPercent > 0 ? `+${alert.gapPercent}%` : `${alert.gapPercent}%`})
                                </span>
                              </span>
                            </td>

                            {/* Moyenne Compset */}
                            <td className="py-3 px-3 text-right whitespace-nowrap align-middle">
                              <span className="font-bold text-slate-800 text-xs tabular-nums">
                                {alert.compsetAverageRate} €
                              </span>
                              <div className="text-[9px] text-slate-400">5 concurrents</div>
                            </td>

                            {/* Colonne Bornes de Sécurité (Plancher / Plafond) */}
                            <td className="py-3 px-3 align-middle min-w-[210px]">
                              <div className="space-y-1">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${safety.badgeClass}`}
                                >
                                  {safety.type === 'ceiling_breach' && (
                                    <AlertOctagon className="w-3.5 h-3.5 text-rose-600 shrink-0 animate-pulse" />
                                  )}
                                  {safety.type === 'floor_breach' && (
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                  )}
                                  {safety.type === 'large_step' && (
                                    <ShieldAlert className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                                  )}
                                  {safety.type === 'compset_disconnect' && (
                                    <AlertTriangle className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                  )}
                                  {safety.type === 'safe' && (
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  )}
                                  <span>{safety.badgeLabel}</span>
                                </span>
                                {safety.hasViolation && (
                                  <p className="text-[10px] text-slate-600 line-clamp-1 max-w-[220px]" title={safety.explanation}>
                                    {safety.explanation}
                                  </p>
                                )}
                              </div>
                            </td>

                            {/* Confiance IA */}
                            <td className="py-3 px-2 text-center whitespace-nowrap align-middle">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-black">
                                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                <span>{alert.confidenceScore}%</span>
                              </span>
                            </td>

                            {/* Validation Humaine (Actions) */}
                            <td className="py-3 px-3 text-right whitespace-nowrap align-middle">
                              <div className="flex items-center justify-end gap-1.5">
                                {alert.status === 'active' ? (
                                  <>
                                    <button
                                      onClick={() => handleAccept(alert)}
                                      className="px-2.5 py-1.5 rounded-lg text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                                      title={`Accepter le tarif conseillé de ${alert.recommendedRate}€`}
                                    >
                                      <Check className="w-3 h-3" />
                                      <span>Accepter</span>
                                    </button>

                                    <button
                                      onClick={() => handleOpenModifyModal(alert)}
                                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-violet-50 hover:bg-violet-100 text-violet-800 border border-violet-200 transition-all flex items-center gap-1 cursor-pointer"
                                      title="Ajuster manuellement le tarif"
                                    >
                                      <Edit3 className="w-3 h-3 text-violet-600" />
                                      <span>Ajuster</span>
                                    </button>

                                    <button
                                      onClick={() => handleReject(alert)}
                                      className="p-1.5 rounded-lg text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer"
                                      title="Rejeter et conserver le tarif actuel"
                                    >
                                      <X className="w-3.5 h-3.5 text-rose-600" />
                                    </button>

                                    <button
                                      onClick={() => handlePostpone(alert)}
                                      className="p-1.5 rounded-lg text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer"
                                      title="Reporter la décision de 48h"
                                    >
                                      <Clock className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    <span>Traité ({alert.status})</span>
                                  </span>
                                )}

                                <button
                                  onClick={() => toggleRowExpanded(alert.id)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all cursor-pointer ml-1"
                                  title={isExpanded ? 'Masquer les détails' : 'Afficher les détails complets'}
                                >
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Accordéon Détails de l'alerte et des bornes de sécurité */}
                          {isExpanded && (
                            <tr className="bg-slate-50/90 border-b border-slate-200 animate-fadeIn">
                              <td colSpan={10} className="p-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                  {/* Colonne 1: Motif et compression */}
                                  <div className="space-y-2 bg-white p-3.5 rounded-xl border border-slate-200">
                                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                      <Info className="w-4 h-4 text-violet-600" />
                                      <span>Analyse & Justification Algorithmique</span>
                                    </div>
                                    <p className="text-slate-600 leading-relaxed">{alert.reason}</p>
                                    <div className="pt-1 text-[11px] text-slate-500 border-t border-slate-100">
                                      <strong className="text-slate-700">Facteur de compression :</strong>{' '}
                                      {alert.compressionFactor}
                                    </div>
                                  </div>

                                  {/* Colonne 2: Diagnostic de sécurité des bornes */}
                                  <div
                                    className={`space-y-2 p-3.5 rounded-xl border ${
                                      safety.hasViolation
                                        ? 'bg-amber-50/60 border-amber-300'
                                        : 'bg-emerald-50/50 border-emerald-200'
                                    }`}
                                  >
                                    <div className="font-bold flex items-center gap-1.5 text-slate-900">
                                      {safety.hasViolation ? (
                                        <ShieldAlert className="w-4 h-4 text-amber-600" />
                                      ) : (
                                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                      )}
                                      <span>Diagnostic des Bornes de Sécurité</span>
                                    </div>
                                    <p className="text-slate-700 leading-relaxed">{safety.explanation}</p>
                                    <div className="text-[11px] text-slate-500 pt-1 space-y-0.5 border-t border-slate-200/50">
                                      <div>
                                        • Plancher strict : <strong>{RM_HOTEL_SAFETY_LIMITS.RATE_FLOOR_EUR}€</strong>
                                      </div>
                                      <div>
                                        • Plafond strict : <strong>{RM_HOTEL_SAFETY_LIMITS.RATE_CEILING_EUR}€</strong>
                                      </div>
                                      <div>
                                        • Saut unitaire max : <strong>{RM_HOTEL_SAFETY_LIMITS.MAX_SINGLE_STEP_EUR}€</strong>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Colonne 3: Sources vérifiées & actions */}
                                  <div className="space-y-2 bg-white p-3.5 rounded-xl border border-slate-200">
                                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                      <Calendar className="w-4 h-4 text-indigo-600" />
                                      <span>Sources Données Vérifiées</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                      {alert.sources.map((src, sIdx) => (
                                        <span
                                          key={sIdx}
                                          className="bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded-md border border-slate-200"
                                        >
                                          {src}
                                        </span>
                                      ))}
                                    </div>
                                    <div className="pt-2 text-[11px] text-slate-500">
                                      Min stay conseillé : <strong>{alert.minStayRecommended} nuit(s)</strong> ·
                                      CTA conseillé : <strong>{alert.ctaRecommended ? 'Oui (Fermer)' : 'Non (Ouvert)'}</strong>
                                    </div>
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
          ) : (
            /* VUE FICHES DÉTAILLÉES AVEC ALERTES VISUELLES & SURLIGNAGE */
            <div className="space-y-4">
              {filteredAlertsWithSafety.map(({ alert, safety, demandInfo }) => {
                const isCritique = alert.urgency === 'critique';

                return (
                  <div
                    key={alert.id}
                    className={`bg-white rounded-3xl border p-5 sm:p-6 shadow-2xs space-y-4 transition-all ${
                      safety.rowHighlightClass
                        ? safety.rowHighlightClass
                        : alert.status !== 'active'
                        ? 'border-slate-200 opacity-70 bg-slate-50/50'
                        : isCritique
                        ? 'border-rose-200/90 ring-1 ring-rose-200/50'
                        : 'border-slate-200/90 hover:border-violet-300'
                    }`}
                  >
                    {/* Header: Date, Urgence, Demande %, Bornes de Sécurité, Confiance */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              alert.urgency === 'critique'
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : alert.urgency === 'haute'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            Urgence {alert.urgency}
                          </span>

                          <span className="text-xs font-bold text-slate-800">
                            {new Date(alert.dateStr).toLocaleDateString('fr-FR', {
                              weekday: 'long',
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })}
                          </span>

                          {/* Demande Marché avec Taux en % */}
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${demandInfo.colorClass}`}
                          >
                            {demandInfo.badge}
                          </span>

                          {/* Badge de Sécurité Bornes */}
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${safety.badgeClass}`}
                          >
                            {safety.type === 'ceiling_breach' && (
                              <AlertOctagon className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
                            )}
                            {safety.type === 'floor_breach' && (
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            )}
                            {safety.type === 'large_step' && (
                              <Zap className="w-3.5 h-3.5 text-orange-600" />
                            )}
                            {safety.type === 'safe' && (
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            )}
                            <span>{safety.badgeLabel}</span>
                          </span>

                          {alert.status !== 'active' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700 capitalize">
                              Statut : {alert.status}
                            </span>
                          )}
                        </div>

                        <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                          {alert.eventTitle}
                        </h3>
                        <p className="text-xs text-slate-500">
                          Lieu : {alert.venueName} · Tension compset : {alert.soldOutCompetitorsCount} concurrents complets
                        </p>
                      </div>

                      {/* Confidence Score Pill */}
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold shrink-0">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>Confiance {alert.confidenceScore}%</span>
                      </div>
                    </div>

                    {/* Surlignage Avertissement Sécurité si incohérence */}
                    {safety.hasViolation && (
                      <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-300 text-xs text-amber-900 flex items-start gap-2.5">
                        <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                        <div>
                          <strong>Avertissement Borne de Sécurité :</strong> {safety.explanation}
                        </div>
                      </div>
                    )}

                    {/* Rate Comparison Strip avec surlignage des tarifs */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200/80 text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Tarif Actuel</span>
                        <span className="text-lg font-bold text-slate-800 mt-0.5 block">{alert.currentRate}€</span>
                        <span className="text-[10px] text-slate-500">Grille enregistrée</span>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-violet-600 uppercase block">Tarif Conseillé</span>
                        <span
                          className={`text-lg mt-0.5 inline-block ${
                            safety.cellHighlightClass || 'font-black text-violet-700'
                          }`}
                        >
                          {alert.recommendedRate}€
                        </span>
                        <span className="text-[10px] text-violet-600 font-semibold block">
                          Yield optimisé {safety.type === 'ceiling_breach' ? '(Plafond 550€)' : safety.type === 'floor_breach' ? '(Plancher 180€)' : ''}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-emerald-600 uppercase block">Écart (€ / %)</span>
                        <span className="text-lg font-black text-emerald-600 mt-0.5 block">
                          {alert.gapEur > 0 ? `+${alert.gapEur}€` : `${alert.gapEur}€`} ({alert.gapPercent > 0 ? `+${alert.gapPercent}%` : `${alert.gapPercent}%`})
                        </span>
                        <span className="text-[10px] text-emerald-600 font-semibold">
                          {alert.gapEur >= 0 ? 'Sous-tarification' : 'Sur-tarification'}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Moyenne Compset</span>
                        <span className="text-lg font-bold text-slate-800 mt-0.5 block">{alert.compsetAverageRate}€</span>
                        <span className="text-[10px] text-slate-500">5 hôtels à proximité</span>
                      </div>
                    </div>

                    {/* Reason and Compression explanation */}
                    <div className="space-y-1.5 text-xs text-slate-700 leading-relaxed bg-amber-50/50 p-3.5 rounded-2xl border border-amber-200/60">
                      <div>
                        <strong className="text-amber-900">Motif de l&apos;alerte :</strong> {alert.reason}
                      </div>
                      <div className="text-slate-600">
                        <strong>Facteur de compression :</strong> {alert.compressionFactor}
                      </div>
                    </div>

                    {/* Sources consultation */}
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 pt-1">
                      <span className="font-bold text-slate-700">Sources vérifiées :</span>
                      {alert.sources.map((src, sIdx) => (
                        <span key={sIdx} className="bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                          {src}
                        </span>
                      ))}
                    </div>

                    {/* THE 4 REQUIRED ACTIONS */}
                    {alert.status === 'active' ? (
                      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                        <div className="text-[11px] text-slate-500">
                          Prenez une décision pour verrouiller ou ajuster la grille tarifaire :
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {/* Action 1: Accepter */}
                          <button
                            onClick={() => handleAccept(alert)}
                            className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Accepter ({alert.recommendedRate}€)</span>
                          </button>

                          {/* Action 2: Modifier */}
                          <button
                            onClick={() => handleOpenModifyModal(alert)}
                            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-violet-50 hover:bg-violet-100 text-violet-800 border border-violet-200 transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-violet-600" />
                            <span>Modifier le tarif</span>
                          </button>

                          {/* Action 3: Rejeter */}
                          <button
                            onClick={() => handleReject(alert)}
                            className="px-3 py-2 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5 text-rose-600" />
                            <span>Rejeter</span>
                          </button>

                          {/* Action 4: Reporter */}
                          <button
                            onClick={() => handlePostpone(alert)}
                            className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>Reporter (48h)</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Décision enregistrée dans l&apos;historique RM</span>
                        </span>
                        <button
                          onClick={() => {
                            setAlerts((prev) => prev.map((a) => (a.id === alert.id ? { ...a, status: 'active' } : a)));
                            onShowToast('Alerte réouverte');
                          }}
                          className="text-xs text-violet-600 hover:text-violet-800 font-bold cursor-pointer"
                        >
                          Réévaluer l&apos;alerte
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Main Tab: Visualisation Recharts Évolution ADR & RevPAR (Historique & Prévisionnel) */}
      {activeTab === 'trends' && (
        <div className="space-y-4">
          <RMPerformanceTrendChart hotel={hotel} />
        </div>
      )}

      {/* Main Tab 2: Decision Audit Trail / Historique */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Journal d&apos;Audit des Décisions Revenue Management
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Traçabilité complète des ajustements tarifaires et des choix stratégiques
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-slate-100 text-slate-700 rounded-xl border border-slate-200">
              {decisions.length} décision{decisions.length > 1 ? 's' : ''}
            </span>
          </div>

          {decisions.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
              Aucune décision enregistrée pour le moment. Traitez une alerte ci-dessus pour alimenter l&apos;audit trail.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase text-slate-500 font-bold">
                  <tr>
                    <th className="py-2.5 px-3">Date d&apos;impact</th>
                    <th className="py-2.5 px-3">Événement</th>
                    <th className="py-2.5 px-3">Action RM</th>
                    <th className="py-2.5 px-3">Tarif Initial</th>
                    <th className="py-2.5 px-3">Tarif Appliqué</th>
                    <th className="py-2.5 px-3">Delta</th>
                    <th className="py-2.5 px-3">Décidé par</th>
                    <th className="py-2.5 px-3">Horodatage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {decisions.map((dec) => {
                    const delta = dec.appliedRate - dec.originalCurrentRate;

                    return (
                      <tr key={dec.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{dec.dateStr}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900 max-w-[200px] truncate">{dec.eventTitle}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              dec.action === 'accepted'
                                ? 'bg-emerald-100 text-emerald-800'
                                : dec.action === 'modified'
                                ? 'bg-violet-100 text-violet-800'
                                : dec.action === 'rejected'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {dec.action}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{dec.originalCurrentRate}€</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{dec.appliedRate}€</td>
                        <td className="py-2.5 px-3">
                          <span className={`font-bold ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                            {delta > 0 ? `+${delta}€` : `${delta}€`}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{dec.decidedBy}</td>
                        <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                          {new Date(dec.decidedAt).toLocaleString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal for Modifying Rate */}
      {modifyingAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setModifyingAlert(null)} />
          <div className="relative bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 z-10 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">Ajuster le tarif personnalisé</h3>
              <button onClick={() => setModifyingAlert(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Définissez votre propre tarif pour <strong>{modifyingAlert.eventTitle}</strong> ({modifyingAlert.dateStr}) :
            </p>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3">
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-500 block mb-1">
                  Nouveau tarif par nuit (€)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={customRateInput}
                    onChange={(e) => setCustomRateInput(parseInt(e.target.value, 10) || 0)}
                    min={100}
                    max={1500}
                    step={5}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                  <span className="font-bold text-slate-600 text-sm">€ / nuit</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-slate-500 block mb-1">
                  Justification RM (optionnel)
                </label>
                <input
                  type="text"
                  value={customCommentInput}
                  onChange={(e) => setCustomCommentInput(e.target.value)}
                  placeholder="Ex : Négociation contingent groupe en cours, ajustement test"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>
            </div>

            {/* Live Safety Guardrail Indicator in Modal */}
            {customRateInput >= RM_HOTEL_SAFETY_LIMITS.RATE_CEILING_EUR ? (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  <strong>Avertissement Plafond :</strong> ce tarif atteint ou dépasse le tarif plafond ({RM_HOTEL_SAFETY_LIMITS.RATE_CEILING_EUR}€).
                </span>
              </div>
            ) : customRateInput <= RM_HOTEL_SAFETY_LIMITS.RATE_FLOOR_EUR ? (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Avertissement Plancher :</strong> ce tarif est égal ou inférieur au plancher garanti ({RM_HOTEL_SAFETY_LIMITS.RATE_FLOOR_EUR}€).
                </span>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Tarif conforme aux bornes de l'hôtel [{RM_HOTEL_SAFETY_LIMITS.RATE_FLOOR_EUR}€ - {RM_HOTEL_SAFETY_LIMITS.RATE_CEILING_EUR}€].</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setModifyingAlert(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmModify}
                className="px-4 py-2 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl shadow-xs cursor-pointer"
              >
                Appliquer et tracer ({customRateInput}€)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

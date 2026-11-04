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
  Building2,
  ExternalLink,
  Flame,
  ArrowRight,
  Filter,
  Check,
  X,
  Edit3,
} from 'lucide-react';
import { RMAlertItem, RMDecisionRecord, RMDecisionAction, Hotel, EventItem } from '../../types';
import {
  getStoredRMAlerts,
  getStoredRMDecisions,
  recordRMDecision,
} from '../../services/rmDecisionService';

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

  // Active tab inside Decision Center: 'active_alerts' vs 'decision_audit_log'
  const [activeTab, setActiveTab] = useState<'alerts' | 'history'>('alerts');

  // Filter for alerts
  const [statusFilter, setStatusFilter] = useState<'active' | 'all' | 'processed'>('active');
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | 'critique' | 'haute' | 'moyenne'>('all');

  // Modal state for modifying rate
  const [modifyingAlert, setModifyingAlert] = useState<RMAlertItem | null>(null);
  const [customRateInput, setCustomRateInput] = useState<number>(300);
  const [customCommentInput, setCustomCommentInput] = useState<string>('');

  // Filtering
  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (statusFilter === 'active' && a.status !== 'active') return false;
      if (statusFilter === 'processed' && a.status === 'active') return false;
      if (urgencyFilter !== 'all' && a.urgency !== urgencyFilter) return false;
      return true;
    });
  }, [alerts, statusFilter, urgencyFilter]);

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

        {/* Subtabs: Alertes Actives vs Journal d'Audit */}
        <div className="pt-2 border-t border-white/10 flex items-center gap-2">
          <button
            onClick={() => setActiveTab('alerts')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'alerts' ? 'bg-white text-slate-900 shadow-xs' : 'text-violet-200 hover:bg-white/10'
            }`}
          >
            Alertes & Recommandations RM ({activeAlertsCount})
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
          {/* Filters Bar */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-700">Statut :</span>
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                  statusFilter === 'active' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                Actives ({activeAlertsCount})
              </button>
              <button
                onClick={() => setStatusFilter('processed')}
                className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                  statusFilter === 'processed' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                Traitées ({alerts.length - activeAlertsCount})
              </button>
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                  statusFilter === 'all' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                Toutes ({alerts.length})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700">Urgence :</span>
              <select
                value={urgencyFilter}
                onChange={(e) => setUrgencyFilter(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 font-semibold text-slate-700"
              >
                <option value="all">Toutes urgences</option>
                <option value="critique">Critique</option>
                <option value="haute">Haute</option>
                <option value="moyenne">Moyenne</option>
              </select>
            </div>
          </div>

          {/* Alert Cards */}
          {filteredAlerts.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-8 text-center text-slate-500 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <div className="font-bold text-slate-900">Toutes les alertes ont été traitées !</div>
              <p className="text-xs">Aucune opportunité nécessitant une décision immédiate sur ce filtre.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAlerts.map((alert) => {
                const associatedEvent = events.find((e) => e.id === alert.eventId);
                const isCritique = alert.urgency === 'critique';

                return (
                  <div
                    key={alert.id}
                    className={`bg-white rounded-3xl border p-5 sm:p-6 shadow-2xs space-y-4 transition-all ${
                      alert.status !== 'active'
                        ? 'border-slate-200 opacity-70 bg-slate-50/50'
                        : isCritique
                        ? 'border-rose-200/90 ring-1 ring-rose-200/50'
                        : 'border-slate-200/90 hover:border-violet-300'
                    }`}
                  >
                    {/* Header: Date, Urgency, Status, Event Title */}
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

                    {/* Rate Comparison Strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200/80 text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Tarif Actuel</span>
                        <span className="text-lg font-bold text-slate-800 mt-0.5 block">{alert.currentRate}€</span>
                        <span className="text-[10px] text-slate-500">Grille enregistrée</span>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-violet-600 uppercase block">Tarif Conseillé</span>
                        <span className="text-lg font-black text-violet-700 mt-0.5 block">{alert.recommendedRate}€</span>
                        <span className="text-[10px] text-violet-600 font-semibold">Yield optimisé</span>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-emerald-600 uppercase block">Écart (€ / %)</span>
                        <span className="text-lg font-black text-emerald-600 mt-0.5 block">
                          +{alert.gapEur}€ (+{alert.gapPercent}%)
                        </span>
                        <span className="text-[10px] text-emerald-600 font-semibold">Sous-tarification</span>
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
                            className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
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
                            // Re-open
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

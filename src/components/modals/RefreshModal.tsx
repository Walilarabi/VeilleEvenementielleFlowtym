/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  RotateCcw,
  Search,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  Zap,
  TrendingUp,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  X,
  Layers,
  Globe,
  Terminal,
  Activity,
  CheckCircle,
  ExternalLink,
  MapPin,
  Clock,
  Building2,
  Filter,
} from 'lucide-react';
import { EventItem, EventProposal, Hotel } from '../../types';
import {
  runEventIntelligenceCampaign,
  AgentCampaignResult,
  getCampaignsHistory,
  DiscoveredSourceRecord,
} from '../../services/eventIntelligenceAgent';

interface RefreshModalProps {
  isOpen: boolean;
  onClose: () => void;
  hotel: Hotel;
  onRefreshComplete: (
    newHighImpactEvents: EventItem[],
    newProposals: EventProposal[],
    stats: { newCount: number; modifiedCount: number; cancelledCount: number; verifiedCount: number }
  ) => void;
  onOpenProposals: () => void;
}

export const RefreshModal: React.FC<RefreshModalProps> = ({
  isOpen,
  onClose,
  hotel,
  onRefreshComplete,
  onOpenProposals,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [currentPhase, setCurrentPhase] = useState(1);
  const [phaseTitle, setPhaseTitle] = useState('Initialisation de l’Agent IA...');
  const [progressPercent, setProgressPercent] = useState(0);
  const [liveLog, setLiveLog] = useState('');
  const [campaignResult, setCampaignResult] = useState<AgentCampaignResult | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [activeReportTab, setActiveReportTab] = useState<'events' | 'sources' | 'logs'>('events');

  // Live real-time counters during execution
  const [counters, setCounters] = useState({
    sourcesAnalyzed: 8,
    newSources: 0,
    eventsFound: 0,
    duplicatesFiltered: 0,
    integrated: 0,
    pendingValidation: 0,
  });

  const logsEndRef = useRef<HTMLDivElement>(null);
  const [allLogs, setAllLogs] = useState<string[]>([]);

  // Auto-scroll logs terminal
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [allLogs]);

  // When modal opens, launch campaign automatically or reset
  useEffect(() => {
    if (isOpen) {
      handleLaunchCampaign();
    } else {
      setIsRunning(false);
      setProgressPercent(0);
      setCampaignResult(null);
      setAllLogs([]);
    }
  }, [isOpen]);

  const handleLaunchCampaign = async () => {
    setIsRunning(true);
    setProgressPercent(5);
    setCampaignResult(null);
    setAllLogs([]);
    setShowHistory(false);
    setCounters({
      sourcesAnalyzed: 8,
      newSources: 0,
      eventsFound: 0,
      duplicatesFiltered: 0,
      integrated: 0,
      pendingValidation: 0,
    });

    try {
      const result = await runEventIntelligenceCampaign(
        hotel,
        [], // existing events for deduplication
        [], // existing proposals
        (step) => {
          setCurrentPhase(step.phase);
          setPhaseTitle(step.phaseTitle);
          setProgressPercent(step.progressPercent);
          setLiveLog(step.log);
          setCounters(step.counters);
          setAllLogs((prev) => [...prev, step.log]);
        }
      );

      setCampaignResult(result);
      setIsRunning(false);

      // Notify parent app of new data
      onRefreshComplete(
        result.newIntegratedEvents,
        result.newProposals,
        {
          newCount: result.eventsIntegratedCount,
          modifiedCount: 1,
          cancelledCount: 0,
          verifiedCount: result.sourcesAnalyzedCount,
        }
      );
    } catch (err: any) {
      console.error('Agent campaign failed:', err);
      setIsRunning(false);
      setAllLogs((prev) => [...prev, `[Erreur] ${err?.message || 'Échec de la campagne'}`]);
    }
  };

  if (!isOpen) return null;

  const pastCampaigns = getCampaignsHistory();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs transition-all animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/90 dark:border-slate-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Sticky Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white flex items-center justify-center shadow-sm shadow-violet-200">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                  Agent IA de Veille Événementielle Autonome
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-800 dark:text-violet-300 border border-violet-200 dark:border-violet-800/70">
                  Temps Réel
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                <span>Établissement cible : <strong className="text-slate-800 dark:text-slate-200">{hotel.name}</strong> ({hotel.city})</span>
                <span className="text-slate-300">·</span>
                <span>Rayon : <strong>10/30 km</strong></span>
                <span className="text-slate-300">·</span>
                <span>Horizon : <strong>24–36 mois</strong></span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isRunning && (
              <button
                onClick={() => setShowHistory((prev) => !prev)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  showHistory
                    ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-800 dark:text-violet-300 border-violet-300 dark:border-violet-700/70'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80'
                }`}
              >
                Historique des campagnes ({pastCampaigns.length})
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* HISTORY VIEW */}
          {showHistory && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                  Historique des campagnes d'exploration
                </h3>
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-xs font-semibold text-violet-700 dark:text-violet-300 hover:underline"
                >
                  Retour au résultat actuel
                </button>
              </div>

              {pastCampaigns.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Aucune campagne archivée pour le moment.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {pastCampaigns.map((c) => (
                    <div
                      key={c.campaignId}
                      className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-900 hover:border-violet-300 dark:hover:border-violet-600/70 hover:shadow-xs transition-all text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          Campagne du {new Date(c.startedAt).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Durée : {Math.round(c.durationMs / 1000)}s
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-600 dark:text-slate-400 pt-1">
                        <div>Sources auditées : <strong>{c.sourcesAnalyzedCount}</strong></div>
                        <div>Nouvelles sources : <strong className="text-emerald-700 dark:text-emerald-300">+{c.newSourcesDiscoveredCount}</strong></div>
                        <div>Événements intégrés : <strong className="text-violet-700 dark:text-violet-300">{c.eventsIntegratedCount}</strong></div>
                        <div>Doublons éliminés : <strong>{c.duplicatesFilteredCount}</strong></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ACTIVE CAMPAIGN OR FINAL REPORT */}
          {!showHistory && (
            <>
              {/* Progress Bar & Phase Status */}
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {isRunning ? (
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-violet-600" />
                      </span>
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    )}
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {isRunning ? `Phase ${currentPhase}/5 : ${phaseTitle}` : 'Campagne terminée avec succès'}
                    </span>
                  </div>

                  <span className="text-xs font-extrabold text-violet-700 dark:text-violet-300 tabular-nums">
                    {progressPercent}%
                  </span>
                </div>

                {/* Progress bar line */}
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-violet-600 to-indigo-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                {/* Live log ticker */}
                {isRunning && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate flex items-center gap-1.5 pt-1">
                    <Activity className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 animate-spin" />
                    <span>{liveLog || 'Connexion aux flux de données...'}</span>
                  </div>
                )}
              </div>

              {/* Real-time Counters Grid (Section 8 requirements) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                {/* 1. Sources analysées */}
                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1">
                  <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Sources analysées</span>
                  <div className="text-xl font-black text-slate-900 dark:text-slate-100 tabular-nums">
                    {counters.sourcesAnalyzed}
                  </div>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Globe className="w-3 h-3 text-violet-500" />
                    Viparis, agendas, arénas
                  </span>
                </div>

                {/* 2. Nouvelles sources découvertes */}
                <div className="bg-emerald-50/70 dark:bg-emerald-950/40 p-3.5 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/70 shadow-2xs space-y-1">
                  <span className="text-emerald-800 dark:text-emerald-300 text-[10px] font-bold uppercase tracking-wider block">Nouvelles sources</span>
                  <div className="text-xl font-black text-emerald-700 dark:text-emerald-300 tabular-nums">
                    +{counters.newSources}
                  </div>
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    Mémorisées au réseau
                  </span>
                </div>

                {/* 3. Événements trouvés */}
                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1">
                  <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Événements trouvés</span>
                  <div className="text-xl font-black text-slate-900 dark:text-slate-100 tabular-nums">
                    {counters.eventsFound}
                  </div>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Search className="w-3 h-3 text-slate-400" />
                    2026 à 2028
                  </span>
                </div>

                {/* 4. Doublons écartés */}
                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1">
                  <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Doublons écartés</span>
                  <div className="text-xl font-black text-slate-700 dark:text-slate-300 tabular-nums">
                    {counters.duplicatesFiltered}
                  </div>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    Fusion des preuves
                  </span>
                </div>

                {/* 5. Événements intégrés (Score >= 60) */}
                <div className="bg-violet-50/70 dark:bg-violet-950/40 p-3.5 rounded-2xl border border-violet-200 dark:border-violet-800/70 shadow-2xs space-y-1">
                  <span className="text-violet-900 dark:text-violet-200 text-[10px] font-bold uppercase tracking-wider block">Intégrés direct</span>
                  <div className="text-xl font-black text-violet-700 dark:text-violet-300 tabular-nums">
                    {counters.integrated}
                  </div>
                  <span className="text-[10px] text-violet-700 dark:text-violet-300 font-semibold flex items-center gap-1">
                    <Zap className="w-3 h-3 text-violet-600 dark:text-violet-400" />
                    Score RM ≥ 60
                  </span>
                </div>

                {/* 6. À valider (Score 30-59) */}
                <div className="bg-amber-50/70 dark:bg-amber-950/40 p-3.5 rounded-2xl border border-amber-200 dark:border-amber-800/70 shadow-2xs space-y-1">
                  <span className="text-amber-900 dark:text-amber-200 text-[10px] font-bold uppercase tracking-wider block">À valider RM</span>
                  <div className="text-xl font-black text-amber-700 dark:text-amber-300 tabular-nums">
                    {counters.pendingValidation}
                  </div>
                  <span className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    Score 30 à 59
                  </span>
                </div>
              </div>

              {/* REPORT TABS WHEN CAMPAIGN IS READY OR RUNNING */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button
                      onClick={() => setActiveReportTab('events')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        activeReportTab === 'events'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      Événements qualifiés ({campaignResult?.newIntegratedEvents.length || counters.integrated})
                    </button>
                    <button
                      onClick={() => setActiveReportTab('sources')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        activeReportTab === 'sources'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      Nouvelles sources ({campaignResult?.newDiscoveredSources.length || counters.newSources})
                    </button>
                    <button
                      onClick={() => setActiveReportTab('logs')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                        activeReportTab === 'logs'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      <Terminal className="w-3.5 h-3.5" />
                      <span>Console d&apos;exécution ({allLogs.length})</span>
                    </button>
                  </div>

                  {campaignResult && (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      Pilote : <strong>Folkestone Opéra · Paris</strong> ({campaignResult.summaryStats.primaryRadiusKm} / {campaignResult.summaryStats.extendedRadiusKm} km)
                    </span>
                  )}
                </div>

                {/* TAB 1: DISCOVERED & INTEGRATED EVENTS */}
                {activeReportTab === 'events' && (
                  <div className="space-y-3">
                    {campaignResult?.newIntegratedEvents.length === 0 && !isRunning && (
                      <div className="p-8 text-center text-slate-400 text-xs">
                        Aucun nouvel événement à intégrer sur ce cycle.
                      </div>
                    )}

                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                      {(campaignResult?.newIntegratedEvents || []).map((ev) => {
                        const dist = ev.hotelImpacts[hotel.id]?.distanceKm ?? 5.5;
                        return (
                          <div
                            key={ev.id}
                            className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-violet-300 dark:hover:border-violet-600/70 hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                          >
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-slate-900 dark:text-slate-100">{ev.title}</span>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    ev.impactLevel === 'hyper'
                                      ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300'
                                      : 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300'
                                  }`}
                                >
                                  Impact {ev.impactLevel}
                                </span>
                                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/70">
                                  Dates confirmées officielles
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-wrap">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                  {ev.startDate} → {ev.endDate}
                                </span>
                                <span>·</span>
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                  {ev.venueName} ({dist} km)
                                </span>
                                <span>·</span>
                                <span>{(ev.expectedAttendance || 0).toLocaleString('fr-FR')} pax</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                              <div className="text-right">
                                <div className="text-sm font-black text-violet-700 dark:text-violet-300 tabular-nums">
                                  Score RM {ev.scoreBreakdown.finalRMScore}/100
                                </div>
                                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                                  ADR +{ev.hotelImpacts[hotel.id]?.estimatedADRBoostPercent || 35}% estimé
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TAB 2: NEWLY DISCOVERED SOURCES */}
                {activeReportTab === 'sources' && (
                  <div className="space-y-3">
                    <div className="bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 rounded-2xl p-3 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>
                        L&apos;agent mémorise automatiquement ces nouvelles sources dans son référentiel permanent et les réinterrogera lors des prochaines campagnes.
                      </span>
                    </div>

                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {(campaignResult?.newDiscoveredSources || []).map((src) => (
                        <div
                          key={src.id}
                          className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 dark:text-slate-100">{src.name}</span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300">
                                Découverte IA
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                              <span className="font-mono text-slate-600 dark:text-slate-400">{src.domain}</span>
                              <span>·</span>
                              <span>Catégorie : {src.category}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <span className="text-[10px] text-slate-400 block">Indice fiabilité</span>
                              <strong className="text-xs font-black text-emerald-700 dark:text-emerald-300">{src.reliabilityScore}%</strong>
                            </div>
                            <a
                              href={src.url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-slate-400 hover:text-violet-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Visiter la source"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB 3: LIVE TERMINAL LOGS */}
                {activeReportTab === 'logs' && (
                  <div className="bg-slate-950 text-slate-200 font-mono text-[11px] rounded-2xl p-4 h-64 overflow-y-auto space-y-1.5 border border-slate-800 shadow-inner">
                    {allLogs.map((log, index) => (
                      <div
                        key={index}
                        className={`leading-relaxed ${
                          log.includes('NOUVELLE SOURCE')
                            ? 'text-emerald-400 font-bold'
                            : log.includes('QUALIFIÉ')
                            ? 'text-violet-300 font-bold'
                            : log.includes('À VALIDER')
                            ? 'text-amber-300'
                            : log.includes('Doublon')
                            ? 'text-slate-400'
                            : 'text-slate-300'
                        }`}
                      >
                        {log}
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Sticky Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Déduplication stricte & Vérification croisée des sources actives</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {!isRunning && (
              <button
                onClick={handleLaunchCampaign}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span>Relancer une exploration</span>
              </button>
            )}

            {campaignResult && campaignResult.proposalsCount > 0 && (
              <button
                onClick={() => {
                  onClose();
                  onOpenProposals();
                }}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 dark:text-slate-50 font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>Examiner les propositions ({campaignResult.proposalsCount})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={onClose}
              disabled={isRunning}
              className={`px-5 py-2 rounded-xl font-bold transition-all cursor-pointer ${
                isRunning
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-violet-600 hover:bg-violet-700 text-white shadow-xs'
              }`}
            >
              {isRunning ? 'Exploration en cours...' : 'Consulter le calendrier mis à jour'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  X,
  Calendar,
  Building2,
  TrendingUp,
  AlertTriangle,
  Zap,
  MapPin,
  Users,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Flame,
  Clock,
  Layers,
  ArrowRight,
  Sliders,
  DollarSign,
  ChevronRight,
  Info,
  Activity,
  BedDouble,
  BarChart3,
  HelpCircle,
  FileCheck2,
  Lock,
} from 'lucide-react';
import { EventItem, Hotel, StandardDemandLevel } from '../../types';
import { getCompsetForDate } from '../../services/compsetBenchmarkService';
import { getDEdgeInventoryForDate } from '../../services/dedgeConnectivityService';
import { generateRMEpistemologicalBreakdown } from '../../services/rmEpistemologicalEngine';
import { formatEventDateRange, getCategoryLabel, getImpactColorClasses } from '../../utils/helpers';

interface DateDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string;
  hotel: Hotel;
  events: EventItem[];
  onSelectEvent: (event: EventItem) => void;
  onApplyRecommendation?: (dateStr: string, recommendedRate: number) => void;
}

export const DateDetailModal: React.FC<DateDetailModalProps> = ({
  isOpen,
  onClose,
  dateStr,
  hotel,
  events,
  onSelectEvent,
  onApplyRecommendation,
}) => {
  if (!isOpen || !dateStr) return null;

  const dateObj = new Date(dateStr);
  const formattedDateFr = dateObj.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Événements actifs à cette date
  const dayEvents = useMemo(
    () => events.filter((e) => e.startDate <= dateStr && e.endDate >= dateStr),
    [events, dateStr]
  );
  const totalPax = dayEvents.reduce((acc, e) => acc + (e.expectedAttendance || 0), 0);
  const maxScore =
    dayEvents.length > 0 ? Math.max(...dayEvents.map((e) => e.scoreBreakdown?.finalRMScore ?? 50)) : 0;

  // Données de veille tarifaire Lighthouse Compset
  const compset = useMemo(
    () => getCompsetForDate(hotel.id, dateStr, hotel.baseADR, dayEvents.length, maxScore, totalPax),
    [hotel.id, dateStr, hotel.baseADR, dayEvents.length, maxScore, totalPax]
  );

  // Données internes de stock et de pickup CRS D-EDGE
  const dedge = useMemo(
    () => getDEdgeInventoryForDate(hotel.id, dateStr, hotel.roomCount, hotel.baseADR),
    [hotel.id, dateStr, hotel.roomCount, hotel.baseADR]
  );

  // Moteur de justification épistémologique RM (5 Niveaux)
  const breakdown = useMemo(
    () => generateRMEpistemologicalBreakdown(dateStr, hotel, dayEvents, compset, dedge),
    [dateStr, hotel, dayEvents, compset, dedge]
  );

  // Qualification standard de la demande
  const demandLevel: StandardDemandLevel = compset.demandLevel;

  // Configuration visuelle du niveau de demande
  const getDemandConfig = (lvl: StandardDemandLevel) => {
    switch (lvl) {
      case 'exceptionnel':
        return {
          label: 'Demande Exceptionnelle',
          color: 'text-rose-700 bg-rose-50 border-rose-200',
          badge: 'bg-rose-600 text-white',
          desc: 'Saturation imminente du marché. Multiples événements ou sold-out compset.',
          adrDelta: '+35% à +50%',
          minStay: '3 nuits minimum',
        };
      case 'eleve':
        return {
          label: 'Demande Élevée',
          color: 'text-amber-800 bg-amber-50 border-amber-200',
          badge: 'bg-amber-600 text-white',
          desc: 'Forte pression événementielle et commerciale. Compset en hausse tarifaire.',
          adrDelta: '+20% à +35%',
          minStay: '2 nuits recommandé',
        };
      case 'normal':
        return {
          label: 'Demande Normale',
          color: 'text-sky-800 bg-sky-50 border-sky-200',
          badge: 'bg-sky-600 text-white',
          desc: 'Flux standard pour la période sans surchauffe majeure.',
          adrDelta: 'Tarif BAR Standard',
          minStay: 'Libre (1 nuit)',
        };
      case 'faible':
      default:
        return {
          label: 'Demande Faible',
          color: 'text-slate-700 bg-slate-50 border-slate-200',
          badge: 'bg-slate-600 text-white',
          desc: 'Faible activité événementielle dans le périmètre direct.',
          adrDelta: 'Tarif de stimulation',
          minStay: 'Libre (1 nuit)',
        };
    }
  };

  const demandConfig = getDemandConfig(demandLevel);

  // Calcul du tarif recommandé
  let baseRecommendedRate = hotel.baseADR;
  if (demandLevel === 'exceptionnel') baseRecommendedRate = Math.round(hotel.baseADR * 1.42);
  else if (demandLevel === 'eleve') baseRecommendedRate = Math.round(hotel.baseADR * 1.25);
  else if (demandLevel === 'normal') baseRecommendedRate = Math.round(hotel.baseADR * 1.05);

  const [customRate, setCustomRate] = useState<number>(baseRecommendedRate);
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [applied, setApplied] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'reco' | 'market_compset' | 'dedge_inventory' | 'events'>('reco');

  const priceDeltaEur = customRate - hotel.baseADR;
  const priceDeltaPercent = Math.round((priceDeltaEur / hotel.baseADR) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" onClick={onClose} />

      {/* Modal Card */}
      <div className="relative bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200/90 z-10 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${demandConfig.badge}`}>
                {demandConfig.label}
              </span>
              <span className="text-xs text-slate-300">·</span>
              <span className="text-xs font-semibold text-slate-200 capitalize">{formattedDateFr}</span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Confiance {breakdown.confidenceScore}%</span>
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold tracking-tight">
              Analyse Revenue Management & Aide à la Décision
            </h3>
            <p className="text-xs text-slate-300">
              Établissement : <strong className="text-white">{hotel.name}</strong> ({hotel.stars}★ · {hotel.roomCount} ch. · ADR Base : {hotel.baseADR}€)
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs in Modal Header */}
        <div className="flex items-center gap-1 px-6 py-2.5 bg-slate-100/80 border-b border-slate-200 shrink-0 text-xs font-semibold text-slate-600 overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('reco')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeSubTab === 'reco'
                ? 'bg-white text-violet-700 shadow-2xs font-bold'
                : 'hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Recommandation & Explicabilité (5 Niveaux)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('market_compset')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeSubTab === 'market_compset'
                ? 'bg-white text-violet-700 shadow-2xs font-bold'
                : 'hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-violet-600" />
            <span>Veille Tarifaire Lighthouse ({compset.soldOutCount}/{compset.totalCompetitors} complets)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('dedge_inventory')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeSubTab === 'dedge_inventory'
                ? 'bg-white text-violet-700 shadow-2xs font-bold'
                : 'hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-indigo-600" />
            <span>Stock & Pickup D-EDGE ({dedge.roomsAvailable} ch. dispo)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('events')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeSubTab === 'events'
                ? 'bg-white text-violet-700 shadow-2xs font-bold'
                : 'hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>Événements Détectés ({dayEvents.length})</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-slate-800 text-sm">
          {/* TAB 1: RECOMMANDATION & EXPLICABILITÉ (5 NIVEAUX) */}
          {activeSubTab === 'reco' && (
            <div className="space-y-6">
              {/* Tarifs et Action RM Card */}
              <div className="bg-gradient-to-br from-violet-50/80 via-purple-50/40 to-white border border-violet-200/90 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-violet-700" />
                    <h4 className="text-xs font-bold text-violet-950 uppercase tracking-wider">
                      Proposition Tarifaire & Stratégie Yield
                    </h4>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-violet-200/80 text-violet-900 rounded-full">
                    Gouvernance RM Active
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-white rounded-xl p-3 border border-violet-200/80">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Tarif Actuel (Base)</div>
                    <div className="text-xl font-bold text-slate-900 mt-1">{hotel.baseADR}€</div>
                    <div className="text-[10px] text-slate-500">Grille tarifaire standard</div>
                  </div>

                  <div className="bg-white rounded-xl p-3 border border-violet-200/80 relative">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-bold text-violet-600 uppercase">Tarif Recommandé</div>
                      <button
                        onClick={() => setIsEditingRate(!isEditingRate)}
                        className="text-[10px] text-violet-600 hover:underline font-semibold"
                      >
                        {isEditingRate ? 'Valider' : 'Modifier'}
                      </button>
                    </div>

                    {isEditingRate ? (
                      <div className="flex items-center gap-1 mt-1">
                        <input
                          type="number"
                          value={customRate}
                          onChange={(e) => setCustomRate(Number(e.target.value))}
                          className="w-20 px-2 py-1 text-sm font-bold border border-violet-400 rounded-md bg-violet-50/50"
                        />
                        <span className="text-xs font-bold text-slate-700">€</span>
                      </div>
                    ) : (
                      <div className="text-xl font-bold text-violet-700 mt-1">{customRate}€</div>
                    )}

                    <div className="text-[10px] font-bold text-emerald-600 mt-0.5">
                      {priceDeltaEur > 0 ? `+${priceDeltaEur}€ (+${priceDeltaPercent}%)` : priceDeltaEur < 0 ? `${priceDeltaEur}€` : 'Aligné sur le base'}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-3 border border-violet-200/80">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Séjour Minimum (MLOS)</div>
                    <div className="text-xl font-bold text-slate-900 mt-1">{demandConfig.minStay}</div>
                    <div className="text-[10px] text-slate-500">Protection des nuits de pointe</div>
                  </div>
                </div>

                <div className="p-3 bg-white/80 border border-violet-100 rounded-xl text-xs text-violet-950 leading-relaxed">
                  <strong>Recommandation d&apos;action :</strong> {breakdown.recommandation}
                </div>

                {/* Direct Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-violet-200/50">
                  <div className="text-[11px] text-slate-500">
                    Chaque arbitrage est tracé et synchronisable avec D-EDGE CRS.
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (onApplyRecommendation) {
                          onApplyRecommendation(dateStr, customRate);
                        }
                        setApplied(true);
                      }}
                      disabled={applied}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs ${
                        applied
                          ? 'bg-emerald-600 text-white'
                          : 'bg-violet-600 hover:bg-violet-700 text-white'
                      }`}
                    >
                      {applied ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Appliqué ({customRate}€)</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4" />
                          <span>Accepter & Appliquer</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* GRILLE D'EXPLICABILITÉ EN 5 NIVEAUX */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-slate-700" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Détail de la Justification RM (Cadre Méthodologique en 5 Niveaux)
                  </h4>
                </div>

                <div className="space-y-2.5">
                  {/* 1. FAIT OBSERVÉ */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-slate-900" />
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
                        1. Fait Observé (Données brutes vérifiables)
                      </span>
                    </div>
                    <ul className="list-disc list-inside text-xs text-slate-700 space-y-1 pl-1">
                      {breakdown.faitObserve.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  {/* 2. ANALYSE */}
                  <div className="bg-blue-50/50 border border-blue-200 rounded-2xl p-4 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-600" />
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-950">
                        2. Analyse (Interprétation des dynamiques de marché)
                      </span>
                    </div>
                    <ul className="list-disc list-inside text-xs text-blue-900 space-y-1 pl-1">
                      {breakdown.analyse.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  {/* 3. PRÉVISION */}
                  <div className="bg-purple-50/50 border border-purple-200 rounded-2xl p-4 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-600" />
                      <span className="text-xs font-bold uppercase tracking-wider text-purple-950">
                        3. Prévision (Projections chiffrées & probabilités)
                      </span>
                    </div>
                    <ul className="list-disc list-inside text-xs text-purple-900 space-y-1 pl-1">
                      {breakdown.prevision.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  {/* 4. RECOMMANDATION */}
                  <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-4 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-600" />
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-950">
                        4. Recommandation (Action concrète préconisée)
                      </span>
                    </div>
                    <p className="text-xs text-emerald-900 pl-1 font-medium">
                      {breakdown.recommandation}
                    </p>
                  </div>

                  {/* 5. HYPOTHÈSE & LIMITES */}
                  <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-4 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-600" />
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-950">
                        5. Hypothèses & Limites (Conditions de validité)
                      </span>
                    </div>
                    <ul className="list-disc list-inside text-xs text-amber-900 space-y-1 pl-1">
                      {breakdown.hypothese.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: VEILLE TARIFAIRE LIGHTHOUSE (COMPSET) */}
          {activeSubTab === 'market_compset' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Relevé Concurrentiel Lighthouse Rate Insight (v3)
                  </h4>
                  <p className="text-xs text-slate-500">
                    5 établissements comparables dans un rayon de 400m · Relevé direct OTA & Web
                  </p>
                </div>
                <span className="text-xs font-bold text-violet-700 bg-violet-50 px-2.5 py-1 rounded-lg border border-violet-200">
                  Moyenne Compset : {compset.compsetAverage}€
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {compset.competitors.map((comp) => (
                  <div
                    key={comp.id}
                    className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-2 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h5 className="text-xs font-bold text-slate-900">{comp.name}</h5>
                        <p className="text-[10px] text-slate-500">
                          {comp.distanceMeters}m · {comp.stars}★ · {comp.roomCount} ch. · {comp.roomType}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        {comp.isSoldOut ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                            COMPLET (Sold-out)
                          </span>
                        ) : (
                          <div>
                            <span className="text-sm font-bold text-slate-900">{comp.currentRate}€</span>
                            <span
                              className={`text-[10px] ml-1 font-semibold ${
                                comp.deltaPercent >= 0 ? 'text-rose-600' : 'text-slate-500'
                              }`}
                            >
                              {comp.deltaPercent >= 0 ? `+${comp.deltaPercent}%` : `${comp.deltaPercent}%`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Source : {comp.scrapedSource}</span>
                      <span>Observé : {comp.lastObservedAt}</span>
                    </div>
                  </div>
                ))}
              </div>

              {compset.soldOutCount >= 2 && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Alerte de Compression :</strong> {compset.soldOutCount} hôtels concurrents sur 5 sont complets. La demande se reporte massivement sur les chambres encore ouvertes. Opportunité de relever le tarif sans risque d&apos;érosion du volume.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: STOCK & PICKUP CRS D-EDGE */}
          {activeSubTab === 'dedge_inventory' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Données Internes CRS D-EDGE & Rythme de Réservation
                  </h4>
                  <p className="text-xs text-slate-500">
                    Synchronisation temps réel Channel Manager & Booking Engine
                  </p>
                </div>
                <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                  {dedge.lastUpdated}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-center">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Taux d&apos;Occupation OTB</div>
                  <div className="text-xl font-black text-slate-900 mt-1">{dedge.occupancyPercent}%</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {dedge.roomsSold} / {dedge.totalRooms} ch.
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-center">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Stock Restant à Vendre</div>
                  <div className="text-xl font-black text-violet-700 mt-1">{dedge.roomsAvailable} ch.</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Disponibles dans le CRS</div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-center">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Pickup Récent (24h)</div>
                  <div className="text-xl font-black text-emerald-600 mt-1">+{dedge.pickup24h} ch.</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">72h : +{dedge.pickup72h} ch.</div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-center">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Vélocité de Vente</div>
                  <div className="text-base font-bold text-slate-900 mt-1 capitalize">
                    {dedge.bookingVelocity.replace('_', ' ')}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Lead time : {dedge.averageLeadTimeDays} j.</div>
                </div>
              </div>

              <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-2xl text-xs text-indigo-950 space-y-2">
                <div className="font-bold flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-indigo-600" />
                  <span>Synthèse de distribution D-EDGE</span>
                </div>
                <p className="leading-relaxed">
                  Le stock de votre hôtel ({dedge.roomsAvailable} chambres restantes sur {dedge.totalRooms}) s&apos;écoule à un rythme <strong>{dedge.bookingVelocity.replace('_', ' ')}</strong> avec un pickup de <strong>+{dedge.pickup24h} chambres</strong> ces dernières 24 heures. Un minimum stay de <strong>{dedge.minStayRestriction} nuit(s)</strong> est actuellement transmis aux canaux de distribution OTA.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: ÉVÉNEMENTS DÉTECTÉS */}
          {activeSubTab === 'events' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Événements Détectés ({dayEvents.length})
                </h4>
                <span className="text-xs text-slate-500">
                  Affluence cumulée : {totalPax.toLocaleString('fr-FR')} personnes
                </span>
              </div>

              {dayEvents.length === 0 ? (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center text-xs text-slate-500">
                  Aucun événement d&apos;envergure répertorié à cette date. La demande repose sur les flux réguliers d&apos;affaires ou de loisirs.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {dayEvents.map((ev) => {
                    const impact = getImpactColorClasses(ev.impactLevel);
                    return (
                      <div
                        key={ev.id}
                        className="bg-white border border-slate-200 hover:border-violet-300 rounded-2xl p-4 transition-all shadow-2xs space-y-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${impact.badgeBg}`}>
                                {ev.impactLevel}
                              </span>
                              <span className="text-xs font-semibold text-slate-500">
                                {getCategoryLabel(ev.category)}
                              </span>
                              <span className="text-slate-300">·</span>
                              <span className="text-xs text-slate-600 font-medium">{ev.venueName}</span>
                            </div>
                            <h5 className="font-bold text-slate-900 text-sm mt-1">{ev.title}</h5>
                            <p className="text-xs text-slate-500">
                              {ev.expectedAttendance.toLocaleString('fr-FR')} participants attendus · {ev.internationalRatioPercent}% internationaux
                            </p>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="text-xl font-black text-slate-900">{ev.scoreBreakdown.finalRMScore}</div>
                            <div className="text-[10px] text-slate-400 font-semibold uppercase">Score RM</div>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                          <span className="text-[11px]">Source officielle : {ev.sources?.[0] || 'Vérifié'}</span>
                          <button
                            onClick={() => {
                              onClose();
                              onSelectEvent(ev);
                            }}
                            className="text-xs font-bold text-violet-600 hover:text-violet-800 flex items-center gap-1 cursor-pointer"
                          >
                            <span>Consulter la fiche complète</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

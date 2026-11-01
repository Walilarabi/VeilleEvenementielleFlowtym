/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import {
  X,
  Calendar,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Building2,
  Users,
  MapPin,
  ShieldCheck,
  ExternalLink,
  CheckCircle2,
  Clock,
  ArrowRight,
  Flame,
  Percent,
  Sliders,
  DollarSign,
} from 'lucide-react';
import { EventItem, Hotel, StandardDemandLevel } from '../../types';
import { getCompsetForDate } from '../../services/compsetBenchmarkService';
import { getImpactColorClasses, getCategoryLabel } from '../../utils/helpers';

interface DateDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string;
  hotel: Hotel;
  events: EventItem[];
  onSelectEvent: (event: EventItem) => void;
  onNavigateToDecisions?: () => void;
}

export const DateDetailModal: React.FC<DateDetailModalProps> = ({
  isOpen,
  onClose,
  dateStr,
  hotel,
  events,
  onSelectEvent,
  onNavigateToDecisions,
}) => {
  if (!isOpen || !dateStr) return null;

  // Active events covering this date
  const dayEvents = useMemo(() => {
    return events.filter((e) => e.startDate <= dateStr && e.endDate >= dateStr);
  }, [events, dateStr]);

  const totalPax = useMemo(() => {
    return dayEvents.reduce((acc, e) => acc + (e.expectedAttendance || 0), 0);
  }, [dayEvents]);

  const maxRMScore = useMemo(() => {
    return dayEvents.length > 0
      ? Math.max(...dayEvents.map((e) => e.scoreBreakdown?.finalRMScore ?? 50))
      : 0;
  }, [dayEvents]);

  // Compute compset and market pressure
  const compset = useMemo(() => {
    const currentRate = hotel.baseADR || 260;
    return getCompsetForDate(hotel.id, dateStr, currentRate, dayEvents.length, maxRMScore, totalPax);
  }, [hotel, dateStr, dayEvents, maxRMScore, totalPax]);

  // Demand Level Badge styling
  const getDemandBadge = (level: StandardDemandLevel) => {
    switch (level) {
      case 'exceptionnel':
        return {
          label: 'Demande Exceptionnelle',
          classes: 'bg-rose-100 text-rose-800 border-rose-300',
          dot: 'bg-rose-600',
        };
      case 'eleve':
        return {
          label: 'Demande Élevée',
          classes: 'bg-amber-100 text-amber-800 border-amber-300',
          dot: 'bg-amber-500',
        };
      case 'normal':
        return {
          label: 'Demande Normale',
          classes: 'bg-blue-50 text-blue-800 border-blue-200',
          dot: 'bg-blue-500',
        };
      case 'faible':
      default:
        return {
          label: 'Demande Faible',
          classes: 'bg-slate-100 text-slate-700 border-slate-300',
          dot: 'bg-slate-400',
        };
    }
  };

  const demandBadge = getDemandBadge(compset.compressionAlert?.demandLevel || (maxRMScore >= 80 ? 'eleve' : maxRMScore >= 60 ? 'normal' : 'faible'));

  // Formatted date header
  const dateFormatted = useMemo(() => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  }, [dateStr]);

  // Recommended price calculations
  const recommendedRate = useMemo(() => {
    const base = hotel.baseADR || 260;
    if (compset.compressionAlert?.demandLevel === 'exceptionnel') return Math.round(base * 1.4);
    if (compset.compressionAlert?.demandLevel === 'eleve') return Math.round(base * 1.28);
    if (dayEvents.length > 0) return Math.round(base * 1.15);
    return base;
  }, [hotel, compset, dayEvents]);

  const priceDelta = recommendedRate - (hotel.baseADR || 260);
  const priceDeltaPercent = Math.round((priceDelta / (hotel.baseADR || 260)) * 100);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-violet-950 text-white flex items-start justify-between gap-4 shrink-0">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${demandBadge.classes}`}>
                <span className={`w-2 h-2 rounded-full ${demandBadge.dot}`} />
                {demandBadge.label}
              </span>
              <span className="text-xs text-slate-300 font-medium">
                Hôtel : <strong className="text-white">{hotel.name}</strong>
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight capitalize">
              {dateFormatted}
            </h3>
            <p className="text-xs text-slate-300">
              Analyse consolidée de la demande événementielle, des signaux compset et recommandations RM
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
            aria-label="Fermer la modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Top KPI Cards Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-1">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-violet-600" />
                Événements
              </div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">
                {dayEvents.length}
              </div>
              <div className="text-[11px] text-slate-500">
                {totalPax.toLocaleString('fr-FR')} pax attendus
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-1">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
                Score RM Max
              </div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">
                {maxRMScore} <span className="text-xs font-normal text-slate-400">/ 100</span>
              </div>
              <div className="text-[11px] text-slate-500">
                Pression événementielle
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-1">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                Moyenne Compset
              </div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">
                {compset.compsetAverage}€
              </div>
              <div className="text-[11px] text-slate-500">
                {compset.soldOutCount} sur {compset.totalCompetitors} complet(s)
              </div>
            </div>

            <div className="bg-violet-50/80 border border-violet-200 rounded-2xl p-3.5 space-y-1">
              <div className="text-[11px] font-bold text-violet-700 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                ADR Recommandé
              </div>
              <div className="text-2xl font-bold text-violet-900 tabular-nums">
                {recommendedRate}€
              </div>
              <div className="text-[11px] font-bold text-emerald-600">
                +{priceDelta}€ (+{priceDeltaPercent}%)
              </div>
            </div>
          </div>

          {/* Section 1: Événements actifs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-violet-600" />
                Événements actifs ce jour ({dayEvents.length})
              </h4>
              <span className="text-xs text-slate-500">
                Cliquez sur un événement pour examiner ses détails
              </span>
            </div>

            {dayEvents.length === 0 ? (
              <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-6 text-center text-slate-500 text-xs">
                Aucun événement majeur recensé ce jour dans le périmètre direct de l’hôtel.
              </div>
            ) : (
              <div className="space-y-2.5">
                {dayEvents.map((ev) => {
                  const impact = getImpactColorClasses(ev.impactLevel);
                  const hotelImp = ev.hotelImpacts?.[hotel.id];

                  return (
                    <div
                      key={ev.id}
                      onClick={() => onSelectEvent(ev)}
                      className="bg-white rounded-2xl border border-slate-200/90 p-4 hover:border-violet-300 hover:shadow-xs transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${impact.badgeBg}`}>
                            {ev.impactLevel}
                          </span>
                          <span className="text-xs text-slate-500 font-medium">
                            {getCategoryLabel(ev.category)}
                          </span>
                          {ev.isRecurring && (
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                              Récurrent annuel
                            </span>
                          )}
                        </div>
                        <h5 className="text-sm font-bold text-slate-900 group-hover:text-violet-700 transition-colors">
                          {ev.title}
                        </h5>
                        <p className="text-xs text-slate-500 flex flex-wrap items-center gap-3">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {ev.venueName} ({hotelImp?.distanceKm ? `${hotelImp.distanceKm} km` : 'Paris'})
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Users className="w-3 h-3 text-slate-400" />
                            {ev.expectedAttendance.toLocaleString('fr-FR')} pax attendus
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                        <div className="text-right">
                          <div className="text-xs text-slate-400 font-medium">Score RM</div>
                          <div className="text-lg font-bold text-slate-900 tabular-nums">
                            {ev.scoreBreakdown?.finalRMScore ?? 50}
                            <span className="text-[10px] text-slate-400">/100</span>
                          </div>
                        </div>
                        <div className="w-7 h-7 rounded-xl bg-slate-100 group-hover:bg-violet-600 group-hover:text-white flex items-center justify-center text-slate-400 transition-all">
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Signaux de Marché & Compset Benchmark */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-violet-600" />
                Benchmark Compset & Taux de Sold-Out
              </h4>
              <span className="text-xs text-slate-500">
                Périmètre direct Opéra / Madeleine (5 concurrents 4★)
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs">
              <div className="divide-y divide-slate-100">
                {compset.competitors.map((comp) => (
                  <div
                    key={comp.id}
                    className="p-3 sm:px-4 sm:py-3 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/60 transition-colors"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{comp.name}</span>
                        <span className="text-[10px] text-amber-500">★★★★</span>
                        <span className="text-[10px] text-slate-400">({comp.distanceMeters}m)</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {comp.roomType} · Source: {comp.scrapedSource}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {comp.isSoldOut ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200">
                          <AlertTriangle className="w-3 h-3" />
                          Complet (Sold-Out)
                        </span>
                      ) : (
                        <div className="text-right">
                          <div className="font-bold text-slate-900 tabular-nums text-sm">
                            {comp.currentRate}€
                          </div>
                          <div className={`text-[10px] font-medium ${comp.deltaPercent > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                            {comp.deltaPercent > 0 ? `+${comp.deltaPercent}% vs base` : 'Tarif standard'}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section 3: Recommandation RM Explicable */}
          <div className="bg-gradient-to-r from-violet-50 to-indigo-50/60 rounded-2xl border border-violet-200/80 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-violet-950 font-bold text-sm">
                <ShieldCheck className="w-4 h-4 text-violet-600" />
                Plan d’Action Revenue Management Recommandé
              </div>
              <span className="text-xs font-semibold text-violet-700 bg-violet-100 px-2.5 py-0.5 rounded-full">
                Explicabilité RM 100%
              </span>
            </div>

            <p className="text-xs text-violet-900/90 leading-relaxed">
              {compset.compressionAlert?.recommendedAction ||
                'Maintenir la grille BAR standard. Surveillance régulière des montées en charge et du pickup compset.'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-violet-200/60 text-xs">
              <div>
                <span className="text-violet-600 block text-[11px] font-semibold">Minimum Stay</span>
                <span className="font-bold text-violet-950">
                  {compset.compressionAlert?.suggestedMinStay ? `${compset.compressionAlert.suggestedMinStay} nuits min` : 'Libre (1 nuit)'}
                </span>
              </div>
              <div>
                <span className="text-violet-600 block text-[11px] font-semibold">CTA (Closed to Arrival)</span>
                <span className="font-bold text-violet-950">
                  {compset.compressionAlert?.ctaRecommended ? 'Actif sur les arrivées du vendredi' : 'Inactif'}
                </span>
              </div>
              <div>
                <span className="text-violet-600 block text-[11px] font-semibold">Gains RevPAR estimés</span>
                <span className="font-bold text-emerald-700">
                  +{priceDelta}€ / chambre vendue
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-all cursor-pointer"
          >
            Fermer
          </button>

          {onNavigateToDecisions && (
            <button
              onClick={() => {
                onClose();
                onNavigateToDecisions();
              }}
              className="px-4 py-2 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
            >
              <span>Ouvrir dans le Centre de Décision RM</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Zap,
  CheckCircle2,
  XCircle,
  MapPin,
  Calendar,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Building2,
  Clock,
  Eye,
} from 'lucide-react';
import { EventItem, EventSuggestion, Hotel } from '../../types';
import { formatEventDateRange, getCategoryLabel, getImpactColorClasses } from '../../utils/helpers';

interface FlowboardViewProps {
  events: EventItem[];
  suggestions: EventSuggestion[];
  hotels: Hotel[];
  selectedHotelId: string;
  onSelectEvent: (event: EventItem) => void;
  onApproveSuggestion: (id: string) => void;
  onDismissSuggestion: (id: string) => void;
  onGoToExplorer: () => void;
  onGoToCalendar: () => void;
}

export const FlowboardView: React.FC<FlowboardViewProps> = ({
  events,
  suggestions,
  hotels,
  selectedHotelId,
  onSelectEvent,
  onApproveSuggestion,
  onDismissSuggestion,
  onGoToExplorer,
  onGoToCalendar,
}) => {
  const currentHotel = hotels.find((h) => h.id === selectedHotelId) || hotels[0];

  // Top priorities: score >= 75
  const priorityEvents = [...events]
    .filter((e) => e.scoreBreakdown.finalRMScore >= 70)
    .sort((a, b) => b.scoreBreakdown.finalRMScore - a.scoreBreakdown.finalRMScore)
    .slice(0, 5);

  // Pending suggestions
  const pendingSuggestions = suggestions.filter((s) => s.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Executive Welcome & Yield Advisory Banner */}
      <div className="bg-gradient-to-r from-violet-900 to-indigo-900 rounded-2xl p-6 text-white shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-xs font-semibold text-violet-200">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Synthèse Revenue Management · Octobre — Décembre 2026</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            Forte compression identifiée sur le marché parisien & lyonnais
          </h2>
          <p className="text-xs sm:text-sm text-violet-200/90 max-w-2xl leading-relaxed">
            Le chevauchement du <strong>Mondial de l&apos;Automobile</strong> (490k pax) et du <strong>SIAL Paris</strong> (285k pax) en semaine 42 requiert un verrouillage immédiat des tarifs de groupe et l&apos;application d&apos;un minimum stay de 3 nuits sur votre portefeuille.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            onClick={onGoToCalendar}
            className="px-4 py-2 text-xs font-bold bg-white text-violet-950 hover:bg-violet-50 rounded-xl transition-all shadow-xs"
          >
            Ouvrir le calendrier d&apos;impact
          </button>
          <button
            onClick={onGoToExplorer}
            className="px-4 py-2 text-xs font-bold bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/20 transition-all"
          >
            Lancer une recherche ciblée
          </button>
        </div>
      </div>

      {/* Grid: 2 Columns (Top RM Priorities & Suggestions to Validate) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Top RM Priorities (2/3 width on desktop) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-violet-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Top Priorités Revenue Management (Scores RM &ge; 70)
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Calculé pour: <strong className="text-slate-800">{currentHotel.name}</strong>
            </span>
          </div>

          <div className="space-y-3">
            {priorityEvents.map((ev) => {
              const impact = getImpactColorClasses(ev.impactLevel);
              const hotelImp = ev.hotelImpacts[currentHotel.id];

              return (
                <div
                  key={ev.id}
                  onClick={() => onSelectEvent(ev)}
                  className="bg-white rounded-2xl border border-slate-200/90 p-4 hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer space-y-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${impact.badgeBg}`}
                        >
                          {ev.impactLevel}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">
                          {getCategoryLabel(ev.category)}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-xs text-slate-500 font-medium tabular-nums">
                          {formatEventDateRange(ev.startDate, ev.endDate)}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mt-1">
                        {ev.title}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {ev.venueName} · {ev.city} ({ev.expectedAttendance.toLocaleString('fr-FR')} pax attendus)
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-2xl font-black text-slate-900 tabular-nums">
                        {ev.scoreBreakdown.finalRMScore}
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase">
                        Score RM
                      </div>
                    </div>
                  </div>

                  {hotelImp && (
                    <div className="bg-slate-50 rounded-xl p-2.5 text-xs text-slate-700 flex items-center justify-between border border-slate-200/60">
                      <div className="flex items-center gap-2 truncate pr-2">
                        <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="truncate font-medium">{hotelImp.recommendedAction}</span>
                      </div>
                      <span className="text-emerald-700 font-bold shrink-0 tabular-nums">
                        ADR +{hotelImp.estimatedADRBoostPercent}%
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Suggestions Queue & Validation (1/3 width) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Suggestions à Valider ({pendingSuggestions.length})
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">Détection auto</span>
          </div>

          <div className="space-y-3">
            {pendingSuggestions.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200/90 p-6 text-center text-xs text-slate-500">
                Toutes les suggestions ont été traitées.
              </div>
            ) : (
              pendingSuggestions.map((sug) => (
                <div
                  key={sug.id}
                  className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-3"
                >
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-violet-600 mb-1">
                      <span>{getCategoryLabel(sug.category)}</span>
                      <span className="text-emerald-600 font-bold tabular-nums">
                        Confiance: {sug.confidence}%
                      </span>
                    </div>
                    <h5 className="text-xs font-bold text-slate-900 leading-snug">
                      {sug.eventTitle}
                    </h5>
                    <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>{sug.suggestedDates.start} au {sug.suggestedDates.end}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-2 bg-slate-50 p-2 rounded-lg border border-slate-200/60 leading-relaxed">
                      {sug.reason}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                    <button
                      onClick={() => onApproveSuggestion(sug.id)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Valider</span>
                    </button>
                    <button
                      onClick={() => onDismissSuggestion(sug.id)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5 text-slate-400" />
                      <span>Ignorer</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Quick Geographic Presence Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Couverture Événementielle par Ville
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-700 font-medium">Paris (Île-de-France)</span>
                <span className="font-bold text-slate-900 tabular-nums">78 événements</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-700 font-medium">Lyon (Rhône-Alpes)</span>
                <span className="font-bold text-slate-900 tabular-nums">18 événements</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-700 font-medium">Nice (Côte d&apos;Azur)</span>
                <span className="font-bold text-slate-900 tabular-nums">10 événements</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
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
  GraduationCap,
  Radar,
  SlidersHorizontal,
} from 'lucide-react';
import { EventItem, EventSuggestion, Hotel } from '../../types';
import { formatEventDateRange, getCategoryLabel, getImpactColorClasses } from '../../utils/helpers';
import { getHotelRoomTypology } from '../../data/hotelRoomTypologies';
import { D3RadarChart } from './D3RadarChart';

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
  onGoToSchoolHolidays?: () => void;
  onGoToOpportunities?: () => void;
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
  onGoToSchoolHolidays,
  onGoToOpportunities,
}) => {
  const currentHotel = hotels.find((h) => h.id === selectedHotelId) || hotels[0];
  const typology = getHotelRoomTypology(currentHotel.id);

  // Top priorities: score >= 75
  const priorityEvents = [...events]
    .filter((e) => e.scoreBreakdown.finalRMScore >= 70)
    .sort((a, b) => b.scoreBreakdown.finalRMScore - a.scoreBreakdown.finalRMScore)
    .slice(0, 5);

  const [selectedRadarEventId, setSelectedRadarEventId] = useState<string>(
    priorityEvents[0]?.id || events[0]?.id || ''
  );

  const selectedRadarEvent =
    events.find((e) => e.id === selectedRadarEventId) || priorityEvents[0] || events[0];

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

      {/* School Holidays Executive Alert & Room Typology Insight */}
      <div className="bg-gradient-to-r from-indigo-50 via-purple-50/60 to-white rounded-2xl border border-indigo-200/80 p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-indigo-950">
                Veille Vacances Scolaires & Overlaps Multi-Pays 2026
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                Score Impact: 82/100 · Fort
              </span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-100/80 text-indigo-800 border border-indigo-200">
                {typology.familyCapacityPercentage}% capacité famille ({typology.familyCapacityRooms} ch. sur {typology.totalRooms})
              </span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              <strong>Grand Hôtel Folkestone Opéra :</strong> Conjonction exceptionnelle <strong>Pâques / Printemps</strong> du 06 au 26 avril 2026 (France Zones A/B/C, Royaume-Uni, Belgique et Pays-Bas simultanés). Protection recommandée des 8 Triples et 4 Quadruples avec un minimum stay de 2 nuits.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onGoToSchoolHolidays && (
            <button
              onClick={onGoToSchoolHolidays}
              className="px-3.5 py-2 text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-white hover:bg-indigo-50 border border-indigo-300 rounded-xl transition-all shadow-2xs flex items-center gap-1.5"
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Module Vacances (12 pays)</span>
            </button>
          )}
          {onGoToOpportunities && (
            <button
              onClick={onGoToOpportunities}
              className="px-3.5 py-2 text-xs font-bold text-violet-700 hover:text-violet-900 bg-violet-100/60 hover:bg-violet-200/70 border border-violet-200 rounded-xl transition-all shadow-2xs flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5 text-amber-600" />
              <span>Centre de Décision RM</span>
            </button>
          )}
        </div>
      </div>

      {/* Real-time Market Signals: D-EDGE Pickup Acceleration & Lighthouse Compset Tension */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* D-EDGE Pickup Alert */}
        <div className="bg-white border border-indigo-200/90 rounded-2xl p-4.5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Alertes Pickup & Stock D-EDGE</h4>
                <p className="text-[10px] text-slate-500">Flux de réservations en direct (dernières 24h)</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
              3 dates en vélocité rapide
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900">18 nov. 2026 (Semaine Salon des Maires)</span>
                <div className="text-[10px] text-slate-500">Stock restant : 9 ch. (OTB 80%)</div>
              </div>
              <div className="text-right">
                <span className="text-emerald-700 font-bold">+5 ch. en 24h</span>
                <div className="text-[10px] text-rose-600 font-semibold">Risque de sous-tarif</div>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900">03 déc. 2026 (Congrès Médical)</span>
                <div className="text-[10px] text-slate-500">Stock restant : 11 ch. (OTB 76%)</div>
              </div>
              <div className="text-right">
                <span className="text-emerald-700 font-bold">+4 ch. en 24h</span>
                <div className="text-[10px] text-amber-600 font-semibold">Hausse BAR préconisée</div>
              </div>
            </div>
          </div>
        </div>

        {/* Lighthouse Compset Price Movements */}
        <div className="bg-white border border-violet-200/90 rounded-2xl p-4.5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Veille Tarifaire Lighthouse Rate Insight</h4>
                <p className="text-[10px] text-slate-500">Mouvements compset direct (Rayon 400m)</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
              Compression détectée
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900">Hôtel Saint-Pétersbourg Opéra</span>
                <div className="text-[10px] text-slate-500">18-20 nov. : Relevé à 345€ (+25%)</div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                SOLD-OUT J-2
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900">Hôtel Charing Cross & Astra</span>
                <div className="text-[10px] text-slate-500">Hausse tarifaire coordonnée de +22€ sur la semaine 47</div>
              </div>
              <span className="text-xs font-bold text-slate-900">Moy. 315€</span>
            </div>
          </div>
        </div>
      </div>

      {/* D3 Radar Chart: Répartition des scores d'impact par catégorie */}
      <div className="bg-gradient-to-br from-slate-50 via-white to-violet-50/30 rounded-2xl border border-violet-200/90 p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center shrink-0 shadow-xs shadow-violet-200">
              <Radar className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                  Cartographie Radar D3 — Répartition des Scores d'Impact RM
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 border border-violet-200">
                  D3.js Interactif
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Visualisation multi-axes des composantes d'impact (Attractivité, Saturation, International, Proximité, Pickup, ADR)
              </p>
            </div>
          </div>

          {/* Event Quick Dropdown Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600 font-semibold hidden sm:inline">Événement :</span>
            <select
              value={selectedRadarEventId}
              onChange={(e) => setSelectedRadarEventId(e.target.value)}
              className="bg-white border border-slate-300 text-slate-900 text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-2xs max-w-[280px] sm:max-w-xs truncate cursor-pointer"
            >
              <optgroup label="Top Priorités RM">
                {priorityEvents.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title} (Score: {ev.scoreBreakdown.finalRMScore})
                  </option>
                ))}
              </optgroup>
              <optgroup label="Tous les événements">
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title} · {ev.startDate}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>

        {/* Quick pills for instant switching between Top Priorities */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <SlidersHorizontal className="w-3 h-3 text-slate-400" />
            <span>Sélection rapide :</span>
          </span>
          {priorityEvents.slice(0, 5).map((ev) => {
            const isSelected = ev.id === selectedRadarEventId;
            return (
              <button
                key={ev.id}
                onClick={() => setSelectedRadarEventId(ev.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-violet-600 text-white shadow-xs ring-2 ring-violet-400'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>{ev.title.split('—')[0].split('-')[0].trim()}</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-black ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {ev.scoreBreakdown.finalRMScore}
                </span>
              </button>
            );
          })}
        </div>

        {/* D3 Radar Chart Component */}
        <D3RadarChart
          event={selectedRadarEvent}
          hotel={currentHotel}
        />
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
              const isSelectedForRadar = ev.id === selectedRadarEventId;

              return (
                <div
                  key={ev.id}
                  onClick={() => {
                    setSelectedRadarEventId(ev.id);
                    onSelectEvent(ev);
                  }}
                  className={`bg-white rounded-2xl border p-4 transition-all cursor-pointer space-y-3 ${
                    isSelectedForRadar
                      ? 'border-violet-500 ring-2 ring-violet-400/40 shadow-xs bg-violet-50/10'
                      : 'border-slate-200/90 hover:border-slate-300 hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
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
                        {isSelectedForRadar && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200 flex items-center gap-1">
                            <Radar className="w-3 h-3" />
                            <span>Affiché sur le Radar D3</span>
                          </span>
                        )}
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

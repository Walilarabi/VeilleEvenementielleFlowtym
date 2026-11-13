/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  X,
  Building,
  MapPin,
  Calendar,
  Users,
  Car,
  Train,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { VenueGeoDetail, EventItem, Hotel } from '../../types';
import { getRMScoreColorClasses } from '../../utils/helpers';

interface VenueDetailDrawerProps {
  venue: VenueGeoDetail | null;
  venueEvents: EventItem[];
  hotel: Hotel;
  onClose: () => void;
  onSelectEvent: (event: EventItem) => void;
}

export const VenueDetailDrawer: React.FC<VenueDetailDrawerProps> = ({
  venue,
  venueEvents,
  hotel,
  onClose,
  onSelectEvent,
}) => {
  if (!venue) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 dark:border-slate-800/80 flex items-start justify-between bg-slate-50/70 dark:bg-slate-800/50">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-violet-600" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">
              Fiche Infrastructure & Calendrier
            </span>
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">{venue.name}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">{venue.address}</p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 transition-colors"
          title="Fermer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Proximity & Commute stats relative to Hotel */}
        <div className="bg-violet-50/60 dark:bg-violet-950/40 border border-violet-100 dark:border-violet-900/60 rounded-2xl p-4 space-y-2.5">
          <div className="text-[11px] font-bold text-violet-950 dark:text-violet-100 uppercase tracking-wider flex items-center justify-between">
            <span>Accessibilité depuis {hotel.name}</span>
            <span className="text-[10px] text-violet-600 dark:text-violet-400 font-semibold">{venue.zone === 'main_10km' ? 'Rayon 10 km' : 'Rayon 30 km'}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-violet-100 dark:border-violet-900/60 shadow-2xs">
              <div className="text-[10px] text-slate-400">Vol d’oiseau</div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">{venue.distanceKm} km</div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-violet-100 dark:border-violet-900/60 shadow-2xs">
              <div className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
                <Car className="w-3 h-3 text-slate-400" />
                <span>Voiture</span>
              </div>
              <div className="text-sm font-bold text-amber-700 dark:text-amber-300 mt-0.5">~{venue.driveTimeMins} min</div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-violet-100 dark:border-violet-900/60 shadow-2xs">
              <div className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
                <Train className="w-3 h-3 text-slate-400" />
                <span>Transports</span>
              </div>
              <div className="text-sm font-bold text-sky-700 dark:text-sky-300 mt-0.5">~{venue.transitTimeMins} min</div>
            </div>
          </div>
        </div>

        {/* Venue Profile Details */}
        <div className="space-y-2 text-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Caractéristiques du Lieu
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800/80">
              <span className="text-slate-400 text-[10px]">Capacité maximale</span>
              <div className="font-bold text-slate-800 dark:text-slate-200 text-sm mt-0.5">
                {venue.capacity.toLocaleString('fr-FR')} pers.
              </div>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800/80">
              <span className="text-slate-400 text-[10px]">Type d’infrastructure</span>
              <div className="font-bold text-slate-800 dark:text-slate-200 text-sm mt-0.5 capitalize">
                {venue.type.replace('_', ' ')}
              </div>
            </div>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">Mutualisation inter-hôtels</span>
            <span className="font-bold text-violet-700 dark:text-violet-300">
              Partagé par {venue.mutualizedHotelsCount} hôtels
            </span>
          </div>
        </div>

        {/* Programmed Events Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
              Événements programmés ({venueEvents.length})
            </h4>
            <span className="text-[11px] text-slate-400">Période active</span>
          </div>

          {venueEvents.length === 0 ? (
            <div className="text-center py-8 px-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-1">
              <Calendar className="w-6 h-6 text-slate-300 mx-auto" />
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Aucun événement ce mois-ci</p>
              <p className="text-[11px] text-slate-400">
                Cette infrastructure est surveillée pour les mois suivants.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {venueEvents.map((ev) => {
                const score = ev.scoreBreakdown.finalRMScore;
                const scoreStyles = getRMScoreColorClasses(score);

                return (
                  <div
                    key={ev.id}
                    onClick={() => onSelectEvent(ev)}
                    className="p-3.5 bg-white dark:bg-slate-900 hover:bg-violet-50/40 rounded-xl border border-slate-200/80 dark:border-slate-800/80 hover:border-violet-200 dark:hover:border-violet-700/70 transition-all cursor-pointer group shadow-2xs space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-violet-700 transition-colors">
                          {ev.title}
                        </div>
                        {ev.subtitle && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                            {ev.subtitle}
                          </div>
                        )}
                      </div>
                      <span
                        className={`inline-flex items-center justify-center px-2 py-0.5 rounded-md font-bold text-[11px] border shrink-0 ${scoreStyles.badge}`}
                      >
                        Score {score}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                      <div className="flex items-center gap-1 font-medium">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>
                          {ev.startDate} → {ev.endDate}
                        </span>
                      </div>
                      <span className="font-semibold text-violet-600 dark:text-violet-400 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                        <span>Fiche RM</span>
                        <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

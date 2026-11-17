/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FLOWTYM RMS — ACCÈS RAPIDE AUX ÉVÉNEMENTS FAVORIS (MULTI-HÔTELS)
 * Affiche tous les événements marqués comme favoris à travers l'ensemble du portefeuille hôtelier.
 */

import React, { useMemo, useState } from 'react';
import {
  Star,
  X,
  Calendar,
  MapPin,
  Building2,
  Search,
  ArrowUpRight,
  Trash2,
} from 'lucide-react';
import { EventItem, Hotel } from '../../types';
import { formatEventDateRange, getCategoryLabel, getImpactColorClasses } from '../../utils/helpers';
import {
  getTodayIsoDate,
  getEffectiveEndDate,
  filterEventsByHotelGeography,
  getEventStatusBadgeConfig,
  sortEventsChronologically,
} from '../../utils/eventFilterUtils';

interface FavoritesModalProps {
  isOpen: boolean;
  onClose: () => void;
  favoriteEvents: EventItem[];
  hotels: Hotel[];
  selectedHotelId: string;
  onSelectEvent: (event: EventItem) => void;
  onToggleFavorite: (eventId: string) => void;
  onSelectHotel?: (hotelId: string) => void;
}

export const FavoritesModal: React.FC<FavoritesModalProps> = ({
  isOpen,
  onClose,
  favoriteEvents,
  hotels,
  selectedHotelId,
  onSelectEvent,
  onToggleFavorite,
  onSelectHotel,
}) => {
  const [hotelFilter, setHotelFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [includePastFavorites, setIncludePastFavorites] = useState<boolean>(false);
  const todayStr = getTodayIsoDate();

  // Associer chaque événement favori aux hôtels du portefeuille concernés
  const enrichedFavorites = useMemo(() => {
    const visibleFavorites = includePastFavorites
      ? favoriteEvents
      : favoriteEvents.filter((ev) => getEffectiveEndDate(ev) >= todayStr);
    const sorted = sortEventsChronologically(visibleFavorites, todayStr, includePastFavorites);

    return sorted.map((ev) => {
      const impactedHotels = hotels.filter((h) => {
        if (ev.hotelImpacts && ev.hotelImpacts[h.id]) return true;
        return filterEventsByHotelGeography([ev], h).length > 0;
      });

      const resolvedHotels =
        impactedHotels.length > 0
          ? impactedHotels
          : hotels.filter((h) => h.city.toLowerCase() === ev.city.toLowerCase());

      return {
        event: ev,
        impactedHotels: resolvedHotels,
      };
    });
  }, [favoriteEvents, hotels, includePastFavorites, todayStr]);

  const filteredFavorites = useMemo(() => {
    return enrichedFavorites.filter(({ event, impactedHotels }) => {
      if (hotelFilter !== 'all') {
        const matchesHotel = impactedHotels.some((h) => h.id === hotelFilter);
        if (!matchesHotel) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hitTitle = event.title.toLowerCase().includes(q);
        const hitCity = event.city.toLowerCase().includes(q);
        const hitVenue = event.venueName.toLowerCase().includes(q);
        const hitHotel = impactedHotels.some((h) => h.name.toLowerCase().includes(q));
        if (!hitTitle && !hitCity && !hitVenue && !hitHotel) return false;
      }

      return true;
    });
  }, [enrichedFavorites, hotelFilter, searchQuery]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/55 backdrop-blur-2xs animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="favorites-modal-title"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[88vh] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
              <Star className="w-4.5 h-4.5 fill-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2
                  id="favorites-modal-title"
                  className="text-base font-bold text-slate-900 dark:text-slate-100 truncate"
                >
                  Événements Favoris — Portfolio Multi-Hôtels
                </h2>
                <span className="text-xs font-bold text-amber-700 dark:text-amber-300 tabular-nums shrink-0">
                  ({favoriteEvents.length})
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Accès rapide aux événements suivis à travers l&apos;ensemble des établissements du groupe.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer les favoris"
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Bar: Search + All-Hotels Filter */}
        <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un favori par titre, ville, lieu ou hôtel..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includePastFavorites}
                onChange={(e) => setIncludePastFavorites(e.target.checked)}
                className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
              />
              <span>Inclure passés</span>
            </label>

            <Building2 className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
            <select
              aria-label="Filtrer les favoris par hôtel"
              value={hotelFilter}
              onChange={(e) => setHotelFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 cursor-pointer"
            >
              <option value="all">Tous les hôtels ({hotels.length})</option>
              {hotels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} · {h.city}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Favorites List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {filteredFavorites.length === 0 ? (
            <div className="py-14 px-6 text-center space-y-3 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
              <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center mx-auto">
                <Star className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {favoriteEvents.length === 0
                  ? 'Aucun événement favori enregistré'
                  : 'Aucun favori ne correspond à votre recherche'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                {favoriteEvents.length === 0
                  ? 'Ouvrez la fiche d’un événement depuis le Tableau, le Calendrier ou Explorer et cliquez sur l’étoile pour le retrouver ici quel que soit l’hôtel actif.'
                  : 'Réinitialisez le filtre hôtel ou la recherche textuelle pour afficher vos favoris.'}
              </p>
            </div>
          ) : (
            filteredFavorites.map(({ event, impactedHotels }) => {
              const impact = getImpactColorClasses(event.impactLevel);
              const statusCfg = getEventStatusBadgeConfig(event, todayStr);
              const score = event.scoreBreakdown.finalRMScore;

              return (
                <div
                  key={event.id}
                  onClick={() => {
                    onSelectEvent(event);
                    onClose();
                  }}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-violet-300 dark:hover:border-violet-700 hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className={`font-bold uppercase tracking-wider text-[10px] ${impact.text}`}>
                        {event.impactLevel}
                      </span>
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                      <span className="text-slate-600 dark:text-slate-300 font-medium">
                        {getCategoryLabel(event.category)}
                      </span>
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                      <span className="text-slate-500 dark:text-slate-400 font-medium tabular-nums inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatEventDateRange(event.startDate, event.endDate)}
                      </span>
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                      <span className="text-xs font-semibold text-violet-700 dark:text-violet-300">
                        {statusCfg.label}
                        {statusCfg.subLabel ? ` (${statusCfg.subLabel})` : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors truncate">
                        {event.title}
                      </h4>
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {event.venueName} · {event.city}
                      </span>
                      <span className="tabular-nums">
                        {event.expectedAttendance.toLocaleString('fr-FR')} pax
                      </span>
                    </div>

                    {impactedHotels.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-slate-600 dark:text-slate-300">
                        <span className="text-slate-400 font-medium">Hôtels concernés :</span>
                        {impactedHotels.map((h, idx) => (
                          <React.Fragment key={h.id}>
                            {idx > 0 && <span className="text-slate-300 dark:text-slate-600">·</span>}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onSelectHotel) {
                                  onSelectHotel(h.id);
                                }
                              }}
                              title={`Basculer le portefeuille actif sur ${h.name}`}
                              className={`font-semibold transition-colors cursor-pointer ${
                                h.id === selectedHotelId
                                  ? 'text-violet-700 dark:text-violet-300 underline'
                                  : 'hover:text-violet-700 dark:hover:text-violet-300'
                              }`}
                            >
                              {h.name} ({h.city})
                            </button>
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right Actions & RM Score */}
                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    <div className="text-right">
                      <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tabular-nums leading-none">
                        {score}
                      </div>
                      <div className="text-[10px] font-semibold text-slate-400 uppercase mt-0.5">
                        Score RM
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(event.id);
                      }}
                      title="Retirer des favoris"
                      aria-label={`Retirer ${event.title} des favoris`}
                      className="p-2 rounded-xl border border-amber-200 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-300 hover:border-rose-200 dark:hover:border-rose-800/70 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>
            {filteredFavorites.length} événement{filteredFavorites.length > 1 ? 's' : ''} affiché{filteredFavorites.length > 1 ? 's' : ''} sur {favoriteEvents.length} favori{favoriteEvents.length > 1 ? 's' : ''}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

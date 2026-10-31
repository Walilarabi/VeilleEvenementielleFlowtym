import React, { useState } from 'react';
import {
  Search,
  Compass,
  SlidersHorizontal,
  MapPin,
  Calendar,
  Building2,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { EventItem, Hotel, EventCategory, RMImpactLevel } from '../../types';
import { formatEventDateRange, getCategoryLabel, getImpactColorClasses } from '../../utils/helpers';

interface ExplorerViewProps {
  events: EventItem[];
  hotels: Hotel[];
  selectedHotelId: string;
  onSelectEvent: (event: EventItem) => void;
}

export const ExplorerView: React.FC<ExplorerViewProps> = ({
  events,
  hotels,
  selectedHotelId,
  onSelectEvent,
}) => {
  const currentHotel = hotels.find((h) => h.id === selectedHotelId) || hotels[0];

  const [query, setQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [radiusKm, setRadiusKm] = useState<number>(30);
  const [minRMScore, setMinRMScore] = useState<number>(0);
  const [isSearching, setIsSearching] = useState(false);

  // Suggested quick prompts matching the PRD
  const quickSearches = [
    'Paris · Salons & Foires > 100k pax',
    'Concerts & Grands Spectacles Paris Q4 2026',
    'Événements Sportifs majeurs (Stade de France & Bercy)',
    'Lyon · Événements corporate & congrès médicaux',
  ];

  const handleApplyQuickSearch = (text: string) => {
    setQuery(text);
    setIsSearching(true);
    setTimeout(() => setIsSearching(false), 200);
  };

  // Filter logic
  const filteredEvents = events.filter((ev) => {
    // Text search
    if (query.trim()) {
      const q = query.toLowerCase();
      const matchTitle = ev.title.toLowerCase().includes(q);
      const matchVenue = ev.venueName.toLowerCase().includes(q);
      const matchCity = ev.city.toLowerCase().includes(q);
      const matchCat = getCategoryLabel(ev.category).toLowerCase().includes(q);
      if (!matchTitle && !matchVenue && !matchCity && !matchCat) {
        return false;
      }
    }

    // City
    if (selectedCity !== 'all' && ev.city !== selectedCity) {
      return false;
    }

    // Category
    if (selectedCategory !== 'all' && ev.category !== selectedCategory) {
      return false;
    }

    // Min Score
    if (ev.scoreBreakdown.finalRMScore < minRMScore) {
      return false;
    }

    // Radius filter (if hotel impact recorded)
    const hotelImp = ev.hotelImpacts[currentHotel.id];
    if (hotelImp && hotelImp.distanceKm > radiusKm) {
      return false;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Explorer Central Search Hero */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-violet-600 flex items-center justify-center text-white shadow-xs">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Explorer & Découverte Événementielle
            </h2>
            <p className="text-xs text-slate-500">
              Recherchez les manifestations, foires et congrès dans n&apos;importe quelle ville ou rayon kilométrique
            </p>
          </div>
        </div>

        {/* Central Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-violet-600 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex: Rechercher les salons professionnels et événements sportifs à Paris générateurs de nuitées..."
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-24 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 shadow-2xs"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-700 px-2 py-1"
            >
              Effacer
            </button>
          )}
        </div>

        {/* Quick Suggestion Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
            Recherches types :
          </span>
          {quickSearches.map((qs) => (
            <button
              key={qs}
              onClick={() => handleApplyQuickSearch(qs)}
              className="text-xs text-slate-600 bg-slate-100 hover:bg-violet-50 hover:text-violet-700 px-3 py-1 rounded-lg transition-colors border border-transparent hover:border-violet-200"
            >
              {qs}
            </button>
          ))}
        </div>

        {/* Filter Controls Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Ville ou Région
            </label>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              <option value="all">Toutes les destinations</option>
              <option value="Paris">Paris & Île-de-France</option>
              <option value="Lyon">Lyon & Auvergne-Rhône-Alpes</option>
              <option value="Nice">Nice & Côte d&apos;Azur</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Catégorie Métier
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              <option value="all">Toutes les catégories</option>
              <option value="salons_foires">Salons & Foires</option>
              <option value="congres_medical">Congrès & Médical</option>
              <option value="concerts_spectacles">Concerts & Spectacles</option>
              <option value="sport">Sport & Compétitions</option>
              <option value="mode_luxe">Mode & Luxe</option>
              <option value="culturel">Culture & Festivals</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Rayon autour de l&apos;hôtel
              </label>
              <span className="text-xs font-bold text-violet-700 tabular-nums">
                &le; {radiusKm} km
              </span>
            </div>
            <input
              type="range"
              min={2}
              max={50}
              step={2}
              value={radiusKm}
              onChange={(e) => setRadiusKm(parseInt(e.target.value, 10))}
              className="w-full accent-violet-600 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Score RM Minimum
              </label>
              <span className="text-xs font-bold text-violet-700 tabular-nums">
                &ge; {minRMScore}/100
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={90}
              step={5}
              value={minRMScore}
              onChange={(e) => setMinRMScore(parseInt(e.target.value, 10))}
              className="w-full accent-violet-600 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs text-slate-600">
        <div>
          <span>Résultats : </span>
          <strong className="text-slate-900 font-bold tabular-nums">
            {filteredEvents.length} événements qualifiés
          </strong>{' '}
          correspondant aux critères RM
        </div>
        <div className="text-[11px] text-slate-400">
          Hôtel actif : {currentHotel.name} ({currentHotel.city})
        </div>
      </div>

      {/* Results Grid */}
      {filteredEvents.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
            <Search className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-800">Aucun événement ne correspond à cette recherche</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Élargissez le rayon kilométrique ou réinitialisez les filtres de catégorie pour afficher davantage d&apos;opportunités.
          </p>
          <button
            onClick={() => {
              setQuery('');
              setSelectedCity('all');
              setSelectedCategory('all');
              setMinRMScore(0);
              setRadiusKm(50);
            }}
            className="px-4 py-2 text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-xl transition-colors"
          >
            Réinitialiser les critères
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEvents.map((ev) => {
            const impactStyles = getImpactColorClasses(ev.impactLevel);
            const hotelImp = ev.hotelImpacts[currentHotel.id];

            return (
              <div
                key={ev.id}
                onClick={() => onSelectEvent(ev)}
                className="bg-white rounded-2xl border border-slate-200/90 p-5 hover:border-violet-300 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-2.5">
                  {/* Top metadata tags */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${impactStyles.badgeBg}`}
                    >
                      {ev.impactLevel}
                    </span>
                    <span className="text-xs font-bold text-slate-900 tabular-nums">
                      Score RM {ev.scoreBreakdown.finalRMScore}/100
                    </span>
                  </div>

                  {/* Title & Dates */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-violet-700 transition-colors leading-snug">
                      {ev.title}
                    </h3>
                    <div className="text-xs font-medium text-slate-500 mt-1 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{formatEventDateRange(ev.startDate, ev.endDate)}</span>
                    </div>
                  </div>

                  {/* Venue & City */}
                  <div className="text-xs text-slate-600 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{ev.venueName} · {ev.city}</span>
                  </div>

                  {/* Key Stats */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl text-xs border border-slate-100">
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Affluence</div>
                      <div className="font-bold text-slate-800 tabular-nums mt-0.5">
                        {ev.expectedAttendance.toLocaleString('fr-FR')} pax
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Clientèle Intl</div>
                      <div className="font-bold text-slate-800 tabular-nums mt-0.5">
                        {ev.internationalRatioPercent}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Hotel specific distance & yield teaser */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="text-slate-500 truncate mr-2">
                    {hotelImp ? (
                      <span className="font-medium text-violet-700">
                        {hotelImp.distanceKm} km · ADR +{hotelImp.estimatedADRBoostPercent}%
                      </span>
                    ) : (
                      <span>Compression macro</span>
                    )}
                  </div>

                  <span className="text-violet-600 font-bold text-xs inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform shrink-0">
                    <span>Détails</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

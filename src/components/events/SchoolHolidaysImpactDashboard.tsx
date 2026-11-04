/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Zap,
  Users,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  Building2,
  BedDouble,
  GraduationCap,
  Sparkles,
  Info,
  DollarSign,
  ChevronRight,
  Sliders,
  Filter,
} from 'lucide-react';
import { SchoolHolidayPeriod, SchoolHolidaysImpactScoreResult, HolidaySeason } from '../../types/schoolHolidays';
import { Hotel } from '../../types';
import { calculateSchoolHolidayImpactScore, detectMajorOverlaps } from '../../services/schoolHolidaysImpactEngine';
import { getHotelInventoryProfile } from '../../data/hotelRoomTypologies';

interface SchoolHolidaysImpactDashboardProps {
  holidays: SchoolHolidayPeriod[];
  hotel: Hotel;
  year: number;
  onSelectHoliday: (holiday: SchoolHolidayPeriod) => void;
}

export const SchoolHolidaysImpactDashboard: React.FC<SchoolHolidaysImpactDashboardProps> = ({
  holidays,
  hotel,
  year,
  onSelectHoliday,
}) => {
  const profile = getHotelInventoryProfile(hotel.id);
  const roomBreakdown = profile.roomBreakdown;

  // Filter state for dashboard
  const [selectedSeason, setSelectedSeason] = useState<'all' | HolidaySeason>('all');
  const [minScoreFilter, setMinScoreFilter] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'matrix' | 'overlaps' | 'room_typologies' | 'comparison'>('matrix');

  // Calculate impact score for all holidays
  const evaluatedHolidays = useMemo(() => {
    return holidays
      .filter((h) => selectedSeason === 'all' || h.season === selectedSeason)
      .map((h) => calculateSchoolHolidayImpactScore(h, hotel, holidays))
      .filter((res) => res.score >= minScoreFilter)
      .sort((a, b) => b.score - a.score);
  }, [holidays, hotel, selectedSeason, minScoreFilter]);

  // Major multi-country overlaps
  const overlaps = useMemo(() => {
    return detectMajorOverlaps(holidays, hotel);
  }, [holidays, hotel]);

  // High potential holidays (Score >= 70)
  const highImpactHolidays = evaluatedHolidays.filter((h) => h.classification === 'vert');
  const moderateImpactHolidays = evaluatedHolidays.filter((h) => h.classification === 'orange');
  const lowImpactHolidays = evaluatedHolidays.filter((h) => h.classification === 'rouge');

  // Classification styling
  const getBadgeStyle = (cls: string) => {
    switch (cls) {
      case 'vert':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'orange':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'rouge':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Hero: Hotel Inventory Compatibility & Revenue Management Strategy */}
      <div className="bg-gradient-to-r from-violet-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-xs font-semibold text-violet-200">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Analyse Prédictive de la Demande Familiale · {hotel.name}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              Impact Hôtelier des Vacances Scolaires & Typologies de Chambres
            </h2>
            <p className="text-xs sm:text-sm text-violet-200/90 max-w-2xl leading-relaxed">
              L&apos;influence des vacances scolaires est pondérée par la part des chambres familiales (<strong>{roomBreakdown.familyCapacitySharePercent}% du parc</strong>), l&apos;accessibilité ferroviaire et la convergence des marchés émetteurs européens.
            </p>
          </div>

          {/* Quick Stats Pill Strip */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="bg-white/10 border border-white/20 rounded-2xl px-4 py-2.5 text-center">
              <div className="text-[10px] uppercase font-bold text-violet-300">Capacité Familiale</div>
              <div className="text-xl font-black text-white mt-0.5">{roomBreakdown.familyCapacityRooms} ch.</div>
              <div className="text-[10px] text-violet-300">{roomBreakdown.familyCapacitySharePercent}% de l&apos;hôtel</div>
            </div>

            <div className="bg-white/10 border border-white/20 rounded-2xl px-4 py-2.5 text-center">
              <div className="text-[10px] uppercase font-bold text-violet-300">Périodes Clés Vertes</div>
              <div className="text-xl font-black text-emerald-400 mt-0.5">{highImpactHolidays.length}</div>
              <div className="text-[10px] text-violet-300">Score RM &ge; 70</div>
            </div>

            <div className="bg-white/10 border border-white/20 rounded-2xl px-4 py-2.5 text-center">
              <div className="text-[10px] uppercase font-bold text-violet-300">ADR Moyen Vacances</div>
              <div className="text-xl font-black text-white mt-0.5">{profile.historicalHolidayADR}€</div>
              <div className="text-[10px] text-emerald-300">+{Math.round(((profile.historicalHolidayADR - hotel.baseADR) / hotel.baseADR) * 100)}% vs Base</div>
            </div>
          </div>
        </div>

        {/* Sub-navigation tabs */}
        <div className="pt-2 border-t border-white/10 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'matrix' ? 'bg-white text-slate-900 shadow-xs' : 'text-violet-200 hover:bg-white/10'
            }`}
          >
            Matrice des Scores RM ({evaluatedHolidays.length})
          </button>
          <button
            onClick={() => setActiveTab('overlaps')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'overlaps' ? 'bg-white text-slate-900 shadow-xs' : 'text-violet-200 hover:bg-white/10'
            }`}
          >
            Périodes de Chevauchement Multi-Pays ({overlaps.length})
          </button>
          <button
            onClick={() => setActiveTab('room_typologies')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'room_typologies' ? 'bg-white text-slate-900 shadow-xs' : 'text-violet-200 hover:bg-white/10'
            }`}
          >
            Audit Parc de Chambres & Compatibilité
          </button>
          <button
            onClick={() => setActiveTab('comparison')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'comparison' ? 'bg-white text-slate-900 shadow-xs' : 'text-violet-200 hover:bg-white/10'
            }`}
          >
            Comparatif Historique (Occ / ADR / RevPAR)
          </button>
        </div>
      </div>

      {/* TAB 1: Matrice des Scores d'Impact RM */}
      {activeTab === 'matrix' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-700">Saison :</span>
              {(['all', 'hiver', 'printemps', 'ete', 'automne'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedSeason(s)}
                  className={`px-2.5 py-1 rounded-lg font-semibold capitalize cursor-pointer transition-all ${
                    selectedSeason === s ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {s === 'all' ? 'Toutes saisons' : s}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700">Filtre score min :</span>
              <select
                value={minScoreFilter}
                onChange={(e) => setMinScoreFilter(parseInt(e.target.value, 10))}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 font-semibold text-slate-700"
              >
                <option value={0}>Tous les scores</option>
                <option value={42}>Impact modéré & élevé (&ge; 42)</option>
                <option value={70}>Impact élevé uniquement (&ge; 70)</option>
              </select>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {evaluatedHolidays.map((item) => {
              const originalHoliday = holidays.find((h) => h.id === item.periodId);
              const badgeCls = getBadgeStyle(item.classification);

              return (
                <div
                  key={item.periodId}
                  onClick={() => originalHoliday && onSelectHoliday(originalHoliday)}
                  className="bg-white rounded-2xl border border-slate-200/90 hover:border-violet-300 hover:shadow-xs transition-all p-4 space-y-3 cursor-pointer flex flex-col justify-between group"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                          <span className="text-base">{item.flag}</span>
                          <span className="font-bold text-slate-800">{item.countryName}</span>
                          <span className="text-slate-300">·</span>
                          <span className="capitalize">{item.season}</span>
                        </div>
                        <h4 className="font-bold text-slate-900 text-sm mt-0.5 group-hover:text-violet-600 transition-colors">
                          {item.holidayName}
                        </h4>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {new Date(item.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} –{' '}
                          {new Date(item.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })} ({item.durationDays} j)
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-2xl font-black text-slate-900 tabular-nums">{item.score}</div>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border inline-block ${badgeCls}`}>
                          {item.classificationLabel}
                        </span>
                      </div>
                    </div>

                    {/* Breakdown bars */}
                    <div className="space-y-1 pt-1.5 border-t border-slate-100 text-[10px]">
                      <div className="flex items-center justify-between text-slate-500">
                        <span>Typologie chambres ({roomBreakdown.familyCapacityRooms} ch.)</span>
                        <span className="font-bold text-slate-800">{item.scoreBreakdown.roomTypologyScore}/25</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                        <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${(item.scoreBreakdown.roomTypologyScore / 25) * 100}%` }} />
                      </div>

                      <div className="flex items-center justify-between text-slate-500">
                        <span>Convergence multi-marchés ({item.overlappingCountries.length} pays)</span>
                        <span className="font-bold text-slate-800">{item.scoreBreakdown.countryOverlapScore}/20</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                        <div className="bg-violet-500 h-full rounded-full" style={{ width: `${(item.scoreBreakdown.countryOverlapScore / 20) * 100}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* Recommendation snippet */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-violet-700 font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      <span>Consulter l&apos;impact & reco</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                    <span className="text-slate-400 font-medium">
                      {item.overlappingCountries.length > 0 ? `${item.overlappingCountries.length} chevauchements` : 'Mono-marché'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: Périodes de Chevauchement Multi-Pays */}
      {activeTab === 'overlaps' && (
        <div className="space-y-4">
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 text-xs text-slate-700 flex items-start gap-3">
            <Info className="w-4 h-4 text-violet-600 shrink-0 mt-0.5" />
            <div>
              <strong>Principe Revenue Management des Chevauchements :</strong> Les périodes où plusieurs marchés émetteurs sont simultanément en vacances créent un effet d&apos;accumulation sur la demande touristique parisienne. Pour {hotel.name}, cela optimise le taux d&apos;occupation des chambres triples, quadruples et communicantes sans cannibaliser les séjours en semaine.
            </div>
          </div>

          <div className="space-y-3">
            {overlaps.map((overlap, idx) => (
              <div
                key={idx}
                className="bg-white border border-slate-200/90 rounded-2xl p-4.5 shadow-2xs space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 uppercase">
                        {overlap.season}
                      </span>
                      <span className="text-xs text-slate-500 font-semibold">
                        {new Date(overlap.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} au{' '}
                        {new Date(overlap.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm mt-1">{overlap.peakPeriodName}</h4>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Score de convergence : {overlap.impactScoreAvg}/100
                    </span>
                  </div>
                </div>

                {/* Overlapping countries list */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                  <span className="text-xs font-bold text-slate-600">
                    {overlap.totalCountries} pays simultanément en vacances :
                  </span>
                  {overlap.countries.map((c) => (
                    <span
                      key={c.code}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-200/80 text-xs font-semibold text-slate-800"
                    >
                      <span>{c.flag}</span>
                      <span>{c.name}</span>
                      <span className="text-[10px] text-slate-500">({c.holidayName})</span>
                    </span>
                  ))}
                </div>

                {/* Strategy alert */}
                <div className="p-3 rounded-xl bg-violet-50/70 border border-violet-200/80 text-xs text-violet-950 flex items-start gap-2">
                  <Zap className="w-4 h-4 text-violet-700 shrink-0 mt-0.5" />
                  <div>
                    <strong>Recommandation RM :</strong> {overlap.recommendedFocus}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Audit Parc de Chambres & Compatibilité */}
      {activeTab === 'room_typologies' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-6 text-xs sm:text-sm">
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              Structure du Parc de Chambres & Potentiel Familial
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Établissement : <strong>{hotel.name}</strong> · Capacité totale : {hotel.roomCount} chambres
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Chambres Simples</span>
              <span className="text-lg font-bold text-slate-800 mt-1 block">{roomBreakdown.singleRooms}</span>
              <span className="text-[10px] text-slate-500">1 personne</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Chambres Doubles</span>
              <span className="text-lg font-bold text-slate-800 mt-1 block">{roomBreakdown.doubleRooms}</span>
              <span className="text-[10px] text-slate-500">2 personnes</span>
            </div>
            <div className="bg-indigo-50/80 p-3 rounded-xl border border-indigo-200 text-center">
              <span className="text-indigo-600 text-[10px] uppercase font-bold block">Chambres Triples</span>
              <span className="text-lg font-bold text-indigo-900 mt-1 block">{roomBreakdown.tripleRooms}</span>
              <span className="text-[10px] text-indigo-600">3 personnes</span>
            </div>
            <div className="bg-indigo-50/80 p-3 rounded-xl border border-indigo-200 text-center">
              <span className="text-indigo-600 text-[10px] uppercase font-bold block">Quadruples</span>
              <span className="text-lg font-bold text-indigo-900 mt-1 block">{roomBreakdown.quadrupleRooms}</span>
              <span className="text-[10px] text-indigo-600">4 personnes</span>
            </div>
            <div className="bg-indigo-50/80 p-3 rounded-xl border border-indigo-200 text-center">
              <span className="text-indigo-600 text-[10px] uppercase font-bold block">Communicantes</span>
              <span className="text-lg font-bold text-indigo-900 mt-1 block">{roomBreakdown.connectingRooms}</span>
              <span className="text-[10px] text-indigo-600">4-5 personnes</span>
            </div>
            <div className="bg-indigo-50/80 p-3 rounded-xl border border-indigo-200 text-center">
              <span className="text-indigo-600 text-[10px] uppercase font-bold block">Suites Famille</span>
              <span className="text-lg font-bold text-indigo-900 mt-1 block">{roomBreakdown.suites}</span>
              <span className="text-[10px] text-indigo-600">3-4 personnes</span>
            </div>
          </div>

          {/* Feeder Markets ranking table */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
              Répartition des Marchés Émetteurs Historiques (Nuitées)
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase text-slate-500 font-bold">
                  <tr>
                    <th className="py-2.5 px-3">Marché Émetteur</th>
                    <th className="py-2.5 px-3">Part des nuitées</th>
                    <th className="py-2.5 px-3">Durée Moy. Séjour (ALOS)</th>
                    <th className="py-2.5 px-3">Propension Séjours Familiaux</th>
                    <th className="py-2.5 px-3">Canal Privilégié</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {profile.feederMarkets.map((m) => (
                    <tr key={m.countryCode} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 font-bold text-slate-900 flex items-center gap-2">
                        <span>{m.flag}</span>
                        <span>{m.countryName}</span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{m.sharePercent}%</td>
                      <td className="py-2.5 px-3 text-slate-600">{m.alos} nuits</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
                          {m.familyTravelPropensity.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">OTA + Direct Web</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Comparatif Historique (Occ / ADR / RevPAR) */}
      {activeTab === 'comparison' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4 text-xs sm:text-sm">
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              Comparatif Historique de Performance Hôtelière par Saison Scolaire
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Impact comparatif mesuré sur le Grand Hôtel Folkestone Opéra (4★)
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase text-slate-500 font-bold">
                <tr>
                  <th className="py-2.5 px-3">Période Scolaire</th>
                  <th className="py-2.5 px-3">Marchés Clés</th>
                  <th className="py-2.5 px-3">Taux d&apos;Occ. Observé</th>
                  <th className="py-2.5 px-3">ADR Réalisé</th>
                  <th className="py-2.5 px-3">RevPAR</th>
                  <th className="py-2.5 px-3">Écart vs Base Annuelle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="hover:bg-slate-50">
                  <td className="py-3 px-3 font-bold text-slate-900">Vacances d&apos;Hiver (Février)</td>
                  <td className="py-3 px-3 text-slate-600">FR (Zone C/B) · GB · BE</td>
                  <td className="py-3 px-3 font-bold text-emerald-600">82.4%</td>
                  <td className="py-3 px-3 font-bold text-slate-900">285€</td>
                  <td className="py-3 px-3 font-bold text-violet-700">234.8€</td>
                  <td className="py-3 px-3 text-emerald-600 font-bold">+18.5%</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-3 px-3 font-bold text-slate-900">Pâques & Spring Break (Avril)</td>
                  <td className="py-3 px-3 text-slate-600">FR · GB · US · DE · ES</td>
                  <td className="py-3 px-3 font-bold text-emerald-600">89.6%</td>
                  <td className="py-3 px-3 font-bold text-slate-900">325€</td>
                  <td className="py-3 px-3 font-bold text-violet-700">291.2€</td>
                  <td className="py-3 px-3 text-emerald-600 font-bold">+34.8%</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-3 px-3 font-bold text-slate-900">Grandes Vacances d&apos;Été (Juil - Août)</td>
                  <td className="py-3 px-3 text-slate-600">Tous marchés européens + US</td>
                  <td className="py-3 px-3 font-bold text-emerald-600">92.1%</td>
                  <td className="py-3 px-3 font-bold text-slate-900">340€</td>
                  <td className="py-3 px-3 font-bold text-violet-700">313.1€</td>
                  <td className="py-3 px-3 text-emerald-600 font-bold">+41.2%</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-3 px-3 font-bold text-slate-900">Toussaint (Fin Octobre)</td>
                  <td className="py-3 px-3 text-slate-600">FR · BE · CH · NL</td>
                  <td className="py-3 px-3 font-bold text-emerald-600">86.5%</td>
                  <td className="py-3 px-3 font-bold text-slate-900">310€</td>
                  <td className="py-3 px-3 font-bold text-violet-700">268.1€</td>
                  <td className="py-3 px-3 text-emerald-600 font-bold">+28.4%</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-3 px-3 font-bold text-slate-900">Fêtes de Fin d&apos;Année (Noël)</td>
                  <td className="py-3 px-3 text-slate-600">Tous marchés (Loisirs & Familles)</td>
                  <td className="py-3 px-3 font-bold text-emerald-600">90.8%</td>
                  <td className="py-3 px-3 font-bold text-slate-900">360€</td>
                  <td className="py-3 px-3 font-bold text-violet-700">326.8€</td>
                  <td className="py-3 px-3 text-emerald-600 font-bold">+47.2%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

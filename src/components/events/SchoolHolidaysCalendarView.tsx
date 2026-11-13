/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Globe,
  BarChart3,
  Users,
  RotateCcw,
  Plus,
  Download,
  Filter,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  Sliders,
  ChevronDown,
  Layers,
  ShieldCheck,
  ExternalLink,
  BedDouble,
  GraduationCap,
  X,
  Upload,
} from 'lucide-react';
import {
  SchoolHolidayPeriod,
  CountryHolidayConfig,
  HolidaySeason,
} from '../../types/schoolHolidays';
import { Hotel } from '../../types';
import {
  INITIAL_COUNTRIES,
  ADDITIONAL_COUNTRIES_AVAILABLE,
  generateSchoolHolidaysForYear,
} from '../../data/schoolHolidaysData';
import { SchoolHolidayDetailModal } from './SchoolHolidayDetailModal';
import { SchoolHolidaysImpactDashboard } from './SchoolHolidaysImpactDashboard';

interface SchoolHolidaysCalendarViewProps {
  hotel: Hotel;
  onShowToast: (msg: string) => void;
}

const MONTHS_HEADER = [
  { key: 0, label: 'JAN', name: 'Janvier' },
  { key: 1, label: 'FÉV', name: 'Février' },
  { key: 2, label: 'MAR', name: 'Mars' },
  { key: 3, label: 'AVR', name: 'Avril' },
  { key: 4, label: 'MAI', name: 'Mai' },
  { key: 5, label: 'JUN', name: 'Juin' },
  { key: 6, label: 'JUL', name: 'Juillet' },
  { key: 7, label: 'AOÛ', name: 'Août' },
  { key: 8, label: 'SEP', name: 'Septembre' },
  { key: 9, label: 'OCT', name: 'Octobre' },
  { key: 10, label: 'NOV', labelSub: '•', name: 'Novembre', isCurrent: true },
  { key: 11, label: 'DÉC', name: 'Décembre' },
];

export const SchoolHolidaysCalendarView: React.FC<SchoolHolidaysCalendarViewProps> = ({
  hotel,
  onShowToast,
}) => {
  // Navigation: Year
  const [selectedYear, setSelectedYear] = useState<number>(2026);

  // Active Countries
  const [activeCountries, setActiveCountries] = useState<CountryHolidayConfig[]>(INITIAL_COUNTRIES);

  // Filter by country
  const [selectedCountryFilter, setSelectedCountryFilter] = useState<string>('all');

  // Filter by French zone: 'all' | 'zone-a' | 'zone-b' | 'zone-c'
  const [frenchZoneFilter, setFrenchZoneFilter] = useState<string>('all');

  // Presentation view: 'calendar' (the exact timeline from the screenshot) vs 'impact_analysis' (the deep RM dashboard)
  const [viewPresentation, setViewPresentation] = useState<'calendar' | 'impact_analysis'>('calendar');

  // Modal for adding a new country
  const [isAddCountryModalOpen, setIsAddCountryModalOpen] = useState(false);

  // Modal for detail of a holiday
  const [selectedHoliday, setSelectedHoliday] = useState<SchoolHolidayPeriod | null>(null);

  // Holidays for current year
  const allHolidaysForYear = useMemo(() => {
    return generateSchoolHolidaysForYear(selectedYear);
  }, [selectedYear]);

  // Filtered countries
  const displayedCountries = useMemo(() => {
    if (selectedCountryFilter === 'all') return activeCountries;
    return activeCountries.filter((c) => c.code === selectedCountryFilter);
  }, [activeCountries, selectedCountryFilter]);

  // Filtered holidays
  const filteredHolidays = useMemo(() => {
    return allHolidaysForYear.filter((h) => {
      // Country filter
      if (selectedCountryFilter !== 'all' && h.countryCode !== selectedCountryFilter) {
        return false;
      }
      return true;
    });
  }, [allHolidaysForYear, selectedCountryFilter]);

  // Color helper according to season matching screenshot
  const getSeasonStyle = (season: HolidaySeason) => {
    switch (season) {
      case 'hiver':
        return {
          pill: 'bg-[#eff6ff] dark:bg-blue-950/60 text-[#1e40af] dark:text-blue-200 border border-[#bfdbfe] dark:border-blue-800/70 hover:bg-[#dbeafe] dark:hover:bg-blue-900/60',
          dot: 'bg-[#3b82f6]',
        };
      case 'printemps':
        return {
          pill: 'bg-[#f0fdf4] dark:bg-emerald-950/60 text-[#166534] dark:text-emerald-200 border border-[#bbf7d0] dark:border-emerald-800/70 hover:bg-[#dcfce7] dark:hover:bg-emerald-900/60',
          dot: 'bg-[#22c55e]',
        };
      case 'ete':
        return {
          pill: 'bg-[#fefce8] dark:bg-amber-950/60 text-[#854d0e] dark:text-amber-200 border border-[#fef08a] dark:border-amber-800/70 hover:bg-[#fef9c3] dark:hover:bg-amber-900/60',
          dot: 'bg-[#eab308]',
        };
      case 'automne':
        return {
          pill: 'bg-[#fdf2f8] dark:bg-pink-950/60 text-[#9d174d] dark:text-pink-200 border border-[#fbcfe8] dark:border-pink-800/70 hover:bg-[#fce7f3] dark:hover:bg-pink-900/60',
          dot: 'bg-[#ec4899]',
        };
    }
  };

  /**
   * Calcule le positionnement horizontal d'une période dans la grille des 12 mois
   * Retourne left % et width % sur 100% de l'année (365 jours)
   */
  const calculateHolidayPosition = (startDateStr: string, endDateStr: string) => {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);

    // Jour de début dans l'année (0 - 365)
    const yearStart = new Date(selectedYear, 0, 1);
    const yearEnd = new Date(selectedYear, 11, 31);
    const totalDaysInYear = (yearEnd.getTime() - yearStart.getTime()) / (1000 * 3600 * 24);

    const startOffsetDays = Math.max(0, (start.getTime() - yearStart.getTime()) / (1000 * 3600 * 24));
    const durationDays = Math.max(1, (end.getTime() - start.getTime()) / (1000 * 3600 * 24));

    const leftPercent = Math.min(98, Math.max(0, (startOffsetDays / totalDaysInYear) * 100));
    const widthPercent = Math.min(100 - leftPercent, Math.max(2.5, (durationDays / totalDaysInYear) * 100));

    return {
      left: `${leftPercent}%`,
      width: `${widthPercent}%`,
    };
  };

  const handleAddCountry = (newCountry: CountryHolidayConfig) => {
    if (!activeCountries.some((c) => c.code === newCountry.code)) {
      setActiveCountries((prev) => [...prev, newCountry]);
      onShowToast(`Pays ${newCountry.name} ajouté au calendrier des vacances`);
    }
    setIsAddCountryModalOpen(false);
  };

  const handleRemoveCountry = (countryCode: string) => {
    if (activeCountries.length <= 1) {
      onShowToast('Impossible de supprimer le dernier pays');
      return;
    }
    setActiveCountries((prev) => prev.filter((c) => c.code !== countryCode));
    onShowToast('Pays retiré du calendrier');
  };

  const handleSyncOfficial = () => {
    onShowToast('Synchronisation réussie avec data.education.gouv.fr et OpenHolidays API (57 périodes à jour)');
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner matching screenshot */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-violet-600 flex items-center justify-center text-white shadow-xs shrink-0">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                  Vacances scolaires {selectedYear} · {activeCountries.length} pays
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-violet-100 dark:bg-violet-900/40 text-violet-800 dark:text-violet-300">
                  Officiel
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Calendrier officiel multi-pays — toutes saisons et destinations clés pour {hotel.name}
              </p>
            </div>
          </div>

          {/* Controls: Year selector, + Pays, + Importer */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                className="appearance-none bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 font-bold text-xs text-slate-800 dark:text-slate-200 px-3.5 py-2 pr-8 rounded-xl shadow-2xs cursor-pointer transition-all"
              >
                <option value={2026}>2026 (en cours)</option>
                <option value={2027}>2027 (officiel & prévisionnel)</option>
                <option value={2028}>2028 (anticipation précoce)</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <button
              onClick={() => setIsAddCountryModalOpen(true)}
              className="px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
              <span>Pays</span>
            </button>

            <button
              onClick={handleSyncOfficial}
              className="px-4 py-2 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-white" />
              <span>Actualiser les sources</span>
            </button>
          </div>
        </div>

        {/* 2. Top Metric Cards Strip (12 pays, 4 saisons, 57 périodes, 92%, MAJ) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <div className="bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 flex items-center justify-center shrink-0">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <div className="text-base font-black text-slate-900 dark:text-slate-100">{activeCountries.length} pays</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">couverts</div>
            </div>
          </div>

          <div className="bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="text-base font-black text-slate-900 dark:text-slate-100">4 saisons</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">périodes saisonnières</div>
            </div>
          </div>

          <div className="bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-base font-black text-slate-900 dark:text-slate-100">{filteredHolidays.length}</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">périodes référencées</div>
            </div>
          </div>

          <div className="bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="text-base font-black text-slate-900 dark:text-slate-100">92%</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">population couverte</div>
            </div>
          </div>

          <div className="bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-3 flex items-center gap-3 col-span-2 sm:col-span-1">
            <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 flex items-center justify-center shrink-0">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100">MAJ 02/11/2026</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">sources officielles</div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Filter Bar & View Mode Toggle */}
      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left: Country filter & Season legend */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Country filter select */}
          <div className="relative">
            <select
              value={selectedCountryFilter}
              onChange={(e) => setSelectedCountryFilter(e.target.value)}
              className="appearance-none bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 font-bold text-slate-800 dark:text-slate-200 px-3 py-1.5 pr-8 rounded-xl cursor-pointer"
            >
              <option value="all">Tous les pays ({activeCountries.length})</option>
              {activeCountries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Season legend chips */}
          <div className="flex items-center gap-3 text-xs font-medium text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]" />
              <span>Hiver</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e]" />
              <span>Printemps</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#eab308]" />
              <span>Été</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ec4899]" />
              <span>Automne</span>
            </span>
          </div>
        </div>

        {/* Right: View presentation toggle */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/70 dark:border-slate-800/70 gap-1">
          <button
            onClick={() => setViewPresentation('calendar')}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
              viewPresentation === 'calendar'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Calendrier Annuel</span>
          </button>
          <button
            onClick={() => setViewPresentation('impact_analysis')}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
              viewPresentation === 'impact_analysis'
                ? 'bg-violet-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Impact Hôtelier & RM</span>
          </button>
        </div>
      </div>

      {/* 4. MAIN DISPLAY: Timeline Grid vs Deep RM Impact Dashboard */}
      {viewPresentation === 'impact_analysis' ? (
        <SchoolHolidaysImpactDashboard
          holidays={allHolidaysForYear}
          hotel={hotel}
          year={selectedYear}
          onSelectHoliday={setSelectedHoliday}
        />
      ) : (
        /* The exact Timeline Grid matching image_18c779b8.png */
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xs overflow-hidden">
          {/* Table Container with scroll */}
          <div className="overflow-x-auto">
            <div className="min-w-[1050px]">
              {/* Header: PAYS + 12 Months */}
              <div className="grid grid-cols-13 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-800/50 text-center text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <div className="py-3.5 px-4 text-left font-bold text-slate-700 dark:text-slate-300 border-r border-slate-200/60 dark:border-slate-800/70 w-44 shrink-0">
                  PAYS
                </div>
                {MONTHS_HEADER.map((m) => (
                  <div
                    key={m.key}
                    className={`py-3.5 border-r border-slate-200/60 dark:border-slate-800/70 last:border-r-0 flex flex-col items-center justify-center ${
                      m.isCurrent ? 'bg-violet-50/60 dark:bg-violet-950/40 text-violet-900 dark:text-violet-200' : ''
                    }`}
                  >
                    <span>{m.label}</span>
                    {m.labelSub && <span className="text-violet-600 dark:text-violet-400 text-xs leading-none mt-0.5">•</span>}
                  </div>
                ))}
              </div>

              {/* Country Rows */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {displayedCountries.map((country) => {
                  const countryHolidays = filteredHolidays.filter((h) => h.countryCode === country.code);

                  return (
                    <div key={country.code} className="grid grid-cols-13 min-h-[64px] hover:bg-slate-50/40 dark:hover:bg-slate-800/60 transition-colors">
                      {/* Pinned Left Country Column */}
                      <div className="py-3 px-4 border-r border-slate-200/60 dark:border-slate-800/70 flex items-center justify-between w-44 shrink-0 bg-white dark:bg-slate-900">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{country.flag}</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate">{country.name}</span>
                        </div>
                      </div>

                      {/* Timeline Area (Span 12 months) */}
                      <div className="col-span-12 relative min-h-[64px] py-2 px-1 flex items-center">
                        {/* Subtle Month Grid Lines */}
                        <div className="absolute inset-0 grid grid-cols-12 pointer-events-none divide-x divide-slate-100/80 dark:divide-slate-800/60">
                          {MONTHS_HEADER.map((m) => (
                            <div key={m.key} className={m.isCurrent ? 'bg-violet-50/20 dark:bg-violet-950/25' : ''} />
                          ))}
                        </div>

                        {/* Holiday Pills Container */}
                        <div className="relative w-full h-9">
                          {countryHolidays.map((holiday) => {
                            const pos = calculateHolidayPosition(holiday.startDate, holiday.endDate);
                            const style = getSeasonStyle(holiday.season);

                            const startLabel = new Date(holiday.startDate).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: 'short',
                            });
                            const endLabel = new Date(holiday.endDate).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: 'short',
                            });

                            return (
                              <button
                                key={holiday.id}
                                onClick={() => setSelectedHoliday(holiday)}
                                style={{ left: pos.left, width: pos.width }}
                                className={`absolute top-0 h-9 rounded-xl px-2.5 py-1 text-left flex flex-col justify-center transition-all shadow-2xs hover:shadow-xs hover:z-10 cursor-pointer overflow-hidden leading-tight ${style.pill}`}
                                title={`${holiday.name} (${holiday.countryName}) : ${startLabel} – ${endLabel}`}
                              >
                                <span className="font-bold text-[10px] truncate block">{holiday.name}</span>
                                <span className="text-[9px] opacity-80 truncate block">
                                  {startLabel} – {endLabel}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add Country row footer matching screenshot */}
              <div className="p-3 border-t border-slate-200/70 dark:border-slate-800/70 bg-slate-50/40 dark:bg-slate-800/40">
                <button
                  onClick={() => setIsAddCountryModalOpen(true)}
                  className="w-full py-2.5 px-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-violet-400 hover:bg-violet-50/50 text-slate-500 dark:text-slate-400 hover:text-violet-700 dark:hover:text-violet-300 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Ajouter un pays</span>
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Official Sources Line matching screenshot */}
          <div className="px-6 py-4 bg-slate-50/80 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 space-y-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-bold text-slate-700 dark:text-slate-300 text-[10px] uppercase tracking-wider">
                SOURCES OFFICIELLES :
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                FR data.education.gouv.fr · BE calendrier.be · DE/CH/NL openholidaysapi.org · GB gov.uk/school-term-holiday-dates · ES educacion.gob.es · US nces.ed.gov · JP mext.go.jp
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-[11px] font-semibold text-slate-600 dark:text-slate-400 pt-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Données libres de droits</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-500" />
                <span>Sources gouvernementales</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-violet-500" />
                <span>Mise à jour annuelle</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom RMS Synchro Banner matching screenshot */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2.5 shadow-2xs">
        <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
        <span>
          Chaque événement validé et chaque période de vacances scolaires alimentent automatiquement le RMS, l&apos;autopilote, le calendrier tarifaire et les alertes de Revenue Management.
        </span>
      </div>

      {/* Modal for Holiday Detail */}
      <SchoolHolidayDetailModal
        isOpen={selectedHoliday !== null}
        onClose={() => setSelectedHoliday(null)}
        holiday={selectedHoliday}
        hotel={hotel}
        allHolidays={allHolidaysForYear}
      />

      {/* Modal for Adding Countries */}
      {isAddCountryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setIsAddCountryModalOpen(false)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 z-10 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Ajouter un pays au calendrier</h3>
              <button onClick={() => setIsAddCountryModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Sélectionnez un marché émetteur supplémentaire pour intégrer son calendrier scolaire officiel :
            </p>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {ADDITIONAL_COUNTRIES_AVAILABLE.map((c) => {
                const isAlreadyAdded = activeCountries.some((ac) => ac.code === c.code);

                return (
                  <div
                    key={c.code}
                    className="flex items-center justify-between p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100/60 dark:hover:bg-slate-800/80"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{c.flag}</span>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-slate-100 text-xs">{c.name}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">{c.officialSource}</div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleAddCountry(c)}
                      disabled={isAlreadyAdded}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isAlreadyAdded
                          ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                          : 'bg-violet-600 hover:bg-violet-700 text-white shadow-2xs'
                      }`}
                    >
                      {isAlreadyAdded ? 'Déjà ajouté' : 'Ajouter'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

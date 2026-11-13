/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  X,
  Calendar,
  Building2,
  TrendingUp,
  AlertTriangle,
  Zap,
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
  Globe,
  BedDouble,
  GraduationCap,
} from 'lucide-react';
import { SchoolHolidayPeriod, SchoolHolidaysImpactScoreResult } from '../../types/schoolHolidays';
import { Hotel } from '../../types';
import { calculateSchoolHolidayImpactScore } from '../../services/schoolHolidaysImpactEngine';
import { getHotelInventoryProfile } from '../../data/hotelRoomTypologies';

interface SchoolHolidayDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  holiday: SchoolHolidayPeriod | null;
  hotel: Hotel;
  allHolidays: SchoolHolidayPeriod[];
  onOpenImpactDashboard?: () => void;
}

export const SchoolHolidayDetailModal: React.FC<SchoolHolidayDetailModalProps> = ({
  isOpen,
  onClose,
  holiday,
  hotel,
  allHolidays,
  onOpenImpactDashboard,
}) => {
  if (!isOpen || !holiday) return null;

  const profile = getHotelInventoryProfile(hotel.id);
  const impactAnalysis = calculateSchoolHolidayImpactScore(holiday, hotel, allHolidays);

  const startFormatted = new Date(holiday.startDate).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const endFormatted = new Date(holiday.endDate).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Badge styling according to classification (Vert / Orange / Rouge / Données insuffisantes)
  const getBadgeStyle = (cls: string) => {
    switch (cls) {
      case 'vert':
        return {
          pill: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/70',
          bar: 'bg-emerald-500',
          dot: 'bg-emerald-500',
        };
      case 'orange':
        return {
          pill: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700/70',
          bar: 'bg-amber-500',
          dot: 'bg-amber-500',
        };
      case 'rouge':
        return {
          pill: 'bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-700/70',
          bar: 'bg-rose-500',
          dot: 'bg-rose-500',
        };
      case 'donnees_insuffisantes':
      default:
        return {
          pill: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700',
          bar: 'bg-slate-400',
          dot: 'bg-slate-400',
        };
    }
  };

  const style = getBadgeStyle(impactAnalysis.classification);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" onClick={onClose} />

      {/* Modal Card */}
      <div className="relative bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200/90 dark:border-slate-800 z-10 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xl">{holiday.flag}</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
                Vacances scolaires · {holiday.countryName}
              </span>
              {holiday.zoneLabel && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-slate-200">
                  {holiday.zoneLabel}
                </span>
              )}
            </div>
            <h3 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <span>{holiday.name}</span>
              <span className="text-slate-400 font-normal">({holiday.year})</span>
            </h3>
            <p className="text-xs text-slate-300">
              Du <strong>{startFormatted}</strong> au <strong>{endFormatted}</strong> · {holiday.durationDays} jours
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-slate-800 dark:text-slate-200 text-xs sm:text-sm">
          {/* School Holidays Impact Score Hero Card */}
          <div className="bg-gradient-to-br from-indigo-50/70 dark:from-indigo-950/50 via-purple-50/50 dark:via-purple-950/30 to-white dark:to-slate-900 border border-indigo-100 dark:border-indigo-900/60 rounded-2xl p-4.5 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  School Holidays Impact Score
                </span>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${style.pill}`}>
                <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                <span>{impactAnalysis.classificationLabel}</span>
              </span>
            </div>

            <div className="flex items-baseline gap-3">
              <div className="text-3xl font-black text-slate-900 dark:text-slate-100 tabular-nums">
                {impactAnalysis.score}
                <span className="text-sm font-semibold text-slate-400">/100</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-snug">
                Évaluation contextualisée pour <strong>{hotel.name}</strong> basée sur vos {profile.roomBreakdown.familyCapacityRooms} chambres familiales et l&apos;afflux du marché {holiday.countryName}.
              </p>
            </div>

            {/* Transparent Score Breakdown */}
            <div className="pt-2 border-t border-indigo-100/80 grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
              <div className="bg-white/80 dark:bg-slate-900/80 p-2 rounded-xl border border-indigo-50">
                <div className="text-slate-400 font-semibold">Marché émetteur</div>
                <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{impactAnalysis.scoreBreakdown.feederMarketScore}/25 pts</div>
              </div>
              <div className="bg-white/80 dark:bg-slate-900/80 p-2 rounded-xl border border-indigo-50">
                <div className="text-slate-400 font-semibold">Proximité / Train</div>
                <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{impactAnalysis.scoreBreakdown.proximityScore}/15 pts</div>
              </div>
              <div className="bg-white/80 dark:bg-slate-900/80 p-2 rounded-xl border border-indigo-50">
                <div className="text-slate-400 font-semibold">Chevauchement</div>
                <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{impactAnalysis.scoreBreakdown.countryOverlapScore}/20 pts</div>
              </div>
              <div className="bg-white/80 dark:bg-slate-900/80 p-2 rounded-xl border border-indigo-50">
                <div className="text-slate-400 font-semibold">Typologie chambres</div>
                <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{impactAnalysis.scoreBreakdown.roomTypologyScore}/25 pts</div>
              </div>
              <div className="bg-white/80 dark:bg-slate-900/80 p-2 rounded-xl border border-indigo-50">
                <div className="text-slate-400 font-semibold">Historique & Pace</div>
                <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{impactAnalysis.scoreBreakdown.historicalPaceScore}/15 pts</div>
              </div>
            </div>
          </div>

          {/* Section: Typologie de chambres & Compatibilité hôtel */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BedDouble className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Compatibilité Parc de Chambres & Clientèle Familiale
                </h4>
              </div>
              <span className="text-[11px] font-bold text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/40 px-2 py-0.5 rounded-full border border-violet-200 dark:border-violet-800/70">
                {profile.roomBreakdown.familyCapacitySharePercent}% du parc adapté
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-3.5 space-y-2 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200/70 dark:border-slate-800/70">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Chambres Triples</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{profile.roomBreakdown.tripleRooms} chambres</span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200/70 dark:border-slate-800/70">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Quadruples</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{profile.roomBreakdown.quadrupleRooms} chambres</span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200/70 dark:border-slate-800/70">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Communicantes</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{profile.roomBreakdown.connectingRooms} chambres</span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200/70 dark:border-slate-800/70">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Suites Famille</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{profile.roomBreakdown.suites} suites</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-1">
                {profile.roomBreakdown.description}
              </p>
            </div>
          </div>

          {/* Section: Chevauchements Multi-Pays */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Pays Simultanément en Vacances ({impactAnalysis.overlappingCountries.length})
                </h4>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Convergence des calendriers</span>
            </div>

            {impactAnalysis.overlappingCountries.length === 0 ? (
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-3 text-xs text-slate-500 dark:text-slate-400 text-center">
                Aucun autre pays répertorié n&apos;est en vacances simultanément sur cette période.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {impactAnalysis.overlappingCountries.map((c) => (
                  <div
                    key={c.code}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    <span>{c.flag}</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{c.name}</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">({c.holidayName})</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Recommandations Revenue Management */}
          <div className="bg-gradient-to-br from-violet-50 dark:from-violet-950/50 to-indigo-50 dark:to-indigo-950/40 border border-violet-200 dark:border-violet-800/70 rounded-2xl p-4.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-violet-700 dark:text-violet-300" />
                <h4 className="text-xs font-bold text-violet-950 dark:text-violet-100 uppercase tracking-wider">
                  Recommandation & Stratégie Revenue Management
                </h4>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-violet-200/80 dark:bg-violet-900/50 text-violet-900 dark:text-violet-200 rounded-full">
                Conditionnée au Pickup
              </span>
            </div>

            <div className="bg-white/90 dark:bg-slate-900/90 p-3 rounded-xl border border-violet-100 dark:border-violet-900/60 text-xs text-violet-950 dark:text-violet-100 leading-relaxed">
              <strong>Analyse contextuelle :</strong> {impactAnalysis.recommendation}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-violet-100 dark:border-violet-900/60">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Stratégie Commerciale</span>
                <p className="text-slate-700 dark:text-slate-300 mt-0.5">{impactAnalysis.commercialStrategy}</p>
              </div>
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-violet-100 dark:border-violet-900/60">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Action Yield & Restrictions</span>
                <p className="text-slate-700 dark:text-slate-300 mt-0.5">{impactAnalysis.yieldAction}</p>
              </div>
            </div>
          </div>

          {/* Official Source & Verification Info */}
          <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-400 gap-2">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Source officielle : <strong>{holiday.officialSource}</strong> (Sync {holiday.lastSync})</span>
            </div>
            {holiday.sourceUrl && (
              <a
                href={holiday.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-200 font-bold flex items-center gap-1"
              >
                <span>Consulter le texte officiel</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

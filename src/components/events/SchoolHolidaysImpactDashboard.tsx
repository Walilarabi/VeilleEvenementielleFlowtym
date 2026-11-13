import React from 'react';
import { AlertTriangle, CalendarDays, ExternalLink } from 'lucide-react';
import { SchoolHolidayPeriod } from '../../types/schoolHolidays';
import { Hotel } from '../../types';

interface SchoolHolidaysImpactDashboardProps {
  holidays: SchoolHolidayPeriod[];
  hotel: Hotel;
  year: number;
  onSelectHoliday: (holiday: SchoolHolidayPeriod) => void;
}

/** Keeps official school-holiday dates visible, but never fabricates hotel demand impact. */
export const SchoolHolidaysImpactDashboard: React.FC<SchoolHolidaysImpactDashboardProps> = ({ holidays, hotel, year, onSelectHoliday }) => {
  const rows = [...holidays].filter((holiday) => holiday.year === year).sort((a, b) => a.startDate.localeCompare(b.startDate));
  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
        <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div>
          <h2 className="text-sm font-bold">Impact hôtelier non calculé</h2>
          <p className="mt-1 text-sm">Les dates de vacances ci-dessous sont un calendrier de référence. Les anciens scores RM, typologies de chambres et comparaisons ADR reposaient sur des profils non confirmés. Aucun impact commercial n'est estimé pour {hotel.name} tant que les parts de clientèle, la typologie réelle et l'historique PMS ne sont pas enregistrés.</p>
        </div></div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-violet-600" /><h3 className="text-sm font-bold text-slate-900 dark:text-white">Périodes de vacances référencées · {year}</h3></div>
          <span className="text-xs text-slate-500">{rows.length} période(s)</span>
        </div>
        {rows.length === 0 ? <p className="p-5 text-sm text-slate-500">Aucune période référencée pour cette année.</p> : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((holiday) => (
              <button key={holiday.id} type="button" onClick={() => onSelectHoliday(holiday)} className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60">
                <span className="min-w-0"><span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">{holiday.flag} {holiday.name} <span className="text-xs font-normal text-slate-500">{holiday.countryName}{holiday.zoneLabel ? ` · ${holiday.zoneLabel}` : ''}</span></span><span className="mt-1 block text-xs text-slate-500">{holiday.startDate} → {holiday.endDate} · {holiday.durationDays} jours</span><span className="mt-1 block text-[11px] text-slate-400">{holiday.officialSource} · {holiday.isOfficial ? 'source officielle' : 'à vérifier'}</span></span>
                {holiday.sourceUrl ? <a href={holiday.sourceUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} aria-label={`Source de ${holiday.name}`} className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-violet-600 dark:hover:bg-slate-700"><ExternalLink size={15} /></a> : null}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

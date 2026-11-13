/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * FLOWTYM REVENUE — Service Centralisé de Chronologie & Filtrage Événementiel
 * 
 * Règles Fondamentales :
 * 1. Date de référence système : 2026-11-12 (ou date courante).
 * 2. Comportement par défaut (sur le mois en cours) :
 *    - Affichage STRICTEMENT restreint aux événements EN COURS et À VENIR.
 *    - Les événements terminés (endDate < refDate) sont EXCLUS de l'affichage par défaut.
 * 3. Ordre de tri chronologique strict :
 *    - Priorité 1 : Événements EN COURS (triés par startDate ASC, endDate ASC, score DESC).
 *    - Priorité 2 : Événements À VENIR (triés par startDate ASC du plus proche au plus éloigné).
 *    - Aucun saut en arrière chronologique.
 * 4. Gestion du sélecteur de période (Mois / Année) :
 *    - Mois en cours : En cours + À venir (terminés exclus).
 *    - Mois futur : Événements de la période classés chronologiquement.
 *    - Mois passé : Historique des événements de la période (y compris terminés).
 * 5. Cohérence absolue entre Vue Liste (Tableau), Vue Calendrier, Vue Explorer Events et Export PDF.
 */

import { EventItem } from '../types';

export const SYSTEM_REFERENCE_DATE = '2026-11-12';

export function getSystemReferenceDate(): string {
  return SYSTEM_REFERENCE_DATE;
}

export type EventChronologicalStatus = 'ongoing' | 'upcoming' | 'past';

/**
 * Normalise la date de fin (si absente, prend startDate)
 */
export function getEffectiveEndDate(ev: { startDate: string; endDate?: string | null }): string {
  return ev.endDate && ev.endDate.trim() ? ev.endDate : ev.startDate;
}

/**
 * Vérifie si un événement est en cours à une date de référence
 * Règle : startDate <= refDate ET endDate >= refDate
 */
export function isEventOngoing(
  ev: { startDate: string; endDate?: string | null },
  refDate: string = SYSTEM_REFERENCE_DATE
): boolean {
  const effectiveEnd = getEffectiveEndDate(ev);
  return ev.startDate <= refDate && effectiveEnd >= refDate;
}

/**
 * Vérifie si un événement est strictement futur
 * Règle : startDate > refDate
 */
export function isEventUpcoming(
  ev: { startDate: string; endDate?: string | null },
  refDate: string = SYSTEM_REFERENCE_DATE
): boolean {
  return ev.startDate > refDate;
}

/**
 * Vérifie si un événement est strictement terminé/passé
 * Règle : endDate < refDate
 */
export function isEventPast(
  ev: { startDate: string; endDate?: string | null },
  refDate: string = SYSTEM_REFERENCE_DATE
): boolean {
  const effectiveEnd = getEffectiveEndDate(ev);
  return effectiveEnd < refDate;
}

/**
 * Détermine le statut chronologique
 */
export function getEventChronologicalStatus(
  ev: { startDate: string; endDate?: string | null },
  refDate: string = SYSTEM_REFERENCE_DATE
): EventChronologicalStatus {
  if (isEventOngoing(ev, refDate)) return 'ongoing';
  if (isEventUpcoming(ev, refDate)) return 'upcoming';
  return 'past';
}

/**
 * Vérifie si un événement intersecte un mois donné (targetYear, targetMonth: 0-11)
 * Gère les chevauchements de début, de fin et à cheval sur 2 mois ou 2 années
 */
export function doesEventOverlapMonth(
  ev: { startDate: string; endDate?: string | null },
  targetYear: number,
  targetMonth: number
): boolean {
  const effectiveEnd = getEffectiveEndDate(ev);
  const monthStart = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-01`;
  const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const monthEnd = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

  return ev.startDate <= monthEnd && effectiveEnd >= monthStart;
}

/**
 * Détermine si le mois sélectionné est passé, en cours ou futur par rapport à refDate
 */
export function getMonthTemporalRelation(
  selectedYear: number,
  selectedMonth: number,
  refDate: string = SYSTEM_REFERENCE_DATE
): 'past' | 'current' | 'future' {
  const refYear = parseInt(refDate.slice(0, 4), 10);
  const refMonth = parseInt(refDate.slice(5, 7), 10) - 1; // 0-indexed

  if (selectedYear < refYear || (selectedYear === refYear && selectedMonth < refMonth)) {
    return 'past';
  }
  if (selectedYear === refYear && selectedMonth === refMonth) {
    return 'current';
  }
  return 'future';
}

/**
 * Tri chronologique strict Revenue Management :
 * 1. Événements EN COURS (startDate ASC, endDate ASC, score DESC)
 * 2. Événements À VENIR (startDate ASC, endDate ASC, score DESC)
 * 3. Événements PASSÉS (startDate ASC, endDate ASC)
 * Interdiction stricte de sauts en arrière ou d'événements passés insérés dans les événements futurs.
 */
export function sortEventsChronologically<T extends { startDate: string; endDate?: string | null; scoreBreakdown?: { finalRMScore?: number } }>(
  eventsList: T[],
  refDate: string = SYSTEM_REFERENCE_DATE,
  forceChronologicalByStartOnly: boolean = false
): T[] {
  return [...eventsList].sort((a, b) => {
    if (forceChronologicalByStartOnly) {
      const cmpStart = a.startDate.localeCompare(b.startDate);
      if (cmpStart !== 0) return cmpStart;
      const endA = getEffectiveEndDate(a);
      const endB = getEffectiveEndDate(b);
      const cmpEnd = endA.localeCompare(endB);
      if (cmpEnd !== 0) return cmpEnd;
      return (b.scoreBreakdown?.finalRMScore || 0) - (a.scoreBreakdown?.finalRMScore || 0);
    }

    const statusA = getEventChronologicalStatus(a, refDate);
    const statusB = getEventChronologicalStatus(b, refDate);

    const rank = (s: EventChronologicalStatus) => {
      if (s === 'ongoing') return 1;
      if (s === 'upcoming') return 2;
      return 3;
    };

    const rA = rank(statusA);
    const rB = rank(statusB);

    if (rA !== rB) {
      return rA - rB;
    }

    // Dans le même statut : ordre chronologique strict par date de début
    const cmpStart = a.startDate.localeCompare(b.startDate);
    if (cmpStart !== 0) {
      return cmpStart;
    }

    // Si même date de début : date de fin croissante
    const endA = getEffectiveEndDate(a);
    const endB = getEffectiveEndDate(b);
    const cmpEnd = endA.localeCompare(endB);
    if (cmpEnd !== 0) {
      return cmpEnd;
    }

    // Si dates identiques : score RM décroissant
    return (b.scoreBreakdown?.finalRMScore || 0) - (a.scoreBreakdown?.finalRMScore || 0);
  });
}

export interface ChronologyFilterOptions {
  selectedYear: number;
  selectedMonth: number; // 0-indexed (0 = Janv, 10 = Nov)
  periodTab?: 'upcoming' | 'ongoing' | 'past' | 'all';
  refDate?: string;
}

/**
 * Filtrage des événements pour la période sélectionnée et tri chronologique unifié
 */
export function filterAndSortEventsByPeriod<T extends { startDate: string; endDate?: string | null; scoreBreakdown?: { finalRMScore?: number } }>(
  events: T[],
  options: ChronologyFilterOptions
): T[] {
  const refDate = options.refDate || SYSTEM_REFERENCE_DATE;
  const temporal = getMonthTemporalRelation(options.selectedYear, options.selectedMonth, refDate);

  // 1. Événements intersectant le mois sélectionné
  const monthEvents = events.filter((ev) => doesEventOverlapMonth(ev, options.selectedYear, options.selectedMonth));

  // 2. Application des règles temporelles
  const filtered = monthEvents.filter((ev) => {
    const status = getEventChronologicalStatus(ev, refDate);

    if (temporal === 'current') {
      // Sur le mois en cours :
      if (options.periodTab === 'ongoing') {
        return status === 'ongoing';
      }
      if (options.periodTab === 'upcoming') {
        return status === 'upcoming';
      }
      if (options.periodTab === 'past') {
        return status === 'past';
      }
      // Par défaut (all) : UNIQUEMENT EN COURS ET À VENIR.
      // Tout événement terminé avant la date du jour est strictement exclu.
      return status === 'ongoing' || status === 'upcoming';
    }

    if (temporal === 'future') {
      // Sur un mois futur : tous les événements sont à venir
      if (options.periodTab === 'past' || options.periodTab === 'ongoing') {
        return false;
      }
      return true;
    }

    if (temporal === 'past') {
      // Sur un mois passé : historique des événements du mois
      if (options.periodTab === 'ongoing' || options.periodTab === 'upcoming') {
        return false;
      }
      return true;
    }

    return true;
  });

  // 3. Tri
  if (temporal === 'past') {
    return sortEventsChronologically(filtered, refDate, true);
  }

  return sortEventsChronologically(filtered, refDate, false);
}

/**
 * Configuration visuelle certifiée des statuts (Badges & Pastilles)
 */
export function getEventStatusBadgeConfig(
  ev: { startDate: string; endDate?: string | null },
  refDate: string = SYSTEM_REFERENCE_DATE
): {
  status: EventChronologicalStatus;
  label: string;
  badgeClass: string;
  dotClass: string;
  subLabel?: string;
} {
  const status = getEventChronologicalStatus(ev, refDate);

  if (status === 'ongoing') {
    return {
      status: 'ongoing',
      label: 'En cours',
      badgeClass: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/70 font-extrabold shadow-2xs',
      dotClass: 'bg-emerald-500 animate-pulse',
      subLabel: `Jusqu'au ${getEffectiveEndDate(ev).split('-').reverse().join('/')}`,
    };
  }

  if (status === 'upcoming') {
    return {
      status: 'upcoming',
      label: 'À venir',
      badgeClass: 'bg-violet-50 dark:bg-violet-950/60 text-violet-800 dark:text-violet-300 border border-violet-200/90 dark:border-violet-800/70 font-bold',
      dotClass: 'bg-violet-500',
      subLabel: `Début le ${ev.startDate.split('-').reverse().join('/')}`,
    };
  }

  return {
    status: 'past',
    label: 'Terminé',
    badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-medium',
    dotClass: 'bg-slate-400',
    subLabel: `Clôturé le ${getEffectiveEndDate(ev).split('-').reverse().join('/')}`,
  };
}

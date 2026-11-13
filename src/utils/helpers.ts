import { EventItem, EventCategory, RMImpactLevel } from '../types';

export function formatEventDateRange(startStr: string, endStr: string): string {
  if (!startStr) return '';
  if (startStr === endStr) {
    const d = new Date(startStr);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  const s = new Date(startStr);
  const e = new Date(endStr);
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.getDate()} - ${e.getDate()} ${s.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}`;
  }
  return `${s.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} - ${e.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

export function getCategoryLabel(category: EventCategory): string {
  switch (category) {
    case 'salons_foires':
      return 'Salons & Foires';
    case 'congres_medical':
      return 'Congrès & Médical';
    case 'concerts_spectacles':
      return 'Concerts & Spectacles';
    case 'sport':
      return 'Sport & Compétitions';
    case 'festivals':
      return 'Festivals & Culture';
    case 'mode_luxe':
      return 'Mode & Fashion Week';
    case 'corporate_sommet':
      return 'Sommets & Corporate';
    case 'culturel':
      return 'Culture & Arts';
    case 'vacances_scolaires':
      return 'Vacances Scolaires';
    case 'periodes_saisonnieres_fetes':
      return 'Périodes saisonnières et fêtes';
    default:
      return category;
  }
}

export function getRMScoreColorClasses(score: number): {
  bg: string;
  text: string;
  border: string;
  barColor: string;
  badge: string;
  label: string;
} {
  if (score >= 60) {
    // 60 à 100 : Rouge pastel (Impact fort)
    return {
      bg: 'bg-rose-50 dark:bg-rose-950/50',
      text: 'text-rose-700 dark:text-rose-300',
      border: 'border-rose-200 dark:border-rose-800/70',
      barColor: 'bg-rose-500',
      badge: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/70',
      label: score >= 85 ? 'Critique' : 'Fort',
    };
  } else if (score >= 30) {
    // 30 à 59 : Orange pastel (Impact moyen)
    return {
      bg: 'bg-amber-50 dark:bg-amber-950/50',
      text: 'text-amber-700 dark:text-amber-300',
      border: 'border-amber-200 dark:border-amber-800/70',
      barColor: 'bg-amber-500',
      badge: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/70',
      label: 'Moyen',
    };
  } else {
    // 0 à 29 : Vert pastel (Impact faible)
    return {
      bg: 'bg-emerald-50 dark:bg-emerald-950/50',
      text: 'text-emerald-700 dark:text-emerald-300',
      border: 'border-emerald-200 dark:border-emerald-800/70',
      barColor: 'bg-emerald-500',
      badge: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70',
      label: 'Faible',
    };
  }
}

export function getImpactColorClasses(impact: RMImpactLevel): {
  bg: string;
  text: string;
  border: string;
  badgeBg: string;
  dotBg: string;
  pillBg: string;
} {
  switch (impact) {
    case 'hyper':
      return {
        bg: 'bg-rose-50/80 dark:bg-rose-950/50',
        text: 'text-rose-700 dark:text-rose-300',
        border: 'border-rose-200 dark:border-rose-800/70',
        badgeBg: 'bg-rose-100/90 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200',
        dotBg: 'bg-rose-500',
        pillBg: 'bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/70',
      };
    case 'critique':
      return {
        bg: 'bg-amber-50/80 dark:bg-amber-950/50',
        text: 'text-amber-700 dark:text-amber-300',
        border: 'border-amber-200 dark:border-amber-800/70',
        badgeBg: 'bg-amber-100/90 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200',
        dotBg: 'bg-amber-500',
        pillBg: 'bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/70',
      };
    case 'modere':
      return {
        bg: 'bg-blue-50/80 dark:bg-blue-950/50',
        text: 'text-blue-700 dark:text-blue-300',
        border: 'border-blue-200 dark:border-blue-800/70',
        badgeBg: 'bg-blue-100/90 dark:bg-blue-950/80 text-blue-800 dark:text-blue-200',
        dotBg: 'bg-blue-500',
        pillBg: 'bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/70',
      };
    case 'faible':
    default:
      return {
        bg: 'bg-emerald-50/80 dark:bg-emerald-950/50',
        text: 'text-emerald-700 dark:text-emerald-300',
        border: 'border-emerald-200 dark:border-emerald-800/70',
        badgeBg: 'bg-emerald-100/90 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200',
        dotBg: 'bg-emerald-500',
        pillBg: 'bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70',
      };
  }
}

export function exportEventsToCSV(events: EventItem[], filename = 'flowtym-events-export.csv') {
  const headers = [
    'ID',
    'Titre',
    'Sous-titre',
    'Catégorie',
    'Ville',
    'Lieu',
    'Date début',
    'Date fin',
    'Affluence estimée',
    'Part internationale (%)',
    'Impact RM',
    'Score RM (0-100)',
    'Score Confiance (%)',
    'Statut',
    'Récurrent',
    'Yield Actif',
  ];

  const rows = events.map((ev) => [
    `"${ev.id}"`,
    `"${ev.title.replace(/"/g, '""')}"`,
    `"${(ev.subtitle || '').replace(/"/g, '""')}"`,
    `"${getCategoryLabel(ev.category)}"`,
    `"${ev.city}"`,
    `"${ev.venueName.replace(/"/g, '""')}"`,
    `"${ev.startDate}"`,
    `"${ev.endDate}"`,
    ev.expectedAttendance,
    ev.internationalRatioPercent,
    `"${ev.impactLevel.toUpperCase()}"`,
    ev.scoreBreakdown.finalRMScore,
    ev.scoreBreakdown.confidenceScore,
    `"${ev.status}"`,
    ev.isRecurring ? 'Oui' : 'Non',
    ev.isYieldActive ? 'Oui' : 'Non',
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Utilitaire universel de téléchargement réel de fichiers CSV (RFC 4180 avec BOM UTF-8)
 */
export function downloadGenericCsv(
  filename: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
): void {
  const escapeCell = (val: string | number | boolean | null | undefined): string => {
    if (val === undefined || val === null) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };

  const csvContent = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => row.map(escapeCell).join(',')),
  ].join('\r\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

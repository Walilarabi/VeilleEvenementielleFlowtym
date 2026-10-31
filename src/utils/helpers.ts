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
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      border: 'border-rose-200',
      barColor: 'bg-rose-500',
      badge: 'bg-rose-50 text-rose-700 border-rose-200',
      label: score >= 85 ? 'Critique' : 'Fort',
    };
  } else if (score >= 30) {
    // 30 à 59 : Orange pastel (Impact moyen)
    return {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200',
      barColor: 'bg-amber-500',
      badge: 'bg-amber-50 text-amber-700 border-amber-200',
      label: 'Moyen',
    };
  } else {
    // 0 à 29 : Vert pastel (Impact faible)
    return {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      barColor: 'bg-emerald-500',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
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
        bg: 'bg-rose-50/80',
        text: 'text-rose-700',
        border: 'border-rose-200',
        badgeBg: 'bg-rose-100/90 text-rose-800',
        dotBg: 'bg-rose-500',
        pillBg: 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200',
      };
    case 'critique':
      return {
        bg: 'bg-amber-50/80',
        text: 'text-amber-700',
        border: 'border-amber-200',
        badgeBg: 'bg-amber-100/90 text-amber-800',
        dotBg: 'bg-amber-500',
        pillBg: 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200',
      };
    case 'modere':
      return {
        bg: 'bg-blue-50/80',
        text: 'text-blue-700',
        border: 'border-blue-200',
        badgeBg: 'bg-blue-100/90 text-blue-800',
        dotBg: 'bg-blue-500',
        pillBg: 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200',
      };
    case 'faible':
    default:
      return {
        bg: 'bg-emerald-50/80',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        badgeBg: 'bg-emerald-100/90 text-emerald-800',
        dotBg: 'bg-emerald-500',
        pillBg: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200',
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

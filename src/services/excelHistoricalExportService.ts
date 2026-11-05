/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * SERVICE D'EXPORTATION EXCEL COMPLÈTE : HISTORIQUE DES PRIX & TAUX D'OCCUPATION
 * Données prêtes pour le travail hors ligne sous Microsoft Excel / LibreOffice
 */

import { getRateIntelligenceRecords, DailyRateIntelligence, calculateCompsetRanking } from './rateIntelligenceService';
import { getMarketDemandPercentage } from './rmDecisionService';

export interface HistoricalExportOptions {
  hotelName?: string;
  startDate?: string;
  endDate?: string;
  includeEvents?: boolean;
  includeCompset?: boolean;
  includeParity?: boolean;
}

export function exportCompleteHistoricalExcel({
  hotelName = 'Grand Hôtel Folkestone Opéra',
  startDate,
  endDate,
  includeEvents = true,
  includeCompset = true,
  includeParity = true,
}: HistoricalExportOptions = {}): { totalRows: number; filename: string } {
  // Fetch full records starting from base date
  const records = getRateIntelligenceRecords();

  // Filter if dates provided
  const filtered = records.filter((r) => {
    if (startDate && r.dateStr < startDate) return false;
    if (endDate && r.dateStr > endDate) return false;
    return true;
  });

  // Excel UTF-8 with semicolon columns
  const headers = [
    'Date Séjour (AAAA-MM-JJ)',
    'Jour Semaine',
    'Contexte Événementiel',
    'Catégorie Événement',
    'Score RM (0-100)',
    'Demande Marché (%)',
    'Taux d’Occupation OTB (%)',
    'Chambres Réservées (OTB)',
    'Chambres Disponibles (sur 45)',
    'Tarif BAR Actuel (€)',
    'Tarif Suggéré Moteur RM (€)',
    'Écart Recommandé (€)',
    'Écart Recommandé (%)',
    'ADR Net Réalisé (€)',
    'RevPAR Réalisé (45 ch.) (€)',
    'Moyenne Compset Lighthouse (€)',
    'Médiane Compset (€)',
    'Min Compset (€)',
    'Max Compset (€)',
    'Rang Compset (1/6)',
    'Statut Parité Tarifaire',
    'Stratégie RM Recommandée',
    'Lead Time Achat',
    'Statut Décision RM',
  ];

  const rows = filtered.map((r) => {
    // Determine parity status for this date
    let parityStatus = 'Conforme (Parité Respectée)';
    if (r.dateStr === '2026-10-18') parityStatus = 'Rupture Agoda (-57€ / Fuite grossiste)';
    else if (r.dateStr === '2026-11-14') parityStatus = 'Rupture Booking.com (-37€ / Tarif Mobile non consenti)';
    else if (r.dateStr === '2026-11-20') parityStatus = 'Rupture Trip.com (-22€ / Affichage hors taxe)';
    else if (r.dateStr === '2026-12-31') parityStatus = 'Rupture Expedia (-55€ / Packaging cassé)';

    const roomsSold = Math.round((45 * r.occupancyPercent) / 100);
    const ranking = calculateCompsetRanking(r, hotelName);
    const demandPct = getMarketDemandPercentage(r.demandLevel);

    return [
      r.dateStr,
      r.dayOfWeek,
      `"${(r.eventTitle || 'Sans événement majeur').replace(/"/g, '""')}"`,
      `"${r.eventCategory || 'standard'}"`,
      r.rmScore || 50,
      `${demandPct}%`,
      `${r.occupancyPercent}%`,
      roomsSold,
      r.remainingRooms,
      r.currentBarEur,
      r.suggestedBarEur,
      r.deltaVsCurrentEur >= 0 ? `+${r.deltaVsCurrentEur}` : `${r.deltaVsCurrentEur}`,
      r.deltaVsCurrentPercent >= 0 ? `+${r.deltaVsCurrentPercent}%` : `${r.deltaVsCurrentPercent}%`,
      r.dedgeReservations.adrNetEur,
      r.dedgeReservations.revparEur,
      r.lighthouse.compsetAvgEur,
      r.lighthouse.compsetMedianEur,
      r.lighthouse.compsetMinEur,
      r.lighthouse.compsetMaxEur,
      `"${ranking.rankingFraction}"`,
      `"${parityStatus}"`,
      `"${r.rmRecommendation.strategyLabel}"`,
      `"${r.dedgeReservations.leadTimeMajorityBucket}"`,
      r.status === 'applied' ? 'Validé / Appliqué' : r.status === 'modified' ? 'Modifié par RM' : r.status === 'rejected' ? 'Refusé' : 'À valider',
    ];
  });

  const csvContent = [headers.join(';'), ...rows.map((row) => row.join(';'))].join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  const nowStr = new Date().toISOString().split('T')[0];
  const filename = `Flowtym_Historique_Complet_Prix_et_Occupation_${hotelName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${nowStr}.csv`;

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return {
    totalRows: filtered.length,
    filename,
  };
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * SERVICE DE RAPPORT MENSUEL DE GESTION & RÉUNIONS PROPRIÉTAIRES
 * Grand Hôtel Folkestone Opéra (45 chambres) — Flowtym Event Intelligence
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Hotel } from '../types';

export interface MonthlyOwnerKPIs {
  monthName: string;
  year: number;
  hotelName: string;
  totalRooms: number;
  totalRoomNightsAvailable: number; // 45 * days
  roomNightsSold: number;
  occupancyRate: number; // %
  occupancyRateN1: number; // %
  occupancyDeltaPct: number;
  
  roomRevenueEur: number;
  roomRevenueN1Eur: number;
  roomRevenueDeltaEur: number;
  roomRevenueDeltaPct: number;
  
  adrEur: number;
  adrN1Eur: number;
  adrDeltaEur: number;
  adrDeltaPct: number;
  
  revparEur: number;
  revparN1Eur: number;
  revparDeltaEur: number;
  revparDeltaPct: number;
  
  // Market Fair Share Indices (Compset)
  mpi: number; // Market Penetration Index (> 100 is outperforming)
  ari: number; // Average Rate Index
  rgi: number; // Revenue Generation Index (Fair Share)
  compsetRank: string; // e.g. "2 / 6"
  
  // Channels Mix
  channels: {
    name: string;
    sharePercent: number;
    roomNights: number;
    revenueEur: number;
    adrEur: number;
    commissionPercent: number;
    commissionEur: number;
    netAdrEur: number;
  }[];
  
  // Room Type Performance
  roomTypes: {
    name: string;
    roomCount: number;
    occupancyPercent: number;
    adrEur: number;
    revenueEur: number;
  }[];
  
  // RM Optimization Gain
  rmOptimizedGainEur: number;
  rmEventsDetectedCount: number;
  topPerformingDates: {
    dateStr: string;
    dayOfWeek: string;
    eventName: string;
    occupancyPercent: number;
    appliedBarEur: number;
    gainVsN1Eur: number;
  }[];
  
  executiveSummary: string;
  strategicRecommendations: string[];
}

export function getMonthlyOwnerData(year = 2026, month = 10): MonthlyOwnerKPIs {
  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
  const daysInMonth = new Date(year, month, 0).getDate();
  const totalRooms = 45;
  const totalRoomNightsAvailable = totalRooms * daysInMonth;

  // Realistically calibrated performance for Grand Hôtel Folkestone Opéra (Octobre 2026 - Haute compression événements)
  const isOctober = month === 10;
  const occupancyRate = isOctober ? 88.4 : 82.6;
  const occupancyRateN1 = isOctober ? 79.8 : 76.2;
  const roomNightsSold = Math.round((totalRoomNightsAvailable * occupancyRate) / 100);
  
  const adrEur = isOctober ? 312.5 : 268.0;
  const adrN1Eur = isOctober ? 264.2 : 238.5;
  const roomRevenueEur = Math.round(roomNightsSold * adrEur);
  const roomRevenueN1Eur = Math.round((totalRoomNightsAvailable * (occupancyRateN1 / 100)) * adrN1Eur);
  
  const revparEur = Math.round((roomRevenueEur / totalRoomNightsAvailable) * 10) / 10;
  const revparN1Eur = Math.round((roomRevenueN1Eur / totalRoomNightsAvailable) * 10) / 10;
  const revparDeltaEur = Math.round((revparEur - revparN1Eur) * 10) / 10;
  const revparDeltaPct = Math.round(((revparEur - revparN1Eur) / revparN1Eur) * 1000) / 10;

  return {
    monthName: monthNames[month - 1] || 'Octobre',
    year,
    hotelName: 'Grand Hôtel Folkestone Opéra (4★)',
    totalRooms,
    totalRoomNightsAvailable,
    roomNightsSold,
    occupancyRate,
    occupancyRateN1,
    occupancyDeltaPct: Math.round((occupancyRate - occupancyRateN1) * 10) / 10,
    
    roomRevenueEur,
    roomRevenueN1Eur,
    roomRevenueDeltaEur: roomRevenueEur - roomRevenueN1Eur,
    roomRevenueDeltaPct: Math.round(((roomRevenueEur - roomRevenueN1Eur) / roomRevenueN1Eur) * 1000) / 10,
    
    adrEur,
    adrN1Eur,
    adrDeltaEur: Math.round((adrEur - adrN1Eur) * 10) / 10,
    adrDeltaPct: Math.round(((adrEur - adrN1Eur) / adrN1Eur) * 1000) / 10,
    
    revparEur,
    revparN1Eur,
    revparDeltaEur,
    revparDeltaPct,
    
    mpi: 108.6, // +8.6% par rapport à la part de marché naturelle
    ari: 112.4, // +12.4% de prix moyen vs compset moyen
    rgi: 122.1, // RGI exceptionnel de 122.1 (sur-performance RevPAR de +22.1%)
    compsetRank: '2 / 6 (Surperformance Compset)',
    
    channels: [
      {
        name: 'Direct (Site Web & Téléphone)',
        sharePercent: 43.5,
        roomNights: Math.round(roomNightsSold * 0.435),
        revenueEur: Math.round(roomRevenueEur * 0.452),
        adrEur: 324.8,
        commissionPercent: 0,
        commissionEur: 0,
        netAdrEur: 324.8,
      },
      {
        name: 'Booking.com',
        sharePercent: 31.8,
        roomNights: Math.round(roomNightsSold * 0.318),
        revenueEur: Math.round(roomRevenueEur * 0.312),
        adrEur: 306.4,
        commissionPercent: 17.5,
        commissionEur: Math.round(roomRevenueEur * 0.312 * 0.175),
        netAdrEur: 252.8,
      },
      {
        name: 'Expedia Group',
        sharePercent: 13.2,
        roomNights: Math.round(roomNightsSold * 0.132),
        revenueEur: Math.round(roomRevenueEur * 0.128),
        adrEur: 302.0,
        commissionPercent: 18.0,
        commissionEur: Math.round(roomRevenueEur * 0.128 * 0.18),
        netAdrEur: 247.6,
      },
      {
        name: 'Corporate & Négocié',
        sharePercent: 7.5,
        roomNights: Math.round(roomNightsSold * 0.075),
        revenueEur: Math.round(roomRevenueEur * 0.072),
        adrEur: 300.0,
        commissionPercent: 5.0,
        commissionEur: Math.round(roomRevenueEur * 0.072 * 0.05),
        netAdrEur: 285.0,
      },
      {
        name: 'GDS & Agences Sélect',
        sharePercent: 4.0,
        roomNights: Math.round(roomNightsSold * 0.04),
        revenueEur: Math.round(roomRevenueEur * 0.036),
        adrEur: 282.0,
        commissionPercent: 10.0,
        commissionEur: Math.round(roomRevenueEur * 0.036 * 0.10),
        netAdrEur: 253.8,
      },
    ],
    
    roomTypes: [
      { name: 'Classique Double', roomCount: 20, occupancyPercent: 91.2, adrEur: 285, revenueEur: Math.round(roomRevenueEur * 0.40) },
      { name: 'Supérieure Exécutive', roomCount: 15, occupancyPercent: 88.0, adrEur: 325, revenueEur: Math.round(roomRevenueEur * 0.36) },
      { name: 'Deluxe Opéra', roomCount: 6, occupancyPercent: 82.5, adrEur: 380, revenueEur: Math.round(roomRevenueEur * 0.16) },
      { name: 'Suite Famille & Quadruple', roomCount: 4, occupancyPercent: 80.0, adrEur: 440, revenueEur: Math.round(roomRevenueEur * 0.08) },
    ],
    
    rmOptimizedGainEur: 38450,
    rmEventsDetectedCount: 7,
    topPerformingDates: [
      { dateStr: `${year}-${String(month).padStart(2, '0')}-18`, dayOfWeek: 'Dimanche', eventName: 'SIAL Paris 2026 (Ouverture)', occupancyPercent: 97.8, appliedBarEur: 395, gainVsN1Eur: 4850 },
      { dateStr: `${year}-${String(month).padStart(2, '0')}-19`, dayOfWeek: 'Lundi', eventName: 'SIAL Paris 2026 (Jour 2 - Pic B2B)', occupancyPercent: 100.0, appliedBarEur: 420, gainVsN1Eur: 5620 },
      { dateStr: `${year}-${String(month).padStart(2, '0')}-14`, dayOfWeek: 'Mercredi', eventName: 'Mondial de l’Automobile 2026', occupancyPercent: 95.6, appliedBarEur: 365, gainVsN1Eur: 4100 },
      { dateStr: `${year}-${String(month).padStart(2, '0')}-20`, dayOfWeek: 'Mardi', eventName: 'SIAL Paris & Sommet Agro', occupancyPercent: 97.8, appliedBarEur: 410, gainVsN1Eur: 5200 },
      { dateStr: `${year}-${String(month).padStart(2, '0')}-27`, dayOfWeek: 'Mardi', eventName: 'Congrès Médical Européen', occupancyPercent: 93.3, appliedBarEur: 345, gainVsN1Eur: 3600 },
    ],
    
    executiveSummary: `Mois d’une excellente tenue commerciale marqué par un RevPAR de ${revparEur}€ (+${revparDeltaPct}% vs N-1), soutenu par une stratégie tarifaire agressive sur les dates de forte compression événementielle (SIAL Paris et Mondial de l’Auto). L’indice de génération de revenu (RGI) s’établit à 122.1, confirmant que l’hôtel capte 22.1% de part de chiffre d’affaires en plus que sa capacité naturelle au sein du compset Opéra.`,
    strategicRecommendations: [
      'Poursuivre la montée en gamme tarifaire sur le direct (43.5% du mix) afin de réduire les coûts de commissions OTA (31.8k€ économisés).',
      'Verrouiller un séjour minimum de 3 nuits sur les 4 Suites Familles lors des vacances scolaires multi-zones pour maximiser l’ADR.',
      'Maintenir la surveillance de parité stricte sur Agoda et Trip.com pour stopper les fuites grossistes avant le réveillon.',
      'Capitaliser sur le RGI de 122.1 pour négocier des conditions corporate rehaussées de +12% pour l’exercice N+1.'
    ]
  };
}

export function exportMonthlyOwnerReportToPDF(kpis: MonthlyOwnerKPIs): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // 1. Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Accent Line
  doc.setFillColor(124, 58, 237); // violet-600
  doc.rect(0, 26, pageWidth, 2, 'F');

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text('FLOWTYM', 14, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(196, 181, 253);
  doc.text('|  RAPPORT MENSUEL DE GESTION & PERFORMANCE HÔTELIÈRE', 46, 13);

  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`${kpis.hotelName} — Bilan de Gestion pour Réunion Propriétaires · ${kpis.monthName} ${kpis.year}`, 14, 21);

  // Date of export
  doc.setFontSize(8);
  doc.text(`Document confidentiel généré le ${new Date().toLocaleDateString('fr-FR')}`, pageWidth - 14, 21, { align: 'right' });

  let currentY = 36;

  // 2. Executive Summary Block
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, currentY, pageWidth - 28, 24, 3, 3, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, currentY, pageWidth - 28, 24, 3, 3, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Synthèse Exécutive du Conseil d\'Administration', 18, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  const splitSummary = doc.splitTextToSize(kpis.executiveSummary, pageWidth - 36);
  doc.text(splitSummary, 18, currentY + 12);

  currentY += 30;

  // 3. Financial KPI Table (autoTable)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Indicateurs Clés d\'Exploitation & Chiffre d\'Affaires (45 Chambres)', 14, currentY);
  currentY += 3;

  autoTable(doc, {
    startY: currentY,
    head: [['Indicateur de Gestion', `Réalisé ${kpis.monthName} ${kpis.year}`, `Historique N-1`, 'Écart (€ / pts)', 'Variation (%)']],
    body: [
      ['Chiffre d’Affaires Hébergement Net', `${kpis.roomRevenueEur.toLocaleString('fr-FR')} €`, `${kpis.roomRevenueN1Eur.toLocaleString('fr-FR')} €`, `+${kpis.roomRevenueDeltaEur.toLocaleString('fr-FR')} €`, `+${kpis.roomRevenueDeltaPct}%`],
      ['Prix Moyen Chambre (ADR Net)', `${kpis.adrEur.toFixed(1)} €`, `${kpis.adrN1Eur.toFixed(1)} €`, `+${kpis.adrDeltaEur} €`, `+${kpis.adrDeltaPct}%`],
      ['Taux d’Occupation Moyen (TO)', `${kpis.occupancyRate.toFixed(1)} %`, `${kpis.occupancyRateN1.toFixed(1)} %`, `+${kpis.occupancyDeltaPct} pts`, `+${((kpis.occupancyDeltaPct / kpis.occupancyRateN1) * 100).toFixed(1)}%`],
      ['Revenu par Chambre Disponible (RevPAR)', `${kpis.revparEur.toFixed(1)} €`, `${kpis.revparN1Eur.toFixed(1)} €`, `+${kpis.revparDeltaEur} €`, `+${kpis.revparDeltaPct}%`],
      ['Nuitées Chambres Vendues (RN)', `${kpis.roomNightsSold} RN`, `${Math.round(kpis.totalRoomNightsAvailable * (kpis.occupancyRateN1 / 100))} RN`, `+${kpis.roomNightsSold - Math.round(kpis.totalRoomNightsAvailable * (kpis.occupancyRateN1 / 100))} RN`, `+${kpis.occupancyDeltaPct}%`],
      ['Gain Net Généré par le Revenue Management', `${kpis.rmOptimizedGainEur.toLocaleString('fr-FR')} €`, '—', `+${kpis.rmOptimizedGainEur.toLocaleString('fr-FR')} €`, 'Surperformance Flowtym'],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { fontStyle: 'bold', halign: 'left' },
      1: { halign: 'right', fontStyle: 'bold' },
      2: { halign: 'right' },
      3: { halign: 'right', fontStyle: 'bold', textColor: [16, 185, 129] },
      4: { halign: 'right', fontStyle: 'bold', textColor: [16, 185, 129] },
    },
  });

  currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // 4. Market Penetration & Fair Share (MPI / ARI / RGI)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('2. Positionnement Concurrentiel & Indices Marché Compset', 14, currentY);
  currentY += 3;

  autoTable(doc, {
    startY: currentY,
    head: [['Indice Stratégique', 'Score Flowtym', 'Base Neutre', 'Interprétation Commerciale']],
    body: [
      ['RGI (Revenue Generation Index)', `${kpis.rgi.toFixed(1)}`, '100.0', 'Surperformance de +22.1% en RevPAR vs le Compset direct (Position 2/6)'],
      ['ARI (Average Rate Index)', `${kpis.ari.toFixed(1)}`, '100.0', 'Tarif moyen supérieur de +12.4% à la moyenne du panier concurrentiel'],
      ['MPI (Market Penetration Index)', `${kpis.mpi.toFixed(1)}`, '100.0', 'Pénétration volumique supérieure de +8.6% à la capacité théorique'],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [109, 40, 217],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
    },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'center', fontStyle: 'bold', textColor: [109, 40, 217] },
      2: { halign: 'center' },
    },
  });

  currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // 5. Channel Distribution Mix Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('3. Mix de Distribution, ADR Net & Coûts d\'Intermédiation', 14, currentY);
  currentY += 3;

  const channelRows = kpis.channels.map((c) => [
    c.name,
    `${c.sharePercent.toFixed(1)} %`,
    `${c.roomNights} RN`,
    `${c.revenueEur.toLocaleString('fr-FR')} €`,
    `${c.adrEur.toFixed(1)} €`,
    c.commissionPercent > 0 ? `${c.commissionPercent}% (${c.commissionEur.toLocaleString('fr-FR')} €)` : '0 € (Direct)',
    `${c.netAdrEur.toFixed(1)} €`,
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Canal de Vente', 'Part Mix', 'Volume', 'CA Brut', 'ADR Brut', 'Commissions Payées', 'ADR Net Réel']],
    body: channelRows,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
    },
    bodyStyles: { fontSize: 7.5 },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'center' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right', textColor: [225, 29, 72] },
      6: { halign: 'right', fontStyle: 'bold', textColor: [16, 185, 129] },
    },
  });

  currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // Check if page break is needed
  if (currentY > pageHeight - 55) {
    doc.addPage();
    currentY = 20;
  }

  // 6. Strategic Recommendations Block
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, currentY, pageWidth - 28, 38, 3, 3, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, currentY, pageWidth - 28, 38, 3, 3, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Recommandations Stratégiques pour les Propriétaires & Conseil de Gestion', 18, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);

  let recY = currentY + 12;
  kpis.strategicRecommendations.forEach((rec, i) => {
    doc.text(`• ${rec}`, 18, recY);
    recY += 6;
  });

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${i} sur ${totalPages} — Grand Hôtel Folkestone Opéra · Rapport Propriétaires`, 14, pageHeight - 8);
    doc.text('FLOWTYM REVENUE MANAGEMENT ENGINE — Tous droits réservés', pageWidth - 14, pageHeight - 8, { align: 'right' });
  }

  // Save PDF
  doc.save(`Rapport_Gestion_Proprietaires_${kpis.hotelName.replace(/[^a-zA-Z0-9]/g, '_')}_${kpis.monthName}_${kpis.year}.pdf`);
}

export function exportMonthlyOwnerReportToExcel(kpis: MonthlyOwnerKPIs): void {
  const lines: string[] = [];

  lines.push(`RAPPORT MENSUEL DE GESTION & PERFORMANCE PROPRIÉTAIRES;${kpis.hotelName}`);
  lines.push(`PÉRIODE CONCERNÉE;${kpis.monthName} ${kpis.year}`);
  lines.push(`CAPACITÉ HÔTELIÈRE;${kpis.totalRooms} chambres (${kpis.totalRoomNightsAvailable} nuitées disponibles)`);
  lines.push(`DATE D'EXTRACTION;${new Date().toLocaleDateString('fr-FR')}`);
  lines.push('');

  // 1. Synthèse Financière
  lines.push('1. SYNTHÈSE DE GESTION FINANCIÈRE & EXPLOITATION');
  lines.push('Indicateur;Réalisé Mois;Historique N-1;Écart Valeur;Variation %');
  lines.push(`Chiffre d'Affaires Hébergement (€);${kpis.roomRevenueEur};${kpis.roomRevenueN1Eur};${kpis.roomRevenueDeltaEur};+${kpis.roomRevenueDeltaPct}%`);
  lines.push(`Prix Moyen Chambre - ADR (€);${kpis.adrEur};${kpis.adrN1Eur};${kpis.adrDeltaEur};+${kpis.adrDeltaPct}%`);
  lines.push(`Taux d'Occupation - TO (%);${kpis.occupancyRate}%;${kpis.occupancyRateN1}%;+${kpis.occupancyDeltaPct} pts;+${kpis.occupancyDeltaPct}%`);
  lines.push(`Revenu par Chambre Disponible - RevPAR (€);${kpis.revparEur};${kpis.revparN1Eur};${kpis.revparDeltaEur};+${kpis.revparDeltaPct}%`);
  lines.push(`Nuitées Vendues (Room Nights);${kpis.roomNightsSold};${Math.round(kpis.totalRoomNightsAvailable * (kpis.occupancyRateN1 / 100))};${kpis.roomNightsSold - Math.round(kpis.totalRoomNightsAvailable * (kpis.occupancyRateN1 / 100))};+${kpis.occupancyDeltaPct}%`);
  lines.push(`Gain Net Optimisation RM Flowtym (€);${kpis.rmOptimizedGainEur};0;+${kpis.rmOptimizedGainEur};Surperformance`);
  lines.push('');

  // 2. Indices Fair Share
  lines.push('2. INDICES DE MARCHÉ COMPSET (FAIR SHARE)');
  lines.push('Indice;Valeur;Base 100;Interprétation');
  lines.push(`RGI - Revenue Generation Index;${kpis.rgi};100;Surperformance RevPAR de +22.1%`);
  lines.push(`ARI - Average Rate Index;${kpis.ari};100;Prix moyen supérieur de +12.4% vs Compset`);
  lines.push(`MPI - Market Penetration Index;${kpis.mpi};100;Part de marché en occupation +8.6%`);
  lines.push('');

  // 3. Canaux de distribution
  lines.push('3. DÉCOMPOSITION PAR CANAL DE DISTRIBUTION');
  lines.push('Canal de Vente;Part Mix (%);Nuitées (RN);CA Brut (€);ADR Brut (€);Taux Commission (%);Montant Commissions (€);ADR Net Réel (€)');
  kpis.channels.forEach((c) => {
    lines.push(`${c.name};${c.sharePercent}%;${c.roomNights};${c.revenueEur};${c.adrEur};${c.commissionPercent}%;${c.commissionEur};${c.netAdrEur}`);
  });
  lines.push('');

  // 4. Typologies de chambres
  lines.push('4. PERFORMANCE PAR TYPOLOGIE DE CHAMBRE');
  lines.push('Catégorie de Chambre;Nombre Chambres;Taux d\'Occupation (%);ADR Moyen Net (€);CA Généré (€)');
  kpis.roomTypes.forEach((rt) => {
    lines.push(`${rt.name};${rt.roomCount};${rt.occupancyPercent}%;${rt.adrEur};${rt.revenueEur}`);
  });
  lines.push('');

  // 5. Recommandations stratégiques
  lines.push('5. RECOMMANDATIONS STRATÉGIQUES POUR LES PROPRIÉTAIRES');
  kpis.strategicRecommendations.forEach((rec, idx) => {
    lines.push(`Recommandation ${idx + 1};"${rec.replace(/"/g, '""')}"`);
  });

  const csvContent = lines.join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Rapport_Gestion_Proprietaires_${kpis.hotelName.replace(/[^a-zA-Z0-9]/g, '_')}_${kpis.monthName}_${kpis.year}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

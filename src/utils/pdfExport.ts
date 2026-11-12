/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EventItem, FilterState, Hotel } from '../types';
import { getCategoryLabel } from './helpers';
import {
  SYSTEM_REFERENCE_DATE,
  sortEventsChronologically,
  getEventStatusBadgeConfig,
  getMonthTemporalRelation,
} from '../services/eventChronologyService';

export interface PDFExportOptions {
  events: EventItem[];
  hotel?: Hotel;
  viewMode?: 'calendar' | 'table';
  filterState?: FilterState;
  filename?: string;
  referenceDate?: string;
}

export function exportEventsToPDF({
  events,
  hotel,
  viewMode = 'table',
  filterState,
  filename,
  referenceDate = SYSTEM_REFERENCE_DATE,
}: PDFExportOptions): void {
  // Landscape orientation for comprehensive data table visibility
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const now = new Date();
  const formattedDate = now.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const formattedTime = now.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Selected period description
  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
  const selectedYear = filterState?.currentYear ?? 2026;
  const selectedMonth = filterState?.currentMonth ?? 10;
  const monthLabel = `${monthNames[selectedMonth]} ${selectedYear}`;
  const temporalRelation = getMonthTemporalRelation(selectedYear, selectedMonth, referenceDate);
  const periodTypeLabel =
    temporalRelation === 'current'
      ? `${monthLabel} — Événements en cours & à venir (Réf : ${referenceDate.split('-').reverse().join('/')})`
      : temporalRelation === 'past'
      ? `${monthLabel} — Historique mensuel consolidé`
      : `${monthLabel} — Prévisions événementielles futures`;

  // 3. Strict chronological sorting matching screen view:
  // Priority 1: Ongoing events (at reference date)
  // Priority 2: Upcoming events strictly ascending by start date (closest first)
  // Priority 3: Past events (if in a past month)
  const isPastMonth = temporalRelation === 'past';
  const sortedEvents = sortEventsChronologically(events, referenceDate, isPastMonth);

  // Calculate KPIs on strictly sorted events
  const totalEvents = sortedEvents.length;
  const ongoingCount = sortedEvents.filter((e) => {
    const end = e.endDate || e.startDate;
    return e.startDate <= referenceDate && end >= referenceDate;
  }).length;
  const upcomingCount = sortedEvents.filter((e) => e.startDate > referenceDate).length;
  const criticalEvents = sortedEvents.filter((e) => e.scoreBreakdown.finalRMScore >= 60 || e.impactLevel === 'hyper' || e.impactLevel === 'critique').length;
  const avgScore = totalEvents > 0 
    ? Math.round(sortedEvents.reduce((acc, e) => acc + e.scoreBreakdown.finalRMScore, 0) / totalEvents) 
    : 0;
  const totalAttendance = sortedEvents.reduce((acc, e) => acc + (e.expectedAttendance || 0), 0);

  // 1. Header Banner (Navy / Violet gradient style)
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 26, 'F');

  // Accent bar
  doc.setFillColor(124, 58, 237); // violet-600
  doc.rect(0, 24, pageWidth, 2, 'F');

  // Brand title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('FLOWTYM', 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(196, 181, 253); // violet-300
  doc.text('|  EVENT INTELLIGENCE & REVENUE MANAGEMENT', 47, 12);

  // Subtitle / Document Type & Period
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(`Rapport analytique — ${periodTypeLabel}`, 14, 19);

  // Right-aligned Generation info
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(`Édité le ${formattedDate} à ${formattedTime}`, pageWidth - 14, 12, { align: 'right' });
  doc.setTextColor(148, 163, 184);
  doc.text(`Établissement : ${hotel ? hotel.name : 'Tous les établissements'}`, pageWidth - 14, 19, { align: 'right' });

  // 2. Executive Context & KPI Summary Box
  const summaryY = 32;
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(14, summaryY, pageWidth - 28, 22, 2, 2, 'FD');

  // KPI 1: Total Events & Ongoing/Upcoming Breakdown
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(String(totalEvents), 24, summaryY + 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  const statusSummaryText =
    temporalRelation === 'current'
      ? `${ongoingCount} EN COURS · ${upcomingCount} À VENIR`
      : temporalRelation === 'past'
      ? 'HISTORIQUE CLÔTURÉ'
      : `${upcomingCount} À VENIR`;
  doc.text(statusSummaryText, 24, summaryY + 17);

  // Divider
  doc.setDrawColor(203, 213, 225);
  doc.line(78, summaryY + 4, 78, summaryY + 18);

  // KPI 2: Critical RM Impact
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(225, 29, 72); // rose-600
  doc.text(`${criticalEvents} (${totalEvents > 0 ? Math.round((criticalEvents / totalEvents) * 100) : 0}%)`, 86, summaryY + 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('IMPACT CRITIQUE & FORT (≥ 60)', 86, summaryY + 17);

  // Divider
  doc.line(144, summaryY + 4, 144, summaryY + 18);

  // KPI 3: Average RM Score
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(124, 58, 237); // violet-600
  doc.text(`${avgScore}/100`, 152, summaryY + 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('SCORE RM MOYEN', 152, summaryY + 17);

  // Divider
  doc.line(202, summaryY + 4, 202, summaryY + 18);

  // KPI 4: Recurrences & Cumulated Attendance
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(`${Math.round(totalAttendance / 1000)}k pax`, 210, summaryY + 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('AFFLUENCE ESTIMÉE CUMULÉE', 210, summaryY + 17);

  // Helper for pure ASCII thousands grouping
  const formatNumber = (num?: number) => {
    if (num === undefined || num === null) return 'NC';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  // Helper for clean, compact dates: DD/MM/YY
  const formatCompactDate = (d: string) => {
    if (!d) return '';
    const parts = d.split('-');
    if (parts.length < 3) return d;
    const yy = parts[0].slice(-2);
    return `${parts[2]}/${parts[1]}/${yy}`;
  };

  // Table of Events
  const tableData = sortedEvents.map((ev) => {
    const score = ev.scoreBreakdown.finalRMScore;
    const impactLabel = 
      score >= 85 || ev.impactLevel === 'hyper'
        ? 'Critique'
        : score >= 60 || ev.impactLevel === 'critique'
        ? 'Fort'
        : score >= 30 || ev.impactLevel === 'modere'
        ? 'Moyen'
        : 'Faible';

    const yieldRec =
      score >= 85
        ? 'Fermeture tarifs réduits - Min 3 nuits'
        : score >= 60
        ? 'Yield actif - +20% à +40% ADR'
        : score >= 30
        ? 'Surveillance pickup - Alignement BAR'
        : 'Ouvert sans restriction';

    const dateText =
      ev.startDate === ev.endDate
        ? formatCompactDate(ev.startDate)
        : `${formatCompactDate(ev.startDate)} - ${formatCompactDate(ev.endDate)}`;

    const attendanceText = ev.expectedAttendance
      ? `${formatNumber(ev.expectedAttendance)} (${ev.internationalRatioPercent}% int.)`
      : 'NC';

    const statusBadge = getEventStatusBadgeConfig(ev, referenceDate);
    const statusText = statusBadge.label; // "En cours" | "À venir" | "Terminé"

    return [
      ev.title,
      statusText,
      getCategoryLabel(ev.category),
      dateText,
      `${ev.venueName} (${ev.city})`,
      attendanceText,
      impactLabel,
      `${score} / 100`,
      yieldRec,
    ];
  });

  autoTable(doc, {
    startY: 58,
    head: [[
      'ÉVÉNEMENT',
      'STATUT',
      'TYPE',
      'DATES',
      'LIEU & VILLE',
      'AFFLUENCE ESTIMÉE',
      'IMPACT RM',
      'SCORE RM',
      'STRATÉGIE TARIFAIRE RECOMMANDÉE',
    ]],
    body: tableData,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 2.2,
      textColor: [15, 23, 42],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [241, 245, 249], // slate-100
      textColor: [51, 65, 85], // slate-700
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'left',
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: 44, fontStyle: 'bold' }, // Title
      1: { cellWidth: 20, halign: 'center' }, // Statut
      2: { cellWidth: 22 }, // Type
      3: { cellWidth: 30, halign: 'center' }, // Dates
      4: { cellWidth: 38 }, // Location
      5: { cellWidth: 30, halign: 'center' }, // Attendance
      6: { cellWidth: 20, halign: 'center' }, // Impact
      7: { cellWidth: 20, halign: 'center', fontStyle: 'bold' }, // Score
      8: { cellWidth: 45 }, // Yield recommendation
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
    didParseCell: (data) => {
      // Colorize Status column (column 1)
      if (data.section === 'body' && data.column.index === 1) {
        const rawRow = data.row.raw as any;
        const statusVal = Array.isArray(rawRow) ? String(rawRow[1]) : '';
        if (statusVal === 'En cours') {
          data.cell.styles.textColor = [5, 150, 105]; // emerald-600
          data.cell.styles.fillColor = [236, 253, 245]; // emerald-50
          data.cell.styles.fontStyle = 'bold';
        } else if (statusVal === 'À venir') {
          data.cell.styles.textColor = [124, 58, 237]; // violet-600
          data.cell.styles.fillColor = [245, 243, 255]; // violet-50
        } else {
          data.cell.styles.textColor = [100, 116, 139]; // slate-500
          data.cell.styles.fillColor = [241, 245, 249]; // slate-100
        }
      }

      // Colorize Impact and Score RM cells based on values
      if (data.section === 'body') {
        if (data.column.index === 6 || data.column.index === 7) {
          const rawRow = data.row.raw as any;
          const scoreStr = Array.isArray(rawRow) ? String(rawRow[7]) : '';
          const rawScore = parseInt(scoreStr.split('/')[0].trim(), 10) || 0;
          if (rawScore >= 85) {
            data.cell.styles.textColor = [225, 29, 72]; // rose-600
            data.cell.styles.fillColor = [255, 241, 242]; // rose-50
          } else if (rawScore >= 60) {
            data.cell.styles.textColor = [217, 119, 6]; // amber-600
            data.cell.styles.fillColor = [254, 243, 199]; // amber-50
          } else if (rawScore >= 30) {
            data.cell.styles.textColor = [180, 83, 9]; // amber-700
            data.cell.styles.fillColor = [255, 251, 235]; // amber-50/60
          } else {
            data.cell.styles.textColor = [5, 150, 105]; // emerald-600
            data.cell.styles.fillColor = [236, 253, 245]; // emerald-50
          }
        }
      }
    },
    margin: { left: 14, right: 14, bottom: 18 },
    didDrawPage: (data) => {
      // Footer on every page
      const currentPage = data.pageNumber;
      const totalPages = (doc.internal as any).getNumberOfPages 
        ? (doc.internal as any).getNumberOfPages() 
        : currentPage;

      doc.setDrawColor(226, 232, 240);
      doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text('Flowtym Event Intelligence — Document confidentiel de Revenue Management & Yield', 14, pageHeight - 7);
      doc.text(
        `Page ${currentPage} sur ${totalPages}`,
        pageWidth - 14,
        pageHeight - 7,
        { align: 'right' }
      );
    },
  });

  // Calculate actual total pages and update footers if necessary
  const pageCount = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    // Erase prior page text area and redraw accurate page number
    doc.setFillColor(255, 255, 255);
    doc.rect(pageWidth - 36, pageHeight - 10, 24, 5, 'F');
    doc.text(`Page ${i} / ${pageCount}`, pageWidth - 14, pageHeight - 7, { align: 'right' });
  }

  // Generate clean downloadable file
  const defaultFilename = `flowtym-rapport-evenements-${now.toISOString().slice(0, 10)}.pdf`;
  doc.save(filename || defaultFilename);
}

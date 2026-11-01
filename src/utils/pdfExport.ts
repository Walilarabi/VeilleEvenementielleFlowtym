/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EventItem, FilterState, Hotel } from '../types';
import { getCategoryLabel } from './helpers';

export interface PDFExportOptions {
  events: EventItem[];
  hotel?: Hotel;
  viewMode?: 'calendar' | 'table';
  filterState?: FilterState;
  filename?: string;
}

export function exportEventsToPDF({
  events,
  hotel,
  viewMode = 'table',
  filterState,
  filename,
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

  // Calculate KPIs
  const totalEvents = events.length;
  const criticalEvents = events.filter((e) => e.scoreBreakdown.finalRMScore >= 60 || e.impactLevel === 'hyper' || e.impactLevel === 'critique').length;
  const recurringEvents = events.filter((e) => e.isRecurring).length;
  const avgScore = totalEvents > 0 
    ? Math.round(events.reduce((acc, e) => acc + e.scoreBreakdown.finalRMScore, 0) / totalEvents) 
    : 0;
  const totalAttendance = events.reduce((acc, e) => acc + (e.expectedAttendance || 0), 0);

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

  // Subtitle / Document Type
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(`Rapport analytique des événements — ${viewMode === 'calendar' ? 'Vue Calendrier Mensuel' : 'Vue Tableau Détaillé'}`, 14, 19);

  // Right-aligned Generation info
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(`Édité le ${formattedDate} à ${formattedTime}`, pageWidth - 14, 12, { align: 'right' });
  doc.setTextColor(148, 163, 184);
  doc.text(`Périmètre : ${hotel ? hotel.name : 'Tous les établissements'}`, pageWidth - 14, 19, { align: 'right' });

  // 2. Executive Context & KPI Summary Box
  const summaryY = 32;
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(14, summaryY, pageWidth - 28, 22, 2, 2, 'FD');

  // KPI 1: Total Events
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(String(totalEvents), 24, summaryY + 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('ÉVÉNEMENTS FILTRÉS', 24, summaryY + 17);

  // Divider
  doc.setDrawColor(203, 213, 225);
  doc.line(72, summaryY + 4, 72, summaryY + 18);

  // KPI 2: Critical RM Impact
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(225, 29, 72); // rose-600
  doc.text(`${criticalEvents} (${totalEvents > 0 ? Math.round((criticalEvents / totalEvents) * 100) : 0}%)`, 80, summaryY + 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('IMPACT CRITIQUE & FORT (≥ 60)', 80, summaryY + 17);

  // Divider
  doc.line(138, summaryY + 4, 138, summaryY + 18);

  // KPI 3: Average RM Score
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(124, 58, 237); // violet-600
  doc.text(`${avgScore}/100`, 146, summaryY + 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('SCORE RM MOYEN', 146, summaryY + 17);

  // Divider
  doc.line(196, summaryY + 4, 196, summaryY + 18);

  // KPI 4: Recurrences & Cumulated Attendance
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(`${recurringEvents} récurrents - ${Math.round(totalAttendance / 1000)}k pax`, 204, summaryY + 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('AFFLUENCE & RÉCURRENCE', 204, summaryY + 17);

  // Helper for pure ASCII thousands grouping (avoids French locale narrow non-breaking spaces that break in jsPDF)
  const formatNumber = (num?: number) => {
    if (num === undefined || num === null) return 'NC';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  // Helper for clean, compact dates: DD/MM/YY - DD/MM/YY (pure ASCII)
  const formatCompactDate = (d: string) => {
    if (!d) return '';
    const parts = d.split('-');
    if (parts.length < 3) return d;
    const yy = parts[0].slice(-2);
    return `${parts[2]}/${parts[1]}/${yy}`;
  };

  // 3. Strict chronological sorting for PDF export (closest to export date first, then ascending order)
  const exportDateStr = now.toISOString().slice(0, 10);

  const sortedEvents = [...events].sort((a, b) => {
    const isUpcomingA = (a.endDate || a.startDate) >= exportDateStr;
    const isUpcomingB = (b.endDate || b.startDate) >= exportDateStr;

    // Prioritize current & upcoming events starting closest to the export date
    if (isUpcomingA && !isUpcomingB) return -1;
    if (!isUpcomingA && isUpcomingB) return 1;

    // Chronological order: earliest date (closest to export date) first
    const timeA = new Date(a.startDate).getTime();
    const timeB = new Date(b.startDate).getTime();
    if (timeA !== timeB) {
      return timeA - timeB;
    }

    // Events with identical start dates: grouped together, ordered by duration then RM score
    const endTimeA = new Date(a.endDate).getTime();
    const endTimeB = new Date(b.endDate).getTime();
    if (endTimeA !== endTimeB) {
      return endTimeA - endTimeB;
    }

    return (b.scoreBreakdown?.finalRMScore || 0) - (a.scoreBreakdown?.finalRMScore || 0);
  });

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

    return [
      ev.title,
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
      cellPadding: 2.5,
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
      0: { cellWidth: 46, fontStyle: 'bold' }, // Title
      1: { cellWidth: 25 }, // Type
      2: { cellWidth: 34, halign: 'center' }, // Dates
      3: { cellWidth: 40 }, // Location
      4: { cellWidth: 32, halign: 'center' }, // Attendance
      5: { cellWidth: 22, halign: 'center' }, // Impact
      6: { cellWidth: 22, halign: 'center', fontStyle: 'bold' }, // Score
      7: { cellWidth: 48 }, // Yield recommendation
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
    didParseCell: (data) => {
      // Colorize Impact and Score RM cells based on values
      if (data.section === 'body') {
        if (data.column.index === 5 || data.column.index === 6) {
          const rawRow = data.row.raw as any;
          const scoreStr = Array.isArray(rawRow) ? String(rawRow[6]) : '';
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

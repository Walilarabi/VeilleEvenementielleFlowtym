/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FLOWTYM RMS — EXPORT PDF DEMAND FORECAST
 * Génère un rapport PDF exécutif incluant les graphiques vectoriels
 * de prévision d'occupation (%) et d'ADR (€), le tableau quotidien et le backtesting.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Hotel } from '../types';
import { BacktestHorizon, BacktestReport } from '../types/historicalData';
import type { ForecastRowData, TimelinePoint } from '../components/forecast/DemandForecastView';

export interface DemandForecastPDFOptions {
  hotel?: Hotel;
  timelinePoints: TimelinePoint[];
  forecastRows: ForecastRowData[];
  backtestReport: BacktestReport;
  filename?: string;
}

interface ChartSeriesDrawConfig {
  title: string;
  subtitle: string;
  unit: '%' | '€';
  yMin: number;
  yMax: number;
  yTicks: number[];
  actualColor: [number, number, number];
  forecastColor: [number, number, number];
  thresholdValue?: number;
  thresholdLabel?: string;
  getActual: (pt: TimelinePoint) => number | null | undefined;
  getForecast: (pt: TimelinePoint) => number | null | undefined;
}

function drawForecastChartVector(
  doc: jsPDF,
  points: TimelinePoint[],
  x: number,
  y: number,
  width: number,
  height: number,
  cfg: ChartSeriesDrawConfig
): void {
  // Chart frame
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, width, height, 2.5, 2.5, 'FD');

  // Header strip inside chart card
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(cfg.title, x + 5, y + 6.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(cfg.subtitle, x + 5, y + 11);

  // Inline legend (top right)
  const legendX = x + width - 78;
  doc.setDrawColor(cfg.actualColor[0], cfg.actualColor[1], cfg.actualColor[2]);
  doc.setLineWidth(0.9);
  doc.setLineDashPattern([], 0);
  doc.line(legendX, y + 5.8, legendX + 7, y + 5.8);
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  doc.text('Réalisé PMS', legendX + 9, y + 6.6);

  doc.setLineDashPattern([1.6, 1.2], 0);
  doc.line(legendX + 36, y + 5.8, legendX + 43, y + 5.8);
  doc.setLineDashPattern([], 0);
  doc.text('Prévision FLOWTYM', legendX + 45, y + 6.6);

  // Plot area
  const padLeft = 15;
  const padRight = 6;
  const padTop = 15;
  const padBottom = 10;
  const plotX = x + padLeft;
  const plotY = y + padTop;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const valueRange = Math.max(1, cfg.yMax - cfg.yMin);
  const toY = (val: number) => {
    const clamped = Math.min(cfg.yMax, Math.max(cfg.yMin, val));
    return plotY + plotH - ((clamped - cfg.yMin) / valueRange) * plotH;
  };
  const toX = (idx: number) => {
    if (points.length <= 1) return plotX;
    return plotX + (idx / (points.length - 1)) * plotW;
  };

  // Forecast zone subtle tint starting at isToday / first forecast
  const transitionIdx = points.findIndex((p) => p.isToday || p.isForecast);
  if (transitionIdx >= 0) {
    const splitX = toX(transitionIdx);
    doc.setFillColor(245, 243, 255); // violet-50 very subtle
    doc.rect(splitX, plotY, plotX + plotW - splitX, plotH, 'F');
  }

  // Horizontal gridlines & Y ticks
  for (const tick of cfg.yTicks) {
    const gy = toY(tick);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(plotX, gy, plotX + plotW, gy);
    doc.setLineDashPattern([], 0);

    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(`${tick}${cfg.unit}`, plotX - 2, gy + 1.1, { align: 'right' });
  }

  // Optional critical threshold horizontal line (e.g. 80% occupancy)
  if (cfg.thresholdValue !== undefined) {
    const ty = toY(cfg.thresholdValue);
    doc.setDrawColor(225, 29, 72); // rose-600
    doc.setLineWidth(0.35);
    doc.setLineDashPattern([2, 1.5], 0);
    doc.line(plotX, ty, plotX + plotW, ty);
    doc.setLineDashPattern([], 0);
    if (cfg.thresholdLabel) {
      doc.setFontSize(6.2);
      doc.setTextColor(225, 29, 72);
      doc.text(cfg.thresholdLabel, plotX + 2, ty - 1.2);
    }
  }

  // Vertical divider for Today (J-0)
  if (transitionIdx >= 0) {
    const tx = toX(transitionIdx);
    doc.setDrawColor(124, 58, 237);
    doc.setLineWidth(0.4);
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.line(tx, plotY, tx, plotY + plotH);
    doc.setLineDashPattern([], 0);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(109, 40, 217);
    doc.text("Aujourd'hui", tx + 1.5, plotY + 3.5);
    doc.setFont('helvetica', 'normal');
  }

  // Axes borders
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(plotX, plotY, plotX, plotY + plotH);
  doc.line(plotX, plotY + plotH, plotX + plotW, plotY + plotH);

  // X-axis date ticks (evenly spaced ~10 labels)
  const step = Math.max(1, Math.floor(points.length / 10));
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  for (let i = 0; i < points.length; i += step) {
    const lx = toX(i);
    doc.text(points[i].label, lx, plotY + plotH + 4.5, { align: 'center' });
  }

  // Draw Actual Line (solid)
  const actualPts: Array<{ px: number; py: number; val: number }> = [];
  points.forEach((pt, idx) => {
    const v = cfg.getActual(pt);
    if (v !== null && v !== undefined) {
      actualPts.push({ px: toX(idx), py: toY(v), val: v });
    }
  });

  if (actualPts.length >= 2) {
    doc.setDrawColor(cfg.actualColor[0], cfg.actualColor[1], cfg.actualColor[2]);
    doc.setLineWidth(0.8);
    doc.setLineDashPattern([], 0);
    for (let i = 1; i < actualPts.length; i++) {
      doc.line(actualPts[i - 1].px, actualPts[i - 1].py, actualPts[i].px, actualPts[i].py);
    }
  }

  // Draw Forecast Line (dashed)
  const forecastPts: Array<{ px: number; py: number; val: number; isEvent: boolean }> = [];
  points.forEach((pt, idx) => {
    const v = cfg.getForecast(pt);
    if (v !== null && v !== undefined) {
      forecastPts.push({
        px: toX(idx),
        py: toY(v),
        val: v,
        isEvent: Boolean(pt.eventTitle),
      });
    }
  });

  if (forecastPts.length >= 2) {
    doc.setDrawColor(cfg.forecastColor[0], cfg.forecastColor[1], cfg.forecastColor[2]);
    doc.setLineWidth(0.75);
    doc.setLineDashPattern([2, 1.3], 0);
    for (let i = 1; i < forecastPts.length; i++) {
      doc.line(
        forecastPts[i - 1].px,
        forecastPts[i - 1].py,
        forecastPts[i].px,
        forecastPts[i].py
      );
    }
    doc.setLineDashPattern([], 0);

    // Highlight event peak points
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(cfg.forecastColor[0], cfg.forecastColor[1], cfg.forecastColor[2]);
    doc.setLineWidth(0.45);
    forecastPts.forEach((fp) => {
      if (fp.isEvent) {
        doc.circle(fp.px, fp.py, 0.9, 'FD');
      }
    });
  }
}

export function exportDemandForecastToPDF({
  hotel,
  timelinePoints,
  forecastRows,
  backtestReport,
  filename,
}: DemandForecastPDFOptions): void {
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

  const hotelLabel = hotel ? `${hotel.name} (${hotel.city})` : 'Grand Hôtel Folkestone Opéra (Paris)';
  const roomCount = hotel?.roomCount || 44;

  // Compute dynamic KPI summary from timelinePoints (forecast window)
  const forecastOnly = timelinePoints.filter((p) => p.isForecast);
  const avgOccForecast =
    forecastOnly.length > 0
      ? Math.round(
          (forecastOnly.reduce((s, p) => s + (p.occForecast ?? 0), 0) / forecastOnly.length) * 10
        ) / 10
      : 0;
  const avgAdrForecast =
    forecastOnly.length > 0
      ? Math.round(
          forecastOnly.reduce((s, p) => s + (p.adrForecast ?? 0), 0) / forecastOnly.length
        )
      : 0;
  const avgRevparForecast =
    forecastOnly.length > 0
      ? Math.round(
          (forecastOnly.reduce((s, p) => s + (p.revparForecast ?? 0), 0) / forecastOnly.length) * 10
        ) / 10
      : 0;
  const totalCaProjected = forecastOnly.reduce((s, p) => s + (p.caProjected ?? 0), 0);

  // ==========================================
  // PAGE 1: SYNTHÈSE EXÉCUTIVE & GRAPHIQUES OCC / ADR
  // ==========================================

  // Top Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 24, 'F');
  doc.setFillColor(124, 58, 237);
  doc.rect(0, 22.5, pageWidth, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text('FLOWTYM', 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(196, 181, 253);
  doc.text('|  DEMAND FORECAST & RAPPORT PRÉVISIONNEL', 45, 11);

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Synthèse Occupation, ADR & RevPAR (${timelinePoints[0]?.dateStr || ''} → ${
      timelinePoints[timelinePoints.length - 1]?.dateStr || ''
    })`,
    14,
    17.5
  );

  doc.setTextColor(226, 232, 240);
  doc.text(`Édité le ${formattedDate} à ${formattedTime}`, pageWidth - 14, 11, { align: 'right' });
  doc.setTextColor(148, 163, 184);
  doc.text(`${hotelLabel} · ${roomCount} chambres`, pageWidth - 14, 17.5, { align: 'right' });

  // 4 Executive KPI Cards Strip
  const kpiY = 28;
  const kpiW = (pageWidth - 28 - 12) / 4;
  const kpiH = 19;
  const kpiCards = [
    {
      label: 'OCCUPATION PRÉVUE MOY.',
      value: `${avgOccForecast.toFixed(1)} %`,
      sub: `Horizon ${forecastOnly.length} jours`,
      accent: [124, 58, 237] as [number, number, number],
    },
    {
      label: 'ADR PRÉVU MOYEN',
      value: `${avgAdrForecast} €`,
      sub: `Tarif moyen chambre projeté`,
      accent: [13, 148, 136] as [number, number, number],
    },
    {
      label: 'REVPAR PRÉVISIONNEL',
      value: `${avgRevparForecast.toFixed(1)} €`,
      sub: `CA projeté : ${totalCaProjected.toLocaleString('fr-FR')} €`,
      accent: [5, 150, 105] as [number, number, number],
    },
    {
      label: 'PRÉCISION BACKTESTING',
      value: `${backtestReport.overallAccuracyPercent} %`,
      sub: `Évaluation sans fuite (${backtestReport.totalDaysEvaluated} j)`,
      accent: [217, 119, 6] as [number, number, number],
    },
  ];

  kpiCards.forEach((card, idx) => {
    const cx = 14 + idx * (kpiW + 4);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(cx, kpiY, kpiW, kpiH, 2, 2, 'FD');

    doc.setFillColor(card.accent[0], card.accent[1], card.accent[2]);
    doc.rect(cx, kpiY, 1.5, kpiH, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(card.label, cx + 4.5, kpiY + 5);

    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(card.value, cx + 4.5, kpiY + 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(card.sub, cx + 4.5, kpiY + 16.5);
  });

  // Chart 1: Occupancy Forecast (%)
  drawForecastChartVector(doc, timelinePoints, 14, 51, pageWidth - 28, 69, {
    title: "1. Courbe d'Occupation : Réalisé PMS vs Prévisionnel (%)",
    subtitle:
      "Taux d'occupation quotidien sur 90 jours glissants (zone violette : fenêtre prévisionnelle · cercles : jours à événement)",
    unit: '%',
    yMin: 0,
    yMax: 100,
    yTicks: [0, 25, 50, 75, 100],
    actualColor: [109, 40, 217],
    forecastColor: [139, 92, 246],
    thresholdValue: 80,
    thresholdLabel: 'Seuil compression 80%',
    getActual: (pt) => pt.occActual,
    getForecast: (pt) => pt.occForecast,
  });

  // Chart 2: ADR Forecast (€)
  const adrValues = timelinePoints
    .flatMap((p) => [p.adrActual, p.adrForecast])
    .filter((v): v is number => typeof v === 'number' && v > 0);
  const minAdr = adrValues.length > 0 ? Math.floor((Math.min(...adrValues) - 25) / 20) * 20 : 120;
  const maxAdr = adrValues.length > 0 ? Math.ceil((Math.max(...adrValues) + 25) / 20) * 20 : 320;
  const adrStep = Math.max(20, Math.round((maxAdr - minAdr) / 4 / 10) * 10);
  const adrTicks: number[] = [];
  for (let v = minAdr; v <= maxAdr; v += adrStep) {
    adrTicks.push(v);
  }
  if (adrTicks[adrTicks.length - 1] < maxAdr) {
    adrTicks.push(maxAdr);
  }

  drawForecastChartVector(doc, timelinePoints, 14, 124, pageWidth - 28, 69, {
    title: "2. Courbe d'ADR : Tarif Moyen Journalier Réalisé vs Prévisionnel (€)",
    subtitle:
      "Évolution de l'ADR intégrant la saisonnalité iso-weekday, le booking pace OTB et les hausses événementielles",
    unit: '€',
    yMin: minAdr,
    yMax: maxAdr,
    yTicks: adrTicks,
    actualColor: [13, 148, 136],
    forecastColor: [20, 184, 166],
    getActual: (pt) => pt.adrActual,
    getForecast: (pt) => pt.adrForecast,
  });

  // ==========================================
  // PAGE 2: DÉTAIL DES PRÉVISIONS & BACKTESTING
  // ==========================================
  doc.addPage('a4', 'landscape');

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 16, 'F');
  doc.setFillColor(124, 58, 237);
  doc.rect(0, 15, pageWidth, 1, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text(`FLOWTYM RMS — Détail Prévisions & Audit Backtesting · ${hotelLabel}`, 14, 10.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('Prévisions clés par date de séjour (Audit 6 piliers)', 14, 24);

  autoTable(doc, {
    startY: 27,
    head: [
      [
        'Date',
        'Demand Score',
        'Occ. Prévue',
        'ADR Prévu',
        'RevPAR Prévu',
        'CA Projeté',
        'Confiance',
        'Facteurs & Événements Clés',
      ],
    ],
    body: forecastRows.map((r) => [
      `${r.dayName}\n(${r.dateStr})`,
      `${r.demandScore}/100\n${r.demandScoreLabel}`,
      `${r.occPrevue} %`,
      `${r.adrPrevu} €`,
      `${r.revparPrevu} €`,
      `${r.caProjete.toLocaleString('fr-FR')} €`,
      `${r.confiance} %`,
      [
        r.facteursExplicatifs.evenement,
        r.facteursExplicatifs.bookingPace,
        r.facteursExplicatifs.positionnementMarche,
      ]
        .filter(Boolean)
        .join(' · '),
    ]),
    theme: 'grid',
    margin: { left: 14, right: 14 },
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    columnStyles: {
      0: { cellWidth: 28, fontStyle: 'bold' },
      1: { cellWidth: 28, halign: 'center' },
      2: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
      3: { cellWidth: 22, halign: 'right' },
      4: { cellWidth: 24, halign: 'right' },
      5: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 20, halign: 'center' },
      7: { cellWidth: 'auto' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  // Backtesting Summary Table below forecast table
  const afterTableY = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || 120) + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `Validation Historique (Backtesting sans fuite · ${backtestReport.evaluatedPeriod})`,
    14,
    afterTableY
  );

  const horizons: BacktestHorizon[] = ['J-90', 'J-60', 'J-30', 'J-14', 'J-7'];
  autoTable(doc, {
    startY: afterTableY + 3,
    head: [
      [
        'Horizon',
        'Échantillons',
        'MAE Occ.',
        'RMSE Occ.',
        'WAPE Occ.',
        'Biais RevPAR',
        'MAE ADR',
        'MAE RevPAR',
        'Précision',
      ],
    ],
    body: horizons.map((h) => {
      const m = backtestReport.metricsByHorizon[h];
      return [
        h,
        `${m.sampleSize} dates`,
        `${m.maeOcc} pts`,
        `${m.rmseOcc}`,
        `${m.wapeOcc} %`,
        `${m.biasRevPar > 0 ? `+${m.biasRevPar}` : m.biasRevPar} €`,
        `${m.maeAdr} €`,
        `${m.maeRevPar} €`,
        `${m.accuracyScorePercent} %`,
      ];
    }),
    theme: 'grid',
    margin: { left: 14, right: 14 },
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
      halign: 'right',
    },
    headStyles: {
      fillColor: [109, 40, 217],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold' },
      8: { halign: 'center', fontStyle: 'bold', textColor: [5, 150, 105] },
    },
  });

  // Footer pagination on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `FLOWTYM RMS · Rapport Demand Forecast (Occupation & ADR) · ${hotelLabel}`,
      14,
      pageHeight - 6
    );
    doc.text(`Page ${i} / ${totalPages}`, pageWidth - 14, pageHeight - 6, { align: 'right' });
  }

  const safeSlug = (hotel?.id || 'hotel').replace(/[^a-zA-Z0-9_-]/g, '_');
  const outName =
    filename ||
    `flowtym_synthese_demand_forecast_${safeSlug}_${now.toISOString().slice(0, 10)}.pdf`;
  doc.save(outName);
}

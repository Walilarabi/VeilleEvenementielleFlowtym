import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DayMarketInfo, MarketDemandLevel } from './marketDemand';
import { Hotel } from '../types';

export interface ExportMarketPdfParams {
  hotel: Hotel;
  monthName: string;
  days: DayMarketInfo[];
  stats: {
    forteCount: number;
    moyenneCount: number;
    faibleCount: number;
    avgOccupancy: number;
  };
  catchmentZone: string;
  catchmentScope: string;
  criticalThreshold?: number;
}

/**
 * Génère et télécharge un rapport PDF consolidé et exécutif de la demande du marché
 * pour le mois sélectionné, avec graphique vectoriel d'évolution et tableau des dates critiques.
 */
export function exportMarketDemandReportPDF({
  hotel,
  monthName,
  days,
  stats,
  catchmentZone,
  catchmentScope,
  criticalThreshold = 80,
}: ExportMarketPdfParams): void {
  // Format A4 Paysage (297 x 210 mm) pour un affichage optimal de la chronologie et du tableau
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  let currentY = 12;

  // Calculs statistiques
  const totalDays = days.length;
  const criticalDays = days.filter(
    (d) => d.intensity >= criticalThreshold || d.demandLevel === 'forte'
  );
  const maxIntensityDay = days.reduce<DayMarketInfo | null>((max, d) => {
    if (!max || d.intensity > max.intensity) return d;
    return max;
  }, null);

  // 1. BANDEAU D'EN-TÊTE SUPÉRIEUR
  // Fond bandeau supérieur (bleu nuit slate élégant)
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(marginX, currentY, pageWidth - marginX * 2, 26, 'F');

  // Accent bar violet Flowtym
  doc.setFillColor(124, 58, 237); // violet-600
  doc.rect(marginX, currentY, 3, 26, 'F');

  // Titres & Branding
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('FLOWTYM RMS', marginX + 8, currentY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('EVENT REVENUE INTELLIGENCE · RAPPORT CONSOLIDÉ DE DEMANDE', marginX + 8, currentY + 12);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(244, 63, 94); // rose-500
  doc.text(
    `ANALYSE DE MARCHÉ : ${monthName.toUpperCase()}`,
    marginX + 8,
    currentY + 20
  );

  // Informations Établissement (alignées à droite du bandeau)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  const hotelText = `${hotel.name} (${hotel.city || 'Paris'})`;
  doc.text(hotelText, pageWidth - marginX - 6, currentY + 7, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(
    `Capacité : ${hotel.roomCount || 142} chambres · Base ADR : ${hotel.baseADR || 280} €`,
    pageWidth - marginX - 6,
    currentY + 12,
    { align: 'right' }
  );
  doc.text(
    `Bassin : ${catchmentZone} (${catchmentScope})`,
    pageWidth - marginX - 6,
    currentY + 17,
    { align: 'right' }
  );

  const editDate = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const editTime = new Date().toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Généré le ${editDate} à ${editTime} · Usage Interne RM`,
    pageWidth - marginX - 6,
    currentY + 22,
    { align: 'right' }
  );

  currentY += 30;

  // 2. BLOCS KPIS RÉCAPITULATIFS
  const kpiWidth = (pageWidth - marginX * 2 - 9) / 4;
  const kpiHeight = 16;

  // KPI 1: Forte Demande
  doc.setFillColor(255, 241, 242); // rose-50
  doc.setDrawColor(254, 205, 211); // rose-200
  doc.roundedRect(marginX, currentY, kpiWidth, kpiHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(159, 18, 57); // rose-900
  doc.text('FORTE DEMANDE (ROUGE)', marginX + 3, currentY + 4.5);
  doc.setFontSize(12);
  doc.setTextColor(225, 29, 72); // rose-600
  doc.text(`${stats.forteCount} jours`, marginX + 3, currentY + 10.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(159, 18, 57);
  doc.text('Tension max · Hausse ADR +25% à +50%', marginX + 3, currentY + 14);

  // KPI 2: Demande Moyenne
  const kpi2X = marginX + kpiWidth + 3;
  doc.setFillColor(254, 243, 199); // amber-50
  doc.setDrawColor(253, 230, 138); // amber-200
  doc.roundedRect(kpi2X, currentY, kpiWidth, kpiHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(120, 53, 15); // amber-900
  doc.text('DEMANDE MOYENNE (ORANGE)', kpi2X + 3, currentY + 4.5);
  doc.setFontSize(12);
  doc.setTextColor(217, 119, 6); // amber-600
  doc.text(`${stats.moyenneCount} jours`, kpi2X + 3, currentY + 10.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(120, 53, 15);
  doc.text('Pickup soutenu · Ajustement ADR +15%', kpi2X + 3, currentY + 14);

  // KPI 3: Faible Demande
  const kpi3X = kpi2X + kpiWidth + 3;
  doc.setFillColor(236, 253, 245); // emerald-50
  doc.setDrawColor(167, 243, 208); // emerald-200
  doc.roundedRect(kpi3X, currentY, kpiWidth, kpiHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(6, 78, 59); // emerald-900
  doc.text('FAIBLE DEMANDE (VERT)', kpi3X + 3, currentY + 4.5);
  doc.setFontSize(12);
  doc.setTextColor(5, 150, 105); // emerald-600
  doc.text(`${stats.faibleCount} jours`, kpi3X + 3, currentY + 10.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(6, 78, 59);
  doc.text('Actions de stimulation · Annulation souple', kpi3X + 3, currentY + 14);

  // KPI 4: TO Moyen & Pic
  const kpi4X = kpi3X + kpiWidth + 3;
  doc.setFillColor(245, 243, 255); // violet-50
  doc.setDrawColor(221, 214, 254); // violet-200
  doc.roundedRect(kpi4X, currentY, kpiWidth, kpiHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(76, 29, 149); // violet-900
  doc.text('TO PRÉVISIONNEL MOYEN', kpi4X + 3, currentY + 4.5);
  doc.setFontSize(12);
  doc.setTextColor(124, 58, 237); // violet-600
  doc.text(`${stats.avgOccupancy}%`, kpi4X + 3, currentY + 10.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(91, 33, 182);
  doc.text(
    maxIntensityDay
      ? `Pic max : ${maxIntensityDay.intensity}% le ${maxIntensityDay.dayNumber}`
      : 'Tension stabilisée',
    kpi4X + 3,
    currentY + 14
  );

  currentY += kpiHeight + 5;

  // 3. GRAPHIQUE D'ÉVOLUTION VECTORIEL DE LA DEMANDE
  const chartBoxWidth = pageWidth - marginX * 2;
  const chartBoxHeight = 36;

  // Cadre du graphique
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(marginX, currentY, chartBoxWidth, chartBoxHeight, 2, 2, 'FD');

  // En-tête du graphique
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text(
    "COURBE D'ÉVOLUTION DE LA TENSION JOURNALIÈRE DE DEMANDE & SEUIL CRITIQUE",
    marginX + 4,
    currentY + 5
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(
    `Progression de l'intensité sur les ${totalDays} jours du mois (${days[0]?.dateStr} au ${days[days.length - 1]?.dateStr})`,
    marginX + 4,
    currentY + 8.5
  );

  // Légende du graphique
  const legX = pageWidth - marginX - 70;
  // Pastille rouge
  doc.setFillColor(244, 63, 94);
  doc.circle(legX, currentY + 5.5, 1.3, 'F');
  doc.setFontSize(6);
  doc.setTextColor(71, 85, 105);
  doc.text('Forte (≥80%)', legX + 2.5, currentY + 6.2);

  // Pastille orange
  doc.setFillColor(251, 146, 60);
  doc.circle(legX + 22, currentY + 5.5, 1.3, 'F');
  doc.text('Moyenne (40-79%)', legX + 24.5, currentY + 6.2);

  // Pastille verte
  doc.setFillColor(52, 211, 153);
  doc.circle(legX + 48, currentY + 5.5, 1.3, 'F');
  doc.text('Faible (<40%)', legX + 50.5, currentY + 6.2);

  // Zone traçable du graphique
  const plotLeft = marginX + 10;
  const plotRight = pageWidth - marginX - 6;
  const plotWidth = plotRight - plotLeft;
  const plotTop = currentY + 12;
  const plotBottom = currentY + chartBoxHeight - 6;
  const plotHeight = plotBottom - plotTop;

  // Lignes de guidage horizontales (0%, 25%, 50%, 75%, 100%)
  const ySteps = [0, 25, 50, 75, 100];
  doc.setLineWidth(0.15);
  doc.setDrawColor(241, 245, 249); // slate-100
  ySteps.forEach((step) => {
    const yPos = plotBottom - (step / 100) * plotHeight;
    doc.line(plotLeft, yPos, plotRight, yPos);
    doc.setFontSize(5);
    doc.setTextColor(148, 163, 184);
    doc.text(`${step}%`, marginX + 3, yPos + 1);
  });

  // Ligne de Seuil Critique (80%) en rouge pointillé
  const criticalY = plotBottom - (criticalThreshold / 100) * plotHeight;
  doc.setDrawColor(225, 29, 72); // rose-600
  doc.setLineWidth(0.3);
  // Simuler une ligne pointillée
  let dashX = plotLeft;
  while (dashX < plotRight) {
    doc.line(dashX, criticalY, Math.min(dashX + 2, plotRight), criticalY);
    dashX += 3.5;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.setTextColor(225, 29, 72);
  doc.text('SEUIL CRITIQUE RM (80%)', plotRight - 28, criticalY - 1);

  // Traçage des barres journalières vectorielles
  if (totalDays > 0) {
    const barSpacing = plotWidth / totalDays;
    const barWidth = Math.max(1.8, barSpacing * 0.7);

    days.forEach((day, index) => {
      const barX = plotLeft + index * barSpacing + (barSpacing - barWidth) / 2;
      const barHeightVal = Math.max(1.5, (day.intensity / 100) * plotHeight);
      const barY = plotBottom - barHeightVal;

      // Choix de la couleur selon le niveau de demande
      if (day.demandLevel === 'forte' || day.intensity >= criticalThreshold) {
        doc.setFillColor(244, 63, 94); // rose-500
      } else if (day.demandLevel === 'moyenne') {
        doc.setFillColor(251, 146, 60); // orange-400
      } else {
        doc.setFillColor(52, 211, 153); // emerald-400
      }

      // Dessin de la barre avec coins supérieurs légèrement arrondis
      doc.roundedRect(barX, barY, barWidth, barHeightVal, 0.4, 0.4, 'F');

      // Étiquette du jour (numéro)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5);
      doc.setTextColor(100, 116, 139);
      doc.text(`${day.dayNumber}`, barX + barWidth / 2, plotBottom + 3, {
        align: 'center',
      });

      // Point rouge sur les pics critiques extrêmes
      if (day.intensity >= criticalThreshold) {
        doc.setFillColor(159, 18, 57);
        doc.circle(barX + barWidth / 2, barY - 1, 0.6, 'F');
      }
    });
  }

  currentY += chartBoxHeight + 5;

  // 4. TABLEAU DES DATES CRITIQUES & STRATÉGIQUES
  // Si le nombre de jours critiques est réduit, on intègre également les journées moyennes
  // pour offrir une vision d'ensemble complète et stratégique au Revenue Manager.
  const datesForTable = days
    .filter((d) => d.intensity >= 40 || d.demandLevel === 'forte' || d.demandLevel === 'moyenne')
    .sort((a, b) => b.intensity - a.intensity);

  // Si moins de 6 dates, afficher toutes les dates du mois triées chronologiquement
  const displayedTableDays = datesForTable.length >= 4 ? datesForTable : days;

  const tableHead = [
    [
      'Date',
      'Niveau Demande',
      'Tension',
      'TO Projeté',
      'Score RM',
      'Événements & Salons Principaux',
      'Stratégie Tarifaire & Consigne Yield',
    ],
  ];

  const tableBody = displayedTableDays.map((d) => {
    const dObj = new Date(d.dateStr);
    const dateFormatted = dObj.toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    });

    const levelText =
      d.demandLevel === 'forte'
        ? 'FORTE'
        : d.demandLevel === 'moyenne'
        ? 'MOYENNE'
        : 'FAIBLE';

    const eventsList =
      d.topEventsTitles && d.topEventsTitles.length > 0
        ? d.topEventsTitles.slice(0, 2).join(' · ')
        : 'Demande organique / Pas de salon majeur';

    const strategyText = `${d.adrAdvice} · MinLOS: ${d.minStayAdvice}`;

    return [
      dateFormatted,
      levelText,
      `${d.intensity}%`,
      `${d.projectedOccupancy}%`,
      d.maxRMScore > 0 ? `${d.maxRMScore}/100` : '—',
      eventsList,
      strategyText,
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: tableHead,
    body: tableBody,
    theme: 'plain',
    margin: { left: marginX, right: marginX, bottom: 14 },
    styles: {
      fontSize: 6.5,
      cellPadding: 1.8,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [15, 23, 42], // slate-900
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7,
      cellPadding: 2.2,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // slate-50
    },
    columnStyles: {
      0: { cellWidth: 20, fontStyle: 'bold' }, // Date
      1: { cellWidth: 22, halign: 'center', fontStyle: 'bold' }, // Niveau
      2: { cellWidth: 15, halign: 'center', fontStyle: 'bold' }, // Tension
      3: { cellWidth: 16, halign: 'center' }, // TO Projeté
      4: { cellWidth: 18, halign: 'center' }, // Score RM
      5: { cellWidth: 78 }, // Événements & Salons
      6: { cellWidth: 'auto' }, // Stratégie
    },
    didParseCell: (data) => {
      // Coloration conditionnelle des niveaux de demande
      if (data.section === 'body') {
        if (data.column.index === 1) {
          const val = String(data.cell.raw);
          if (val === 'FORTE') {
            data.cell.styles.textColor = [225, 29, 72]; // rose-600
            data.cell.styles.fillColor = [255, 241, 242]; // rose-50
          } else if (val === 'MOYENNE') {
            data.cell.styles.textColor = [217, 119, 6]; // amber-600
            data.cell.styles.fillColor = [254, 243, 199]; // amber-50
          } else {
            data.cell.styles.textColor = [5, 150, 105]; // emerald-600
            data.cell.styles.fillColor = [236, 253, 245]; // emerald-50
          }
        }
        if (data.column.index === 2) {
          const raw = String(data.cell.raw);
          const num = parseInt(raw.replace('%', ''), 10);
          if (num >= criticalThreshold) {
            data.cell.styles.textColor = [225, 29, 72];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    },
  });

  // Numérotation des pages & pied de page confidentiel
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184); // slate-400

    // Ligne fine de séparation
    doc.setDrawColor(226, 232, 240);
    doc.line(marginX, pageHeight - 8, pageWidth - marginX, pageHeight - 8);

    doc.text(
      'Flowtym RMS · Document confidentiel de décision stratégique · Reproduction interdite',
      marginX,
      pageHeight - 4.5
    );

    doc.text(
      `Page ${i} sur ${pageCount}`,
      pageWidth - marginX,
      pageHeight - 4.5,
      { align: 'right' }
    );
  }

  // Nom du fichier PDF nettoyé
  const sanitizedMonth = monthName.replace(/\s+/g, '_').toLowerCase();
  const sanitizedHotel = hotel.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  const filename = `Flowtym_Rapport_Demande_${sanitizedHotel}_${sanitizedMonth}.pdf`;

  // Sauvegarde et déclenchement du téléchargement côté client
  doc.save(filename);
}

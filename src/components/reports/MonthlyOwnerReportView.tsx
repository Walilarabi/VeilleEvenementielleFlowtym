/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VUE RAPPORT MENSUEL DE GESTION & RÉUNION PROPRIÉTAIRES
 * Grand Hôtel Folkestone Opéra (45 chambres)
 */

import React, { useState, useMemo } from 'react';
import {
  FileText,
  Download,
  Calendar,
  Building2,
  TrendingUp,
  Percent,
  DollarSign,
  Award,
  Users,
  ShieldCheck,
  Sparkles,
  PieChart,
  ArrowUpRight,
  ArrowRight,
  CheckCircle2,
  Printer,
  ChevronDown,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';
import {
  getMonthlyOwnerData,
  exportMonthlyOwnerReportToPDF,
  exportMonthlyOwnerReportToExcel,
  MonthlyOwnerKPIs,
} from '../../services/monthlyOwnerReportService';

interface MonthlyOwnerReportViewProps {
  onShowToast: (message: string) => void;
  className?: string;
}

export const MonthlyOwnerReportView: React.FC<MonthlyOwnerReportViewProps> = ({
  onShowToast,
  className = '',
}) => {
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number>(10); // Octobre

  const kpis: MonthlyOwnerKPIs = useMemo(() => {
    return getMonthlyOwnerData(selectedYear, selectedMonth);
  }, [selectedYear, selectedMonth]);

  const handleDownloadPDF = () => {
    exportMonthlyOwnerReportToPDF(kpis);
    onShowToast(`✓ Rapport Propriétaires ${kpis.monthName} ${kpis.year} téléchargé au format PDF`);
  };

  const handleDownloadExcel = () => {
    exportMonthlyOwnerReportToExcel(kpis);
    onShowToast(`✓ Données financières de gestion ${kpis.monthName} exportées au format Excel`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-violet-950 rounded-3xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-xs font-semibold text-violet-200">
              <Building2 className="w-3.5 h-3.5 text-amber-300" />
              <span>Gouvernance & Réunion Propriétaires · {kpis.hotelName}</span>
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight">
              Rapport Mensuel de Gestion & Performance RM
            </h2>
            <p className="text-xs sm:text-sm text-violet-200/90 max-w-2xl leading-relaxed">
              Bilan consolidé de l&apos;exploitation hébergement, des indices de part de marché (Fair Share) et de la rentabilité nette par canal de distribution pour vos réunions d&apos;Asset Management.
            </p>
          </div>

          {/* Action Buttons & Period Selector */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Month / Year Selectors */}
            <div className="flex items-center bg-white/10 border border-white/20 rounded-2xl p-1 text-xs">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-transparent text-white font-bold px-3 py-1.5 focus:outline-none cursor-pointer [&>option]:text-slate-900"
              >
                <option value={9}>Septembre 2026</option>
                <option value={10}>Octobre 2026 (Haute compression)</option>
                <option value={11}>Novembre 2026</option>
                <option value={12}>Décembre 2026</option>
              </select>
            </div>

            {/* Download PDF Button */}
            <button
              onClick={handleDownloadPDF}
              className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Télécharger le Rapport (PDF)</span>
            </button>

            {/* Download Excel Button */}
            <button
              onClick={handleDownloadExcel}
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
              title="Exporter le modèle financier au format Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Modèle Excel</span>
            </button>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="p-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs transition-all cursor-pointer"
              title="Imprimer cette vue"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Executive Summary Card */}
      <div className="bg-gradient-to-r from-violet-50 via-indigo-50/60 to-white rounded-2xl border border-violet-200/90 p-5 shadow-2xs space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-violet-900">
          <Sparkles className="w-4 h-4 text-violet-600" />
          <span>Synthèse pour le Conseil d&apos;Administration / Propriétaires</span>
        </div>
        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal">
          {kpis.executiveSummary}
        </p>
      </div>

      {/* Primary Financial KPIs Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CA Hébergement */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-semibold">Chiffre d&apos;Affaires Net</span>
            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold text-[10px] border border-emerald-200 flex items-center gap-0.5">
              <ArrowUpRight className="w-3 h-3" />
              <span>+{kpis.roomRevenueDeltaPct}% vs N-1</span>
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 tabular-nums">
            {kpis.roomRevenueEur.toLocaleString('fr-FR')} €
          </div>
          <div className="text-xs text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
            <span>N-1 : {kpis.roomRevenueN1Eur.toLocaleString('fr-FR')} €</span>
            <span className="text-emerald-600 font-bold">+{kpis.roomRevenueDeltaEur.toLocaleString('fr-FR')} €</span>
          </div>
        </div>

        {/* RevPAR */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-semibold">RevPAR (45 chambres)</span>
            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold text-[10px] border border-emerald-200 flex items-center gap-0.5">
              <ArrowUpRight className="w-3 h-3" />
              <span>+{kpis.revparDeltaPct}%</span>
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 tabular-nums">
            {kpis.revparEur} €
          </div>
          <div className="text-xs text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
            <span>N-1 : {kpis.revparN1Eur} €</span>
            <span className="text-emerald-600 font-bold">+{kpis.revparDeltaEur} €</span>
          </div>
        </div>

        {/* ADR */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-semibold">Prix Moyen Chambre (ADR)</span>
            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold text-[10px] border border-emerald-200 flex items-center gap-0.5">
              <ArrowUpRight className="w-3 h-3" />
              <span>+{kpis.adrDeltaPct}%</span>
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 tabular-nums">
            {kpis.adrEur} €
          </div>
          <div className="text-xs text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
            <span>N-1 : {kpis.adrN1Eur} €</span>
            <span className="text-emerald-600 font-bold">+{kpis.adrDeltaEur} €</span>
          </div>
        </div>

        {/* Taux d'Occupation */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-semibold">Taux d&apos;Occupation (TO)</span>
            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold text-[10px] border border-emerald-200 flex items-center gap-0.5">
              <ArrowUpRight className="w-3 h-3" />
              <span>+{kpis.occupancyDeltaPct} pts</span>
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 tabular-nums">
            {kpis.occupancyRate}%
          </div>
          <div className="text-xs text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
            <span>N-1 : {kpis.occupancyRateN1}%</span>
            <span className="text-slate-700 font-semibold">{kpis.roomNightsSold} nuitées</span>
          </div>
        </div>
      </div>

      {/* Market Fair Share Indices (RGI / ARI / MPI) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-violet-600" />
              <h3 className="text-base font-bold text-slate-900">
                Positionnement Marché & Indices Fair Share (Compset Opéra)
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              Mesure de la captation de valeur face aux 5 concurrents directs (base neutre = 100.0)
            </p>
          </div>
          <span className="text-xs font-bold px-3 py-1 bg-violet-100 text-violet-800 rounded-full border border-violet-200">
            Rang Compset : {kpis.compsetRank}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* RGI */}
          <div className="p-4 rounded-xl bg-violet-50/60 border border-violet-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-violet-900">RGI (Revenue Generation Index)</span>
              <span className="text-xs font-black text-violet-800 bg-white px-2 py-0.5 rounded-md border border-violet-200">
                {kpis.rgi}
              </span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div className="h-full bg-violet-600 rounded-full" style={{ width: `${Math.min(100, (kpis.rgi / 130) * 100)}%` }} />
            </div>
            <p className="text-xs text-slate-600 leading-snug">
              Surperformance globale de <strong>+22.1% en RevPAR</strong> vs le marché direct.
            </p>
          </div>

          {/* ARI */}
          <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-900">ARI (Average Rate Index)</span>
              <span className="text-xs font-black text-indigo-800 bg-white px-2 py-0.5 rounded-md border border-indigo-200">
                {kpis.ari}
              </span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${Math.min(100, (kpis.ari / 130) * 100)}%` }} />
            </div>
            <p className="text-xs text-slate-600 leading-snug">
              Tarif moyen supérieur de <strong>+12.4%</strong> à la moyenne du set concurrentiel.
            </p>
          </div>

          {/* MPI */}
          <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-900">MPI (Market Penetration Index)</span>
              <span className="text-xs font-black text-emerald-800 bg-white px-2 py-0.5 rounded-md border border-emerald-200">
                {kpis.mpi}
              </span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${Math.min(100, (kpis.mpi / 130) * 100)}%` }} />
            </div>
            <p className="text-xs text-slate-600 leading-snug">
              Taux d&apos;occupation supérieur de <strong>+8.6%</strong> à la part de marché naturelle.
            </p>
          </div>
        </div>
      </div>

      {/* Two Columns: Channels Distribution Mix & Room Types Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Channels Mix & Commission Costs */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-violet-600" />
              <h4 className="text-sm font-bold text-slate-900">Mix Canaux & Rentabilité Nette</h4>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              43.5% Direct
            </span>
          </div>

          <div className="space-y-3 text-xs">
            {kpis.channels.map((c) => (
              <div key={c.name} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 space-y-1.5">
                <div className="flex items-center justify-between font-bold text-slate-900">
                  <span>{c.name}</span>
                  <span className="tabular-nums">{c.sharePercent}% ({c.roomNights} RN)</span>
                </div>
                <div className="flex items-center justify-between text-slate-500 text-[11px]">
                  <span>CA Brut: {c.revenueEur.toLocaleString('fr-FR')} € (ADR {c.adrEur}€)</span>
                  <span className="font-semibold text-emerald-700">ADR Net: {c.netAdrEur}€</span>
                </div>
                {c.commissionPercent > 0 && (
                  <div className="text-[10px] text-rose-600 flex items-center justify-between pt-1 border-t border-slate-200/60">
                    <span>Commission intermédiation ({c.commissionPercent}%)</span>
                    <span className="font-semibold">-{c.commissionEur.toLocaleString('fr-FR')} €</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Room Types Performance */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-violet-600" />
              <h4 className="text-sm font-bold text-slate-900">Performance par Typologie de Chambre</h4>
            </div>
            <span className="text-xs text-slate-500">45 chambres au total</span>
          </div>

          <div className="space-y-3 text-xs">
            {kpis.roomTypes.map((rt) => (
              <div key={rt.name} className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 space-y-2">
                <div className="flex items-center justify-between font-bold text-slate-900">
                  <span>{rt.name} ({rt.roomCount} ch.)</span>
                  <span className="text-violet-700 font-black tabular-nums">TO: {rt.occupancyPercent}%</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-600 rounded-full" style={{ width: `${rt.occupancyPercent}%` }} />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>ADR Moyen: <strong className="text-slate-800">{rt.adrEur} €</strong></span>
                  <span>CA Généré: <strong className="text-slate-800">{rt.revenueEur.toLocaleString('fr-FR')} €</strong></span>
                </div>
              </div>
            ))}
          </div>

          {/* Revenue Management Net Value Card */}
          <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-emerald-950">Surperformance Flowtym RM</div>
              <div className="text-[11px] text-emerald-700">Gain net calculé par rapport à une politique tarifaire statique</div>
            </div>
            <div className="text-lg font-black text-emerald-800 tabular-nums">
              +{kpis.rmOptimizedGainEur.toLocaleString('fr-FR')} €
            </div>
          </div>
        </div>
      </div>

      {/* Strategic Owner Directives */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-3">
        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Axes d&apos;Amélioration et Recommandations Propriétaires</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-700">
          {kpis.strategicRecommendations.map((rec, i) => (
            <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 font-bold flex items-center justify-center shrink-0 text-[10px]">
                {i + 1}
              </span>
              <span className="leading-relaxed">{rec}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

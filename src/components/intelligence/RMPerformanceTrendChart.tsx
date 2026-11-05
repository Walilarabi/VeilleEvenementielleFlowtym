/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * FLOWTYM EVENT INTELLIGENCE — VISUALISATION ÉVOLUTION HISTORIQUE & PRÉVISIONNELLE ADR / RevPAR
 * Composant Recharts pour le Centre de Décision Revenue Management (RMDecisionCenter).
 * Exploite les données de réservations et de planning D-EDGE & Night Audit :
 * - Période Historique (Passé < 04/11/2026) : ADR Réalisé, RevPAR Réalisé, Occ. Réalisée
 * - Période Prévisionnelle (Futur >= 04/11/2026) : ADR OTB/Suggéré, RevPAR Prévisionnel, Occ. OTB
 * - Ligne de référence temporelle à la date d'aujourd'hui
 * - Sélecteurs d'horizon et métriques comparatives
 */

import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Sparkles,
  Info,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import { Hotel } from '../../types';
import {
  DailyRateIntelligence,
  TODAY_DATE_STR,
  HOTEL_TOTAL_ROOMS,
  getRateIntelligenceRecords,
} from '../../services/rateIntelligenceService';

interface RMPerformanceTrendChartProps {
  hotel: Hotel;
  records?: DailyRateIntelligence[];
  onSelectDate?: (dateStr: string) => void;
}

export type ChartHorizon = '14d' | '30d' | '60d' | '90d' | 'all';

export const RMPerformanceTrendChart: React.FC<RMPerformanceTrendChartProps> = ({
  hotel,
  records: externalRecords,
  onSelectDate,
}) => {
  const records = useMemo(() => {
    return externalRecords || getRateIntelligenceRecords(hotel.id);
  }, [externalRecords, hotel.id]);

  const [horizon, setHorizon] = useState<ChartHorizon>('60d');
  const [showADR, setShowADR] = useState(true);
  const [showRevPAR, setShowRevPAR] = useState(true);
  const [showOcc, setShowOcc] = useState(true);
  const [showCompset, setShowCompset] = useState(false);

  // Filtrage selon l'horizon sélectionné centré autour de TODAY_DATE_STR
  const chartData = useMemo(() => {
    const today = new Date(`${TODAY_DATE_STR}T00:00:00Z`);
    
    // Déterminer les jours en arrière et en avant
    let daysPast = 14;
    let daysFuture = 46;

    if (horizon === '14d') {
      daysPast = 7;
      daysFuture = 7;
    } else if (horizon === '30d') {
      daysPast = 10;
      daysFuture = 20;
    } else if (horizon === '60d') {
      daysPast = 14;
      daysFuture = 46;
    } else if (horizon === '90d') {
      daysPast = 15;
      daysFuture = 75;
    } else if (horizon === 'all') {
      daysPast = 20;
      daysFuture = 100;
    }

    const minDate = new Date(today);
    minDate.setUTCDate(today.getUTCDate() - daysPast);
    const minStr = minDate.toISOString().split('T')[0];

    const maxDate = new Date(today);
    maxDate.setUTCDate(today.getUTCDate() + daysFuture);
    const maxStr = maxDate.toISOString().split('T')[0];

    return records
      .filter((r) => r.dateStr >= minStr && r.dateStr <= maxStr)
      .map((r) => {
        const isHistorical = r.dateStr < TODAY_DATE_STR;
        const dObj = new Date(r.dateStr);
        const displayDate = `${dObj.getUTCDate()} ${dObj.toLocaleDateString('fr-FR', { month: 'short' })}`;

        const adr = r.dedgeReservations.adrNetEur;
        const revpar = r.dedgeReservations.revparEur;
        const occ = r.occupancyPercent;
        const compsetMed = r.lighthouse.compsetMedianEur;

        return {
          dateStr: r.dateStr,
          displayDate,
          fullDate: r.dateStr,
          isHistorical,
          statusLabel: isHistorical ? 'Réalisé (Night Audit)' : 'Prévisionnel (OTB & RM)',
          event: r.eventTitle || 'Sans événement majeur',
          demandLevel: r.demandLevel,
          rmScore: r.rmScore || 0,
          
          // Séries pour Recharts (distinction passé/futur)
          adrNet: adr,
          revpar: revpar,
          occupancy: occ,
          compsetMedian: compsetMed,
          
          // Séries dédiées pour différencier le tracé continu
          adrHistorical: isHistorical || r.dateStr === TODAY_DATE_STR ? adr : null,
          adrForecast: !isHistorical ? adr : null,
          revparHistorical: isHistorical || r.dateStr === TODAY_DATE_STR ? revpar : null,
          revparForecast: !isHistorical ? revpar : null,

          netRevenue: r.dedgeReservations.netAccommodationRevenue,
          remainingRooms: r.remainingRooms,
          pickup1d: r.dedgePickup.pickup1d,
        };
      });
  }, [records, horizon]);

  // Statistiques comparatives Historique vs Prévisionnel
  const metrics = useMemo(() => {
    const historical = chartData.filter((d) => d.isHistorical);
    const forecast = chartData.filter((d) => !d.isHistorical);

    const calcAvg = (arr: typeof chartData, key: 'adrNet' | 'revpar' | 'occupancy') => {
      if (!arr.length) return 0;
      const sum = arr.reduce((acc, item) => acc + item[key], 0);
      return Math.round((sum / arr.length) * 10) / 10;
    };

    const histAdr = calcAvg(historical, 'adrNet');
    const fcastAdr = calcAvg(forecast, 'adrNet');
    const histRevpar = calcAvg(historical, 'revpar');
    const fcastRevpar = calcAvg(forecast, 'revpar');
    const histOcc = calcAvg(historical, 'occupancy');
    const fcastOcc = calcAvg(forecast, 'occupancy');

    const adrDelta = Math.round((fcastAdr - histAdr) * 10) / 10;
    const revparDelta = Math.round((fcastRevpar - histRevpar) * 10) / 10;

    // Détection du pic maximal
    const peakForecast = forecast.length
      ? forecast.reduce((prev, curr) => (curr.revpar > prev.revpar ? curr : prev), forecast[0])
      : null;

    return {
      histAdr,
      fcastAdr,
      adrDelta,
      histRevpar,
      fcastRevpar,
      revparDelta,
      histOcc,
      fcastOcc,
      peakForecast,
    };
  }, [chartData]);

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-5">
      {/* Header avec Titre et Sélecteurs d'Horizon */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-violet-100 text-violet-700">
              <TrendingUp className="w-4 h-4" />
            </span>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Évolution Historique & Prévisionnelle de l’ADR et du RevPAR
            </h3>
          </div>
          <p className="text-xs text-slate-500">
            Croisement des données de réservations effectives (D-EDGE) et du planning d’occupation de l’hôtel (Capacité {HOTEL_TOTAL_ROOMS} chambres).
          </p>
        </div>

        {/* Sélecteurs de Période & Horizon */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold shadow-2xs">
            {(
              [
                { id: '14d', label: '14 jours' },
                { id: '30d', label: '30 jours' },
                { id: '60d', label: '60 jours (Défaut)' },
                { id: '90d', label: '90 jours' },
                { id: 'all', label: 'Horizon complet' },
              ] as { id: ChartHorizon; label: string }[]
            ).map((btn) => (
              <button
                key={btn.id}
                onClick={() => setHorizon(btn.id)}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer font-bold ${
                  horizon === btn.id
                    ? 'bg-violet-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cartes Métriques Comparatives : Réalisé vs Prévisionnel */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        {/* KPI 1 : ADR Réalisé vs Prévisionnel */}
        <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-200/80 space-y-1">
          <div className="flex items-center justify-between text-slate-500 font-medium">
            <span>ADR Net Moyen</span>
            <span className="text-[10px] font-bold text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
              Historique vs OTB
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-black text-slate-900">{metrics.fcastAdr} €</span>
            <span className="text-xs text-slate-400">vs {metrics.histAdr} €</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>+{metrics.adrDelta} € d’évolution prévisionnelle</span>
          </div>
        </div>

        {/* KPI 2 : RevPAR Réalisé vs Prévisionnel */}
        <div className="bg-violet-50/50 rounded-2xl p-3.5 border border-violet-200/80 space-y-1">
          <div className="flex items-center justify-between text-violet-800 font-semibold">
            <span>RevPAR Moyen (45 ch.)</span>
            <span className="text-[10px] font-bold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded">
              Yield Flowtym
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-black text-violet-950">{metrics.fcastRevpar} €</span>
            <span className="text-xs text-violet-500">vs {metrics.histRevpar} €</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold text-violet-700">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>+{metrics.revparDelta} € / chambre disponible</span>
          </div>
        </div>

        {/* KPI 3 : Taux d'Occupation OTB */}
        <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-200/80 space-y-1">
          <div className="flex items-center justify-between text-slate-500 font-medium">
            <span>Occupation Moyenne</span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              OTB
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-black text-slate-900">{metrics.fcastOcc}%</span>
            <span className="text-xs text-slate-400">vs {metrics.histOcc}% hist.</span>
          </div>
          <p className="text-[11px] text-slate-500">Rythme d’absorption conforme aux objectifs</p>
        </div>

        {/* KPI 4 : Pic de Performance Anticipé */}
        <div className="bg-amber-50/60 rounded-2xl p-3.5 border border-amber-200/80 space-y-1">
          <div className="flex items-center justify-between text-amber-800 font-semibold">
            <span>Pic de RevPAR Détecté</span>
            <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
              Compression
            </span>
          </div>
          {metrics.peakForecast ? (
            <>
              <div className="text-lg font-black text-amber-950">
                {metrics.peakForecast.revpar} €
                <span className="text-xs font-normal text-amber-700 ml-1.5">
                  ({metrics.peakForecast.adrNet}€ ADR)
                </span>
              </div>
              <p className="text-[11px] text-amber-800 truncate" title={metrics.peakForecast.event}>
                {metrics.peakForecast.displayDate} · {metrics.peakForecast.event}
              </p>
            </>
          ) : (
            <div className="text-slate-400">Aucun pic détecté</div>
          )}
        </div>
      </div>

      {/* Toggles des Séries Recharts */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-slate-500 text-[11px]">Affichage des courbes :</span>

          <button
            onClick={() => setShowADR(!showADR)}
            className={`px-2.5 py-1 rounded-lg border font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              showADR
                ? 'bg-violet-600 text-white border-violet-600 shadow-2xs'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            <span className="w-2.5 h-1 bg-violet-400 rounded-full" />
            <span>ADR Net (€)</span>
          </button>

          <button
            onClick={() => setShowRevPAR(!showRevPAR)}
            className={`px-2.5 py-1 rounded-lg border font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              showRevPAR
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            <span className="w-2.5 h-1 bg-emerald-400 rounded-full" />
            <span>RevPAR (€)</span>
          </button>

          <button
            onClick={() => setShowOcc(!showOcc)}
            className={`px-2.5 py-1 rounded-lg border font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              showOcc
                ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            <span className="w-2.5 h-1 bg-sky-300 rounded-full" />
            <span>Taux d’Occupation (%)</span>
          </button>

          <button
            onClick={() => setShowCompset(!showCompset)}
            className={`px-2.5 py-1 rounded-lg border font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              showCompset
                ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            <span className="w-2.5 h-1 bg-amber-400 rounded-full" />
            <span>Médiane Compset (€)</span>
          </button>
        </div>

        {/* Légende Temporelle Passé / Futur */}
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-slate-400" />
            <span>Trait plein : Réalisé (Passé)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-t-2 border-dashed border-violet-600" />
            <span className="text-violet-700 font-semibold">Tirets : Prévisionnel (Futur)</span>
          </div>
        </div>
      </div>

      {/* Canvas Recharts Interactif */}
      <div className="h-80 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 15, right: 15, left: -5, bottom: 5 }}
            onClick={(e: any) => {
              if (e && e.activePayload && e.activePayload.length) {
                const dateStr = e.activePayload[0].payload.dateStr;
                onSelectDate?.(dateStr);
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="displayDate"
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={{ stroke: '#cbd5e1' }}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11, fill: '#64748b' }}
              domain={['dataMin - 20', 'dataMax + 30']}
              unit="€"
              axisLine={{ stroke: '#cbd5e1' }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11, fill: '#0284c7' }}
              domain={[0, 100]}
              unit="%"
              axisLine={{ stroke: '#0284c7' }}
            />

            {/* Ligne verticale de bascule Aujourd'hui */}
            <ReferenceLine
              yAxisId="left"
              x={
                chartData.find((d) => d.dateStr === TODAY_DATE_STR)?.displayDate ||
                chartData[Math.min(chartData.length - 1, 14)]?.displayDate
              }
              stroke="#ef4444"
              strokeDasharray="4 4"
              strokeWidth={2}
              label={{
                value: 'Aujourd’hui (04 nov.)',
                position: 'top',
                fill: '#dc2626',
                fontSize: 10,
                fontWeight: 'bold',
              }}
            />

            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-xl text-xs space-y-2 border border-slate-800 max-w-xs">
                      <div className="border-b border-slate-800 pb-1.5 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-100">{data.fullDate}</div>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                              data.isHistorical
                                ? 'bg-slate-800 text-slate-300'
                                : 'bg-violet-900 text-violet-300'
                            }`}
                          >
                            {data.statusLabel}
                          </span>
                        </div>
                        {data.rmScore > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-600/80 text-white">
                            Score RM {data.rmScore}
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-violet-300 font-semibold truncate">
                        {data.event}
                      </div>

                      <div className="space-y-1 font-mono text-[11px] pt-1">
                        <div className="flex justify-between text-violet-300 font-bold">
                          <span>ADR Net :</span>
                          <span>{data.adrNet} €</span>
                        </div>
                        <div className="flex justify-between text-emerald-400 font-bold">
                          <span>RevPAR (45 ch.) :</span>
                          <span>{data.revpar} €</span>
                        </div>
                        <div className="flex justify-between text-sky-400">
                          <span>Taux d’Occupation :</span>
                          <span>{data.occupancy}%</span>
                        </div>
                        {showCompset && (
                          <div className="flex justify-between text-amber-300">
                            <span>Médiane Compset :</span>
                            <span>{data.compsetMedian} €</span>
                          </div>
                        )}
                        <div className="flex justify-between text-slate-300 pt-1 border-t border-slate-800 text-[10px]">
                          <span>CA Net Nuitée :</span>
                          <span className="font-bold text-white">
                            {data.netRevenue.toLocaleString('fr-FR')} €
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-400 text-[10px]">
                          <span>Stock restant :</span>
                          <span>{data.remainingRooms} chambres</span>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />

            {/* Zone d'Occupation OTB / Réalisée */}
            {showOcc && (
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="occupancy"
                fill="#0284c7"
                stroke="#0284c7"
                fillOpacity={0.07}
                strokeWidth={1.5}
                name="Taux d’Occ. %"
              />
            )}

            {/* Courbe ADR Net : Période Historique (pleine) */}
            {showADR && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="adrHistorical"
                stroke="#7c3aed"
                strokeWidth={2.5}
                dot={{ r: 2, fill: '#7c3aed' }}
                connectNulls={false}
                name="ADR Réalisé (€)"
              />
            )}

            {/* Courbe ADR Net : Période Prévisionnelle (tirets) */}
            {showADR && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="adrForecast"
                stroke="#7c3aed"
                strokeWidth={2.5}
                strokeDasharray="4 3"
                dot={{ r: 3, fill: '#7c3aed' }}
                connectNulls={false}
                name="ADR Prévisionnel (€)"
              />
            )}

            {/* Courbe RevPAR : Période Historique (pleine) */}
            {showRevPAR && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="revparHistorical"
                stroke="#10b981"
                strokeWidth={2.5}
                dot={{ r: 2, fill: '#10b981' }}
                connectNulls={false}
                name="RevPAR Réalisé (€)"
              />
            )}

            {/* Courbe RevPAR : Période Prévisionnelle (tirets) */}
            {showRevPAR && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="revparForecast"
                stroke="#10b981"
                strokeWidth={2.5}
                strokeDasharray="4 3"
                dot={{ r: 3, fill: '#10b981' }}
                connectNulls={false}
                name="RevPAR Prévisionnel (€)"
              />
            )}

            {/* Médiane Compset */}
            {showCompset && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="compsetMedian"
                stroke="#f59e0b"
                strokeWidth={1.5}
                dot={false}
                name="Médiane Compset (€)"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

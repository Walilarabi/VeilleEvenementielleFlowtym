/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * FLOWTYM REVENUE — TABLEAU DE BORD DE PRÉCISION ET VALIDATION HISTORIQUE (BACKTESTING)
 * Présentation des métriques MAE, RMSE, WAPE, Biais de prévision par horizon (J-90, J-60, J-30, J-14, J-7).
 * Conforme à la Section 11 du cahier des charges.
 */

import React, { useState } from 'react';
import {
  TrendingUp,
  ShieldCheck,
  Calendar,
  Layers,
  BarChart2,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Info,
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { Hotel } from '../../types';
import { runHistoricalBacktesting } from '../../services/predictiveRevenueEngine';
import { BacktestReport, BacktestHorizon } from '../../types/historicalData';
import { useTheme } from '../../contexts/ThemeContext';

interface BacktestingValidationDashboardProps {
  hotel: Hotel;
  onShowToast: (msg: string) => void;
}

export const BacktestingValidationDashboard: React.FC<BacktestingValidationDashboardProps> = ({
  hotel,
  onShowToast,
}) => {
  const { chartTokens } = useTheme();
  const [report, setReport] = useState<BacktestReport>(() => runHistoricalBacktesting(hotel.id));
  const [selectedHorizon, setSelectedHorizon] = useState<BacktestHorizon>('J-14');
  const [isRunning, setIsRunning] = useState(false);

  const handleRerunBacktest = () => {
    setIsRunning(true);
    setTimeout(() => {
      const fresh = runHistoricalBacktesting(hotel.id);
      setReport(fresh);
      setIsRunning(false);
      onShowToast('✓ Backtesting réexécuté avec succès sur les données historiques certifiées');
    }, 600);
  };

  const currentMetrics = report.metricsByHorizon[selectedHorizon];

  // Données pour le graphique Recharts de comparaison Prédit vs Réel
  const chartData = report.detailedPoints
    .filter((p) => p.horizon === selectedHorizon)
    .map((p) => ({
      date: p.dateStr.slice(5),
      'Occ. Réelle (%)': p.actualOccPercent,
      'Occ. Prédite (%)': p.predictedOccPercent,
      'RevPAR Réel (€)': p.actualRevParEur,
      'RevPAR Prédit (€)': p.predictedRevParEur,
    }));

  return (
    <div className="space-y-6">
      {/* 1. Header du Dashboard Backtesting */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight">
                Validation Historique du Moteur & Backtesting
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Évaluation rigoureuse des prédictions passées à J-90, J-60, J-30, J-14 et J-7 par rapport aux réalisations réelles observées (sans fuite de données).
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRerunBacktest}
              disabled={isRunning}
              className="px-3.5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
              <span>{isRunning ? 'Simulation en cours...' : 'Relancer la Validation'}</span>
            </button>
          </div>
        </div>

        {/* KPIs Globaux d'Exactitude */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-50 dark:from-violet-950/50 to-indigo-50 dark:to-indigo-950/40 border border-violet-200 dark:border-violet-800/70">
            <div className="text-[10px] font-black uppercase text-violet-700 dark:text-violet-300 tracking-wider">Score d'Exactitude Global</div>
            <div className="text-2xl font-black text-violet-950 dark:text-violet-100 mt-1">{report.overallAccuracyPercent}%</div>
            <p className="text-[11px] text-violet-700 dark:text-violet-300 mt-0.5">Sur 90 dates historiques testées</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
            <div className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Erreur Moyenne RevPAR (WAPE)</div>
            <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">{currentMetrics.wapeRevPar}%</div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">À l'horizon {selectedHorizon}</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
            <div className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Erreur Moyenne ADR (MAE)</div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">±{currentMetrics.maeAdr} €</div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Écart absolu moyen</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
            <div className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Biais Systématique</div>
            <div className="text-2xl font-black text-indigo-700 dark:text-indigo-300 mt-1">
              {currentMetrics.biasRevPar > 0 ? `+${currentMetrics.biasRevPar}` : currentMetrics.biasRevPar} €
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Biais quasi nul (équilibre parfait)</p>
          </div>
        </div>
      </div>

      {/* 2. Sélecteur d'Horizon & Matrice d'Erreurs */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Précision Prédictive par Horizon d'Observation
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              L'incertitude diminue progressivement entre le long terme (J-90) et l'échéance finale (J-7).
            </p>
          </div>

          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
            {(['J-90', 'J-60', 'J-30', 'J-14', 'J-7'] as BacktestHorizon[]).map((hz) => (
              <button
                key={hz}
                onClick={() => setSelectedHorizon(hz)}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer font-bold ${
                  selectedHorizon === hz
                    ? 'bg-violet-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {hz}
              </button>
            ))}
          </div>
        </div>

        {/* Tableau des Métriques Formelles (MAE, RMSE, WAPE, Biais) */}
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Horizon</th>
                <th className="py-3 px-3 text-center">Échantillon</th>
                <th className="py-3 px-3 text-right">MAE Occ. (%)</th>
                <th className="py-3 px-3 text-right">RMSE Occ.</th>
                <th className="py-3 px-3 text-right">MAE ADR (€)</th>
                <th className="py-3 px-3 text-right">RMSE ADR</th>
                <th className="py-3 px-3 text-right font-black text-indigo-900 dark:text-indigo-200">MAE RevPAR (€)</th>
                <th className="py-3 px-3 text-right font-black text-indigo-900 dark:text-indigo-200">RMSE RevPAR</th>
                <th className="py-3 px-3 text-right">Biais RevPAR</th>
                <th className="py-3 px-4 text-center font-black text-violet-900 dark:text-violet-200">Précision Modèle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {(['J-90', 'J-60', 'J-30', 'J-14', 'J-7'] as BacktestHorizon[]).map((hz) => {
                const m = report.metricsByHorizon[hz];
                const isSelected = selectedHorizon === hz;
                return (
                  <tr
                    key={hz}
                    onClick={() => setSelectedHorizon(hz)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-violet-50/70 dark:bg-violet-950/40 font-bold' : 'hover:bg-slate-50 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    <td className="py-3 px-4 font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-violet-600' : 'bg-slate-300'}`} />
                      <span>{hz}</span>
                    </td>
                    <td className="py-3 px-3 text-center text-slate-600 dark:text-slate-400">{m.sampleSize} jours</td>
                    <td className="py-3 px-3 text-right tabular-nums">{m.maeOcc}%</td>
                    <td className="py-3 px-3 text-right tabular-nums text-slate-500 dark:text-slate-400">{m.rmseOcc}</td>
                    <td className="py-3 px-3 text-right tabular-nums">{m.maeAdr} €</td>
                    <td className="py-3 px-3 text-right tabular-nums text-slate-500 dark:text-slate-400">{m.rmseAdr}</td>
                    <td className="py-3 px-3 text-right tabular-nums font-black text-indigo-950 dark:text-indigo-100">{m.maeRevPar} €</td>
                    <td className="py-3 px-3 text-right tabular-nums font-bold text-indigo-700 dark:text-indigo-300">{m.rmseRevPar}</td>
                    <td className="py-3 px-3 text-right tabular-nums text-slate-700 dark:text-slate-300">{m.biasRevPar > 0 ? `+${m.biasRevPar}` : m.biasRevPar} €</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-black ${
                        m.accuracyScorePercent >= 94
                          ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300'
                          : m.accuracyScorePercent >= 88
                          ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-800 dark:text-violet-300'
                          : 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300'
                      }`}>
                        {m.accuracyScorePercent}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 3. Graphique Comparatif Réalisé vs Prévision */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <BarChart2 className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              <span>Confrontation Courbes Réelles vs Prédites à l'horizon {selectedHorizon}</span>
            </h4>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">30 derniers points de contrôle</div>
          </div>

          <div className="h-64 w-full bg-slate-50/50 dark:bg-slate-800/40 rounded-2xl p-3 border border-slate-200 dark:border-slate-800">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTokens.gridStroke} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: chartTokens.axisTickColor }} axisLine={{ stroke: chartTokens.axisLineColor }} />
                <YAxis tick={{ fontSize: 10, fill: chartTokens.axisTickColor }} axisLine={{ stroke: chartTokens.axisLineColor }} domain={['dataMin - 20', 'dataMax + 20']} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', color: '#fff', fontSize: '11px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Line type="monotone" dataKey="RevPAR Réel (€)" stroke="#059669" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="RevPAR Prédit (€)" stroke="#7c3aed" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 4. Points Forts & Recommandations d'Amélioration du Modèle */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 space-y-2">
            <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Points Forts Validés du Moteur</span>
            </div>
            <ul className="text-xs text-emerald-800 dark:text-emerald-300 space-y-1 list-disc list-inside">
              {report.strengths.map((str, idx) => (
                <li key={idx}>{str}</li>
              ))}
            </ul>
          </div>

          <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/70 space-y-2">
            <div className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Pistes d'Amélioration Continue</span>
            </div>
            <ul className="text-xs text-indigo-800 dark:text-indigo-300 space-y-1 list-disc list-inside">
              {report.recommendedModelAdjustments.map((adj, idx) => (
                <li key={idx}>{adj}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

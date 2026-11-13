/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * COMPOSANT : SURVEILLANCE PARITÉ TARIFAIRE IA & ALERTES SLACK AUTOMATIQUES
 * Détection des disparités OTAs et déclenchement automatique d'alertes Slack
 */

import React, { useState } from 'react';
import {
  AlertTriangle,
  Send,
  CheckCircle2,
  Settings,
  ShieldAlert,
  Zap,
  ExternalLink,
  RefreshCw,
  Eye,
  Sliders,
  X,
  MessageSquare,
  Globe2,
  DollarSign,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import {
  getSlackParityConfig,
  saveSlackParityConfig,
  getParityDiscrepancies,
  saveParityDiscrepancies,
  sendSlackParityAlert,
  generateSlackPayload,
  ParityDiscrepancyItem,
  SlackParityConfig,
} from '../../services/parityMonitoringService';

interface SlackParityMonitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (msg: string) => void;
}

export const SlackParityMonitorModal: React.FC<SlackParityMonitorModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
}) => {
  const [config, setConfig] = useState<SlackParityConfig>(getSlackParityConfig);
  const [discrepancies, setDiscrepancies] = useState<ParityDiscrepancyItem[]>(getParityDiscrepancies);
  const [selectedItem, setSelectedItem] = useState<ParityDiscrepancyItem>(discrepancies[0]);
  const [isSending, setIsSending] = useState(false);

  if (!isOpen) return null;

  const handleSaveConfig = () => {
    saveSlackParityConfig(config);
    onShowToast('✓ Configuration Slack et seuils de parité enregistrés avec succès !');
  };

  const handleSendSlackTest = async (item: ParityDiscrepancyItem) => {
    setIsSending(true);
    const res = await sendSlackParityAlert(item, config);
    setIsSending(false);
    onShowToast(res.message);
    setDiscrepancies(getParityDiscrepancies());
  };

  const handleResolve = (id: string) => {
    const updated = discrepancies.map((d) => (d.id === id ? { ...d, status: 'resolved' as const } : d));
    setDiscrepancies(updated);
    saveParityDiscrepancies(updated);
    onShowToast('✓ Disparité marquée comme résolue dans le channel manager');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-5xl w-full max-h-[92vh] overflow-hidden flex flex-col animate-in zoom-in-95">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-rose-900 via-slate-900 to-indigo-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-rose-300">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold tracking-tight">
                  Surveillance Parité IA & Alertes Slack Automatiques
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-400/30">
                  Détection Temps Réel
                </span>
              </div>
              <p className="text-xs text-rose-200">
                Alerte instantanée dans Slack dès qu&apos;un canal OTA sous-cote votre tarif direct officiel
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body: 2 columns */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Discrepancies List & Slack Settings (6 cols) */}
          <div className="lg:col-span-6 space-y-5">
            {/* Active Parity Discrepancies List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                    Écarts de parité détectés par l&apos;IA ({discrepancies.filter((d) => d.status !== 'resolved').length})
                  </h4>
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Scan continu toutes les 15 min</span>
              </div>

              <div className="space-y-2.5">
                {discrepancies.map((item) => {
                  const isSelected = selectedItem?.id === item.id;
                  const isResolved = item.status === 'resolved';

                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                        isSelected
                          ? 'border-rose-400 bg-rose-50/40 dark:bg-rose-950/30 ring-2 ring-rose-400/20 shadow-xs'
                          : isResolved
                          ? 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 opacity-60'
                          : 'border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-2xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                              {item.channelName}
                            </span>
                            <span className="text-slate-300">·</span>
                            <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                              {item.dateStr}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              ({item.roomType.split(' ')[1] || item.roomType})
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Détecté {item.detectedAt}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs font-black text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/40 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-800/70 tabular-nums">
                            {item.discrepancyEur}€ ({item.discrepancyPercent}%)
                          </span>
                        </div>
                      </div>

                      {/* Rates Comparison Line */}
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60 dark:border-slate-800/70">
                        <span className="text-slate-600 dark:text-slate-400">
                          Direct : <strong className="text-slate-900 dark:text-slate-100">{item.directRateEur}€</strong> vs OTA : <span className="line-through text-slate-400">{item.otaRateEur}€</span>
                        </span>
                        {item.slackSent ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/70">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            <span>Slack notifié</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/70">
                            En attente
                          </span>
                        )}
                      </div>

                      {/* AI Diagnostic Snippet */}
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200/60 dark:border-slate-800/70 leading-relaxed">
                        🤖 <strong>Diagnostic IA :</strong> {item.aiDiagnostic}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Slack Integration Settings */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Configuration du Webhook Slack
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.enabled}
                    onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-600" />
                </label>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block">
                    Canal Slack de destination :
                  </label>
                  <input
                    type="text"
                    value={config.channel}
                    onChange={(e) => setConfig({ ...config, channel: e.target.value })}
                    className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 font-bold text-slate-800 dark:text-slate-200 text-xs focus:ring-2 focus:ring-violet-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block">
                    Webhook URL Slack (Incoming Webhook) :
                  </label>
                  <input
                    type="text"
                    value={config.webhookUrl}
                    onChange={(e) => setConfig({ ...config, webhookUrl: e.target.value })}
                    className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 font-mono text-[11px] text-slate-600 dark:text-slate-400 focus:ring-2 focus:ring-violet-500 focus:outline-none truncate"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-600 dark:text-slate-400">Seuil de déclenchement :</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Écart dès</span>
                    <input
                      type="number"
                      value={config.triggerThresholdEur}
                      onChange={(e) => setConfig({ ...config, triggerThresholdEur: Number(e.target.value) })}
                      className="w-14 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-center font-bold text-xs"
                    />
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">€</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleSaveConfig}
                className="w-full py-2 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Enregistrer les paramètres Slack
              </button>
            </div>
          </div>

          {/* Right Column: Realistic Slack Message Preview (6 cols) */}
          <div className="lg:col-span-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Rendu en direct dans votre canal Slack ({config.channel})
                </span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">Slack Block Kit format</span>
            </div>

            {/* Simulated Slack Message Card (Slack Theme) */}
            <div className="bg-[#1a1d21] text-slate-100 rounded-2xl p-5 shadow-lg border border-slate-800 space-y-4 font-sans select-none">
              {/* Channel Header */}
              <div className="flex items-center justify-between text-xs border-b border-slate-800/80 pb-3 text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-white">{config.channel}</span>
                  <span>·</span>
                  <span>14 membres</span>
                </div>
                <span className="text-[10px]">Aujourd&apos;hui à 09:12</span>
              </div>

              {/* Bot Post Header */}
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-rose-600 flex items-center justify-center text-white font-black text-xs shrink-0 shadow-xs">
                  ⚡
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">{config.botName}</span>
                    <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.2 rounded font-semibold uppercase">
                      APP
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">09:12</span>
                  </div>

                  {/* Slack Message Body */}
                  <div className="space-y-3 pt-1">
                    <div className="text-rose-400 font-bold text-xs flex items-center gap-1.5">
                      <span>🚨</span>
                      <span>RUPTURE DE PARITÉ TARIFAIRE DÉTECTÉE · {selectedItem.channelName.toUpperCase()}</span>
                    </div>

                    <div className="text-xs text-slate-300 leading-relaxed">
                      <strong>Hôtel :</strong> Grand Hôtel Folkestone Opéra (Paris 8e)<br />
                      <strong>Date de séjour :</strong> {selectedItem.dateStr} ({selectedItem.roomType})<br />
                      <strong>Détection IA :</strong> {selectedItem.aiDiagnostic}
                    </div>

                    {/* Price Comparison Block */}
                    <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/80 grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Tarif Direct Site Web</div>
                        <div className="text-base font-black text-emerald-400 mt-0.5">{selectedItem.directRateEur} €</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-rose-400 uppercase font-semibold">Tarif {selectedItem.channelName}</div>
                        <div className="text-base font-black text-rose-400 mt-0.5">
                          {selectedItem.otaRateEur} € <span className="text-xs font-bold text-rose-300">({selectedItem.discrepancyEur}€)</span>
                        </div>
                      </div>
                    </div>

                    {/* Root cause and RM action */}
                    <div className="text-[11px] text-slate-400 space-y-1 bg-slate-800/40 p-2.5 rounded-lg border border-slate-800">
                      <div>🔍 <strong>Cause racine :</strong> {selectedItem.rootCause}</div>
                      <div>💡 <strong>Action recommandée :</strong> {selectedItem.recommendedAction}</div>
                    </div>

                    {/* Interactive Slack Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        onClick={() => handleResolve(selectedItem.id)}
                        className="px-3 py-1.5 bg-[#007a5a] hover:bg-[#148567] text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                      >
                        Corriger dans D-EDGE CRS
                      </button>
                      <button
                        onClick={() => onShowToast(`Contact transmis au Market Manager de ${selectedItem.channelName}`)}
                        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Notifier l&apos;OTA
                      </button>
                      <button
                        onClick={() => onShowToast(`Inspection des flux de parité pour le ${selectedItem.dateStr}`)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                      >
                        Inspecter sur Flowtym
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Test Trigger Button for Selected Item */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  Transmettre cette alerte dans Slack ({config.channel})
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">{selectedItem.channelName}</span>
              </div>
              <button
                onClick={() => handleSendSlackTest(selectedItem)}
                disabled={isSending}
                className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSending ? 'Transmission en cours...' : `Envoyer l'alerte ${selectedItem.channelName} sur Slack`}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Dernière notification Slack transmise : <strong>{config.lastAlertSentAt || 'Aucune alerte récente'}</strong>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * COMPOSANT : CONFIGURATION DU BRIEF HEBDOMADAIRE DU LUNDI MATIN
 * Résumé automatique des performances clés et des recommandations de prix S+1
 */

import React, { useState } from 'react';
import {
  Mail,
  Clock,
  Calendar,
  CheckCircle2,
  Send,
  Sparkles,
  Zap,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Building2,
  DollarSign,
  Layers,
  Settings,
  Eye,
  X,
} from 'lucide-react';
import {
  getMondayDigestConfig,
  saveMondayDigestConfig,
  generateMondayDigestContent,
  sendSimulatedMondayDigest,
  MondayDigestConfig,
} from '../../services/automatedDigestsService';

interface WeeklyMondayDigestConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (msg: string) => void;
}

export const WeeklyMondayDigestConfigModal: React.FC<WeeklyMondayDigestConfigModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
}) => {
  const [config, setConfig] = useState<MondayDigestConfig>(getMondayDigestConfig);
  const [recipientInput, setRecipientInput] = useState('WaliLarabi@gmail.com');
  const [showPreview, setShowPreview] = useState(true);
  const [isSendingTest, setIsSendingTest] = useState(false);

  const digestContent = generateMondayDigestContent();

  if (!isOpen) return null;

  const handleSave = () => {
    saveMondayDigestConfig(config);
    onShowToast('✓ Configuration du récapitulatif du lundi matin enregistrée !');
    onClose();
  };

  const handleTestSend = () => {
    setIsSendingTest(true);
    setTimeout(() => {
      const result = sendSimulatedMondayDigest(recipientInput);
      setIsSendingTest(false);
      onShowToast(result.message);
      setConfig(getMondayDigestConfig());
    }, 700);
  };

  const handleAddEmail = () => {
    if (!recipientInput.includes('@') || config.recipients.includes(recipientInput)) return;
    const updated = { ...config, recipients: [...config.recipients, recipientInput] };
    setConfig(updated);
    saveMondayDigestConfig(updated);
  };

  const handleRemoveEmail = (email: string) => {
    const updated = { ...config, recipients: config.recipients.filter((r) => r !== email) };
    setConfig(updated);
    saveMondayDigestConfig(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-violet-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-amber-300">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold tracking-tight">
                  Brief Hebdomadaire RM du Lundi Matin
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Automatisé
                </span>
              </div>
              <p className="text-xs text-violet-200">
                Envoi automatique chaque lundi matin : bilan S-1 & recommandations tarifaires pour la semaine à venir
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

        {/* Modal Body: Two columns (Settings on left / Preview on right) */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Configuration Settings (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            {/* Main Toggle Switch */}
            <div className="p-4 rounded-2xl bg-violet-50/70 dark:bg-violet-950/40 border border-violet-200/80 dark:border-violet-800/70 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-violet-950 dark:text-violet-100 block">
                  Activer l&apos;envoi automatique
                </span>
                <span className="text-[11px] text-violet-700 dark:text-violet-300">
                  Déclenchement récurrent chaque lundi
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600" />
              </label>
            </div>

            {/* Time of dispatch */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                <span>Heure d&apos;envoi le lundi matin :</span>
              </label>
              <select
                value={config.timeOfDay}
                onChange={(e) => setConfig({ ...config, timeOfDay: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 text-xs font-semibold rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="07:30">07:30 (Avant l&apos;ouverture opérationnelle)</option>
                <option value="08:00">08:00 (Recommandé · Heure standard de briefing)</option>
                <option value="08:30">08:30</option>
                <option value="09:00">09:00</option>
              </select>
            </div>

            {/* Recipients */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                <span>Destinataires du récapitulatif :</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={recipientInput}
                  onChange={(e) => setRecipientInput(e.target.value)}
                  placeholder="nom@hotel.com"
                  className="flex-1 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 text-xs rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <button
                  onClick={handleAddEmail}
                  className="px-3 py-2 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Ajouter
                </button>
              </div>

              {/* Email Chips */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {config.recipients.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800"
                  >
                    <span>{email}</span>
                    <button
                      onClick={() => handleRemoveEmail(email)}
                      className="text-slate-400 hover:text-rose-600 transition-colors ml-1"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Distribution Channels */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Canaux de notification :</label>
              <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.channels.email}
                    onChange={(e) => setConfig({ ...config, channels: { ...config.channels, email: e.target.checked } })}
                    className="rounded text-violet-600 dark:text-violet-400 focus:ring-violet-500"
                  />
                  <span>Email HTML responsive consolidé</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.channels.slack}
                    onChange={(e) => setConfig({ ...config, channels: { ...config.channels, slack: e.target.checked } })}
                    className="rounded text-violet-600 dark:text-violet-400 focus:ring-violet-500"
                  />
                  <span>Canal Slack interne (#revenue-management)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.channels.inApp}
                    onChange={(e) => setConfig({ ...config, channels: { ...config.channels, inApp: e.target.checked } })}
                    className="rounded text-violet-600 dark:text-violet-400 focus:ring-violet-500"
                  />
                  <span>Notification push in-app dans Flowtym</span>
                </label>
              </div>
            </div>

            {/* Test Trigger Button */}
            <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 rounded-2xl space-y-2">
              <div className="text-xs font-bold text-amber-950 dark:text-amber-100 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Tester l&apos;envoi instantanément</span>
              </div>
              <p className="text-[11px] text-amber-800 dark:text-amber-300">
                Envoie immédiatement un récapitulatif test à <strong>{recipientInput}</strong> pour valider le contenu avant le prochain lundi.
              </p>
              <button
                onClick={handleTestSend}
                disabled={isSendingTest}
                className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSendingTest ? 'Envoi en cours...' : 'Envoyer un récapitulatif test'}</span>
              </button>
            </div>
          </div>

          {/* Right Column: Interactive Digest Preview (7 cols) */}
          <div className="lg:col-span-7 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Aperçu du Brief Hebdomadaire (Rendu Réel)
                </span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                {digestContent.generationDate}
              </span>
            </div>

            {/* Email Container Simulation */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-4 shadow-2xs text-xs">
              {/* Header Box */}
              <div className="bg-violet-900 text-white p-3.5 rounded-lg space-y-1">
                <div className="text-[10px] uppercase font-bold text-violet-300">
                  {digestContent.hotelName}
                </div>
                <h4 className="text-sm font-bold">{digestContent.subject}</h4>
                <div className="text-[10px] text-violet-200">{digestContent.periodLabel}</div>
              </div>

              {/* S-1 Performance Block */}
              <div className="space-y-1.5">
                <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 text-xs">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>1. Bilan de la semaine écoulée (S-1)</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/60 dark:border-slate-800/70">
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">Taux d&apos;Occupation</div>
                    <div className="text-sm font-black text-slate-900 dark:text-slate-100 mt-0.5">{digestContent.pastWeek.occupancyPercent}%</div>
                    <div className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold">{digestContent.pastWeek.roomNightsSold} RN</div>
                  </div>
                  <div className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/60 dark:border-slate-800/70">
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">ADR Net Réalisé</div>
                    <div className="text-sm font-black text-slate-900 dark:text-slate-100 mt-0.5">{digestContent.pastWeek.adrEur} €</div>
                    <div className="text-[9px] text-slate-500 dark:text-slate-400">RevPAR {digestContent.pastWeek.revparEur}€</div>
                  </div>
                  <div className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/60 dark:border-slate-800/70">
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">Pickup 7 jours</div>
                    <div className="text-sm font-black text-emerald-700 dark:text-emerald-300 mt-0.5">+{digestContent.pastWeek.pickup7dRooms} ch.</div>
                    <div className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold">+14.8% vs budget</div>
                  </div>
                </div>
              </div>

              {/* S+1 Pricing Recommendations Table */}
              <div className="space-y-2">
                <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span>2. Recommandations tarifaires de la semaine à venir</span>
                  </span>
                  <span className="text-[10px] font-bold text-violet-700 dark:text-violet-300">5 dates ciblées</span>
                </div>

                <div className="space-y-2">
                  {digestContent.upcomingWeekRecommendations.map((rec) => (
                    <div
                      key={rec.dateStr}
                      className="p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-slate-100">{rec.dayOfWeek} {rec.dateStr.split('-').slice(1).join('/')}</span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[160px]">{rec.eventTitle}</span>
                        </div>
                        <div className="text-[10px] text-violet-700 dark:text-violet-300 font-medium mt-0.5">
                          {rec.strategyAction}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1.5 justify-end">
                          <span className="line-through text-slate-400 text-[11px]">{rec.currentBarEur}€</span>
                          <ArrowRight className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span className="font-black text-emerald-700 dark:text-emerald-300 text-xs">{rec.suggestedBarEur}€</span>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">+{rec.deltaEur}€ (+{rec.deltaPercent}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Yield Directives */}
              <div className="p-3 bg-violet-50/60 dark:bg-violet-950/40 rounded-lg border border-violet-200/80 dark:border-violet-800/70 space-y-1.5">
                <div className="font-bold text-violet-950 dark:text-violet-100 text-xs flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-violet-700 dark:text-violet-300" />
                  <span>3. Directives de yield prioritaires pour vos équipes</span>
                </div>
                <div className="space-y-1 text-[11px] text-slate-700 dark:text-slate-300">
                  {digestContent.yieldDirectives.map((d, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <span className="text-violet-600 dark:text-violet-400 font-bold">•</span>
                      <span><strong>{d.title}</strong> — {d.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Dernier envoi automatique : <strong>{config.lastSentAt || 'En attente du prochain lundi'}</strong>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Fermer
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              Enregistrer la configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

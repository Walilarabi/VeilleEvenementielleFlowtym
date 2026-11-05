/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  BellRing,
  CheckCircle2,
  X,
  Zap,
  TrendingUp,
  ArrowRight,
  ShieldAlert,
  Volume2,
  VolumeX,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import {
  PushOpportunityAlert,
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  triggerNativePushNotification,
  playChimeSound,
  SAMPLE_MAJOR_OPPORTUNITIES,
} from '../../services/pushNotificationService';

interface RateOpportunityPushNotificationProps {
  onNavigateToPricing: (alert: PushOpportunityAlert) => void;
  onApplyRecommendedRate?: (alert: PushOpportunityAlert) => void;
  onShowToast: (message: string) => void;
}

export const RateOpportunityPushNotification: React.FC<RateOpportunityPushNotificationProps> = ({
  onNavigateToPricing,
  onApplyRecommendedRate,
  onShowToast,
}) => {
  const [permission, setPermission] = useState<NotificationPermission>(getBrowserNotificationPermission());
  const [activeAlerts, setActiveAlerts] = useState<PushOpportunityAlert[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [progressPercent, setProgressPercent] = useState(100);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-detect and push an initial major opportunity alert on mount (after 1.8s) for demonstration
  useEffect(() => {
    const timer = setTimeout(() => {
      const initialAlert = SAMPLE_MAJOR_OPPORTUNITIES[0]; // SIAL Paris +120€
      triggerAlert(initialAlert);
    }, 1800);

    return () => clearTimeout(timer);
  }, []);

  const triggerAlert = (alert: PushOpportunityAlert) => {
    setActiveAlerts((prev) => {
      // Don't duplicate if already open
      if (prev.some((a) => a.id === alert.id)) return prev;
      return [alert, ...prev].slice(0, 3);
    });

    // Native browser push notification
    triggerNativePushNotification(alert);

    // Audio chime
    if (soundEnabled) {
      playChimeSound();
    }

    // Reset progress bar
    setProgressPercent(100);
  };

  const handleRequestPermission = async () => {
    const res = await requestBrowserNotificationPermission();
    setPermission(res);
    if (res === 'granted') {
      onShowToast('✓ Notifications navigateur autorisées !');
      // Fire a test alert
      triggerAlert(SAMPLE_MAJOR_OPPORTUNITIES[1]);
    } else if (res === 'denied') {
      onShowToast('Notifications bloquées par le navigateur. Vous pouvez les réactiver dans les paramètres de votre navigateur.');
    }
  };

  const handleDismiss = (id: string) => {
    setActiveAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const handleApply = (alert: PushOpportunityAlert) => {
    handleDismiss(alert.id);
    if (onApplyRecommendedRate) {
      onApplyRecommendedRate(alert);
    } else {
      onShowToast(`✓ Tarif conseillé de ${alert.recommendedRate}€ appliqué pour le ${alert.dateStr} (+${alert.gapEur}€)`);
    }
  };

  const handleConsult = (alert: PushOpportunityAlert) => {
    handleDismiss(alert.id);
    onNavigateToPricing(alert);
  };

  // Auto-dismiss the top alert after 12 seconds if not hovered
  useEffect(() => {
    if (activeAlerts.length === 0 || isHovered) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const duration = 12000;
    const stepTime = 100;
    const stepDecrement = (stepTime / duration) * 100;

    intervalRef.current = setInterval(() => {
      setProgressPercent((prev) => {
        if (prev <= 0) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setActiveAlerts((current) => current.slice(1));
          return 100;
        }
        return Math.max(0, prev - stepDecrement);
      });
    }, stepTime);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeAlerts.length, isHovered]);

  return (
    <aside
      aria-label="Alertes tarifaires push"
      className="fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm sm:max-w-md w-[calc(100%-2rem)] sm:w-full pointer-events-none"
    >
      {/* Browser Permission Prompt Banner (only when not granted and no critical alerts) */}
      {permission === 'default' && activeAlerts.length === 0 && (
        <div className="pointer-events-auto bg-white/95 backdrop-blur-md rounded-2xl border border-violet-200 p-3 shadow-lg flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
              <BellRing className="w-4 h-4 animate-bounce" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 leading-tight">
                Alertes Push Opportunités
              </p>
              <p className="text-[10px] text-slate-500">
                Recevez les hausses de tarifs en direct
              </p>
            </div>
          </div>
          <button
            onClick={handleRequestPermission}
            className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors shrink-0 cursor-pointer"
          >
            Activer
          </button>
        </div>
      )}

      {/* Quick Test / Status trigger bar for the user */}
      <div className="pointer-events-auto flex items-center justify-end gap-1.5 self-end">
        {permission === 'granted' && (
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-2xs backdrop-blur-sm">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Push Navigateur Actif</span>
          </span>
        )}
        {permission === 'denied' && (
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-medium px-2 py-0.5 rounded-full shadow-2xs">
            <span>Push Navigateur Bloqué</span>
          </span>
        )}
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="p-1.5 bg-white/90 hover:bg-white text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg text-[10px] shadow-2xs transition-colors cursor-pointer"
          title={soundEnabled ? 'Désactiver le son des alertes' : 'Activer le son des alertes'}
        >
          {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-violet-600" /> : <VolumeX className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={() => {
            const nextIdx = Math.floor(Math.random() * SAMPLE_MAJOR_OPPORTUNITIES.length);
            triggerAlert(SAMPLE_MAJOR_OPPORTUNITIES[nextIdx]);
          }}
          className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/90 hover:bg-white text-violet-700 border border-violet-200 rounded-lg text-[11px] font-bold shadow-2xs transition-colors cursor-pointer"
          title="Simuler une nouvelle alerte push d'opportunité tarifaire majeure"
        >
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span>Simuler Alerte Push</span>
        </button>
      </div>

      {/* Active Notification Cards */}
      {activeAlerts.map((alert, index) => (
        <div
          key={alert.id}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={`pointer-events-auto bg-white/95 backdrop-blur-md rounded-2xl border-2 border-rose-400 shadow-2xl p-4 transition-all duration-300 relative overflow-hidden animate-in slide-in-from-top-3 fade-in ${
            index === 0 ? 'scale-100 opacity-100 ring-4 ring-rose-500/20' : 'scale-95 opacity-90'
          }`}
        >
          {/* Progress bar for auto-dismiss (only on top card) */}
          {index === 0 && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-slate-100">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-rose-600 transition-all duration-100 ease-linear"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}

          {/* Header with Urgency & Gain */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600" />
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 flex items-center gap-1">
                <Zap className="w-3 h-3 text-rose-600" />
                <span>Opportunité Tarifaire Majeure</span>
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-lg border border-emerald-300 tabular-nums">
                +{alert.gapEur}€ ({alert.gapPercent > 0 ? `+${alert.gapPercent.toFixed(0)}%` : ''})
              </span>
              <button
                onClick={() => handleDismiss(alert.id)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Fermer la notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Event Title & Date */}
          <div className="mt-2.5">
            <h4 className="text-sm font-bold text-slate-900 leading-snug">
              {alert.title}
            </h4>
            <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
              <span className="font-semibold text-slate-700">{alert.dateStr}</span>
              <span>·</span>
              <span className="truncate">{alert.venueName}</span>
            </div>
          </div>

          {/* Pricing Leap & Demand Details */}
          <div className="mt-3 p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Tarif Vendu vs Recommandé :</span>
              <div className="flex items-center gap-2">
                <span className="line-through text-slate-400 font-semibold tabular-nums">{alert.currentRate}€</span>
                <ArrowRight className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-sm font-black text-emerald-700 tabular-nums bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {alert.recommendedRate}€
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60">
              <span className="text-slate-600">Niveau de demande :</span>
              <span className="font-bold text-rose-700 bg-rose-100/60 px-1.5 py-0.5 rounded">
                {alert.demandLevel} ({alert.demandPercent}%)
              </span>
            </div>
          </div>

          {/* Context Reason */}
          <p className="mt-2 text-xs text-slate-600 leading-relaxed bg-amber-50/60 border border-amber-200/60 p-2 rounded-xl">
            {alert.reason}
          </p>

          {/* Actions */}
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => handleConsult(alert)}
              className="flex-1 py-2 px-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Consulter Recommandation</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleApply(alert)}
              className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
              title="Appliquer immédiatement ce tarif conseillé"
            >
              Appliquer (+{alert.gapEur}€)
            </button>
          </div>
        </div>
      ))}
    </aside>
  );
};

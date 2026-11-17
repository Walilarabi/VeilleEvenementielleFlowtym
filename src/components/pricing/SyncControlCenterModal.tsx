/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Centre de Contrôle de Synchronisation Bidirectionnelle, Planifications Futures,
 * Résolution de Conflits et Journaux Techniques Filtrables.
 */

import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Play,
  RefreshCw,
  ScrollText,
  Trash2,
  X,
} from 'lucide-react';
import {
  ConnectorSyncLog,
  Hotel,
  RateCalendarCell,
  RateSyncConflict,
  ScheduledRateChange,
} from '../../types';
import {
  fetchSyncLogsForHotel,
  getScheduledRateChanges,
  updateScheduledRateChangeStatus,
} from '../../services/connectors/connectorRegistry';
import {
  applyBulkEditInPlanning,
  dispatchOutboundPush,
  pullExternalUpdatesInPlanning,
  resolveRateConflictInPlanning,
  retryFailedCellSync,
} from '../../services/ratePlanningSyncService';
import { getHotelTariffConfig } from '../../services/tariffConfigurationService';

interface SyncControlCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  hotel: Hotel;
  cells: RateCalendarCell[];
  conflicts: RateSyncConflict[];
  initialTab?: 'control' | 'conflicts' | 'logs' | 'scheduled';
  onUpdated: () => void;
  onShowToast?: (msg: string) => void;
}

export const SyncControlCenterModal: React.FC<SyncControlCenterModalProps> = ({
  isOpen,
  onClose,
  hotel,
  cells,
  conflicts,
  initialTab = 'control',
  onUpdated,
  onShowToast,
}) => {
  const [tab, setTab] = useState<'control' | 'conflicts' | 'logs' | 'scheduled'>(initialTab);
  const [logs, setLogs] = useState<ConnectorSyncLog[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledRateChange[]>([]);
  const [busy, setBusy] = useState(false);

  // Filtres logs techniques
  const [filterProvider, setFilterProvider] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterOpType, setFilterOpType] = useState('all');
  const [filterRoom, setFilterRoom] = useState('all');
  const [filterPlan, setFilterPlan] = useState('all');
  const [filterDate, setFilterDate] = useState('');

  const cfg = getHotelTariffConfig(hotel);

  const loadData = async () => {
    const fetchedLogs = await fetchSyncLogsForHotel(hotel.id, {
      providerId: filterProvider,
      status: filterStatus,
      operationType: filterOpType,
      roomTypeCode: filterRoom,
      ratePlanCode: filterPlan,
      date: filterDate || undefined,
    });
    setLogs(fetchedLogs);
    setScheduled(getScheduledRateChanges(hotel.id));
  };

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      void loadData();
    }
  }, [isOpen, initialTab, hotel.id]);

  if (!isOpen) return null;

  const unsyncedCells = cells.filter(
    (c) =>
      c.syncStatus === 'saved_local' ||
      c.syncStatus === 'queued' ||
      c.syncStatus === 'pending' ||
      c.syncStatus === 'failed' ||
      c.syncStatus === 'rejected'
  );
  const failedCells = cells.filter((c) => c.syncStatus === 'failed' || c.syncStatus === 'rejected');
  const openConflicts = conflicts.filter((c) => c.status === 'open');

  const handleManualPushAllPending = async () => {
    if (unsyncedCells.length === 0) {
      onShowToast?.('Aucune cellule en attente d’envoi.');
      return;
    }
    setBusy(true);
    const res = await dispatchOutboundPush(
      hotel,
      unsyncedCells.slice(0, 120),
      'flowtym_manual',
      'sync_retry',
      'Wali Larabi (Centre de Synchro)',
      `Synchronisation manuelle groupée (${unsyncedCells.length} cellules)`
    );
    setBusy(false);
    await loadData();
    onUpdated();
    onShowToast?.(`Push terminé : ${res.syncedCount} confirmée(s), ${res.failedCount} échec(s).`);
  };

  const handlePull = async () => {
    setBusy(true);
    const res = await pullExternalUpdatesInPlanning(hotel);
    setBusy(false);
    await loadData();
    onUpdated();
    onShowToast?.(`Pull terminé : ${res.importedCount} mise(s) à jour externe(s) intégrée(s).`);
  };

  const handleExecuteScheduled = async (item: ScheduledRateChange) => {
    setBusy(true);
    await applyBulkEditInPlanning(
      hotel,
      {
        startDate: item.dateFrom,
        endDate: item.dateTo,
        roomTypeCodes: item.roomCategoryCodes,
        ratePlanCodes: item.ratePlanCodes,
        adjustmentMode:
          item.adjustmentMode === 'fixed_price'
            ? 'fixed'
            : item.adjustmentMode === 'inventory_set'
            ? 'inventory_set'
            : item.adjustmentMode === 'delta_pct'
            ? 'delta_pct'
            : 'delta_eur',
        value: item.adjustmentValue,
        weekdays: item.weekdays,
        inventoryAvailable: item.inventoryValue ?? undefined,
        minStay: item.minStay ?? undefined,
        isClosed: item.stopSell ?? undefined,
        cascadeDerivedPlans: true,
        reason: `Exécution planifiée (${item.scopeLabel})`,
      },
      item.actor
    );
    setScheduled(updateScheduledRateChangeStatus(hotel.id, item.id, 'executed', 'Exécuté manuellement'));
    setBusy(false);
    await loadData();
    onUpdated();
    onShowToast?.(`Modification planifiée « ${item.scopeLabel} » exécutée.`);
  };

  const filteredLogs = logs.filter((l) => {
    if (filterProvider !== 'all' && l.providerId !== filterProvider) return false;
    if (filterStatus !== 'all' && l.status !== filterStatus) return false;
    if (filterOpType !== 'all' && l.operationType !== filterOpType) return false;
    if (filterRoom !== 'all' && l.roomTypeCode !== filterRoom) return false;
    if (filterPlan !== 'all' && l.ratePlanCode !== filterPlan) return false;
    if (filterDate && !l.createdAt.startsWith(filterDate)) return false;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Centre de Contrôle de Synchronisation &amp; Journaux Techniques — {hotel.name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Pilotage bidirectionnel (Push / Pull / Retry), résolution des conflits, modifications planifiées &amp; traçabilité complète
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-nav */}
        <div className="px-6 py-2.5 bg-slate-50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-2 text-xs font-semibold">
          {[
            { id: 'control', label: `Pilotage & Queue (${unsyncedCells.length})` },
            { id: 'conflicts', label: `Conflits ouverts (${openConflicts.length})` },
            { id: 'scheduled', label: `Modifications planifiées (${scheduled.filter((s) => s.status === 'scheduled').length})` },
            { id: 'logs', label: `Journaux Techniques (${filteredLogs.length})` },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as any)}
              className={`px-3.5 py-1.5 rounded-lg cursor-pointer ${
                tab === t.id
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {tab === 'control' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] text-slate-500">Total cellules suivies</div>
                  <div className="text-xl font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                    {cells.length}
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] text-slate-500">Enregistrées / En attente</div>
                  <div className="text-xl font-mono font-bold text-amber-600 tabular-nums">
                    {unsyncedCells.length}
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] text-slate-500">Échecs / Rejets</div>
                  <div className="text-xl font-mono font-bold text-rose-600 tabular-nums">
                    {failedCells.length}
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] text-slate-500">Conflits ouverts</div>
                  <div className="text-xl font-mono font-bold text-rose-600 tabular-nums">
                    {openConflicts.length}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleManualPushAllPending}
                  className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>Envoyer les modifications en attente ({unsyncedCells.length})</span>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handlePull}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  <span>Récupérer les mises à jour PMS / CM (Pull)</span>
                </button>
              </div>

              {failedCells.length > 0 && (
                <div className="border border-rose-200 dark:border-rose-800 rounded-xl overflow-hidden">
                  <div className="px-4 py-2 bg-rose-50 dark:bg-rose-950/40 font-bold text-rose-900 dark:text-rose-200">
                    Cellules en échec ou rejetées — Relance individuelle
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-60 overflow-y-auto">
                    {failedCells.slice(0, 30).map((cell) => (
                      <div key={cell.cellKey} className="px-4 py-2.5 flex items-center justify-between gap-3">
                        <div>
                          <div className="font-bold text-slate-900 dark:text-slate-100">
                            {cell.roomTypeName} · {cell.ratePlanCode} · <span className="font-mono">{cell.stayDate}</span> ({cell.currentRateEur}€)
                          </div>
                          <div className="text-[11px] text-rose-600 dark:text-rose-400">
                            {cell.syncErrorMessage || 'Erreur de transmission'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            await retryFailedCellSync(hotel, cell.cellKey);
                            await loadData();
                            onUpdated();
                          }}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Relancer</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'conflicts' && (
            <div className="space-y-3">
              {openConflicts.length === 0 ? (
                <div className="p-8 text-center border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                  Aucun conflit ouvert entre FLOWTYM et les systèmes externes.
                </div>
              ) : (
                openConflicts.map((conf) => (
                  <div
                    key={conf.id}
                    className="p-4 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/40 dark:bg-rose-950/20 flex flex-wrap items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                        <span>
                          {conf.roomTypeName} · {conf.ratePlanCode} · <span className="font-mono">{conf.stayDate}</span>
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-300">
                        FLOWTYM : <strong className="font-mono">{conf.flowtymRateEur}€</strong> ({conf.flowtymActor}) vs{' '}
                        {conf.externalSource.toUpperCase()} : <strong className="font-mono">{conf.externalRateEur}€</strong> ({conf.externalActor})
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await resolveRateConflictInPlanning(hotel, conf.id, 'keep_flowtym');
                          await loadData();
                          onUpdated();
                          onShowToast?.(`Conflit résolu : tarif FLOWTYM (${conf.flowtymRateEur}€) conservé.`);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-violet-600 text-white font-bold cursor-pointer"
                      >
                        Conserver FLOWTYM ({conf.flowtymRateEur}€)
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await resolveRateConflictInPlanning(hotel, conf.id, 'adopt_external');
                          await loadData();
                          onUpdated();
                          onShowToast?.(`Conflit résolu : tarif externe (${conf.externalRateEur}€) adopté.`);
                        }}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold cursor-pointer"
                      >
                        Adopter Externe ({conf.externalRateEur}€)
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'scheduled' && (
            <div className="space-y-3">
              {scheduled.length === 0 ? (
                <div className="p-8 text-center border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500">
                  <CalendarClock className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                  Aucune modification tarifaire planifiée. Utilisez « Modification en masse → Planifier dans le futur ».
                </div>
              ) : (
                scheduled.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        {item.scopeLabel} · Exécution prévue : <span className="font-mono">{item.scheduledForIso.replace('T', ' ').slice(0, 16)}</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Période {item.dateFrom} → {item.dateTo} · Plans : {item.ratePlanCodes.join(', ')} · Statut :{' '}
                        <strong className="uppercase">{item.status}</strong>
                      </div>
                    </div>
                    {item.status === 'scheduled' && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleExecuteScheduled(item)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Play className="w-3 h-3" />
                          <span>Exécuter maintenant</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setScheduled(updateScheduledRateChangeStatus(hotel.id, item.id, 'cancelled'))}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'logs' && (
            <div className="space-y-3">
              {/* Filtres journaux techniques */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                <select
                  value={filterProvider}
                  onChange={(e) => setFilterProvider(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                >
                  <option value="all">Tous fournisseurs</option>
                  <option value="dedge">D-EDGE</option>
                  <option value="opera_cloud">Opera Cloud</option>
                  <option value="mews">Mews</option>
                  <option value="siteminder">SiteMinder</option>
                  <option value="lighthouse">Lighthouse</option>
                </select>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                >
                  <option value="all">Tous statuts</option>
                  <option value="synced">Confirmé (Synced)</option>
                  <option value="failed">Échec (Failed)</option>
                  <option value="conflict">Conflit</option>
                  <option value="queued">En attente</option>
                </select>
                <select
                  value={filterOpType}
                  onChange={(e) => setFilterOpType(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                >
                  <option value="all">Toutes opérations</option>
                  <option value="push_rates">Push Tarifs</option>
                  <option value="pull_rates">Pull Tarifs</option>
                  <option value="excel_import">Import Excel</option>
                  <option value="test_read">Test Lecture</option>
                  <option value="test_write">Test Écriture</option>
                  <option value="test_connection">Test Connexion</option>
                </select>
                <select
                  value={filterRoom}
                  onChange={(e) => setFilterRoom(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                >
                  <option value="all">Toutes chambres</option>
                  {cfg.roomCategories.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <select
                  value={filterPlan}
                  onChange={(e) => setFilterPlan(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                >
                  <option value="all">Tous plans</option>
                  {cfg.ratePlans.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.code}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                />
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-800/70 text-[11px] font-semibold text-slate-600 dark:text-slate-300 sticky top-0">
                    <tr>
                      <th className="px-3 py-2">Horodatage</th>
                      <th className="px-3 py-2">Fournisseur</th>
                      <th className="px-3 py-2">Opération</th>
                      <th className="px-3 py-2">Chambre / Plan</th>
                      <th className="px-3 py-2">Statut</th>
                      <th className="px-3 py-2">Traçabilité / ACK</th>
                      <th className="px-3 py-2">Détail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                    {filteredLogs.map((l) => (
                      <tr key={l.id}>
                        <td className="px-3 py-2 font-mono whitespace-nowrap">
                          {l.createdAt.slice(0, 19).replace('T', ' ')}
                        </td>
                        <td className="px-3 py-2 font-semibold">{l.providerName}</td>
                        <td className="px-3 py-2 font-mono">{l.operationType}</td>
                        <td className="px-3 py-2 font-mono">
                          {l.roomTypeCode || '—'} / {l.ratePlanCode || '—'}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`px-2 py-0.5 rounded font-semibold ${
                              l.status === 'synced'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                                : l.status === 'conflict'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300'
                            }`}
                          >
                            {l.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-500">{l.traceabilityId}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{l.message}</td>
                      </tr>
                    ))}
                    {filteredLogs.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
                          <ScrollText className="w-5 h-5 mx-auto mb-1 opacity-50" />
                          Aucun journal technique pour ces critères.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

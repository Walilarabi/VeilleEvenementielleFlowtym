/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Centre Universel de Gestion des Connecteurs (PMS, Channel Manager, Rate Shopper, API Custom)
 * Secrets chiffrés côté serveur (AES-256-GCM), tests Read/Write/Webhook, Sandbox vs Production.
 */

import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Lock,
  Plug,
  Plus,
  Radio,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  ConnectorFamily,
  ConnectorInstance,
  ConnectorProviderId,
  ConnectorTestResult,
  Hotel,
} from '../../types';
import {
  CONNECTOR_PROVIDERS,
  executeConnectorTest,
  fetchConnectorsForHotel,
  getCachedConnectorsForHotel,
  getProviderDefinition,
  saveConnectorOnServer,
  deleteConnectorOnServer,
} from '../../services/connectors/connectorRegistry';

interface UniversalConnectorCenterProps {
  hotel: Hotel;
  onShowToast?: (msg: string) => void;
  actorRole?: string;
}

export const UniversalConnectorCenter: React.FC<UniversalConnectorCenterProps> = ({
  hotel,
  onShowToast,
  actorRole = 'admin',
}) => {
  const [connectors, setConnectors] = useState<ConnectorInstance[]>(() =>
    getCachedConnectorsForHotel(hotel.id)
  );
  const [selectedId, setSelectedId] = useState<string>(() => getCachedConnectorsForHotel(hotel.id)[0]?.id || '');
  const [familyFilter, setFamilyFilter] = useState<'all' | ConnectorFamily>('all');
  const [plainSecretsDraft, setPlainSecretsDraft] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<ConnectorTestResult | null>(null);
  const [testingType, setTestingType] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newProviderId, setNewProviderId] = useState<ConnectorProviderId>('dedge');

  useEffect(() => {
    let mounted = true;
    void fetchConnectorsForHotel(hotel.id).then((list) => {
      if (!mounted) return;
      setConnectors(list);
      if (list.length > 0 && !list.some((c) => c.id === selectedId)) {
        setSelectedId(list[0].id);
      }
      setPlainSecretsDraft({});
      setTestResult(null);
    });
    return () => {
      mounted = false;
    };
  }, [hotel.id]);

  const activeConnector = connectors.find((c) => c.id === selectedId) || connectors[0] || null;
  const providerDef = activeConnector ? getProviderDefinition(activeConnector.providerId) : null;

  const updateActive = (patch: Partial<ConnectorInstance>) => {
    if (!activeConnector) return;
    setConnectors((prev) =>
      prev.map((c) => (c.id === activeConnector.id ? { ...c, ...patch } : c))
    );
  };

  const handleSave = async () => {
    if (!activeConnector) return;
    setSaving(true);
    const res = await saveConnectorOnServer(hotel.id, activeConnector, plainSecretsDraft, actorRole);
    setSaving(false);
    if (!res.success) {
      onShowToast?.(res.error || 'Erreur lors de la sauvegarde du connecteur.');
      return;
    }
    setConnectors((prev) => prev.map((c) => (c.id === res.connector.id ? res.connector : c)));
    setPlainSecretsDraft({});
    onShowToast?.(
      `Connecteur « ${res.connector.displayName} » enregistré (${res.connector.executionMode === 'live_api' ? 'Production Live' : 'Sandbox sécurisée'}).`
    );
  };

  const handleRunTest = async (testType: 'connection' | 'read' | 'write' | 'webhook') => {
    if (!activeConnector) return;
    setTestingType(testType);
    // Sauvegarder d'abord si des secrets ou champs ont été saisis
    if (Object.keys(plainSecretsDraft).length > 0) {
      await saveConnectorOnServer(hotel.id, activeConnector, plainSecretsDraft, actorRole);
      setPlainSecretsDraft({});
    }
    const res = await executeConnectorTest(hotel.id, activeConnector.id, testType);
    setTestingType(null);
    setTestResult(res);
    const now = res.testedAt || new Date().toISOString();
    updateActive({
      lastReadTestAt: testType === 'read' && res.success ? now : activeConnector.lastReadTestAt,
      lastWriteTestAt: testType === 'write' && res.success ? now : activeConnector.lastWriteTestAt,
      lastError: res.success ? null : res.message,
    });
    onShowToast?.(res.message);
  };

  const handleAddConnector = async () => {
    const def = getProviderDefinition(newProviderId);
    const now = new Date().toISOString();
    const created: ConnectorInstance = {
      id: `conn-${hotel.id}-${def.providerId}-${Date.now().toString().slice(-4)}`,
      hotelId: hotel.id,
      family: def.family,
      providerId: def.providerId,
      providerName: def.name,
      displayName: def.name,
      environment: 'sandbox',
      authType: def.defaultAuthType,
      endpointUrl: def.defaultEndpointPlaceholder,
      hotelExternalCode: '',
      webhookUrl: '/api/webhooks/external-ari',
      webhookSecretMasked: '',
      hasWebhookSecret: false,
      credentials: def.fields.map((f) => ({
        keyName: f.key,
        label: f.label,
        isSecret: f.isSecret,
        hasValue: false,
        maskedPreview: '',
        updatedAt: now,
      })),
      activeSyncMode: def.defaultCapabilities.supportsWebhooks ? 'realtime_webhook' : 'scheduled',
      pollingIntervalMinutes: 15,
      autoSyncEnabled: false,
      capabilities: { ...def.defaultCapabilities },
      isActive: true,
      isPrimaryForFamily: !connectors.some((c) => c.family === def.family),
      connectionStatus: 'unconfigured',
      executionMode: 'sandbox_simulation',
      lastReadTestAt: null,
      lastWriteTestAt: null,
      lastSyncAt: null,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    };
    const res = await saveConnectorOnServer(hotel.id, created, {}, actorRole);
    setConnectors((prev) => [...prev, res.connector]);
    setSelectedId(res.connector.id);
    setIsAddOpen(false);
    onShowToast?.(`Connecteur ${def.name} ajouté à ${hotel.name}.`);
  };

  const handleDelete = async (id: string) => {
    await deleteConnectorOnServer(hotel.id, id, actorRole);
    const next = connectors.filter((c) => c.id !== id);
    setConnectors(next);
    if (selectedId === id) setSelectedId(next[0]?.id || '');
    onShowToast?.('Connecteur retiré.');
  };

  const filteredList = connectors.filter((c) => familyFilter === 'all' || c.family === familyFilter);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-violet-700 dark:text-violet-300">
            <Plug className="w-4 h-4" />
            <span>Architecture Modulaire Universelle · Découplée des fournisseurs</span>
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Centre de Connecteurs PMS, Channel Manager &amp; Rate Shopper — {hotel.name}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Tous les secrets API sont chiffrés côté serveur (AES-256-GCM) et masqués après saisie. Mode Sandbox contrôlé actif tant que les clés de production ne sont pas renseignées.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddOpen((v) => !v)}
          className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Ajouter un connecteur</span>
        </button>
      </div>

      {/* Panneau ajout */}
      {isAddOpen && (
        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-wrap items-end justify-between gap-3 text-xs">
          <div className="flex-1 min-w-[260px]">
            <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
              Choisir un fournisseur PMS / Channel Manager / Rate Shopper
            </label>
            <select
              value={newProviderId}
              onChange={(e) => setNewProviderId(e.target.value as ConnectorProviderId)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            >
              <optgroup label="Channel Managers (D-EDGE Prioritaire)">
                {CONNECTOR_PROVIDERS.filter((p) => p.family === 'channel_manager').map((p) => (
                  <option key={p.providerId} value={p.providerId}>
                    {p.name} {p.isPriority ? '★ Prioritaire' : ''}
                  </option>
                ))}
              </optgroup>
              <optgroup label="PMS (Property Management Systems)">
                {CONNECTOR_PROVIDERS.filter((p) => p.family === 'pms').map((p) => (
                  <option key={p.providerId} value={p.providerId}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Rate Shoppers">
                {CONNECTOR_PROVIDERS.filter((p) => p.family === 'rate_shopper').map((p) => (
                  <option key={p.providerId} value={p.providerId}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleAddConnector}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
            >
              Créer le connecteur
            </button>
          </div>
        </div>
      )}

      {/* Split Master/Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Liste des connecteurs */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold">
            {[
              { id: 'all', label: 'Tous' },
              { id: 'channel_manager', label: 'Channel Mgr' },
              { id: 'pms', label: 'PMS' },
              { id: 'rate_shopper', label: 'Rate Shopper' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFamilyFilter(f.id as any)}
                className={`px-2.5 py-1.5 rounded-lg cursor-pointer ${
                  familyFilter === f.id
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                    : 'border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {filteredList.map((conn) => {
              const selected = activeConnector?.id === conn.id;
              return (
                <button
                  key={conn.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(conn.id);
                    setPlainSecretsDraft({});
                    setTestResult(null);
                  }}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                    selected
                      ? 'border-violet-500 bg-violet-50/70 dark:bg-violet-950/30'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {conn.displayName}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        conn.executionMode === 'live_api'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      }`}
                    >
                      {conn.executionMode === 'live_api' ? 'LIVE PROD' : 'SANDBOX'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="uppercase font-mono">{conn.family.replace('_', ' ')}</span>
                    <span className="font-mono">{conn.hotelExternalCode || 'Non configuré'}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Détail & Configuration du connecteur sélectionné */}
        {activeConnector && providerDef && (
          <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-5 text-xs">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {activeConnector.displayName}
                  </h4>
                  {providerDef.isPriority && (
                    <span className="px-2 py-0.5 rounded bg-violet-100 dark:bg-violet-950/60 text-violet-800 dark:text-violet-300 text-[10px] font-bold">
                      Prioritaire
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{providerDef.description}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDelete(activeConnector.id)}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-rose-600 cursor-pointer"
                  title="Supprimer ce connecteur"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSave}
                  className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{saving ? 'Chiffrement...' : 'Enregistrer (Chiffré Serveur)'}</span>
                </button>
              </div>
            </div>

            {/* Environnement, Code Hôtel & URL */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Environnement
                </label>
                <select
                  value={activeConnector.environment}
                  onChange={(e) => updateActive({ environment: e.target.value as 'sandbox' | 'production' })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                >
                  <option value="sandbox">Sandbox / Test (Simulation contrôlée)</option>
                  <option value="production">Production (API Live si secrets présents)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Code Établissement Externe
                </label>
                <input
                  type="text"
                  value={activeConnector.hotelExternalCode}
                  onChange={(e) => updateActive({ hotelExternalCode: e.target.value })}
                  placeholder="H2258 / PARFO"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Mode de Synchronisation
                </label>
                <select
                  value={activeConnector.activeSyncMode}
                  onChange={(e) => updateActive({ activeSyncMode: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                >
                  <option value="realtime_webhook">Temps réel (API + Webhooks)</option>
                  <option value="scheduled">Polling planifié ({activeConnector.pollingIntervalMinutes} min)</option>
                  <option value="manual">Validation manuelle stricte</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Endpoint API Externe
                </label>
                <input
                  type="url"
                  value={activeConnector.endpointUrl}
                  onChange={(e) => updateActive({ endpointUrl: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  URL Webhook Entrante FLOWTYM
                </label>
                <input
                  type="text"
                  value={activeConnector.webhookUrl}
                  onChange={(e) => updateActive({ webhookUrl: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs"
                />
              </div>
            </div>

            {/* Identifiants & Secrets chiffrés */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Identifiants &amp; Secrets (Coffre-fort Serveur AES-256-GCM)</span>
                </div>
                <span className="text-[10px] text-slate-500">
                  Jamais réaffichés en clair après sauvegarde
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {providerDef.fields.map((field) => {
                  const cred = activeConnector.credentials.find((c) => c.keyName === field.key);
                  const draftVal = plainSecretsDraft[field.key] ?? '';
                  return (
                    <div key={field.key}>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 flex items-center justify-between">
                        <span>{field.label}</span>
                        {field.isSecret && cred?.hasValue && (
                          <span className="font-mono text-[10px] text-emerald-700 dark:text-emerald-300">
                            Enregistré : {cred.maskedPreview || '••••••••'}
                          </span>
                        )}
                      </label>
                      <div className="relative">
                        <input
                          type={field.isSecret ? 'password' : 'text'}
                          value={
                            draftVal ||
                            (!field.isSecret ? cred?.maskedPreview || '' : '')
                          }
                          onChange={(e) =>
                            setPlainSecretsDraft((prev) => ({
                              ...prev,
                              [field.key]: e.target.value,
                            }))
                          }
                          placeholder={
                            field.isSecret && cred?.hasValue
                              ? 'Laisser vide pour conserver le secret chiffré actuel'
                              : field.placeholder
                          }
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs"
                        />
                        {field.isSecret && (
                          <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Matrice des capacités */}
            <div className="space-y-2">
              <div className="font-bold text-slate-900 dark:text-slate-100">
                Matrice de Capacités du Connecteur (Modèle Central FLOWTYM)
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-[11px]">
                {[
                  { key: 'readRates', label: 'Lecture Tarifs' },
                  { key: 'writeRates', label: 'Écriture Tarifs' },
                  { key: 'readInventory', label: 'Lecture Stock' },
                  { key: 'writeInventory', label: 'Écriture Stock' },
                  { key: 'writeRestrictions', label: 'Restrictions ARI' },
                  { key: 'importRoomTypes', label: 'Import Chambres' },
                  { key: 'importRatePlans', label: 'Import Plans' },
                  { key: 'supportsWebhooks', label: 'Webhooks' },
                  { key: 'supportsPolling', label: 'Polling' },
                  { key: 'supportsDeltaSync', label: 'Delta Sync' },
                ].map((cap) => {
                  const enabled = Boolean((activeConnector.capabilities as any)?.[cap.key]);
                  return (
                    <label
                      key={cap.key}
                      className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 cursor-pointer ${
                        enabled
                          ? 'border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200'
                          : 'border-slate-200 dark:border-slate-800 text-slate-400'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) =>
                          updateActive({
                            capabilities: {
                              ...activeConnector.capabilities,
                              [cap.key]: e.target.checked,
                            },
                          })
                        }
                        className="rounded text-emerald-600"
                      />
                      <span className="truncate font-medium">{cap.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Tests de connectivité (Connexion / Lecture / Écriture / Webhook) */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { id: 'connection', label: 'Tester Connexion', icon: Radio },
                  { id: 'read', label: 'Tester Lecture (Read)', icon: RefreshCw },
                  { id: 'write', label: 'Tester Écriture (Write)', icon: Upload },
                  { id: 'webhook', label: 'Vérifier Webhook', icon: Activity },
                ].map((btn) => {
                  const Icon = btn.icon;
                  const running = testingType === btn.id;
                  return (
                    <button
                      key={btn.id}
                      type="button"
                      disabled={Boolean(testingType)}
                      onClick={() => handleRunTest(btn.id as any)}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Icon className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} />
                      <span>{btn.label}</span>
                    </button>
                  );
                })}
              </div>

              {testResult && (
                <div
                  className={`p-3.5 rounded-xl border flex items-start gap-2.5 ${
                    testResult.success
                      ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200'
                      : 'border-rose-200 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  )}
                  <div className="space-y-0.5">
                    <div className="font-bold">
                      {testResult.message}
                    </div>
                    <div className="text-[11px] font-mono opacity-80">
                      Mode : {testResult.executionMode} · Traçabilité : {testResult.traceabilityId} · Latence : {testResult.latencyMs}ms
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

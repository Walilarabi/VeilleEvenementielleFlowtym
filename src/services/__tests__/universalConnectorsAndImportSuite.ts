/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Suite de Tests Automatisés — Connecteurs Universels, Coffre-Fort Secrets,
 * Import Excel D-EDGE 6 étapes, Vérité 4 Sources & Planning 365j.
 */

import { INITIAL_HOTELS as HOTELS } from '../../data/mockData';
import {
  analyzeSpreadsheetBuffer,
  buildSampleDedgePlanningWorkbook,
  executeDedgeImport,
  generateDedgeImportDiff,
  getImportMappingTemplates,
  saveImportMappingTemplate,
} from '../connectors/dedgeExcelImportEngine';
import {
  CONNECTOR_PROVIDERS,
  buildDefaultConnectorsForHotel,
  getScheduledRateChanges,
  saveScheduledRateChange,
  updateScheduledRateChangeStatus,
} from '../connectors/connectorRegistry';
import {
  applyBulkEditInPlanning,
  buildCellKey,
  dispatchOutboundPush,
  duplicateRoomRatesInPlanning,
  ensurePlanningCellsForDateRange,
  getRatePlanningCells,
  updateCellManuallyInPlanning,
} from '../ratePlanningSyncService';
import { getHotelTariffConfig } from '../tariffConfigurationService';
import { getTodayIsoDate, addDaysIso } from '../../utils/eventFilterUtils';

function ensureLocalStorageShim(): void {
  if (typeof (globalThis as any).localStorage !== 'undefined') return;
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => {
      store.clear();
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

export interface SuiteTestResult {
  id: number;
  name: string;
  passed: boolean;
  details: string;
}

export async function runUniversalConnectorsAndImportSuite(
  baseUrl: string = 'http://127.0.0.1:3000'
): Promise<{ passedCount: number; total: number; results: SuiteTestResult[] }> {
  ensureLocalStorageShim();
  const hotel = HOTELS[0];
  const today = getTodayIsoDate();
  const results: SuiteTestResult[] = [];

  const runCase = async (id: number, name: string, fn: () => void | Promise<void>) => {
    try {
      await fn();
      results.push({ id, name, passed: true, details: 'OK' });
    } catch (err: any) {
      results.push({ id, name, passed: false, details: err?.message || String(err) });
    }
  };

  // TEST 1 : Catalogue universel 3 familles (PMS, Channel Manager, Rate Shopper)
  await runCase(1, 'Registre universel : 3 familles et D-EDGE prioritaire avec capacités déclarées', () => {
    const families = new Set(CONNECTOR_PROVIDERS.map((p) => p.family));
    assert(families.has('pms'), 'Famille PMS présente');
    assert(families.has('channel_manager'), 'Famille Channel Manager présente');
    assert(families.has('rate_shopper'), 'Famille Rate Shopper présente');
    const dedge = CONNECTOR_PROVIDERS.find((p) => p.providerId === 'dedge');
    assert(Boolean(dedge && dedge.isPriority), 'D-EDGE marqué prioritaire');
    assert(Boolean(dedge?.defaultCapabilities.supportsWebhooks && dedge?.defaultCapabilities.writeRates), 'Capacités D-EDGE déclarées');
  });

  // TEST 2 : Parseur D-EDGE Planning Excel (.xlsx) : Price (EUR) vs Left for sale + cellules chambre implicites
  await runCase(2, 'Import Excel D-EDGE : séparation Price (EUR) vs Left for sale et héritage cellule vide', () => {
    const bytes = buildSampleDedgePlanningWorkbook(today, 10);
    const analysis = analyzeSpreadsheetBuffer(bytes, 'H2258 - FOLKESTONE OPERA - Planning.xlsx', hotel);
    assert(analysis.detectedProvider === 'dedge_planning', `Provider détecté: ${analysis.detectedProvider}`);
    assert(analysis.dateRange.totalDates === 10, `10 dates détectées (obtenu ${analysis.dateRange.totalDates})`);
    const rateRecords = analysis.records.filter((r) => r.metricType === 'rate' && r.isValid);
    const invRecords = analysis.records.filter((r) => r.metricType === 'inventory' && r.isValid);
    assert(rateRecords.length === 60, `60 tarifs attendus (obtenu ${rateRecords.length})`);
    assert(invRecords.length === 30, `30 stocks Left for sale attendus (obtenu ${invRecords.length})`);
    assert(invRecords.every((r) => r.externalRoomLabel.length > 0), 'Héritage ligne supérieure pour cellule chambre vide');
  });

  // TEST 3 : Import CSV avec anomalies (valeurs négatives, invalides, doublons)
  await runCase(3, 'Import CSV : détection valeurs négatives, texte invalide et doublons', () => {
    const d1 = today;
    const d2 = addDaysIso(today, 1);
    const csv = [
      `Chambre;Plan;Type;${d1};${d2}`,
      'Double Classique;BAR;Price (EUR);210;-45',
      'Double Classique;BAR;Price (EUR);215;abc',
    ].join('\n');
    const buf = new TextEncoder().encode(csv);
    const analysis = analyzeSpreadsheetBuffer(buf, 'planning_test.csv', hotel);
    assert(analysis.anomalies.some((a) => a.code === 'negative_value'), 'Valeur négative détectée');
    assert(analysis.anomalies.some((a) => a.code === 'invalid_number'), 'Nombre invalide détecté');
    assert(analysis.anomalies.some((a) => a.code === 'duplicate_row'), 'Doublon détecté');
  });

  // TEST 4 : Modèles de mapping réutilisables, prévisualisation Diff non destructive & exécution
  await runCase(4, 'Modèles mapping réutilisables, Diff non destructif & Import transactionnel', () => {
    const cfg = getHotelTariffConfig(hotel);
    const template = saveImportMappingTemplate(hotel.id, {
      id: 'tpl-qa-dedge',
      name: 'Modèle QA D-EDGE',
      providerPreset: 'dedge_planning',
      roomColumnName: 'Chambre',
      ratePlanColumnName: 'Plan',
      dataTypeColumnName: 'Type de donnée',
      priceTypeValue: 'Price (EUR)',
      inventoryTypeValue: 'Left for sale',
      roomCodeMappings: { 'Double Classique': cfg.roomCategories[0].code },
      planCodeMappings: { 'BAR - Best Available Rate': 'BAR' },
      defaultCurrency: 'EUR',
    });
    assert(template.some((t) => t.id === 'tpl-qa-dedge'), 'Modèle sauvegardé');
    assert(getImportMappingTemplates(hotel.id).length >= 1, 'Modèle relu par hôtel');

    const bytes = buildSampleDedgePlanningWorkbook(today, 5);
    const analysis = analyzeSpreadsheetBuffer(bytes, 'dedge_diff.xlsx', hotel);
    const roomMap = { 'Double Classique': 'classique', 'Double Supérieure': 'superieure', 'Deluxe / Famille': 'deluxe' };
    const planMap = { 'BAR - Best Available Rate': 'BAR', 'NRF - Non Remboursable (-10%)': 'NRF' };

    const beforeKey = buildCellKey(hotel.id, 'classique', 'BAR', today);
    const beforeCell = getRatePlanningCells(hotel).find((c) => c.cellKey === beforeKey);
    const diff = generateDedgeImportDiff(hotel, analysis, roomMap, planMap);
    assert(diff.length > 0, 'Diff non vide généré');
    // Vérifier que le diff n'a pas muté les cellules existantes
    const stillBefore = getRatePlanningCells(hotel).find((c) => c.cellKey === beforeKey);
    assert(stillBefore?.currentRateEur === beforeCell?.currentRateEur, 'Diff strictement non destructif');

    const execRes = executeDedgeImport(hotel, {
      analysis,
      roomCodeMappings: roomMap,
      planCodeMappings: planMap,
      autoCreateMissingRooms: true,
      autoCreateMissingPlans: true,
      overwriteExisting: true,
      actor: 'QA Import',
    });
    assert(execRes.report.updatedRatesCount > 0, 'Tarifs mis à jour après confirmation');
    assert(execRes.report.updatedInventoryCount > 0, 'Stocks Left for sale propagés');
  });

  // TEST 5 : Horizon 365 jours (génération paresseuse) & Duplication chambre -> chambre
  await runCase(5, 'Génération paresseuse 365 jours & Duplication chambre vers chambre avec écart €', async () => {
    const end365 = addDaysIso(today, 364);
    const allCells = ensurePlanningCellsForDateRange(hotel, today, end365);
    assert(allCells.some((c) => c.stayDate === end365), 'Cellule à J+364 générée dynamiquement');

    const dupRes = await duplicateRoomRatesInPlanning(hotel, {
      sourceRoomCode: 'classique',
      targetRoomCodes: ['superieure'],
      startDate: today,
      endDate: addDaysIso(today, 2),
      offsetEur: 25,
      ratePlanCodes: ['BAR'],
      copyRestrictions: true,
    });
    const src = dupRes.cells.find((c) => c.cellKey === buildCellKey(hotel.id, 'classique', 'BAR', today));
    const dst = dupRes.cells.find((c) => c.cellKey === buildCellKey(hotel.id, 'superieure', 'BAR', today));
    assert(Boolean(src && dst && dst.currentRateEur === src.currentRateEur + 25), 'Écart +25€ appliqué lors de duplication');
  });

  // TEST 6 : Modification en masse filtrée par jours de semaine & Planifications futures
  await runCase(6, 'Bulk edit filtré par jours de semaine + Planification future', async () => {
    const start = today;
    const end = addDaysIso(today, 6);
    const resBulk = await applyBulkEditInPlanning(hotel, {
      startDate: start,
      endDate: end,
      weekdays: [5, 6], // Vendredi & Samedi uniquement
      roomTypeCodes: ['classique'],
      ratePlanCodes: ['BAR'],
      adjustmentMode: 'fixed',
      value: 333,
      reason: 'QA Weekends seuls',
    });
    const cells7 = resBulk.cells.filter(
      (c) =>
        c.roomTypeCode === 'classique' &&
        c.ratePlanCode === 'BAR' &&
        c.stayDate >= start &&
        c.stayDate <= end
    );
    const friSat = cells7.filter((c) => {
      const dow = new Date(`${c.stayDate}T00:00:00Z`).getUTCDay();
      return dow === 5 || dow === 6;
    });
    const nonFriSat = cells7.filter((c) => {
      const dow = new Date(`${c.stayDate}T00:00:00Z`).getUTCDay();
      return dow !== 5 && dow !== 6;
    });
    assert(friSat.every((c) => c.currentRateEur === 333), 'Vendredi/Samedi fixés à 333€');
    assert(nonFriSat.some((c) => c.currentRateEur !== 333), 'Autres jours de la semaine préservés');

    saveScheduledRateChange(hotel.id, {
      id: 'sched-qa-1',
      hotelId: hotel.id,
      scheduledForIso: new Date(Date.now() + 3600000).toISOString(),
      status: 'scheduled',
      scopeLabel: 'classique · BAR',
      dateFrom: start,
      dateTo: end,
      weekdays: [1, 2],
      roomCategoryCodes: ['classique'],
      ratePlanCodes: ['BAR'],
      adjustmentMode: 'delta_pct',
      adjustmentValue: 5,
      autoPushToConnectors: true,
      actor: 'QA',
      createdAt: new Date().toISOString(),
    });
    updateScheduledRateChangeStatus(hotel.id, 'sched-qa-1', 'executed', 'Exécuté QA');
    const savedSched = getScheduledRateChanges(hotel.id).find((s) => s.id === 'sched-qa-1');
    assert(savedSched?.status === 'executed', 'Statut planification mis à jour');
  });

  // TEST 7 : Vérité 4 sources (sauvegarde locale sans envoi vs poussée sortante)
  await runCase(7, 'Vérité 4 sources : Enregistrer localement vs Transmettre au connecteur', async () => {
    const key = buildCellKey(hotel.id, 'classique', 'BAR', today);
    const localSave = await updateCellManuallyInPlanning(hotel, key, {
      newRateEur: 277,
      saveOnly: true,
      cascadeDerivedPlans: false,
      reason: 'QA saveOnly',
    });
    const cellLocal = localSave.cells.find((c) => c.cellKey === key);
    assert(cellLocal?.syncStatus === 'saved_local', 'Statut saved_local après sauvegarde locale seule');
    assert(cellLocal?.flowtymSavedRateEur === 277, 'flowtymSavedRateEur = 277');

    const pushed = await dispatchOutboundPush(
      hotel,
      [cellLocal!],
      'flowtym_manual',
      'manual_edit',
      'QA Push',
      'Test Push 4 sources',
      { forceOverwrite: true }
    );
    const afterCell = getRatePlanningCells(hotel).find((c) => c.cellKey === key);
    assert(pushed.syncedCount === 1, `Cellule transmise (synced=${pushed.syncedCount}, failed=${pushed.failedCount}, conflict=${pushed.conflictCount}, err=${pushed.lastError || 'none'})`);
    assert(afterCell?.transmittedRateEur === 277 && Boolean(afterCell?.lastSentAt), 'transmittedRateEur & lastSentAt tracés');
  });

  // TEST 8 : Endpoints Serveur Express (Coffre-fort AES-256-GCM, 409 anti-doublon, ack-inbound, sync-logs)
  await runCase(8, 'Serveur Express : Coffre-fort secrets masqués, 409 anti-doublon & ack-inbound', async () => {
    const defaultDedge = buildDefaultConnectorsForHotel(hotel.id)[0];
    const secretVal = 'sk_live_dedge_super_secret_4321';
    const postConn = await fetch(`${baseUrl}/api/connectors/${encodeURIComponent(hotel.id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-flowtym-role': 'admin' },
      body: JSON.stringify({
        connector: defaultDedge,
        secrets: { apiToken: secretVal },
      }),
    });
    assert(postConn.ok, `POST /api/connectors HTTP ${postConn.status}`);
    const getConn = await fetch(`${baseUrl}/api/connectors/${encodeURIComponent(hotel.id)}`);
    const getConnText = await getConn.text();
    assert(!getConnText.includes(secretVal), 'Aucun secret en clair ne doit fuiter dans GET /api/connectors');
    const getConnJson = JSON.parse(getConnText);
    const dedgeCred = getConnJson.connectors
      ?.find((c: any) => c.id === defaultDedge.id)
      ?.credentials?.find((cr: any) => cr.keyName === 'apiToken');
    assert(dedgeCred?.hasValue === true && dedgeCred?.maskedPreview?.includes('4321'), 'Aperçu masqué ••••4321 vérifié');

    const testResp = await fetch(
      `${baseUrl}/api/connectors/${encodeURIComponent(hotel.id)}/${encodeURIComponent(defaultDedge.id)}/test`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testType: 'connection', connector: defaultDedge }),
      }
    );
    const testJson = await testResp.json();
    assert(testJson.executionMode === 'sandbox_simulation' || testJson.executionMode === 'live_api', 'Mode exécution explicite');

    // Anti-doublon 409 sur externalMappings
    const cfg = getHotelTariffConfig(hotel);
    const dupCategories = cfg.roomCategories.map((rc, idx) =>
      idx < 2
        ? {
            ...rc,
            externalMappings: [
              {
                id: `map-dup-${idx}`,
                hotelId: hotel.id,
                internalRoomCode: rc.code,
                system: 'channel_manager' as const,
                connectorId: 'conn_dedge_1',
                connectorName: 'D-EDGE',
                externalCode: 'SAME_EXT_CODE',
                externalName: 'Doublon Test',
                lastVerifiedAt: new Date().toISOString(),
              },
            ],
          }
        : rc
    );
    const dupResp = await fetch(`${baseUrl}/api/tariff-config/${encodeURIComponent(hotel.id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: { ...cfg, roomCategories: dupCategories },
      }),
    });
    assert(dupResp.status === 409, `Doublon externalMappings doit renvoyer 409 (reçu ${dupResp.status})`);

    // Flux Sens 2 complet : Webhook entrant -> Pull -> ack-inbound (anti-boucle & acquittement)
    const whResp = await fetch(`${baseUrl}/api/webhooks/external-ari`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hotelId: hotel.id,
        stayDate: today,
        roomTypeCode: 'classique',
        ratePlanCode: 'BAR',
        newRateEur: 280,
        source: 'channel_manager',
      }),
    }).then((r) => r.json());
    assert(whResp.success && whResp.inboundEvent?.eventId, 'Webhook entrant enregistré');

    const pullResp = await fetch(`${baseUrl}/api/rate-planning/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hotelId: hotel.id }),
    }).then((r) => r.json());
    const evIds = (pullResp.inboundEvents || []).map((u: any) => u.eventId);
    assert(evIds.includes(whResp.inboundEvent.eventId), 'Pull récupère l’événement webhook entrant');

    const ack1 = await fetch(`${baseUrl}/api/rate-planning/ack-inbound`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hotelId: hotel.id, eventIds: [whResp.inboundEvent.eventId] }),
    }).then((r) => r.json());
    assert(ack1.success && ack1.acknowledgedCount === 1, 'Premier ack-inbound acquitté');

    const ack2 = await fetch(`${baseUrl}/api/rate-planning/ack-inbound`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hotelId: hotel.id, eventIds: [whResp.inboundEvent.eventId] }),
    }).then((r) => r.json());
    assert(ack2.success && ack2.acknowledgedCount === 0, 'Deuxième ack-inbound déjà dépilé');

    const logsJson = await fetch(
      `${baseUrl}/api/sync-logs/${encodeURIComponent(hotel.id)}?providerId=dedge`
    ).then((r) => r.json());
    assert(logsJson.success && Array.isArray(logsJson.logs) && logsJson.logs.length >= 1, 'Logs techniques filtrés retournés');
  });

  const passedCount = results.filter((r) => r.passed).length;
  return { passedCount, total: results.length, results };
}

// Exécution directe via `npx tsx src/services/__tests__/universalConnectorsAndImportSuite.ts`
const isDirectCli =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv.some((a) => a.includes('universalConnectorsAndImportSuite'));

if (isDirectCli) {
  runUniversalConnectorsAndImportSuite()
    .then((summary) => {
      console.log(`\n=== UNIVERSAL CONNECTORS & IMPORT SUITE: ${summary.passedCount}/${summary.total} ===`);
      summary.results.forEach((r) => {
        console.log(`${r.passed ? '[PASS]' : '[FAIL]'} #${r.id} ${r.name} -> ${r.details}`);
      });
      if (summary.passedCount < summary.total) process.exit(1);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

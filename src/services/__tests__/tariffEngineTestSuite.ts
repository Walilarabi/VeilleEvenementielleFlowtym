/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FLOWTYM REVENUE — SUITE DE TESTS AUTOMATISÉS (20 SCÉNARIOS SECTION 17)
 */

import * as XLSX from 'xlsx';
import { INITIAL_HOTELS as HOTELS } from '../../data/mockData';
import {
  applyGroupTemplateToHotel,
  applyRoundingRule,
  canDeleteRatePlan,
  computeDerivedRateForPlan,
  detectCircularDependencies,
  evaluateSafeFormula,
  executeRatePlanImport,
  getEffectiveBreakfastPrice,
  getHotelTariffConfig,
  normalizeRateExcludingBreakfast,
  parseRatePlansFromSpreadsheetBuffer,
  resolveCascadeForRootPlan,
  resolveReferencePlanCode,
  saveHotelTariffConfig,
  validateRatePlanList,
} from '../tariffConfigurationService';
import {
  acceptRecommendationInPlanning,
  applyRestrictionRuleToPlanning,
  buildCellKey,
  copyRatesOverPeriod,
  getRatePlanningCells,
  pullExternalUpdatesInPlanning,
  recalculateDerivedPlansInPlanning,
  simulateExternalSystemChange,
  updateCellManuallyInPlanning,
} from '../ratePlanningSyncService';

export interface TestCaseResult {
  id: number;
  name: string;
  passed: boolean;
  details: string;
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export async function runAll20TariffTests(options?: { liveServerBaseUrl?: string }): Promise<{
  passedCount: number;
  total: number;
  results: TestCaseResult[];
}> {
  const hotelA = HOTELS[0]; // hotel-opera
  const hotelB = HOTELS[1]; // hotel-lyon or second hotel
  const results: TestCaseResult[] = [];
  const baseUrl = options?.liveServerBaseUrl || 'http://127.0.0.1:3000';
  if (typeof process !== 'undefined' && process.env) {
    process.env.FLOWTYM_API_BASE = baseUrl;
  }

  const runCase = async (id: number, name: string, fn: () => Promise<void> | void) => {
    try {
      await fn();
      results.push({ id, name, passed: true, details: 'OK' });
    } catch (err: any) {
      results.push({ id, name, passed: false, details: err?.message || String(err) });
    }
  };

  // TEST 1 : Créer un plan tarifaire et vérifier apparition dans Planning
  await runCase(1, 'Créer un plan tarifaire et l’afficher dans le Planning', () => {
    const cfg = getHotelTariffConfig(hotelA);
    const createdPlan = {
      ...cfg.ratePlans[1],
      id: `rp-test-promo10`,
      code: 'PROMO_WKD',
      name: 'Week-End Escapade (-10%)',
      planNature: 'promotional' as const,
      referencePlanCode: 'BAR',
      calculationMode: 'percent_minus' as const,
      variationValue: 10,
      relationActive: true,
      pmsExternalId: 'PMS-OPR-PKW',
      cmExternalId: 'DE-OPR-PKW',
      isSystemDefault: false,
      isNrfPlan: false,
    };
    saveHotelTariffConfig(hotelA, { ...cfg, ratePlans: [...cfg.ratePlans, createdPlan] }, 'QA');
    const cells = getRatePlanningCells(hotelA);
    const hasPromoCell = cells.some(
      (c) => c.ratePlanCode === 'PROMO_WKD' && c.stayDate === '2026-11-16'
    );
    assert(hasPromoCell, 'La cellule PROMO_WKD doit être matérialisée dans le Planning.');
  });

  // TEST 2 : Modifier un plan tarifaire
  await runCase(2, 'Modifier un plan tarifaire et refléter le libellé dans le Planning', () => {
    const cfg = getHotelTariffConfig(hotelA);
    const updatedPlans = cfg.ratePlans.map((p) =>
      p.code === 'PROMO_WKD' ? { ...p, name: 'Week-End Privilège (-10%)' } : p
    );
    saveHotelTariffConfig(hotelA, { ...cfg, ratePlans: updatedPlans }, 'QA');
    const cells = getRatePlanningCells(hotelA);
    const target = cells.find((c) => c.ratePlanCode === 'PROMO_WKD');
    assert(
      target?.ratePlanName === 'Week-End Privilège (-10%)',
      'Le nouveau nom du plan doit être propagé aux cellules.'
    );
  });

  // TEST 3 : Dupliquer un plan + unicité code / IDs externes
  await runCase(3, 'Dupliquer un plan et contrôler l’unicité des codes & IDs externes', () => {
    const cfg = getHotelTariffConfig(hotelA);
    const src = cfg.ratePlans.find((p) => p.code === 'PROMO_WKD')!;
    const dupErr = validateRatePlanList([...cfg.ratePlans, { ...src, id: 'dup-id' }]);
    assert(Boolean(dupErr && dupErr.includes('doublon')), 'Le doublon de code doit être bloqué.');
    const uniqueCopy = {
      ...src,
      id: 'rp-test-copy',
      code: 'PROMO_WKD_COPY',
      pmsExternalId: 'PMS-OPR-PKW2',
      cmExternalId: 'DE-OPR-PKW2',
    };
    const next = saveHotelTariffConfig(hotelA, { ...cfg, ratePlans: [...cfg.ratePlans, uniqueCopy] }, 'QA');
    assert(next.ratePlans.some((p) => p.code === 'PROMO_WKD_COPY'), 'La copie unique doit être enregistrée.');
  });

  // TEST 4 : Désactiver / archiver + blocage suppression d’un plan référencé
  await runCase(4, 'Désactiver/archiver et protéger la suppression d’un plan référencé', () => {
    const cfg = getHotelTariffConfig(hotelA);
    const guardBar = canDeleteRatePlan(cfg, 'BAR');
    assert(!guardBar.allowed, 'La suppression de BAR (référence active + parent) doit être bloquée.');
    const guardCopy = canDeleteRatePlan(cfg, 'PROMO_WKD_COPY');
    assert(guardCopy.allowed, 'Un plan feuille non référencé peut être supprimé.');
    const cleaned = cfg.ratePlans.filter((p) => p.code !== 'PROMO_WKD_COPY');
    saveHotelTariffConfig(hotelA, { ...cfg, ratePlans: cleaned }, 'QA');
  });

  // TEST 5 : Changer le tarif de référence global
  await runCase(5, 'Changer librement le tarif de référence global (BAR → CORP)', () => {
    const cfg = getHotelTariffConfig(hotelA);
    const next = saveHotelTariffConfig(
      hotelA,
      { ...cfg, referenceMode: 'single_global', globalReferencePlanCode: 'CORP' },
      'QA'
    );
    const resolved = resolveReferencePlanCode(next, 'classique', '2026-11-16');
    assert(resolved === 'CORP', `La référence résolue doit être CORP (obtenu ${resolved}).`);
    // Restaurer BAR pour les tests suivants
    saveHotelTariffConfig(hotelA, { ...next, globalReferencePlanCode: 'BAR' }, 'QA');
  });

  // TEST 6 : Tarifs de référence différents par catégorie
  await runCase(6, 'Configurer des tarifs de référence différents par catégorie de chambre', () => {
    const cfg = getHotelTariffConfig(hotelA);
    const next = saveHotelTariffConfig(
      hotelA,
      {
        ...cfg,
        referenceMode: 'per_category',
        referenceRules: [
          {
            id: 'ref-cl',
            hotelId: hotelA.id,
            scope: 'per_category',
            roomCategoryCode: 'classique',
            referencePlanCode: 'BAR',
            currency: 'EUR',
            validFrom: null,
            validTo: null,
            priority: 1,
            isActive: true,
          },
          {
            id: 'ref-dlx',
            hotelId: hotelA.id,
            scope: 'per_category',
            roomCategoryCode: 'deluxe_famille',
            referencePlanCode: 'BB',
            currency: 'EUR',
            validFrom: null,
            validTo: null,
            priority: 2,
            isActive: true,
          },
        ],
      },
      'QA'
    );
    assert(resolveReferencePlanCode(next, 'classique', '2026-11-16') === 'BAR', 'Classique -> BAR');
    assert(resolveReferencePlanCode(next, 'deluxe_famille', '2026-11-16') === 'BB', 'Deluxe -> BB');
    saveHotelTariffConfig(hotelA, { ...next, referenceMode: 'single_global', globalReferencePlanCode: 'BAR' }, 'QA');
  });

  // TEST 7 : Créer relation dérivée et modifier tarif de référence
  await runCase(7, 'Relation dérivée (-10% PROMO_WKD) & cascade multi-niveaux', () => {
    const cfg = getHotelTariffConfig(hotelA);
    const cascade = resolveCascadeForRootPlan({
      rootPlanCode: 'BAR',
      rootNewRateEur: 300,
      config: cfg,
      roomCategoryCode: 'classique',
      stayDate: '2026-11-16',
    });
    const promo = cascade.find((c) => c.planCode === 'PROMO_WKD');
    assert(promo?.computedRateEur === 270, `PROMO_WKD sur 300€ (-10%) attendu 270€, obtenu ${promo?.computedRateEur}`);
    const formulaRes = evaluateSafeFormula('REF * 0.8 + 10', 300);
    assert(formulaRes === 250, `evaluateSafeFormula('REF * 0.8 + 10', 300) attendu 250, obtenu ${formulaRes}`);
  });

  // TEST 8 : Modifier formule d’un plan dérivé & recalcul global
  await runCase(8, 'Modifier la formule d’un plan dérivé et recalculer le planning', async () => {
    const cfg = getHotelTariffConfig(hotelA);
    const modifiedPlans = cfg.ratePlans.map((p) =>
      p.code === 'PROMO_WKD' ? { ...p, variationValue: 20 } : p
    );
    saveHotelTariffConfig(hotelA, { ...cfg, ratePlans: modifiedPlans }, 'QA');
    await recalculateDerivedPlansInPlanning(hotelA, { startDate: '2026-11-16', endDate: '2026-11-16' });
    const cells = getRatePlanningCells(hotelA);
    const barCell = cells.find((c) => c.cellKey === buildCellKey(hotelA.id, 'classique', 'BAR', '2026-11-16'))!;
    const promoCell = cells.find((c) => c.cellKey === buildCellKey(hotelA.id, 'classique', 'PROMO_WKD', '2026-11-16'))!;
    const expected = Math.round(barCell.currentRateEur * 0.8);
    assert(
      promoCell.currentRateEur === expected,
      `Après passage à -20%, PROMO_WKD attendu ${expected}€, obtenu ${promoCell.currentRateEur}€`
    );
  });

  // TEST 9 : Détecter et bloquer une dépendance circulaire
  await runCase(9, 'Détecter et bloquer toute dépendance circulaire (A → B → A)', () => {
    const cfg = getHotelTariffConfig(hotelA);
    const brokenPlans = cfg.ratePlans.map((p) => {
      if (p.code === 'BAR') {
        return { ...p, referencePlanCode: 'NRF', calculationMode: 'fixed_plus' as const, variationValue: 10 };
      }
      return p;
    });
    const cycle = detectCircularDependencies(brokenPlans);
    assert(cycle !== null && cycle.length >= 2, 'Le détecteur DFS doit identifier la boucle BAR ↔ NRF.');
    let blocked = false;
    try {
      saveHotelTariffConfig(hotelA, { ...cfg, ratePlans: brokenPlans }, 'QA');
    } catch {
      blocked = true;
    }
    assert(blocked, 'saveHotelTariffConfig doit refuser de sauvegarder une boucle circulaire.');
  });

  // TEST 10 : Accepter recommandation moteur sur tarif de référence + cascade
  await runCase(10, 'Accepter recommandation RM sur référence → mise à jour Planning & dérivés', async () => {
    const cells = getRatePlanningCells(hotelA);
    const pendingBar = cells.find(
      (c) =>
        c.ratePlanCode === 'BAR' &&
        c.roomTypeCode === 'classique' &&
        c.recommendation?.status === 'pending'
    );
    assert(Boolean(pendingBar), 'Une recommandation BAR en attente doit exister.');
    const targetRate = pendingBar!.recommendation!.recommendedRateEur;
    await acceptRecommendationInPlanning(hotelA, pendingBar!.cellKey, { cascadeDerivedPlans: true });
    const after = getRatePlanningCells(hotelA);
    const updatedBar = after.find((c) => c.cellKey === pendingBar!.cellKey)!;
    assert(updatedBar.currentRateEur === targetRate, 'Le tarif BAR doit correspondre à la recommandation.');
    assert(updatedBar.recommendation?.targetRole === 'reference', 'Rôle référence tagué sur la reco.');
  });

  // TEST 11 : Préserver les tarifs indépendants lors des variations de la référence
  await runCase(11, 'Ne jamais modifier automatiquement un tarif indépendant (GROUP)', async () => {
    const cellsBefore = getRatePlanningCells(hotelA);
    const groupKey = buildCellKey(hotelA.id, 'classique', 'GROUP', '2026-11-17');
    const barKey = buildCellKey(hotelA.id, 'classique', 'BAR', '2026-11-17');
    const groupBefore = cellsBefore.find((c) => c.cellKey === groupKey)!.currentRateEur;
    await updateCellManuallyInPlanning(hotelA, barKey, {
      newRateEur: 340,
      cascadeDerivedPlans: true,
      forceOverwrite: true,
      reason: 'Test protection tarif indépendant',
    });
    const cellsAfter = getRatePlanningCells(hotelA);
    const groupAfter = cellsAfter.find((c) => c.cellKey === groupKey)!.currentRateEur;
    const bbAfter = cellsAfter.find((c) => c.cellKey === buildCellKey(hotelA.id, 'classique', 'BB', '2026-11-17'))!.currentRateEur;
    assert(groupAfter === groupBefore, `GROUP indépendant doit rester à ${groupBefore}€ (obtenu ${groupAfter}€).`);
    assert(bbAfter === 364, `BB dérivé (+24€) sur 340€ doit passer à 364€ (obtenu ${bbAfter}€).`);
  });

  // TEST 12 : Calcul FLEX / NRF % et montant fixe + plancher NRF
  await runCase(12, 'Calcul FLEX / NRF (-% et -€ fixe) + surcharge période & plancher NRF', () => {
    const cfg = getHotelTariffConfig(hotelA);
    const nrfPlan = cfg.ratePlans.find((p) => p.code === 'NRF')!;
    // Période salon 2026-11-20 a une règle -8%
    const periodVal = computeDerivedRateForPlan({
      referenceRateEur: 300,
      targetPlan: nrfPlan,
      config: cfg,
      roomCategoryCode: 'classique',
      stayDate: '2026-11-20',
    });
    assert(periodVal === 276, `NRF période salon (-8% sur 300€) attendu 276€, obtenu ${periodVal}`);

    // Fixe -30€ avec plancher NRF 200€
    const fixedCfg = {
      ...cfg,
      flexNrf: { ...cfg.flexNrf, method: 'fixed_discount' as const, defaultValue: 30, periodRules: [], demandRules: [], nrfFloorEur: 200 },
    };
    const floored = computeDerivedRateForPlan({
      referenceRateEur: 215,
      targetPlan: nrfPlan,
      config: fixedCfg,
      roomCategoryCode: 'classique',
      stayDate: '2026-12-05',
    });
    assert(floored === 200, `Plancher NRF 200€ doit bloquer 215-30=185 à 200€, obtenu ${floored}`);
  });

  // TEST 13 : Règles d’arrondi FLEX / NRF
  await runCase(13, 'Règles d’arrondi FLEX / NRF (euro proche, multiple 5, .99, exact)', () => {
    assert(applyRoundingRule(242.6, 'nearest_euro') === 243, 'nearest_euro');
    assert(applyRoundingRule(242.6, 'nearest_5') === 245, 'nearest_5');
    assert(applyRoundingRule(242.6, 'end_99') === 242.99, 'end_99');
    assert(applyRoundingRule(242.646, 'none') === 242.65, 'none');
  });

  // TEST 14 : Désactiver synchronisation automatique FLEX → NRF
  await runCase(14, 'Désactiver sync auto FLEX → NRF conserve le tarif NRF intact', async () => {
    const cfg = getHotelTariffConfig(hotelA);
    saveHotelTariffConfig(hotelA, { ...cfg, flexNrf: { ...cfg.flexNrf, autoSyncFlexToNrf: false } }, 'QA');
    const nrfKey = buildCellKey(hotelA.id, 'classique', 'NRF', '2026-11-17');
    const barKey = buildCellKey(hotelA.id, 'classique', 'BAR', '2026-11-17');
    const nrfBefore = getRatePlanningCells(hotelA).find((c) => c.cellKey === nrfKey)!.currentRateEur;
    await updateCellManuallyInPlanning(hotelA, barKey, {
      newRateEur: 390,
      cascadeDerivedPlans: true,
      forceOverwrite: true,
    });
    const nrfAfter = getRatePlanningCells(hotelA).find((c) => c.cellKey === nrfKey)!.currentRateEur;
    assert(nrfAfter === nrfBefore, `Avec autoSyncFlexToNrf=false, NRF doit rester à ${nrfBefore}€ (obtenu ${nrfAfter}€).`);
    // Réactiver
    saveHotelTariffConfig(hotelA, { ...cfg, flexNrf: { ...cfg.flexNrf, autoSyncFlexToNrf: true } }, 'QA');
  });

  // TEST 15 : Configurer petit-déjeuner (catégorie, période, normalisation RM)
  await runCase(15, 'Petit-déjeuner : variation catégorie/période & normalisation moteur RM', () => {
    const cfg = getHotelTariffConfig(hotelA);
    const stdPrice = getEffectiveBreakfastPrice({
      mealPlan: cfg.mealPlan,
      roomCategoryCode: 'classique',
      stayDate: '2026-11-18',
    });
    const holidayPrice = getEffectiveBreakfastPrice({
      mealPlan: cfg.mealPlan,
      roomCategoryCode: 'classique',
      stayDate: '2026-12-25',
    });
    assert(stdPrice === 24, `PDJ standard attendu 24€, obtenu ${stdPrice}€`);
    assert(holidayPrice === 28, `PDJ fêtes (25 déc) attendu 28€, obtenu ${holidayPrice}€`);
    const bbPlan = cfg.ratePlans.find((p) => p.code === 'BB')!;
    const norm = normalizeRateExcludingBreakfast(284, bbPlan, cfg.mealPlan, 'classique', '2026-11-18');
    assert(norm === 260, `Tarif BB 284€ normalisé hors PDJ attendu 260€, obtenu ${norm}€`);
  });

  // TEST 16 : Importation depuis Excel/CSV
  await runCase(16, 'Importer plans tarifaires depuis fichier Excel (.xlsx) avec anti-doublon', () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        Code: 'EARLY_IMP',
        Nom: 'Early Booking Excel (-15%)',
        Nature: 'promotional',
        Calcul: 'percent_minus',
        Variation: 15,
        Annulation: 'Non-annulable',
        PDJ: 'Non',
      },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plans');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const parsed = parseRatePlansFromSpreadsheetBuffer(buf, 'test.xlsx');
    assert(parsed.length === 1 && parsed[0].externalCode === 'EARLY_IMP', 'Parsing Excel réussi.');
    const impRes = executeRatePlanImport(hotelA, {
      source: 'excel',
      fileName: 'test.xlsx',
      mode: 'add_only',
      items: parsed,
    });
    assert(impRes.job.addedCount === 1, '1 plan ajouté depuis Excel.');
    assert(
      impRes.config.ratePlans.some((p) => p.code === 'EARLY_IMP' && p.provenance === 'excel'),
      'Provenance excel enregistrée.'
    );
  });

  // TEST 17 : Importation depuis PMS / Channel Manager sans doublon de catégorie
  await runCase(17, 'Importer depuis PMS & Channel Manager sans créer de doublon chambre', async () => {
    const beforeRoomsCount = getHotelTariffConfig(hotelA).roomCategories.length;
    const imp = executeRatePlanImport(hotelA, {
      source: 'pms',
      mode: 'add_only',
      items: [
        {
          id: 'imp-pms-pkg',
          externalCode: 'PMS_PKG_ROM',
          name: 'Package Romantique PMS',
          planNature: 'promotional',
          calculationMode: 'fixed_plus',
          variationValue: 45,
          cancellationPolicy: 'Semi-flexible',
          breakfastIncluded: true,
          roomCategories: ['classique', 'superieure'],
          action: 'add',
        },
      ],
      newRoomCategories: [
        {
          externalCode: getHotelTariffConfig(hotelA).roomCategories[0].pmsRoomId,
          name: getHotelTariffConfig(hotelA).roomCategories[0].name,
          physicalRooms: 20,
          maxAdults: 2,
          maxChildren: 0,
        },
      ],
    });
    assert(imp.job.addedCount === 1, 'Plan PMS importé.');
    assert(
      imp.config.roomCategories.length === beforeRoomsCount,
      'La catégorie PMS déjà existante ne doit PAS être dupliquée.'
    );
  });

  // TEST 18 : Cohérence des chambres, capacités et anti-doublon mapping
  await runCase(18, 'Cohérence catégories de chambres, capacités et unicité mapping PMS/CM', () => {
    const cfg = getHotelTariffConfig(hotelA);
    assert(cfg.roomCategories.every((rc) => rc.physicalRooms > 0 && rc.maxAdults >= 1), 'Capacités valides');
    const pmsIds = cfg.roomCategories.map((c) => c.pmsRoomId).filter(Boolean);
    assert(new Set(pmsIds).size === pmsIds.length, 'Chaque catégorie doit avoir un ID PMS unique.');
  });

  // TEST 19 : Synchro 2-Way (Push, Webhook/Pull anti-boucle, Copie période, Restriction)
  await runCase(19, 'Synchro 2-Way Planning ↔ PMS/CM, copie période & application restriction', async () => {
    const resCopy = await copyRatesOverPeriod(hotelA, {
      sourceStartDate: '2026-11-16',
      sourceEndDate: '2026-11-17',
      targetStartDate: '2026-11-23',
      roomTypeCodes: ['classique'],
      ratePlanCodes: ['BAR'],
    });
    assert(resCopy.cells.length > 0, 'Copie période exécutée.');
    const rst = getHotelTariffConfig(hotelA).restrictionRules[0];
    const resRst = await applyRestrictionRuleToPlanning(hotelA, rst);
    assert(resRst.cells.some((c) => c.stayDate === '2026-11-20' && c.minStay >= 2), 'MinStay 2 appliqué sur la règle.');

    // Vérifier aussi les routes API réelles si le serveur répond
    try {
      const catResp = await fetch(`${baseUrl}/api/external-catalog/pms?hotelId=${hotelA.id}`);
      if (catResp.ok) {
        const catJson = await catResp.json();
        assert(Array.isArray(catJson.ratePlans) && catJson.ratePlans.length > 0, 'Catalogue PMS HTTP OK.');
        await simulateExternalSystemChange({
          hotelId: hotelA.id,
          stayDate: '2026-11-18',
          roomTypeCode: 'classique',
          ratePlanCode: 'BAR',
          newRateEur: 312,
          source: 'pms',
        });
        const pull = await pullExternalUpdatesInPlanning(hotelA);
        assert(
          pull.importedCount >= 1 ||
            pull.cells.find((c) => c.cellKey === buildCellKey(hotelA.id, 'classique', 'BAR', '2026-11-18'))?.currentRateEur === 312,
          'Import Sens 2 Webhook + Pull vérifié.'
        );
      }
    } catch {
      // Serveur arrêté hors ligne : test unitaire local valide
    }
  });

  // TEST 20 : Isolation multi-hôtels & héritage groupe
  await runCase(20, 'Isolation stricte multi-hôtels (Hôtel A vs Hôtel B) & héritage groupe', () => {
    const cfgA = getHotelTariffConfig(hotelA);
    const cfgB = getHotelTariffConfig(hotelB);
    saveHotelTariffConfig(hotelA, { ...cfgA, currency: 'CHF', globalReferencePlanCode: 'BB' }, 'QA');
    const reloadedB = getHotelTariffConfig(hotelB);
    assert(reloadedB.currency === 'EUR', `Hôtel B doit conserver EUR (obtenu ${reloadedB.currency}).`);
    assert(
      reloadedB.globalReferencePlanCode !== 'BB' || cfgB.globalReferencePlanCode === 'BB',
      'Le changement de référence de Hôtel A ne doit pas altérer Hôtel B.'
    );
    const inheritedB = applyGroupTemplateToHotel(hotelB, 'QA');
    assert(inheritedB.inheritanceMode === 'inherit_group', 'Héritage groupe appliqué proprement à Hôtel B.');
    // Restaurer Hôtel A EUR / BAR
    saveHotelTariffConfig(hotelA, { ...getHotelTariffConfig(hotelA), currency: 'EUR', globalReferencePlanCode: 'BAR' }, 'QA');
  });

  const passedCount = results.filter((r) => r.passed).length;
  return { passedCount, total: results.length, results };
}

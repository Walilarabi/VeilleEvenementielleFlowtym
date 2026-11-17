/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FLOWTYM REVENUE — ÉDITEUR DE CORRESPONDANCE CHAMBRES (ROOM MAPPING EDITOR)
 * Gère explicitement la matrice entre IDs de catégories internes et IDs externes
 * (PMS / Channel Manager), avec validation temps réel anti-doublons & suggestions API.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  DownloadCloud,
  Link2,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
} from 'lucide-react';
import {
  ConnectorInstance,
  Hotel,
  HotelTariffConfiguration,
  RoomCategoryConfig,
  RoomTypeExternalMapping,
} from '../../types';
import { validateRoomCategoryMappings } from '../../services/tariffConfigurationService';
import {
  fetchConnectorsForHotel,
  getCachedConnectorsForHotel,
} from '../../services/connectors/connectorRegistry';

interface RoomMappingEditorProps {
  hotel: Hotel;
  config: HotelTariffConfiguration;
  onCommitMappings: (
    nextRooms: RoomCategoryConfig[],
    nextMappings: RoomTypeExternalMapping[],
    details: string,
    toastMsg: string
  ) => void;
  onShowToast: (msg: string) => void;
}

interface ExternalRoomCatalogEntry {
  externalCode: string;
  name: string;
  physicalRooms: number;
}

interface DraftExtraMapping {
  id: string;
  connectorId: string;
  connectorName: string;
  providerId: string;
  system: 'pms' | 'channel_manager';
  externalCode: string;
  externalName: string;
  isPrimary: boolean;
}

interface DraftRow {
  id: string;
  name: string;
  originalCode: string;
  code: string;
  pmsRoomId: string;
  cmRoomId: string;
  isArchived: boolean;
  extraMappings: DraftExtraMapping[];
}

export const RoomMappingEditor: React.FC<RoomMappingEditorProps> = ({
  hotel,
  config,
  onCommitMappings,
  onShowToast,
}) => {
  const [connectors, setConnectors] = useState<ConnectorInstance[]>(() =>
    getCachedConnectorsForHotel(hotel.id)
  );

  useEffect(() => {
    let active = true;
    void fetchConnectorsForHotel(hotel.id).then((list) => {
      if (active) setConnectors(list);
    });
    return () => {
      active = false;
    };
  }, [hotel.id]);

  const mappableConnectors = useMemo(
    () => connectors.filter((c) => c.family === 'pms' || c.family === 'channel_manager'),
    [connectors]
  );

  const buildDrafts = (rooms: RoomCategoryConfig[]): DraftRow[] =>
    rooms.map((rc) => {
      const savedExtras = (rc.externalMappings || []).length
        ? (rc.externalMappings || []).map((m) => ({
            id: m.id,
            connectorId: m.connectorId || m.system,
            connectorName: m.connectorName || (m.system === 'pms' ? 'PMS' : 'Channel Manager'),
            providerId: m.providerId || m.system,
            system: m.system,
            externalCode: m.externalCode,
            externalName: m.externalName || rc.name,
            isPrimary: Boolean(m.isPrimary),
          }))
        : (config.roomMappings || [])
            .filter(
              (m) =>
                m.internalRoomCode === rc.code &&
                m.connectorId &&
                m.connectorId !== 'pms' &&
                m.connectorId !== 'channel_manager'
            )
            .map((m) => ({
              id: m.id,
              connectorId: m.connectorId || m.system,
              connectorName: m.connectorName || m.system,
              providerId: m.providerId || m.system,
              system: m.system,
              externalCode: m.externalCode,
              externalName: m.externalName || rc.name,
              isPrimary: Boolean(m.isPrimary),
            }));

      return {
        id: rc.id,
        name: rc.name,
        originalCode: rc.code,
        code: rc.code,
        pmsRoomId: rc.pmsRoomId || '',
        cmRoomId: rc.cmRoomId || '',
        isArchived: Boolean(rc.isArchived),
        extraMappings: savedExtras,
      };
    });

  const [draftRows, setDraftRows] = useState<DraftRow[]>(() =>
    buildDrafts(config.roomCategories)
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [pmsCatalog, setPmsCatalog] = useState<ExternalRoomCatalogEntry[]>([]);
  const [cmCatalog, setCmCatalog] = useState<ExternalRoomCatalogEntry[]>([]);
  const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(false);

  useEffect(() => {
    setDraftRows(buildDrafts(config.roomCategories));
  }, [config.roomCategories, config.roomMappings, hotel.id]);

  // Détection précise des doublons par champ (code interne, ID PMS, ID Channel Manager, et IDs multi-connecteurs)
  const validation = useMemo(() => {
    const codeCounts = new Map<string, number>();
    const pmsCounts = new Map<string, number>();
    const cmCounts = new Map<string, number>();
    const connectorCodeCounts = new Map<string, number>();

    draftRows.forEach((row) => {
      const c = row.code.trim().toLowerCase();
      if (c) codeCounts.set(c, (codeCounts.get(c) || 0) + 1);

      const p = row.pmsRoomId.trim().toUpperCase();
      if (p) pmsCounts.set(p, (pmsCounts.get(p) || 0) + 1);

      const cm = row.cmRoomId.trim().toUpperCase();
      if (cm) cmCounts.set(cm, (cmCounts.get(cm) || 0) + 1);

      row.extraMappings.forEach((em) => {
        const ext = em.externalCode.trim().toUpperCase();
        if (!ext) return;
        const pairKey = `${em.connectorId}::${ext}`;
        connectorCodeCounts.set(pairKey, (connectorCodeCounts.get(pairKey) || 0) + 1);
      });
    });

    const rowErrors = new Map<
      string,
      { codeError?: string; pmsError?: string; cmError?: string; extraError?: string }
    >();
    const errorMessages: string[] = [];

    draftRows.forEach((row) => {
      const err: { codeError?: string; pmsError?: string; cmError?: string; extraError?: string } = {};
      const c = row.code.trim().toLowerCase();
      const p = row.pmsRoomId.trim().toUpperCase();
      const cm = row.cmRoomId.trim().toUpperCase();

      if (!c) {
        err.codeError = 'Code interne requis';
        errorMessages.push(`${row.name} : code interne vide.`);
      } else if ((codeCounts.get(c) || 0) > 1) {
        err.codeError = `Doublon "${c}"`;
        errorMessages.push(`Code interne en doublon : "${c}".`);
      }

      if (p && (pmsCounts.get(p) || 0) > 1) {
        err.pmsError = `ID PMS dupliqué`;
        errorMessages.push(`ID PMS "${row.pmsRoomId.trim()}" attribué à plusieurs catégories.`);
      }

      if (cm && (cmCounts.get(cm) || 0) > 1) {
        err.cmError = `ID CM dupliqué`;
        errorMessages.push(`ID Channel Manager "${row.cmRoomId.trim()}" attribué à plusieurs catégories.`);
      }

      row.extraMappings.forEach((em) => {
        const ext = em.externalCode.trim().toUpperCase();
        if (!ext) {
          err.extraError = `ID vide sur ${em.connectorName}`;
          errorMessages.push(`${row.name} : un identifiant supplémentaire pour ${em.connectorName} est vide.`);
          return;
        }
        const pairKey = `${em.connectorId}::${ext}`;
        if ((connectorCodeCounts.get(pairKey) || 0) > 1) {
          err.extraError = `ID "${ext}" dupliqué sur ${em.connectorName}`;
          errorMessages.push(
            `ID externe "${em.externalCode.trim()}" dupliqué sur le connecteur ${em.connectorName}.`
          );
        }
      });

      if (err.codeError || err.pmsError || err.cmError || err.extraError) {
        rowErrors.set(row.id, err);
      }
    });

    const now = new Date().toISOString();
    const projectedRooms: RoomCategoryConfig[] = config.roomCategories.map((rc) => {
      const d = draftRows.find((r) => r.id === rc.id);
      if (!d) return rc;
      const normCode = d.code.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_');
      const mappedExtras: RoomTypeExternalMapping[] = d.extraMappings
        .filter((em) => em.externalCode.trim() !== '')
        .map((em) => ({
          id: em.id,
          hotelId: hotel.id,
          internalRoomCode: normCode,
          system: em.system,
          connectorId: em.connectorId,
          connectorName: em.connectorName,
          providerId: em.providerId,
          externalCode: em.externalCode.trim(),
          externalName: em.externalName.trim() || rc.name,
          isPrimary: em.isPrimary,
          lastVerifiedAt: now,
        }));

      // Synchronise l'ID principal PMS/CM si un mapping extra primaire est défini et que le champ de base est vide
      const primaryPmsExtra = mappedExtras.find((m) => m.system === 'pms' && m.isPrimary);
      const primaryCmExtra = mappedExtras.find((m) => m.system === 'channel_manager' && m.isPrimary);

      return {
        ...rc,
        code: normCode,
        pmsRoomId: d.pmsRoomId.trim() || primaryPmsExtra?.externalCode || '',
        cmRoomId: d.cmRoomId.trim() || primaryCmExtra?.externalCode || '',
        externalMappings: mappedExtras,
      };
    });
    const serviceError = validateRoomCategoryMappings(projectedRooms);

    return {
      rowErrors,
      uniqueErrors: Array.from(new Set(errorMessages)),
      serviceError,
      isValid: rowErrors.size === 0 && !serviceError,
      projectedRooms,
    };
  }, [draftRows, config.roomCategories, hotel.id]);

  const isDirty = useMemo(() => {
    return draftRows.some((d) => {
      const orig = config.roomCategories.find((rc) => rc.id === d.id);
      if (!orig) return true;
      const origExtras = (orig.externalMappings || [])
        .map((m) => `${m.connectorId}:${m.externalCode}:${m.isPrimary ? 1 : 0}`)
        .join('|');
      const draftExtras = d.extraMappings
        .map((m) => `${m.connectorId}:${m.externalCode.trim()}:${m.isPrimary ? 1 : 0}`)
        .join('|');
      return (
        d.code.trim().toLowerCase() !== orig.code.trim().toLowerCase() ||
        d.pmsRoomId.trim() !== (orig.pmsRoomId || '').trim() ||
        d.cmRoomId.trim() !== (orig.cmRoomId || '').trim() ||
        origExtras !== draftExtras
      );
    });
  }, [draftRows, config.roomCategories]);

  const stats = useMemo(() => {
    const active = draftRows.filter((r) => !r.isArchived);
    const totalExtra = active.reduce((acc, r) => acc + r.extraMappings.length, 0);
    return {
      total: active.length,
      pmsMapped: active.filter((r) => r.pmsRoomId.trim().length > 0).length,
      cmMapped: active.filter((r) => r.cmRoomId.trim().length > 0).length,
      totalExtra,
      conflicts: validation.rowErrors.size,
    };
  }, [draftRows, validation.rowErrors.size]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return draftRows;
    return draftRows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        r.pmsRoomId.toLowerCase().includes(q) ||
        r.cmRoomId.toLowerCase().includes(q) ||
        r.extraMappings.some(
          (m) =>
            m.externalCode.toLowerCase().includes(q) ||
            m.connectorName.toLowerCase().includes(q)
        )
    );
  }, [draftRows, searchQuery]);

  const handleFetchExternalCatalogs = async () => {
    setIsLoadingCatalogs(true);
    try {
      const [pmsResp, cmResp] = await Promise.all([
        fetch(`/api/external-catalog/pms?hotelId=${encodeURIComponent(hotel.id)}`),
        fetch(`/api/external-catalog/channel_manager?hotelId=${encodeURIComponent(hotel.id)}`),
      ]);
      const [pmsJson, cmJson] = await Promise.all([pmsResp.json(), cmResp.json()]);
      setPmsCatalog(Array.isArray(pmsJson.roomCategories) ? pmsJson.roomCategories : []);
      setCmCatalog(Array.isArray(cmJson.roomCategories) ? cmJson.roomCategories : []);
      onShowToast('Catalogues chambres PMS et Channel Manager chargés pour assistance au mapping.');
    } catch {
      onShowToast('Impossible de charger les catalogues externes PMS/CM.');
    } finally {
      setIsLoadingCatalogs(false);
    }
  };

  const handleFieldChange = (
    rowId: string,
    field: 'code' | 'pmsRoomId' | 'cmRoomId',
    value: string
  ) => {
    setDraftRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, [field]: value } : row))
    );
  };

  const handleAddConnectorMapping = (rowId: string) => {
    const defaultConn = mappableConnectors[0];
    const connId = defaultConn ? defaultConn.id : 'dedge';
    const connName = defaultConn ? defaultConn.displayName : 'D-EDGE CRS';
    const providerId = defaultConn ? defaultConn.providerId : 'dedge';
    const system: 'pms' | 'channel_manager' =
      defaultConn?.family === 'pms' ? 'pms' : 'channel_manager';

    setDraftRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              extraMappings: [
                ...row.extraMappings,
                {
                  id: `map-ext-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  connectorId: connId,
                  connectorName: connName,
                  providerId,
                  system,
                  externalCode: '',
                  externalName: row.name,
                  isPrimary: row.extraMappings.length === 0,
                },
              ],
            }
          : row
      )
    );
  };

  const handleUpdateExtraMapping = (
    rowId: string,
    mapId: string,
    patch: Partial<DraftExtraMapping>
  ) => {
    setDraftRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              extraMappings: row.extraMappings.map((em) =>
                em.id === mapId ? { ...em, ...patch } : em
              ),
            }
          : row
      )
    );
  };

  const handleRemoveExtraMapping = (rowId: string, mapId: string) => {
    setDraftRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              extraMappings: row.extraMappings.filter((em) => em.id !== mapId),
            }
          : row
      )
    );
  };

  const handleSaveMatrix = () => {
    if (!validation.isValid) {
      onShowToast(
        validation.serviceError ||
          validation.uniqueErrors[0] ||
          'Corrigez les doublons avant de sauvegarder la matrice.'
      );
      return;
    }

    const now = new Date().toISOString();
    const nextMappings: RoomTypeExternalMapping[] = [];
    validation.projectedRooms.forEach((rc) => {
      if (rc.pmsRoomId) {
        nextMappings.push({
          id: `map-pms-${rc.id}`,
          hotelId: hotel.id,
          internalRoomCode: rc.code,
          system: 'pms',
          externalCode: rc.pmsRoomId,
          externalName: rc.name,
          isPrimary: true,
          lastVerifiedAt: now,
        });
      }
      if (rc.cmRoomId) {
        nextMappings.push({
          id: `map-cm-${rc.id}`,
          hotelId: hotel.id,
          internalRoomCode: rc.code,
          system: 'channel_manager',
          externalCode: rc.cmRoomId,
          externalName: rc.name,
          isPrimary: true,
          lastVerifiedAt: now,
        });
      }
      if (rc.externalMappings && rc.externalMappings.length > 0) {
        nextMappings.push(...rc.externalMappings);
      }
    });

    onCommitMappings(
      validation.projectedRooms,
      nextMappings,
      `Mise à jour matrice multi-connecteurs chambres (${stats.pmsMapped} PMS, ${stats.cmMapped} CM, ${stats.totalExtra} mapping(s) additionnel(s))`,
      'Matrice de correspondance chambres enregistrée et validée sans doublon.'
    );
  };

  return (
    <section
      aria-label="Éditeur de correspondance des chambres PMS et Channel Manager"
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4"
    >
      {/* EN-TÊTE */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link2 className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Matrice Multi-Connecteurs Chambres (RoomMappingEditor)
            </h3>
            <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {stats.pmsMapped}/{stats.total} PMS · {stats.cmMapped}/{stats.total} Channel Manager · {stats.totalExtra} liaison(s) multi-connecteurs
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Associez chaque catégorie interne à ses identifiants PMS, Channel Manager et connecteurs multiples (Opera, Mews, D-EDGE, SiteMinder…). Doublons bloqués par connecteur.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrer code ou ID..."
              className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            />
          </div>

          <button
            type="button"
            onClick={() => void handleFetchExternalCatalogs()}
            disabled={isLoadingCatalogs}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <DownloadCloud className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
            <span>{isLoadingCatalogs ? 'Chargement...' : 'Charger IDs PMS / CM'}</span>
          </button>

          {isDirty && (
            <button
              type="button"
              onClick={() => setDraftRows(buildDrafts(config.roomCategories))}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-slate-600 dark:text-slate-300 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Réinitialiser</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSaveMatrix}
            disabled={!validation.isValid || !isDirty}
            className="px-3.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-45 disabled:cursor-not-allowed text-white font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Enregistrer la matrice</span>
          </button>
        </div>
      </div>

      {/* BANDEAU D'ÉTAT / VALIDATION ANTI-DOUBLON */}
      {!validation.isValid ? (
        <div
          role="alert"
          className="p-3 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Validation bloquée — doublon ou champ invalide détecté :</div>
            <ul className="list-disc pl-4 mt-1 space-y-0.5">
              {(validation.uniqueErrors.length > 0
                ? validation.uniqueErrors
                : [validation.serviceError || 'Erreur de validation']
              ).map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/20 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Unicité vérifiée : aucun doublon sur les codes internes, IDs PMS, IDs Channel Manager ni sur les connecteurs additionnels.
          </span>
          {isDirty && (
            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
              Modifications non enregistrées
            </span>
          )}
        </div>
      )}

      {/* MATRICE DE CORRESPONDANCE */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase text-slate-500 dark:text-slate-400">
              <th className="py-2.5 pr-3">Catégorie Flowtym</th>
              <th className="py-2.5 px-3">Code interne</th>
              <th className="py-2.5 px-3">ID Principal PMS</th>
              <th className="py-2.5 px-3">ID Principal CM</th>
              <th className="py-2.5 px-3">IDs Externes Multi-Connecteurs</th>
              <th className="py-2.5 pl-3">État</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredRows.map((row) => {
              const err = validation.rowErrors.get(row.id);
              const bothMapped = row.pmsRoomId.trim() !== '' && row.cmRoomId.trim() !== '';
              const partialMapped =
                !bothMapped &&
                (row.pmsRoomId.trim() !== '' ||
                  row.cmRoomId.trim() !== '' ||
                  row.extraMappings.some((m) => m.externalCode.trim() !== ''));

              return (
                <tr key={row.id} className={row.isArchived ? 'opacity-50' : ''}>
                  <td className="py-2.5 pr-3 font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap align-top">
                    {row.name}
                  </td>

                  <td className="py-2.5 px-3 align-top">
                    <input
                      type="text"
                      value={row.code}
                      onChange={(e) => handleFieldChange(row.id, 'code', e.target.value)}
                      aria-label={`Code interne pour ${row.name}`}
                      className={`w-32 px-2.5 py-1.5 rounded-lg border font-mono text-xs bg-white dark:bg-slate-900 ${
                        err?.codeError
                          ? 'border-rose-500 text-rose-700 dark:text-rose-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100'
                      }`}
                    />
                    {err?.codeError && (
                      <div className="text-[10px] text-rose-600 dark:text-rose-400 mt-0.5 font-semibold">
                        {err.codeError}
                      </div>
                    )}
                  </td>

                  <td className="py-2.5 px-3 align-top">
                    <div className="space-y-1">
                      <input
                        type="text"
                        value={row.pmsRoomId}
                        onChange={(e) => handleFieldChange(row.id, 'pmsRoomId', e.target.value)}
                        placeholder="ex: PMS-OPER-STD"
                        aria-label={`ID PMS pour ${row.name}`}
                        className={`w-40 px-2.5 py-1.5 rounded-lg border font-mono text-xs bg-white dark:bg-slate-900 ${
                          err?.pmsError
                            ? 'border-rose-500 text-rose-700 dark:text-rose-300'
                            : 'border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100'
                        }`}
                      />
                      {pmsCatalog.length > 0 && (
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) handleFieldChange(row.id, 'pmsRoomId', e.target.value);
                          }}
                          className="block w-40 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-300"
                          aria-label={`Suggestion PMS pour ${row.name}`}
                        >
                          <option value="">Catalogue PMS...</option>
                          {pmsCatalog.map((ext) => (
                            <option key={ext.externalCode} value={ext.externalCode}>
                              {ext.externalCode} — {ext.name}
                            </option>
                          ))}
                        </select>
                      )}
                      {err?.pmsError && (
                        <div className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">
                          {err.pmsError}
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="py-2.5 px-3 align-top">
                    <div className="space-y-1">
                      <input
                        type="text"
                        value={row.cmRoomId}
                        onChange={(e) => handleFieldChange(row.id, 'cmRoomId', e.target.value)}
                        placeholder="ex: DE-OPER-STD"
                        aria-label={`ID Channel Manager pour ${row.name}`}
                        className={`w-40 px-2.5 py-1.5 rounded-lg border font-mono text-xs bg-white dark:bg-slate-900 ${
                          err?.cmError
                            ? 'border-rose-500 text-rose-700 dark:text-rose-300'
                            : 'border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100'
                        }`}
                      />
                      {cmCatalog.length > 0 && (
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) handleFieldChange(row.id, 'cmRoomId', e.target.value);
                          }}
                          className="block w-40 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-300"
                          aria-label={`Suggestion Channel Manager pour ${row.name}`}
                        >
                          <option value="">Catalogue CM...</option>
                          {cmCatalog.map((ext) => (
                            <option key={ext.externalCode} value={ext.externalCode}>
                              {ext.externalCode} — {ext.name}
                            </option>
                          ))}
                        </select>
                      )}
                      {err?.cmError && (
                        <div className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">
                          {err.cmError}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* MULTI-CONNECTEURS */}
                  <td className="py-2.5 px-3 align-top min-w-[290px]">
                    <div className="space-y-1.5">
                      {row.extraMappings.map((em) => (
                        <div key={em.id} className="flex items-center gap-1.5">
                          <select
                            value={em.connectorId}
                            onChange={(e) => {
                              const found = mappableConnectors.find((c) => c.id === e.target.value);
                              handleUpdateExtraMapping(row.id, em.id, {
                                connectorId: e.target.value,
                                connectorName: found ? found.displayName : e.target.value,
                                providerId: found ? found.providerId : e.target.value,
                                system: found?.family === 'pms' ? 'pms' : 'channel_manager',
                              });
                            }}
                            className="w-32 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px]"
                            aria-label={`Connecteur pour ${row.name}`}
                          >
                            {mappableConnectors.length === 0 ? (
                              <>
                                <option value="dedge">D-EDGE CRS</option>
                                <option value="opera_cloud">Opera Cloud</option>
                                <option value="mews">Mews</option>
                                <option value="siteminder">SiteMinder</option>
                              </>
                            ) : (
                              mappableConnectors.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.displayName}
                                </option>
                              ))
                            )}
                          </select>
                          <input
                            type="text"
                            value={em.externalCode}
                            onChange={(e) =>
                              handleUpdateExtraMapping(row.id, em.id, {
                                externalCode: e.target.value,
                              })
                            }
                            placeholder="ID externe..."
                            className="w-28 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-[11px]"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveExtraMapping(row.id, em.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                            title="Retirer cette correspondance"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => handleAddConnectorMapping(row.id)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-600 dark:text-violet-400 hover:underline cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Ajouter ID connecteur</span>
                      </button>

                      {err?.extraError && (
                        <div className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">
                          {err.extraError}
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="py-2.5 pl-3 text-[11px] font-medium whitespace-nowrap align-top">
                    {err ? (
                      <span className="text-rose-600 dark:text-rose-400 font-semibold">
                        Conflit à résoudre
                      </span>
                    ) : bothMapped ? (
                      <span className="text-emerald-700 dark:text-emerald-400">
                        Complet (PMS + CM)
                      </span>
                    ) : partialMapped ? (
                      <span className="text-amber-700 dark:text-amber-400">
                        Partiel
                      </span>
                    ) : (
                      <span className="text-slate-400">Non mappé</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

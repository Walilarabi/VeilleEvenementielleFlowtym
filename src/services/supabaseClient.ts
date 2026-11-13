/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const DEFAULT_SUPABASE_URL = 'https://aliploqizujgovnlgjvg.supabase.co';

const STORAGE_URL_KEY = 'flowtym_supabase_url';
const STORAGE_ANON_KEY = 'flowtym_supabase_anon_key';

export const FLOWTYM_CORE_TABLES = [
  'organizations',
  'users',
  'user_hotel_access',
  'hotels',
  'room_types',
  'rate_plans',
  'market_segments',
  'distribution_channels',
  'cities',
  'venues',
  'hotel_geo_settings',
  'hotel_venue_distances',
  'events',
  'event_occurrences',
  'event_sources',
  'event_evidence',
  'event_hotel_impacts',
  'event_proposals',
  'event_suggestions',
  'reservations',
  'reservation_stay_nights',
  'otb_pace_snapshots',
  'dedge_inventory_days',
  'season_calendars',
  'pricing_guardrails',
  'learned_calibration_rules',
  'daily_rate_recommendations',
  'daily_restrictions',
  'competitors',
  'rate_shop_batches',
  'lighthouse_rates',
  'rate_parity_checks',
  'hotel_rms_configs',
  'rm_alerts',
  'rm_decision_records',
  'major_event_email_alert_configs',
  'major_event_email_alert_logs',
  'ari_push_jobs',
  'hotel_historical_daily',
  'hotel_historical_demand_snapshots',
  'hotel_parameters_profiles',
  'hotel_historical_import_logs',
  'hotel_backtest_evaluations',
  'audit_logs',
  'system_admin_configs',
  'system_operation_logs',
] as const;

export function getSupabaseCredentials(): { url: string; anonKey: string } {
  const envUrl = ((import.meta as any).env?.VITE_SUPABASE_URL || '').trim();
  const envKey = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '').trim();
  const localUrl = (typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_URL_KEY) || '' : '').trim();
  const localKey = (typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_ANON_KEY) || '' : '').trim();

  const looksLikeUrl = (v: string) => /^https?:\/\//i.test(v);
  const looksLikeKey = (v: string) => Boolean(v) && !looksLikeUrl(v);

  const resolvedUrl =
    (looksLikeUrl(localUrl) ? localUrl : '') ||
    (looksLikeUrl(envUrl) ? envUrl : '') ||
    (looksLikeUrl(envKey) ? envKey : '') ||
    DEFAULT_SUPABASE_URL;

  const resolvedKey =
    (looksLikeKey(localKey) ? localKey : '') ||
    (looksLikeKey(envKey) ? envKey : '') ||
    (looksLikeKey(envUrl) ? envUrl : '');

  return {
    url: resolvedUrl,
    anonKey: resolvedKey,
  };
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseCredentials();
  return Boolean(url && anonKey && url.startsWith('http'));
}

export function saveSupabaseCredentials(url: string, anonKey: string): void {
  if (typeof localStorage !== 'undefined') {
    if (url) {
      localStorage.setItem(STORAGE_URL_KEY, url.trim());
    } else {
      localStorage.removeItem(STORAGE_URL_KEY);
    }

    if (anonKey) {
      localStorage.setItem(STORAGE_ANON_KEY, anonKey.trim());
    } else {
      localStorage.removeItem(STORAGE_ANON_KEY);
    }
  }

  // Reset client cache so next call gets fresh instance
  cachedClient = null;
}

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;

  const { url, anonKey } = getSupabaseCredentials();
  if (!url || !anonKey || !url.startsWith('http')) {
    return null;
  }

  try {
    cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    return cachedClient;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}

export async function testSupabaseConnection(
  url?: string,
  key?: string
): Promise<{
  success: boolean;
  message: string;
  tablesFound?: string[];
  missingTables?: string[];
}> {
  const targetUrl = (url || getSupabaseCredentials().url).trim();
  const targetKey = (key || getSupabaseCredentials().anonKey).trim();

  if (!targetUrl || !targetKey) {
    return {
      success: false,
      message: 'URL Supabase et clé Anon Key requises pour vérifier la connexion.',
    };
  }

  try {
    const testClient = createClient(targetUrl, targetKey);
    const tablesToCheck = [
      'organizations',
      'hotels',
      'room_types',
      'rate_plans',
      'venues',
      'events',
      'reservations',
      'otb_pace_snapshots',
      'daily_rate_recommendations',
      'pricing_guardrails',
      'hotel_rms_configs',
      'rm_alerts',
      'rm_decision_records',
      'ari_push_jobs',
      'audit_logs',
    ];

    const checks = await Promise.all(
      tablesToCheck.map(async (tableName) => {
        const { error } = await testClient.from(tableName).select('id', { count: 'exact', head: true });
        if (!error) return { tableName, exists: true, authError: null };
        const msg = (error.message || '').toLowerCase();
        if (
          error.code === '42P01' ||
          error.code === 'PGRST205' ||
          msg.includes('does not exist') ||
          msg.includes('could not find the table')
        ) {
          return { tableName, exists: false, authError: null };
        }
        return { tableName, exists: false, authError: error };
      })
    );

    const fatalAuthError = checks.find(
      (c) => c.authError && (c.authError.message?.toLowerCase().includes('invalid api key') || c.authError.code === 'PGRST301')
    )?.authError;

    if (fatalAuthError) {
      return {
        success: false,
        message: `Erreur d'authentification Supabase : ${fatalAuthError.message}`,
      };
    }

    const tablesFound = checks.filter((c) => c.exists).map((c) => c.tableName);
    const missingTables = checks.filter((c) => !c.exists).map((c) => c.tableName);

    if (tablesFound.length === 0) {
      return {
        success: true,
        message:
          'Connexion établie avec https://aliploqizujgovnlgjvg.supabase.co, mais les tables ne sont pas encore créées. Exécutez le script SQL dans le SQL Editor Supabase.',
        tablesFound: [],
        missingTables,
      };
    }

    if (missingTables.length > 0) {
      return {
        success: true,
        message: `Connecté à Supabase (${tablesFound.length}/${tablesToCheck.length} tables principales détectées). Tables manquantes : ${missingTables.join(', ')}.`,
        tablesFound,
        missingTables,
      };
    }

    return {
      success: true,
      message: `Connexion à Supabase réussie ! Toutes les tables principales (${tablesFound.length}/${tablesToCheck.length}) sont actives.`,
      tablesFound,
      missingTables: [],
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Impossible de joindre le serveur Supabase. Vérifiez l’URL et la clé.',
    };
  }
}

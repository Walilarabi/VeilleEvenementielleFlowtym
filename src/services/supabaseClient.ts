/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_URL_KEY = 'flowtym_supabase_url';
const STORAGE_ANON_KEY = 'flowtym_supabase_anon_key';

export function getSupabaseCredentials(): { url: string; anonKey: string } {
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
  const localUrl = localStorage.getItem(STORAGE_URL_KEY) || '';
  const localKey = localStorage.getItem(STORAGE_ANON_KEY) || '';

  return {
    url: localUrl.trim() || envUrl.trim(),
    anonKey: localKey.trim() || envKey.trim(),
  };
}

export function saveSupabaseCredentials(url: string, anonKey: string): void {
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

export async function testSupabaseConnection(url?: string, key?: string): Promise<{
  success: boolean;
  message: string;
  tablesFound?: string[];
}> {
  const targetUrl = url || getSupabaseCredentials().url;
  const targetKey = key || getSupabaseCredentials().anonKey;

  if (!targetUrl || !targetKey) {
    return {
      success: false,
      message: 'URL et clé anonyme (Anon Key) requises.',
    };
  }

  try {
    const testClient = createClient(targetUrl, targetKey);
    // Ping a standard public table or query
    const { data, error } = await testClient.from('events').select('count', { count: 'exact', head: true });
    
    if (error) {
      // If table doesn't exist yet, but authentication worked:
      if (error.code === '42P01' || error.message?.includes('does not exist') || error.code === 'PGRST204') {
        return {
          success: true,
          message: 'Connexion à Supabase réussie ! Les tables doivent maintenant être initialisées via le script SQL.',
          tablesFound: [],
        };
      }
      return {
        success: false,
        message: `Erreur Supabase (${error.code || 'ERR'}): ${error.message}`,
      };
    }

    return {
      success: true,
      message: 'Connexion à Supabase réussie et table "events" détectée !',
      tablesFound: ['events'],
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Impossible de joindre le serveur Supabase. Vérifiez l’URL et la clé.',
    };
  }
}

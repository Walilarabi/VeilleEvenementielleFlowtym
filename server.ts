/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

dotenv.config();

const DEFAULT_SUPABASE_URL = 'https://aliploqizujgovnlgjvg.supabase.co';

const app = express();
app.use(express.json());

const port = Number(process.env.PORT) || 3000;

// Initialize Google GenAI client according to AI Studio guidelines
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  try {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    console.log('[Server] Google GenAI client initialized with server-side API key');
  } catch (err) {
    console.warn('[Server] Could not initialize Google GenAI client:', err);
  }
}

// In-memory campaign state registry
const activeCampaigns = new Map<string, any>();

function resolveServerSupabaseConfig(): { url: string; key: string } {
  const rawUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const rawKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();

  const looksLikeUrl = (v: string) => /^https?:\/\//i.test(v);
  const looksLikeKey = (v: string) => Boolean(v) && !looksLikeUrl(v);

  let url = looksLikeUrl(rawUrl) ? rawUrl : looksLikeUrl(rawKey) ? rawKey : DEFAULT_SUPABASE_URL;
  let key = looksLikeKey(rawKey) ? rawKey : looksLikeKey(rawUrl) ? rawUrl : '';

  if (!url) url = DEFAULT_SUPABASE_URL;
  return { url, key };
}

// 1. Health check
app.get('/api/health', (req, res) => {
  const { url, key } = resolveServerSupabaseConfig();
  res.json({
    status: 'ok',
    service: 'Flowtym Event Intelligence Agent API',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    supabaseUrl: url,
    hasSupabaseKey: Boolean(key),
    time: new Date().toISOString(),
  });
});

// 1b. Supabase connection & schema status
app.get('/api/supabase/status', async (req, res) => {
  const { url, key } = resolveServerSupabaseConfig();

  if (!key) {
    return res.status(200).json({
      connected: false,
      url,
      hasKey: false,
      tablesFound: [],
      message: 'Clé Supabase (VITE_SUPABASE_ANON_KEY ou SUPABASE_SERVICE_ROLE_KEY) non configurée dans .env.',
    });
  }

  try {
    const supabase = createClient(url, key);
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
    const results = await Promise.all(
      tablesToCheck.map(async (table) => {
        const { error } = await supabase.from(table).select('id', { count: 'exact', head: true });
        return { table, exists: !error, errorCode: error?.code || null, errorMsg: error?.message || null };
      })
    );
    const tablesFound = results.filter((r) => r.exists).map((r) => r.table);
    return res.json({
      connected: true,
      url,
      hasKey: true,
      tablesFound,
      missingTables: results.filter((r) => !r.exists).map((r) => r.table),
    });
  } catch (err: any) {
    return res.status(200).json({
      connected: false,
      url,
      hasKey: true,
      tablesFound: [],
      error: err?.message || 'Supabase connection error',
    });
  }
});

// 1c. Serve complete Supabase DDL SQL migration
app.get('/api/supabase/schema', (req, res) => {
  try {
    const sqlPath = path.resolve(process.cwd(), 'src/supabase/migrations/00_complete_flowtym_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    res.type('text/plain').send(sql);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Could not read schema SQL' });
  }
});

// 2. Real-time Gemini Search Grounding endpoint
app.post('/api/agent/search', async (req, res) => {
  const { city = 'Paris', lat = 48.8718, lng = 2.3316 } = req.body;

  if (!ai) {
    return res.status(200).json({
      groundingChunks: [],
      message: 'Gemini client not initialized, fallback to verified registry',
    });
  }

  try {
    const prompt = `Recherche les grands événements (salons professionnels, congrès médicaux, tournées de concerts en aréna/stade, grands événements sportifs internationaux) confirmés ou prévus à ${city} et dans un rayon de 30 km (notamment Paris Expo Porte de Versailles, Villepinte, Accor Arena, Stade de France, La Défense Arena) pour 2026, 2027 et 2028.
Cite les dates officielles, le lieu exact, l'affluence attendue et le site web officiel de l'événement.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || '';
    const groundingChunks =
      response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
        uri: chunk.web?.uri || '',
        title: chunk.web?.title || '',
      })) || [];

    const searchQueries =
      response.candidates?.[0]?.groundingMetadata?.webSearchQueries || [];

    res.json({
      success: true,
      text,
      groundingChunks,
      searchQueries,
    });
  } catch (err: any) {
    console.error('[GeminiSearch] Error executing web search grounding:', err);
    res.status(200).json({
      groundingChunks: [],
      error: err?.message || 'Search execution error',
    });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile('dist/index.html', { root: '.' });
    });
  }

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`[Flowtym] Server running on http://0.0.0.0:${port}`);
  });

  server.on('error', (err: any) => {
    console.error('[Flowtym Server Error]', err);
  });
}

startServer();

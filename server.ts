/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;

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

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Flowtym Event Intelligence Agent API',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    time: new Date().toISOString(),
  });
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

  app.listen(port, () => {
    console.log(`[Flowtym] Server running on http://localhost:${port}`);
  });
}

startServer();

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

// Fallback key provided by the user in this session
const FALLBACK_KEY = 'AIzaSyBxfqsOZHfVcTTv8J8lmm5fv_K98lB72HQ';

let isConfigured = false;
let loadPromise: Promise<typeof google> | null = null;

export function getGoogleMapsApiKey(): string {
  const envKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (envKey && envKey.trim().length > 0 && !envKey.includes('MY_GOOGLE_MAPS_API_KEY')) {
    return envKey.trim();
  }
  return FALLBACK_KEY;
}

export function loadGoogleMaps(): Promise<typeof google> {
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    if (!isConfigured) {
      const key = getGoogleMapsApiKey();
      setOptions({
        key,
        v: 'weekly',
        language: 'fr',
        region: 'FR',
      });
      isConfigured = true;
    }

    await importLibrary('maps');
    await importLibrary('marker');
    await importLibrary('geometry');

    return (window as any).google;
  })();

  return loadPromise;
}

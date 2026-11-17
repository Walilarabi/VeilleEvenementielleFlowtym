/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export function resolveApiUrl(path: string): string {
  if (typeof window !== 'undefined') return path;
  const base =
    (typeof process !== 'undefined' && process.env?.FLOWTYM_API_BASE) || 'http://127.0.0.1:3000';
  return `${base}${path}`;
}

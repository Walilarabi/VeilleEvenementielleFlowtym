export function parseHoptymNumber(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let normalized = String(value).trim().replace(/[€$£%]/g, '').replace(/[\s\u00a0\u202f]/g, '');
  const comma = normalized.lastIndexOf(',');
  const dot = normalized.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) {
    const decimal = comma > dot ? ',' : '.';
    normalized = decimal === ',' ? normalized.replace(/\./g, '').replace(',', '.') : normalized.replace(/,/g, '');
  } else if (comma >= 0 || dot >= 0) {
    const separator = comma >= 0 ? ',' : '.';
    const parts = normalized.split(separator);
    if (parts.length > 2) {
      const last = parts.pop() || '';
      normalized = parts.join('') + (last.length > 0 && last.length <= 2 ? '.' + last : last);
    } else {
      const fraction = parts[1] || '';
      normalized = fraction.length > 0 && fraction.length <= 2 ? parts[0] + '.' + fraction : parts.join('');
    }
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseHoptymBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  return ['true', '1', 'yes', 'oui', 'x', 'closed', 'ferme', 'fermé'].includes(String(value ?? '').trim().toLowerCase());
}

export function parseHoptymDate(value: unknown): string | null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 100000) {
    return new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000).toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  const iso = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) {
    const candidate = iso[1];
    const date = new Date(candidate + 'T00:00:00.000Z');
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === candidate ? candidate : null;
  }
  const fr = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (fr) {
    const candidate = `${fr[3]}-${fr[2].padStart(2, '0')}-${fr[1].padStart(2, '0')}`;
    const date = new Date(candidate + 'T00:00:00.000Z');
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === candidate ? candidate : null;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

export async function createHoptymImportFingerprint(
  dataset: string,
  hotelId: string,
  records: Array<Record<string, unknown>>
): Promise<string> {
  const payload = JSON.stringify({ schemaVersion: 2, dataset, hotelId, records });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Shared output helpers. Every configurator package that writes spreadsheets, CSV files or hashed manifests uses
 * these so the safety rules stay identical across tools.
 */

/** Text that a spreadsheet would run as a formula: =, +, -, @ (optionally after leading spaces), or a leading tab or carriage return. */
const FORMULA_START = /^\s*[=+\-@]|^[\t\r]/

/** Returns strings that could run as a formula prefixed with an apostrophe; every other value is returned unchanged. */
export function spreadsheetSafe<T>(value: T): T | string {
  return typeof value === 'string' && FORMULA_START.test(value) ? `'${value}` : value
}

/** One quoted CSV cell: formula-safe, double quotes doubled, null and undefined written as empty. */
export function csvCell(value: unknown): string {
  const text = String(spreadsheetSafe(value ?? ''))
  return `"${text.replace(/"/g, '""')}"`
}

/** Lowercase hex SHA-256 of text (UTF-8) or bytes, using Web Crypto. */
export async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource)
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/** Size and SHA-256 for each file, sorted by path, for package manifests. */
export async function fileDigests(files: Record<string, string | Uint8Array>): Promise<{ path: string; bytes: number; sha256: string }[]> {
  const paths = Object.keys(files).sort()
  return Promise.all(paths.map(async path => {
    const data = files[path]
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
    return { path, bytes: bytes.byteLength, sha256: await sha256Hex(bytes) }
  }))
}

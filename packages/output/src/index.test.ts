import { describe, it, expect } from 'vitest'
import { csvCell, fileDigests, sha256Hex, spreadsheetSafe } from './index'

describe('spreadsheetSafe', () => {
  it('prefixes every formula start, including after leading spaces and tab or carriage return', () => {
    for (const value of ['=1+1', '+SUM(A1)', '-2', '@cmd', '  =HYPERLINK("x")', '\tcmd', '\rcmd']) expect(spreadsheetSafe(value)).toBe(`'${value}`)
  })
  it('leaves safe text and non-strings unchanged', () => {
    expect(spreadsheetSafe('node1')).toBe('node1')
    expect(spreadsheetSafe('a=b')).toBe('a=b')
    expect(spreadsheetSafe(42)).toBe(42)
    expect(spreadsheetSafe(true)).toBe(true)
  })
})

describe('csvCell', () => {
  it('quotes, doubles quotes, escapes formulas and writes empty values', () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('=cmd')).toBe(`"'=cmd"`)
    expect(csvCell(null)).toBe('""')
    expect(csvCell(undefined)).toBe('""')
    expect(csvCell(7)).toBe('"7"')
  })
})

describe('sha256Hex and fileDigests', () => {
  it('hashes text and bytes identically and lists files sorted with sizes', async () => {
    const empty = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    expect(await sha256Hex('')).toBe(empty)
    expect(await sha256Hex('abc')).toBe(await sha256Hex(new TextEncoder().encode('abc')))
    const digests = await fileDigests({ 'b.txt': 'abc', 'a.bin': new Uint8Array([1, 2, 3]) })
    expect(digests.map(d => [d.path, d.bytes])).toEqual([['a.bin', 3], ['b.txt', 3]])
    expect(digests[1].sha256).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})

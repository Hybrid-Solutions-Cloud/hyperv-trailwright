/** A hostname or strict IPv4 literal; URLs, ports, numeric pseudo-addresses and empty labels are excluded. */
export function dnsOrIpv4(value:string):boolean{return value.length>0&&value.length<=253&&(/^[\d.]+$/.test(value)?ipv4(value)!==null:value.split('.').every(label=>/^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label)))}

export function ipv4(value: string): number | null {
  const parts = value.split('.')
  if (parts.length !== 4 || parts.some(p => !/^(0|[1-9]\d{0,2})$/.test(p) || Number(p) > 255)) return null
  return parts.reduce((sum, p) => sum * 256 + Number(p), 0)
}
export function cidr(value: string): { first: number; last: number; prefix: number } | null {
  const parts = value.split('/')
  if (parts.length !== 2 || !/^(\d|[12]\d|3[0-2])$/.test(parts[1])) return null
  const address = ipv4(parts[0])
  if (address === null) return null
  const prefix = Number(parts[1]), size = 2 ** (32 - prefix)
  const first = Math.floor(address / size) * size
  return { first, last: first + size - 1, prefix }
}

/** Commercial core-license planning rules; entitlement and program eligibility are separate reviews. */
export const CORE_LICENSE_RULES = {
  id:'microsoft-commercial-core-2025',version:'0.1.0',reviewedAt:'2026-09-11',
  sources:[
    'https://www.microsoft.com/licensing/guidance/Windows-Server-2025',
    'https://www.microsoft.com/licensing/guidance/Core-based-licensing-models',
  ],
  scope:'Windows Server and System Center Commercial Licensing core models; not a SPLA, OEM, outsourcing, reassignment or included-SQL determination.',
} as const

const whole = (value:number,min:number) => Number.isSafeInteger(value) && value >= min && value <= 1_000_000
export interface PhysicalCoreInputs {
  sockets:number
  coresPerSocket:number
  edition:'standard'|'datacenter'
  /** Maximum virtual OSEs on this particular server, including maintenance/failover placement. */
  peakVirtualOSEs:number
  /** Only host/manage virtual OSEs, an additional counted physical OSE, or no counted physical OSE. */
  physicalOSE:'hosting-only'|'other'|'absent'
}
export function physicalCoreRequirement(input:PhysicalCoreInputs) {
  if (!whole(input.sockets,1) || !whole(input.coresPerSocket,1) || !whole(input.peakVirtualOSEs,0) || !['standard','datacenter'].includes(input.edition) || !['hosting-only','other','absent'].includes(input.physicalOSE)) return null
  const physicalCores = input.sockets * input.coresPerSocket
  const baseCores = Math.max(physicalCores,input.sockets * 8,16)
  const countedOSEs = input.peakVirtualOSEs + (input.physicalOSE === 'other' ? 1 : 0)
  // Selecting physical-core coverage still needs one complete set when only the physical OSE is used.
  const sets = input.edition === 'datacenter' ? 1 : Math.max(1,Math.ceil(countedOSEs / 2))
  const coreLicenses = baseCores * sets
  if (!Number.isSafeInteger(coreLicenses)) return null
  return {physicalCores,baseCores,countedOSEs,sets,coreLicenses,twoCorePacks:Math.ceil(coreLicenses / 2),virtualOSELimit:input.edition === 'datacenter' ? null : sets * 2 - (input.physicalOSE === 'other' ? 1 : 0)}
}

export interface VirtualCoreInputs {vCores:number;count:number}
/** The caller must supply the reviewed complete customer/product pool, never combine unrelated customers. */
export function virtualCoreRequirement(machines:VirtualCoreInputs[],eligibleSubscriptionOrSa:boolean) {
  if (!eligibleSubscriptionOrSa || !machines.length || machines.some(m=>!whole(m.vCores,1) || !whole(m.count,1))) return null
  const rows = machines.map(m=>({...m,coresPerVM:Math.max(8,m.vCores)}))
  const vmCoreLicenses = rows.reduce((sum,m)=>sum+m.coresPerVM*m.count,0)
  const coreLicenses = Math.max(16,vmCoreLicenses)
  if (!Number.isSafeInteger(coreLicenses)) return null
  return {rows,vmCoreLicenses,customerMinimumTopUp:coreLicenses-vmCoreLicenses,coreLicenses,twoCorePacks:Math.ceil(coreLicenses/2)}
}

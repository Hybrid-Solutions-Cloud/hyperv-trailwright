import {describe,it,expect} from 'vitest'
import {physicalCoreRequirement,virtualCoreRequirement} from './licenseModel'

describe('commercial core-license arithmetic',()=>{
  it('applies physical processor and server minimums without confusing packs with OSE rights',()=>{
    expect(physicalCoreRequirement({sockets:2,coresPerSocket:4,edition:'standard',peakVirtualOSEs:2,physicalOSE:'hosting-only'})).toMatchObject({physicalCores:8,baseCores:16,sets:1,coreLicenses:16,twoCorePacks:8,virtualOSELimit:2})
    expect(physicalCoreRequirement({sockets:4,coresPerSocket:4,edition:'standard',peakVirtualOSEs:2,physicalOSE:'hosting-only'})).toMatchObject({baseCores:32,sets:1,coreLicenses:32,virtualOSELimit:2})
  })
  it('relicenses every physical core for additional Standard OSE pairs and counts a non-hosting physical OSE',()=>{
    expect(physicalCoreRequirement({sockets:2,coresPerSocket:16,edition:'standard',peakVirtualOSEs:3,physicalOSE:'hosting-only'})).toMatchObject({baseCores:32,sets:2,coreLicenses:64,virtualOSELimit:4})
    expect(physicalCoreRequirement({sockets:2,coresPerSocket:16,edition:'standard',peakVirtualOSEs:2,physicalOSE:'other'})).toMatchObject({countedOSEs:3,sets:2,coreLicenses:64,virtualOSELimit:3})
  })
  it('does not remove reserved/failover servers from the physical licensing calculation',()=>{
    const servers=[2,2,4].map(peakVirtualOSEs=>physicalCoreRequirement({sockets:2,coresPerSocket:8,edition:'standard',peakVirtualOSEs,physicalOSE:'hosting-only'})!)
    expect(servers.reduce((n,s)=>n+s.coreLicenses,0)).toBe(64)
    expect(physicalCoreRequirement({sockets:2,coresPerSocket:8,edition:'datacenter',peakVirtualOSEs:100,physicalOSE:'hosting-only'})).toMatchObject({sets:1,coreLicenses:16,virtualOSELimit:null})
  })
  it('requires eligible VM licensing rights and applies per-VM and customer minimums separately',()=>{
    expect(virtualCoreRequirement([{vCores:2,count:1}],false)).toBeNull()
    expect(virtualCoreRequirement([{vCores:2,count:1}],true)).toMatchObject({vmCoreLicenses:8,customerMinimumTopUp:8,coreLicenses:16})
    expect(virtualCoreRequirement([{vCores:2,count:2},{vCores:12,count:1}],true)).toMatchObject({vmCoreLicenses:28,customerMinimumTopUp:0,coreLicenses:28})
  })
  it('separates core requirements from purchasable packs and rejects missing/fractional inventory',()=>{
    expect(virtualCoreRequirement([{vCores:9,count:1}],true)).toMatchObject({rows:[{coresPerVM:9}],vmCoreLicenses:9,coreLicenses:16})
    expect(virtualCoreRequirement([{vCores:9,count:2}],true)).toMatchObject({coreLicenses:18,twoCorePacks:9})
    expect(physicalCoreRequirement({sockets:1,coresPerSocket:17,edition:'standard',peakVirtualOSEs:3,physicalOSE:'hosting-only'})).toMatchObject({baseCores:17,coreLicenses:34,twoCorePacks:17})
    for(const value of [0,-1,1.5,NaN,Infinity])expect(physicalCoreRequirement({sockets:value,coresPerSocket:8,edition:'standard',peakVirtualOSEs:1,physicalOSE:'hosting-only'})).toBeNull()
    expect(virtualCoreRequirement([],true)).toBeNull();expect(virtualCoreRequirement([{vCores:8,count:0}],true)).toBeNull()
  })
})

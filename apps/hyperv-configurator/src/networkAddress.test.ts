import {it,expect} from 'vitest'
import {dnsOrIpv4} from './networkAddress'
import {validate} from './validation'
import {vmmFixture} from './testing/vmmFixture'

it('uses the same BMC address contract in generic review and the VMM handoff',()=>{
  const {project,host}=vmmFixture()
  for(const address of ['bmc.example.test','BMC-01','192.0.2.25']){
    host.values.bmcAddress=address
    expect(dnsOrIpv4(address)).toBe(true)
    expect(validate(project).filter(f=>f.recordId===host.id&&f.fieldKey==='bmcAddress')).toEqual([])
  }
  for(const address of ['256.1.1.1','192.00.2.1','1.2.3','bmc..test','https://bmc.test','bmc.test:443','-bmc.test','bmc_.test','a'.repeat(64)+'.test']){
    host.values.bmcAddress=address
    expect(dnsOrIpv4(address),address).toBe(false)
    expect(validate(project).some(f=>f.code==='BMC_ADDRESS'&&f.fieldKey==='bmcAddress')).toBe(true)
  }
  host.values.bmcAddress='bmc.example.test';host.values.managementIp='host.example.test'
  expect(validate(project).some(f=>f.code==='IP_ADDRESS'&&f.fieldKey==='managementIp')).toBe(true)
})

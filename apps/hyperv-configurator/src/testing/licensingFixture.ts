import {collections,newRecord,type Answers} from '../catalog'
import {newProject,newComponent} from '../project'

export function licensingFixture(model:'physical'|'virtual'|'manual'='physical') {
  const project=newProject();project.name='Licensing example';project.owner='Example licensing owner';project.updatedAt='2026-09-11T00:00:00.000Z';project.createdAt=project.updatedAt
  const add=(key:string,id:string,values:Answers)=>{const row=newRecord(collections.find(c=>c.key===key)!);row.id=id;Object.assign(row.values,{name:id,owner:project.owner},values);project.design[key].push(row);return row}
  add('clusters','cluster-a',{name:'Example cluster',os:'ws2025',edition:'standard',reserveNodes:1})
  const host=add('hosts','host-a',{name:'example-hv01',cluster:'cluster-a',sockets:2,coresPerSocket:8})
  add('hosts','host-b',{name:'example-hv02',cluster:'cluster-a',sockets:2,coresPerSocket:8})
  const vm=newComponent('vmm');vm.id='vm-a';vm.name='example-vmm';vm.vCpu=4;vm.hosting='vcd';project.components.push(vm)
  const license=add('licenses','license-a',{name:'Windows core coverage',product:'windows',edition:'Windows Server 2025 Standard',context:'internal',program:'Example Commercial Licensing agreement',basis:'Example two-core SKU',rights:'purchase',required:24,owned:model==='physical'?8:0,unitPrice:10,currency:'USD',quoteDate:'2026-09-10',term:'perpetual',saExpiry:'2027-09-11',calculationModel:model,coreEdition:'standard',unitBasis:'pack2',ruleProfile:'commercial2025',customerScope:'Example customer',vmEligibility:'sa',customerMinimumReview:'Complete fictional customer/product pool reviewed; no other holdings inferred.',entitlementId:'example-pool',entitlementTotalUnits:model==='physical'?8:0,assignmentReview:'Example quantity and entitlement assignment review.',reviewedAt:'2026-09-11',quoteStatus:'quoted',quoteSource:'Example quote reference'})
  Object.assign(license.values,{commercialProgram:'commercial',agreementRef:'EXAMPLE agreement evidence',rightsOwner:'Example rights reviewer',rightsEvidence:'EXAMPLE applicable product terms review',entitlementTerm:'sa',termStart:'2026-01-01',assignedAt:'2026-01-01',reassignmentBasis:model==='virtual'?'vmMobility':'fixed',mobilityEvidence:'EXAMPLE assignment and server farm review',activationMethod:'kms',activationRef:'secret-ref://example/activation',activationEvidence:'EXAMPLE KMS prerequisite and owner review'})
  const assign=(id:string,values:Answers)=>add('licenseAssignments',id,{license:license.id,placementReview:'Example per-host peak includes all approved maintenance/failover arrivals; do not subtract reserve hosts.',...values})
  if(model==='physical') {assign('assignment-a',{kind:'host',host:host.id,peakVirtualOSEs:2,physicalOSE:'hosting-only'});assign('assignment-b',{kind:'host',host:'host-b',peakVirtualOSEs:4,physicalOSE:'hosting-only'})}
  if(model==='virtual')assign('assignment-a',{kind:'vm',vm:vm.id,osClass:'windows'})
  return {project,license,host,vm,add,assign}
}

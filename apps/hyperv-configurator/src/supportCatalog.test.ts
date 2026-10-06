import {it,expect} from 'vitest'
import {SUPPORT_CATALOG,componentSupportIds,releaseLabel,supportPlan} from './supportCatalog'
import {newComponent,newProject} from './project'

it('keeps dated vendor support, preview, unknown and Configurator execution boundaries distinct',()=>{
  const entries=SUPPORT_CATALOG.entries
  expect(new Set(entries.map(e=>e.id)).size).toBe(entries.length)
  expect(new Set(entries.map(e=>e.status))).toEqual(new Set(['supported','preview','unknown','unavailable']))
  for(const row of entries.filter(e=>e.basis==='vendor'))expect(row.sources.every(s=>s.startsWith('https://'))&&row.sources.length>0).toBe(true)
  expect(entries.find(e=>e.id==='native-consumers')).toMatchObject({basis:'configurator',status:'unknown'})
  expect(entries.find(e=>e.id==='ome-manual-install')).toMatchObject({basis:'configurator',status:'unavailable'})
})
it('does not interpret arbitrary build strings, other releases or provider wrappers as matching support',()=>{
  for(const version of ['2025','2025 UR1','2025.1'])expect(releaseLabel(version,'2025')).toBe(true)
  for(const version of ['20250','2022','10.25.1439.0','2025 or 2022','2025 preview',''])expect(releaseLabel(version,'2025')).toBe(false)
  const project=newProject(),component=newComponent('ome');project.components.push(component);component.version='4.7.0';component.hosting='vcd'
  expect(componentSupportIds(component)).toContain('ome-47-provider-wrapper')
  expect(supportPlan(project).rows[0].entry.status).toBe('unknown')
  component.hosting='hyperv-existing';expect(componentSupportIds(component)).toContain('ome-47-hyperv')
  component.version='4.5';expect(supportPlan(project).rows[0].entry.id).toBe('unlisted-component')
})
it('never upgrades preview or host-controller tool compatibility through an acceptance checkbox',()=>{
  const project=newProject(),component=newComponent('wac');component.productDetails.mode='virtualization';project.components.push(component)
  for(const accepted of [false,true]){project.requirements.previewsAccepted=accepted;expect(supportPlan(project).rows.every(r=>r.entry.status==='preview')).toBe(true)}
  project.sdn.scope='new';project.sdn.architecture='host-cluster-role';project.sdn.osVersion='Windows Server 2025';project.sdn.owner='vmm';project.sdn.toolVersion='2025 UR1'
  expect(supportPlan(project).rows.find(r=>r.entry.id==='sdn-vmm-host-controller')?.entry.status).toBe('unknown')
  project.sdn.osVersion='Windows Server 2022'
  expect(supportPlan(project).rows.some(r=>r.entry.id==='sdn-controller-cluster')).toBe(false)
  project.sdn.scope='none';expect(supportPlan(project).rows.some(r=>r.targetId==='sdn')).toBe(false)
})

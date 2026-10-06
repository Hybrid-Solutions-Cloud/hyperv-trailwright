import {test,expect} from '@playwright/test'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import PizZip from 'pizzip'
import {newProject,newComponent} from '../src/project'
import {collections,newRecord} from '../src/catalog'

test('existing VMware guest ownership and component network mappings survive review and export',async({page},info)=>{
  page.on('dialog',d=>d.accept());const project=newProject();project.name='Existing VMware guest example';project.owner='Design team';project.scope='management'
  const c=newComponent('wac');c.name='Example existing gateway';c.version='2511';c.owner='Platform team';c.hosting='vsphere';c.lifecycle='preserve';c.vCpu=4;c.memoryGiB=8;c.diskGiB=100;c.placement='Existing VMware management pool';c.productDetails.mode='administration'
  Object.assign(c.hostingDetails,{configureGuest:true,resourceId:'vm-42',currentEvidence:'Existing vCenter inventory EXAMPLE-42',currentObservedAt:'2026-09-10T12:00:00Z',providerEndpoint:'https://vcenter.example.test',providerVersion:'8.0 U3',providerCredentialRef:'secret-ref://example/vcenter',datacenterId:'datacenter-1',poolId:'resgroup-8',consumer:'Reviewed guest configuration handoff',consumerVersion:'1.0.0',consumerEvidence:'Example contract and scoped target evidence',preservation:'Retain the existing VM, disks and placement.',guestAcceptance:'Confirm guest identity, connectivity and supported WAC prerequisites.'})
  project.components.push(c)
  const network=newRecord(collections.find(c=>c.key==='networks')!);network.id='management-net';Object.assign(network.values,{name:'Management network',owner:'Network team',purpose:'vm',routingScope:'management',cidr:'10.40.0.0/24',gateway:'10.40.0.1',vlan:120,mtu:1500});project.design.networks.push(network)
  const nic=newRecord(collections.find(c=>c.key==='managementNetworks')!);Object.assign(nic.values,{name:'Gateway NIC',owner:'Network team',component:c.id,network:network.id,lifecycle:'configure',currentId:'4000',providerNetworkId:'dvportgroup-12',adapterName:'Ethernet',addressing:'static',ip:'10.41.0.11/24',gateway:'10.40.0.1',dns:'10.40.0.2',preservation:'Retain adapter identity and management route.',acceptance:'DNS and gateway connectivity accepted by operator.'});project.design.managementNetworks.push(nic)
  await page.goto('./');await page.locator('input[type=file]').first().setInputFiles({name:'hosting.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))})
  const nav=page.getByRole('navigation',{name:'Design sections'});await nav.getByRole('button',{name:/Review and exports/}).click()
  await page.getByRole('button',{name:'Example existing gateway: Use existing preserves the resource. Choose Configure existing before selecting a configuration action.',exact:true}).click();await expect(page.getByLabel('Lifecycle',{exact:true})).toBeFocused();await page.getByLabel('Lifecycle',{exact:true}).selectOption('configure')
  await nav.getByRole('button',{name:/Hosting and availability/}).click();await page.getByLabel('Guest configuration owner',{exact:true}).fill('Windows team');await expect(page.getByLabel('Create infrastructure',{exact:true})).not.toBeChecked();await expect(page.getByLabel('Install product',{exact:true})).not.toBeChecked()
  await expect(page.getByRole('region',{name:'Component hosting and ownership'})).toContainText('guest configuration: Windows team')
  await nav.getByRole('button',{name:/Review and exports/}).click();await page.getByRole('button',{name:'Gateway NIC: The address/prefix must match the selected design subnet.',exact:true}).click();await expect(page.getByLabel('IPv4 address / prefix',{exact:true})).toBeFocused();await page.getByLabel('IPv4 address / prefix',{exact:true}).fill('10.40.0.11/24')
  const savedEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download project',exact:true}).click();const saved=await readFile((await(await savedEvent).path())!,'utf8');expect(JSON.parse(saved)).toMatchObject({schemaVersion:32,components:[{lifecycle:'configure',hostingDetails:{resourceId:'vm-42',guestOwner:'Windows team',createInfrastructure:false}}],design:{managementNetworks:[{values:{ip:'10.40.0.11/24'}}]}})
  await page.locator('input[type=file]').first().setInputFiles({name:'reopen.json',mimeType:'application/json',buffer:Buffer.from(saved)})
  await nav.getByRole('button',{name:/Hosting and availability/}).click();await expect(page.getByLabel('Existing immutable VM / server / service ID',{exact:true})).toHaveValue('vm-42')
  await page.setViewportSize({width:390,height:844});await page.getByRole('region',{name:'Component hosting and ownership'}).scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('hosting-mobile.png')})
  await nav.getByRole('button',{name:/Review and exports/}).click();const event=page.waitForEvent('download');await page.getByRole('button',{name:'Download design package (.zip)',exact:true}).click();const download=await event;await download.saveAs(info.outputPath('hosting-design.zip'))
  const zip=new PizZip(await readFile((await download.path())!)),plan=JSON.parse(zip.file('plans/component-hosting.json')!.asText())
  expect(plan.findings).toEqual([]);expect(plan.components[0].executionReady).toBe(false);expect(plan.components[0].actions.filter((a:any)=>a.selected).map((a:any)=>a.key)).toEqual(['configureGuest']);expect(plan.attachments[0].values.component).toBe(c.id)
  for(const entry of JSON.parse(zip.file('manifest.json')!.asText()).files){const bytes=zip.file(entry.path)!.asUint8Array();expect(bytes.length).toBe(entry.sizeBytes);expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256)}
})

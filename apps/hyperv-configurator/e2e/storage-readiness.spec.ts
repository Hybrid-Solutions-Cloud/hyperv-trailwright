import {test,expect} from '@playwright/test'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import PizZip from 'pizzip'
import {storageFixture} from '../src/testing/storageFixture'

test('physical eligibility correction and SAN interface ownership survive reopen and export',async({page},info)=>{
  const {project}=storageFixture();project.name='Physical storage readiness example'
  for(const disk of project.design.disks.filter(d=>d.values.role!=='boot'))Object.assign(disk.values,{bus:disk.values.media==='nvme'?'nvme':'sata',presentation:'direct',sharedAccess:'no',multipath:'no',powerLossProtection:'yes',nativeDiskIds:'EXAMPLE '+disk.id,driverVersion:'EXAMPLE reviewed storage driver',certification:'EXAMPLE device and OS certification review',observedAt:'2026-09-11T12:00:00Z',evidence:'EXAMPLE direct attachment and flash protection inspection'})
  project.design.disks.find(d=>d.id==='capacity-1')!.values.bus='fc'
  page.on('dialog',d=>d.accept());const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
  await page.goto('./');await page.locator('input[type=file]').first().setInputFiles({name:'storage.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))})
  const nav=page.getByRole('navigation',{name:'Design sections'});await nav.getByRole('button',{name:/Storage/}).click()
  const review=page.getByRole('region',{name:'Physical storage eligibility',exact:true});await expect(review.getByRole('row').filter({hasText:'capacity-1'})).toContainText('incompatible')
  await nav.getByRole('button',{name:/Review and exports/}).click()
  await page.getByRole('button',{name:'Physical Windows Server S2D capacity/cache devices must be attached to one host; SAN, shared SAS and virtual disks do not qualify for this physical deployment path.',exact:true}).click()
  const physical=page.locator('[data-record-id="capacity-1"]');await expect(physical.getByLabel('Physical storage connection',{exact:true})).toBeFocused();await physical.getByLabel('Physical storage connection',{exact:true}).selectOption('sata')
  await expect(review.getByRole('row').filter({hasText:'capacity-1'})).toContainText('operator-reviewed')
  await page.getByRole('button',{name:'+ Add storage interface',exact:true}).click()
  const port=page.locator('[data-record-id]').filter({has:page.getByLabel('Native HBA / interface identity',{exact:true})}),portId=(await port.getAttribute('data-record-id'))!
  await port.getByLabel('Name *',{exact:true}).fill('Example FC port A');await port.getByLabel('Owner *',{exact:true}).fill('Storage team');await port.getByLabel('Initiating host *',{exact:true}).selectOption('host-1');await port.getByLabel('Storage interface protocol *',{exact:true}).selectOption('fc');await port.getByLabel('Native HBA / interface identity',{exact:true}).fill('EXAMPLE HBA-A/port1');await port.getByLabel('Initiator WWPN / iSCSI name',{exact:true}).fill('20:00:00:00:00:00:00:01');await port.getByLabel('Physical slot / port',{exact:true}).fill('Slot 3 port 1');await port.getByLabel('Physical fabric / failure domain',{exact:true}).fill('Physical fabric A');await port.getByLabel('HBA / NIC driver and firmware',{exact:true}).fill('EXAMPLE pinned HBA driver');await port.getByLabel('Interface, vendor DSM and physical-path qualification',{exact:true}).fill('EXAMPLE vendor support and failover review');await port.getByLabel('Storage interface observation (UTC)',{exact:true}).fill('2026-09-11T12:00:00Z');await port.getByLabel('Initiator inventory evidence',{exact:true}).fill('EXAMPLE physical initiator inventory')
  await page.getByRole('button',{name:'+ Add SAN I/O path',exact:true}).click()
  const route=page.locator('[data-record-id]').filter({has:page.getByLabel('Initiating storage interface',{exact:true})})
  await route.getByLabel('Name *',{exact:true}).fill('Example SAN route A');await route.getByLabel('Owner *',{exact:true}).fill('Storage team');await route.getByLabel('Presented volume *',{exact:true}).selectOption('san-volume');await route.getByLabel('Initiating host *',{exact:true}).selectOption('host-1');await route.getByLabel('Initiator WWPN / IQN *',{exact:true}).fill('2000000000000001');await route.getByLabel('Target WWPN / portal *',{exact:true}).fill('5000000000000001');await route.getByLabel('Independent fabric / network *',{exact:true}).fill('Physical fabric A');await route.getByLabel('Observed path state *',{exact:true}).selectOption('planned');await route.getByLabel('Initiating storage interface',{exact:true}).selectOption(portId);await route.getByLabel('Physical route and independent-path acceptance',{exact:true}).fill('EXAMPLE path A; second independent route still requires review')
  const savedEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download project',exact:true}).click();const saved=await readFile((await(await savedEvent).path())!,'utf8')
  expect(JSON.parse(saved)).toMatchObject({schemaVersion:32,design:{storageInterfaces:[{id:portId}],sanPaths:[{values:{interface:portId}}]}})
  await page.locator('input[type=file]').first().setInputFiles({name:'reopened-storage.json',mimeType:'application/json',buffer:Buffer.from(saved)})
  await nav.getByRole('button',{name:/Storage/}).click();await page.setViewportSize({width:390,height:844});await review.scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('storage-readiness-mobile.png')})
  await nav.getByRole('button',{name:/Review and exports/}).click();const event=page.waitForEvent('download');await page.getByRole('button',{name:'Download design package (.zip)',exact:true}).click();const download=await event;await download.saveAs(info.outputPath('storage-readiness-design.zip'))
  const zip=new PizZip(await readFile((await download.path())!)),plan=JSON.parse(zip.file('plans/storage-readiness.json')!.asText())
  expect(plan.disks.find((d:{id:string})=>d.id==='capacity-1')).toMatchObject({status:'operator-reviewed',runtimeQualified:false});expect(plan.interfaces[0]).toMatchObject({id:portId,inputs:{nativeId:'EXAMPLE HBA-A/port1'}});expect(plan.routes[0].inputs.interface).toBe(portId)
  expect(JSON.parse(zip.file('plans/storage-assessment.json')!.asText()).systems.find((s:{kind:string})=>s.kind==='s2d').inventoryRawTiB).toBe(24)
  expect(zip.file('diagrams/topology.drawio')!.asText()).toContain('source="n:'+portId+'" target="n:'+plan.routes[0].id+'"')
  for(const entry of JSON.parse(zip.file('manifest.json')!.asText()).files){const bytes=zip.file(entry.path)!.asUint8Array();expect(bytes.length).toBe(entry.sizeBytes);expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256)}
  expect(errors).toEqual([])
})

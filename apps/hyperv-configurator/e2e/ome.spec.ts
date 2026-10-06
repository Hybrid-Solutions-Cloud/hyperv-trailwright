import {test,expect} from '@playwright/test'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import PizZip from 'pizzip'
import {newProject,newComponent} from '../src/project'
import {omePlugins,omeMilestones} from '../src/omeFields'

test('OME sizing, discovery and manual acceptance remain explicit through edit, reopen and export',async({page},info)=>{
  page.on('dialog',d=>d.accept());const project=newProject();project.name='OME manual example';project.owner='Design team';project.scope='management'
  const c=newComponent('ome');c.name='Example OME';c.version='4.7';c.owner='Operator';c.hosting='hyperv-existing';c.placement='Existing management cluster';c.ome.devices=999;c.vCpu=4;c.memoryGiB=40;c.diskGiB=830
  Object.assign(c.productDetails,{sizingProfile:'small',capacityUnits:'binary',primaryDiskGiB:415,secondaryDiskGiB:415,sizingEvidence:'Reviewed release matrix, binary unit interpretation and growth.'})
  for(const p of omePlugins){c.productDetails['plugin_'+p.key]='enabled';c.productDetails['pluginVersion_'+p.key]=p.version}
  for(const key of Object.keys(omeMilestones)){c.productDetails['manual_'+key]='planned';c.productDetails['manualOwner_'+key]='Operator'}
  project.components.push(c)
  await page.goto('./');await page.locator('input[type=file]').first().setInputFiles({name:'ome.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))})
  const nav=page.getByRole('navigation',{name:'Design sections'});await nav.getByRole('button',{name:/Product configuration/}).click()
  const sizing=page.getByRole('region',{name:'OME capacity and manual acceptance'});await expect(sizing).toContainText('4 cores; 40 GB memory; 415 + 415 GB disks')
  await page.getByLabel('Managed device count',{exact:true}).fill('1000');await page.getByLabel('Reviewed OME sizing profile',{exact:true}).selectOption('large');await expect(sizing).toContainText('16 cores; 64 GB memory')
  await page.getByLabel('Reviewed OME sizing profile',{exact:true}).selectOption('extraLarge');await expect(sizing).toContainText('Capacity requirement is unresolved')
  await page.getByLabel('Managed device count',{exact:true}).fill('999');await page.getByLabel('Reviewed OME sizing profile',{exact:true}).selectOption('small')
  await page.getByLabel('Discovery addresses (one IPv4, DNS name, IPv4 CIDR or IPv4 start-end per line)',{exact:true}).fill('10.20.0.0/24\n10.20.0.1-10.20.0.4\nbmc.example.test')
  await page.getByLabel('Discovery runtime credential reference',{exact:true}).fill('secret-ref://example/idrac')
  await page.locator('summary').filter({hasText:/^Appliance import \/ existing instance identification$/}).click()
  await page.getByLabel('Appliance import / existing instance identification state',{exact:true}).selectOption('reported')
  await page.getByLabel('Appliance import / existing instance identification evidence / exclusion reason',{exact:true}).fill('Manual import record EXAMPLE-1, image hash and VM inventory reviewed.')
  await page.getByLabel('Appliance import / existing instance identification observation time (UTC)',{exact:true}).fill('2100-01-01T12:00:00Z')
  await nav.getByRole('button',{name:/Review and exports/}).click();await page.getByRole('button',{name:/Example OME: Provide a valid, non-future UTC observation for Appliance import/}).click()
  await expect(page.getByLabel('Appliance import / existing instance identification observation time (UTC)',{exact:true})).toBeFocused()
  await page.getByLabel('Appliance import / existing instance identification observation time (UTC)',{exact:true}).fill('2026-09-10T12:00:00Z')
  const savedEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download project',exact:true}).click();const saved=await readFile((await(await savedEvent).path())!,'utf8');expect(JSON.parse(saved)).toMatchObject({schemaVersion:32,components:[{productDetails:{manual_import:'reported',sizingProfile:'small'}}]})
  await page.locator('input[type=file]').first().setInputFiles({name:'reopen.json',mimeType:'application/json',buffer:Buffer.from(saved)})
  await nav.getByRole('button',{name:/Product configuration/}).click();await expect(page.getByLabel('Reviewed OME sizing profile',{exact:true})).toHaveValue('small')
  await page.setViewportSize({width:390,height:844});await sizing.scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('ome-mobile.png')})
  await nav.getByRole('button',{name:/Review and exports/}).click();const event=page.waitForEvent('download');await page.getByRole('button',{name:'Download design package (.zip)',exact:true}).click();const download=await event;await download.saveAs(info.outputPath('ome-design.zip'))
  const zip=new PizZip(await readFile((await download.path())!)),plan=JSON.parse(zip.file('plans/ome-manual.json')!.asText()),a=plan.appliances[0]
  expect(a.vendor).toMatchObject({cores:4,memoryGB:40,primaryGB:415,secondaryGB:415});expect(a.targets).toMatchObject({addressCount:256,dnsNames:1});expect(a.milestones[0].state).toBe('reported');expect(a.runtimeQualified).toBe(false)
  for(const entry of JSON.parse(zip.file('manifest.json')!.asText()).files){const bytes=zip.file(entry.path)!.asUint8Array();expect(bytes.length).toBe(entry.sizeBytes);expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256)}
})

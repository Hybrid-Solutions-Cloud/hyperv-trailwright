import {test,expect} from '@playwright/test'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import PizZip from 'pizzip'
import {vmmFixture} from '../src/testing/vmmFixture'
import {clusterFixture} from '../src/testing/clusterFixture'

test('host deployment corrections retain observations, owners and physical links in the downloaded package',async({page},info)=>{
  const {project,host,adapter}=vmmFixture();project.name='Host deployment example';project.owner='Infrastructure team'
  Object.assign(host.values,{osOwner:'preserve',pxeAdapter:adapter.id,pxeMac:String(adapter.values.mac),inventoryEvidence:'EXAMPLE physical identity and bare-metal observation',stageBoundary:'VMM installs OS and role; cluster admission is a separate reviewed stage'})
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept())
  await page.goto('./');await page.locator('input[type=file]').first().setInputFiles({name:'host.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))})
  const nav=page.getByRole('navigation',{name:'Design sections'})
  await nav.getByRole('button',{name:/Review and exports/}).click()
  await page.getByRole('button',{name:'The action and its owner disagree about whether a change is selected.',exact:true}).click()
  await expect(page.getByLabel('Host OS installation/configuration owner',{exact:true})).toBeFocused()
  await page.getByLabel('Host OS installation/configuration owner',{exact:true}).selectOption('vmm')
  await expect(page.getByRole('region',{name:'Host deployment review',exact:true})).toContainText('Install on confirmed bare metal / VMM')
  const savedEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download project',exact:true}).click()
  const saved=await readFile((await(await savedEvent).path())!,'utf8');expect(JSON.parse(saved)).toMatchObject({schemaVersion:32,design:{hosts:[{values:{osOwner:'vmm',currentState:'baremetal',pxeAdapter:adapter.id}}]}})
  await page.locator('input[type=file]').first().setInputFiles({name:'reopened-host.json',mimeType:'application/json',buffer:Buffer.from(saved)})
  await nav.getByRole('button',{name:/Hosts and provisioning/}).click()
  await page.setViewportSize({width:390,height:844});await page.getByRole('region',{name:'Host deployment review',exact:true}).scrollIntoViewIfNeeded()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
  await page.screenshot({path:info.outputPath('host-deployment-mobile.png')})
  await nav.getByRole('button',{name:/Review and exports/}).click()
  const event=page.waitForEvent('download');await page.getByRole('button',{name:'Download design package (.zip)',exact:true}).click();const download=await event
  await download.saveAs(info.outputPath('host-deployment-design.zip'))
  const zip=new PizZip(await readFile((await download.path())!)),plan=JSON.parse(zip.file('plans/host-deployment.json')!.asText())
  expect(plan.hosts[0]).toMatchObject({runtimeQualified:false,inputs:{osAction:'install',osOwner:'vmm',inventoryEvidence:'EXAMPLE physical identity and bare-metal observation'}})
  expect(zip.file('reports/host-deployment.md')!.asText()).toContain('install / vmm')
  expect(zip.file('diagrams/topology.drawio')!.asText()).toContain('source="n:'+adapter.id+'" target="n:'+host.id+'"')
  for(const entry of JSON.parse(zip.file('manifest.json')!.asText()).files){const bytes=zip.file(entry.path)!.asUint8Array();expect(bytes.length).toBe(entry.sizeBytes);expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256)}
  expect(errors).toEqual([])
})

test('mixed expansion preserves existing members and keeps new-cluster execution blocked',async({page})=>{
  const {project,cluster,nodes}=clusterFixture();project.name='Mixed expansion example';project.owner='Infrastructure team'
  Object.assign(cluster.values,{lifecycle:'expand',startingState:'ready',existingClusterId:'EXAMPLE native cluster',existingClusterEvidence:'EXAMPLE baseline with existing and proposed nodes'})
  Object.assign(nodes[0].values,{lifecycle:'preserve',currentState:'member',currentClusterId:'EXAMPLE native cluster',clusterAction:'preserve',clusterJoinOwner:'preserve'})
  page.on('dialog',d=>d.accept());await page.goto('./');await page.locator('input[type=file]').first().setInputFiles({name:'mixed.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))})
  const nav=page.getByRole('navigation',{name:'Design sections'});await nav.getByRole('button',{name:/Review and exports/}).click()
  await page.getByRole('button',{name:'The cluster starting-state choice conflicts with its host inventory. Select mixed states or correct the individual observations.',exact:true}).click()
  await expect(page.getByLabel('Starting state *',{exact:true})).toBeFocused();await page.getByLabel('Starting state *',{exact:true}).selectOption('mixed')
  const review=page.getByRole('region',{name:'Host deployment review',exact:true})
  await expect(review).toContainText('Existing cluster member');await expect(review).toContainText('Join target cluster / Native PowerShell / operator')
  await nav.getByRole('button',{name:/Implementation handoff/}).click()
  await expect(page.getByRole('heading',{name:/adapter|execution request/i})).toHaveCount(0)
  const savedEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download project',exact:true}).click()
  const saved=JSON.parse(await readFile((await(await savedEvent).path())!,'utf8'))
  expect(saved.design.clusters[0].values.startingState).toBe('mixed');expect(saved.design.hosts[0].values.clusterAction).toBe('preserve');expect(saved.design.hosts[1].values.clusterAction).toBe('join')
})

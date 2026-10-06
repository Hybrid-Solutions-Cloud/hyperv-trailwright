import {test,expect} from '@playwright/test'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import PizZip from 'pizzip'
import {networkControlsFixture} from '../src/testing/networkControlsFixture'
test('network controls resolve host QoS overcommit and preserve shared exports',async({page},info)=>{
 const {project}=networkControlsFixture();project.design.networkTrafficClasses.find(c=>c.id==='smb-1')!.values.bandwidthPercent=70
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept())
 await page.goto('./');await page.locator('input[type=file]').first().setInputFiles({name:'controls.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))})
 const nav=page.getByRole('navigation',{name:'Design sections'});await nav.getByRole('button',{name:/Review and exports/}).click()
 await page.getByRole('button',{name:'Unique host traffic-class ETS reservations exceed 100 percent.',exact:true}).click()
 await expect(page.locator('[data-record-id="cluster-1"]').getByLabel('ETS bandwidth reservation (%)',{exact:true})).toBeFocused()
 const smb=page.locator('[data-record-id="smb-1"]');if(await smb.getAttribute('open')===null)await smb.locator('summary').click();await smb.getByLabel('ETS bandwidth reservation (%)',{exact:true}).fill('50')
 const budget=page.getByRole('region',{name:'Host QoS budget',exact:true});await expect(budget.getByRole('row').filter({hasText:'host-net-1'})).toContainText('100')
 await nav.getByRole('button',{name:/Review and exports/}).click();await expect(page.getByRole('button',{name:'Unique host traffic-class ETS reservations exceed 100 percent.',exact:true})).toHaveCount(0)
 const saveEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download project',exact:true}).click();const saved=await readFile((await(await saveEvent).path())!,'utf8');expect(JSON.parse(saved).schemaVersion).toBe(32)
 await page.locator('input[type=file]').first().setInputFiles({name:'reopened-controls.json',mimeType:'application/json',buffer:Buffer.from(saved)});await nav.getByRole('button',{name:/Networking and IP plan/}).click()
 await expect(smb.getByLabel('ETS bandwidth reservation (%)',{exact:true})).toHaveValue('50')
 await page.setViewportSize({width:390,height:844});await budget.scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('network-controls-mobile.png')})
 await nav.getByRole('button',{name:/Review and exports/}).click();const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download design package (.zip)',exact:true}).click();const download=await downloadEvent;await download.saveAs(info.outputPath('network-controls-design.zip'))
 const zip=new PizZip(await readFile((await download.path())!)),plan=JSON.parse(zip.file('plans/network-controls.json')!.asText())
 expect(plan.runtimeQualified).toBe(false);expect(plan.findings).toEqual([]);expect(plan.qos).toHaveLength(2);expect(plan.qos[0]).toMatchObject({classCount:3,etsBandwidthPercent:100,priorityCount:8});expect(plan.trafficClasses).toHaveLength(6)
 expect(zip.file('environment/networking.yml')!.asText()).toContain('networkTrafficClasses:');expect(zip.file('diagrams/topology.drawio')!.asText()).toContain('source="n:default-1" target="n:interface-1"')
 for(const entry of JSON.parse(zip.file('manifest.json')!.asText()).files){const bytes=zip.file(entry.path)!.asUint8Array();expect(bytes.length).toBe(entry.sizeBytes);expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256)}
 expect(errors).toEqual([])
})

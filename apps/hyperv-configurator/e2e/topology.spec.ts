import {test,expect} from '@playwright/test'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import PizZip from 'pizzip'
import {topologyFixture} from '../src/testing/topologyFixture'
test('joined schedules and all topology views survive live review and package export',async({page},info)=>{
 const {project}=topologyFixture();project.design.hosts[0].values.managementIp='192.0.2.11';project.design.adapters[0].values.switchPort='Example switch Gi1/1'
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept())
 await page.goto('./');await page.locator('input[type=file]').first().setInputFiles({name:'topology.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))})
 const nav=page.getByRole('navigation',{name:'Design sections'});await nav.getByRole('button',{name:/Review and exports/}).click()
 const panel=page.getByRole('region',{name:'Topology views',exact:true});await expect(panel.getByLabel('Diagram view',{exact:true})).toHaveValue('management')
 for(const view of ['physical','logical','network','storage','deployment','management']){await panel.getByLabel('Diagram view',{exact:true}).selectOption(view);await expect(panel.getByRole('img')).toBeVisible();expect(await panel.getByRole('img').evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth===1280)).toBe(true)}
 await panel.getByLabel('Diagram view',{exact:true}).selectOption('storage');await panel.locator('summary').click();await expect(panel.getByRole('table',{name:'Diagram resources',exact:true})).toContainText('Example VMM service');await expect(panel.getByRole('table',{name:'Diagram relationships',exact:true})).toContainText('Example VM disk folder')
 await page.setViewportSize({width:390,height:844});await panel.scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('topology-mobile.png')})
 await panel.getByLabel('Show actual diagram size',{exact:true}).check();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await panel.getByLabel('Show actual diagram size',{exact:true}).uncheck()
 const saveEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download project',exact:true}).click();const saved=await readFile((await(await saveEvent).path())!,'utf8');await page.locator('input[type=file]').first().setInputFiles({name:'reopened-topology.json',mimeType:'application/json',buffer:Buffer.from(saved)})
 const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download design package (.zip)',exact:true}).click();const download=await downloadEvent;await download.saveAs(info.outputPath('topology-design.zip'));const zip=new PizZip(await readFile((await download.path())!))
 const graph=JSON.parse(zip.file('diagrams/topology-graph.json')!.asText()),index=JSON.parse(zip.file('diagrams/index.json')!.asText()),schedules=JSON.parse(zip.file('plans/design-schedules.json')!.asText())
 expect(new Set(index.pages.map((p:{view:string})=>p.view)).size).toBe(7);expect(graph.edges).toEqual(expect.arrayContaining([expect.objectContaining({from:'prepare-stage',to:'management-stage'})]));expect(schedules.storage[0]).toMatchObject({Resource:'Example VMM service',AllocatedGiB:80,LocalHost:'host-net-1'});expect(schedules.addresses.filter((a:{Start:string})=>a.Start==='192.0.2.11')).toHaveLength(1)
 for(const p of index.pages){const png=zip.file(p.path)!.asUint8Array();expect(Array.from(png.slice(0,8))).toEqual([137,80,78,71,13,10,26,10]);const bytes=new DataView(png.buffer,png.byteOffset,png.byteLength);expect(bytes.getUint32(16)).toBe(p.width);expect(bytes.getUint32(20)).toBe(p.height);expect(zip.file(p.editable)!.asText()).toContain('<mxfile')}
 for(const entry of JSON.parse(zip.file('manifest.json')!.asText()).files){const bytes=zip.file(entry.path)!.asUint8Array();expect(bytes.length).toBe(entry.sizeBytes);expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256)}
 expect(errors).toEqual([])
})

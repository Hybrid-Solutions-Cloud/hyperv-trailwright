import {test,expect} from '@playwright/test'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import PizZip from 'pizzip'
import * as XLSX from 'xlsx'
import {sdnFixture} from '../src/testing/sdnFixture'
test('SDN intent, ownership, host overhead and ordered handoff survive reopen and package export',async({page},info)=>{
 const {project}=sdnFixture(),errors:string[]=[]
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept())
 await page.goto('./');await page.locator('input[type=file]').first().setInputFiles({name:'sdn.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))})
 const nav=page.getByRole('navigation',{name:'Design sections'});await nav.getByRole('button',{name:/SDN design and setup/}).click()
 const review=page.getByRole('region',{name:'SDN setup review'});await expect(review).toContainText('Required roles: hostcontroller')
 const capacity=page.getByRole('region',{name:'SDN capacity categories',exact:true});await expect(capacity.getByRole('row').filter({hasText:'Host controller overhead'})).toContainText('2');await expect(capacity.getByRole('row').filter({hasText:'Controller VMs'})).toContainText('0')
 await page.getByLabel('SDN delivery intent',{exact:true}).selectOption('qualified');await expect(review).toContainText('Use existing external automation.')
 await page.getByLabel('SDN delivery intent',{exact:true}).selectOption('handoff')
 await page.getByLabel('Outbound NAT required',{exact:true}).check();await expect(review).toContainText('Required roles: hostcontroller, mux');await page.getByLabel('Outbound NAT required',{exact:true}).uncheck()
 const role=page.locator('[data-record-id="sdn-overhead-1"]');await role.locator('summary').first().click();await role.getByLabel('Native object lifecycle owner',{exact:true}).selectOption('vmm')
 await nav.getByRole('button',{name:/Review and exports/}).click();await page.getByRole('button',{name:'Changed objects must have the fabric setup owner; resolve ownership before preparing changes.',exact:true}).click();await expect(role.getByLabel('Native object lifecycle owner',{exact:true})).toBeFocused();await role.getByLabel('Native object lifecycle owner',{exact:true}).selectOption('powershell')
 await page.getByLabel('SDN scope',{exact:true}).selectOption('none');await expect(review).toHaveCount(0);await page.getByLabel('SDN scope',{exact:true}).selectOption('new');await expect(page.getByLabel('Controller REST DNS name',{exact:true})).toHaveValue('nc.example.test')
 const save=page.waitForEvent('download');await page.getByRole('button',{name:'Download project',exact:true}).click();const saved=await readFile((await(await save).path())!,'utf8');expect(JSON.parse(saved)).toMatchObject({schemaVersion:32,sdn:{details:{intent:'handoff',restIp:'192.0.2.10'}},design:{sdnHostBindings:[{values:{host:'sdn-host-1'}},{values:{host:'sdn-host-2'}}]}})
 await page.locator('input[type=file]').first().setInputFiles({name:'reopened-sdn.json',mimeType:'application/json',buffer:Buffer.from(saved)});await nav.getByRole('button',{name:/SDN design and setup/}).click();await expect(page.getByLabel('SDN delivery intent',{exact:true})).toHaveValue('handoff')
 await page.setViewportSize({width:390,height:844});await capacity.scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('sdn-mobile.png')})
 await nav.getByRole('button',{name:/Review and exports/}).click();const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download design package (.zip)',exact:true}).click();const download=await downloadEvent;await download.saveAs(info.outputPath('sdn-design.zip'))
 const zip=new PizZip(await readFile((await download.path())!)),plan=JSON.parse(zip.file('plans/sdn-design.json')!.asText())
 expect(plan.findings).toEqual([]);expect(plan).toMatchObject({intent:'handoff',runtimeQualified:false,executionAllowed:false,capacity:{controllerHostOverhead:{records:2,vCpu:4,memoryGiB:8,diskGiB:40},controllerVms:{records:0}}});expect(plan.stages.map((r:{id:string})=>r.id)).toEqual(['sdn-prerequisites','sdn-hosts','sdn-controller','sdn-networking','sdn-tenant','sdn-acceptance'])
 const workbookPath=Object.keys(zip.files).find(p=>p.endsWith('.xlsx'))!;const book=XLSX.read(zip.file(workbookPath)!.asUint8Array(),{type:'array'});expect(XLSX.utils.sheet_to_json(book.Sheets['SDN role capacity'])).toContainEqual({Category:'controllerHostOverhead',records:2,vCpu:4,memoryGiB:8,diskGiB:40});expect(XLSX.utils.sheet_to_json(book.Sheets['SDN setup stages'])).toHaveLength(6)
 expect(zip.file('reports/sdn-design.md')!.asText()).not.toContain('[object Object]');expect(zip.file('environment/sdn.yml')!.asText()).toContain('sdnHostBindings:');expect(zip.file('diagrams/topology.drawio')!.asText()).toContain('source="n:sdn-host-1" target="n:sdn-binding-1"')
 for(const entry of JSON.parse(zip.file('manifest.json')!.asText()).files){const bytes=zip.file(entry.path)!.asUint8Array();expect(bytes.length).toBe(entry.sizeBytes);expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256)}
 expect(errors).toEqual([])
})

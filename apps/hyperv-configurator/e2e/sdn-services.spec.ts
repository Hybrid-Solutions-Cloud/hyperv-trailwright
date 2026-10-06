import {test,expect} from '@playwright/test'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import PizZip from 'pizzip'
import * as XLSX from 'xlsx'
import {sdnServicesFixture} from '../src/testing/sdnServicesFixture'

test('SDN service choices, tenant validation and gateway capacity survive save and package export',async({page},info)=>{
 const {project}=sdnServicesFixture(),errors:string[]=[]
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept())
 await page.goto('./');await page.locator('input[type=file]').first().setInputFiles({name:'sdn-services.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))})
 const nav=page.getByRole('navigation',{name:'Design sections'});await nav.getByRole('button',{name:/SDN design and setup/}).click()
 const budget=page.getByRole('region',{name:'Gateway pool capacity',exact:true});await expect(budget).toContainText('900')
 const rule=page.locator('[data-record-id="web-rule"]')
 await rule.getByLabel('Traffic rule kind',{exact:true}).selectOption('inboundNat');await rule.getByLabel('Single inbound NAT backend',{exact:true}).selectOption('web-1')
 await expect(rule.getByLabel('Health probe',{exact:true})).toHaveCount(0);await expect(rule.getByLabel('Destination backend pool',{exact:true})).toHaveCount(0)
 await rule.getByLabel('Traffic rule kind',{exact:true}).selectOption('loadBalance');await expect(rule.getByLabel('Health probe',{exact:true})).toHaveValue('web-probe');await expect(rule.getByLabel('Destination backend pool',{exact:true})).toHaveValue('web-pool')
 const backend=page.locator('[data-record-id="web-1"]');await backend.getByLabel('Backend tenant subnet',{exact:true}).selectOption('public-vip')
 await nav.getByRole('button',{name:/Review and exports/}).click();await page.getByRole('button',{name:'The backend subnet must belong to the pool’s tenant.',exact:true}).click();await expect(backend.getByLabel('Backend tenant subnet',{exact:true})).toBeFocused();await backend.getByLabel('Backend tenant subnet',{exact:true}).selectOption('tenant-a')
 const member=page.locator('[data-record-id="gateway-a-member"]');await member.locator('summary').first().click();await member.getByLabel('Capacity test / vendor evidence',{exact:true}).fill('');await expect(budget.getByRole('cell',{name:'Unknown',exact:true})).toHaveCount(2);await member.getByLabel('Capacity test / vendor evidence',{exact:true}).fill('EXAMPLE throughput qualification');await expect(budget).toContainText('900')
 await page.getByLabel('SDN scope',{exact:true}).selectOption('none');await expect(budget).toHaveCount(0);await page.getByLabel('SDN scope',{exact:true}).selectOption('new');await expect(budget).toContainText('900')
 const save=page.waitForEvent('download');await page.getByRole('button',{name:'Download project',exact:true}).click();const saved=await readFile((await(await save).path())!,'utf8');expect(JSON.parse(saved)).toMatchObject({schemaVersion:32,design:{sdnTrafficRules:[{values:{kind:'loadBalance',member:'web-1',probe:'web-probe'}}]}})
 await page.locator('input[type=file]').first().setInputFiles({name:'reopened-services.json',mimeType:'application/json',buffer:Buffer.from(saved)});await nav.getByRole('button',{name:/SDN design and setup/}).click();await expect(budget).toContainText('900')
 await page.setViewportSize({width:390,height:844});await budget.scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('sdn-services-mobile.png')})
 await nav.getByRole('button',{name:/Review and exports/}).click();const event=page.waitForEvent('download');await page.getByRole('button',{name:'Download design package (.zip)',exact:true}).click();const download=await event;await download.saveAs(info.outputPath('sdn-services.zip'))
 const zip=new PizZip(await readFile((await download.path())!)),services=JSON.parse(zip.file('plans/sdn-services.json')!.asText()),fabric=JSON.parse(zip.file('plans/sdn-design.json')!.asText())
 expect(services.findings).toEqual([]);expect(fabric.findings).toEqual([]);expect(services).toMatchObject({runtimeQualified:false,executionAllowed:false,capacity:[{availableMbps:1000,requestedMbps:100,headroomMbps:900}]});expect(services.objects.sdnTrafficRules[0].values).not.toHaveProperty('member')
 const targets=fabric.stages.filter((s:{id:string})=>s.id!=='sdn-acceptance').flatMap((s:{targets:string[]})=>s.targets);for(const rows of Object.values(services.objects) as {id:string}[][])for(const row of rows)expect(targets).toContain(row.id)
 const book=XLSX.read(zip.file(Object.keys(zip.files).find(p=>p.endsWith('.xlsx'))!)!.asUint8Array(),{type:'array'});expect(XLSX.utils.sheet_to_json(book.Sheets['SDN gateway capacity'])).toContainEqual(expect.objectContaining({id:'ipsec-pool',availableMbps:1000,requestedMbps:100,headroomMbps:900}));expect(book.SheetNames).toContain('SDN fabric parameters')
 expect(zip.file('reports/sdn-services.md')!.asText()).toContain('site-a-route');expect(zip.file('environment/sdn.yml')!.asText()).toContain('sdnTrafficRules:')
 for(const entry of JSON.parse(zip.file('manifest.json')!.asText()).files){const bytes=zip.file(entry.path)!.asUint8Array();expect(bytes.length).toBe(entry.sizeBytes);expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256)}
 expect(errors).toEqual([])
})

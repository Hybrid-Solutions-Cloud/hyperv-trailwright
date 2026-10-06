import {test,expect} from '@playwright/test'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import PizZip from 'pizzip'
import * as XLSX from 'xlsx'
import {sdnServicesFixture} from '../src/testing/sdnServicesFixture'

test('SDN returned evidence preserves source bytes, detects stale scope and exports unsigned observations',async({page},info)=>{
 const {project}=sdnServicesFixture(),errors:string[]=[]
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept())
 await page.goto('./');await page.locator('input[type=file]').first().setInputFiles({name:'sdn.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))})
 const nav=page.getByRole('navigation',{name:'Design sections'});await nav.getByRole('button',{name:/SDN design and setup/}).click()
 const panel=page.getByRole('region',{name:'SDN acceptance evidence',exact:true});await expect(panel).toContainText('Review status: missing')
 const requestEvent=page.waitForEvent('download');await panel.getByRole('button',{name:'Download SDN acceptance request',exact:true}).click();const request=JSON.parse(await readFile((await(await requestEvent).path())!,'utf8'));expect(request.scope.resources.length).toBeGreaterThan(11)
 const templateEvent=page.waitForEvent('download');await panel.getByRole('button',{name:'Download SDN result template',exact:true}).click();const result=JSON.parse(await readFile((await(await templateEvent).path())!,'utf8'));expect(result.scopeHash).toBe(request.scopeHash);expect(result.results.every((r:{status:string})=>r.status==='not-run')).toBe(true)
 Object.assign(result,{id:'example-browser-run',observedAt:new Date().toISOString(),source:{operator:'EXAMPLE test operator',runner:'EXAMPLE offline fixture',version:'1.0.0',endpoint:'runner.example.test'}})
 for(const row of result.results)Object.assign(row,{status:'passed',observed:'EXAMPLE scoped traffic capture and failover observation',evidenceRef:'artifact://example/traffic-capture'})
 const original=Buffer.from('\uFEFF'+JSON.stringify(result,null,2)+'\n'),hash=createHash('sha256').update(original).digest('hex')
 await panel.getByLabel('SDN evidence file',{exact:true}).setInputFiles({name:'returned-evidence.json',mimeType:'application/json',buffer:original});await expect(panel).toContainText('Review status: passed-observation')
 await panel.getByLabel('SDN evidence file',{exact:true}).setInputFiles({name:'duplicate.json',mimeType:'application/json',buffer:original});await expect(panel.getByRole('status')).toContainText('unique');await expect(panel).toContainText('SDN evidence provenance (1)')
 const frontend=page.locator('[data-record-id="public-web"]');await frontend.getByLabel('Frontend IPv4 address',{exact:true}).fill('203.0.113.11');await expect(panel).toContainText('Review status: stale');await frontend.getByLabel('Frontend IPv4 address',{exact:true}).fill('203.0.113.10');await expect(panel).toContainText('Review status: passed-observation')
 const saveEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download project',exact:true}).click();const saved=await readFile((await(await saveEvent).path())!);expect(JSON.parse(saved.toString()).sdnEvidence.entries[0].sha256).toBe(hash)
 await page.locator('input[type=file]').first().setInputFiles({name:'reopened.json',mimeType:'application/json',buffer:saved});await nav.getByRole('button',{name:/SDN design and setup/}).click();await expect(panel).toContainText('Review status: passed-observation')
 await page.setViewportSize({width:390,height:844});await panel.scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('sdn-evidence-mobile.png')})
 await nav.getByRole('button',{name:/Review and exports/}).click();const packageEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download design package (.zip)',exact:true}).click();const download=await packageEvent;await download.saveAs(info.outputPath('sdn-evidence.zip'))
 const zip=new PizZip(await readFile((await download.path())!)),review=JSON.parse(zip.file('reports/sdn-evidence.json')!.asText());expect(review).toMatchObject({status:'passed-observation',runtimeQualified:false,executionAllowed:false,history:[{sha256:hash}]})
 expect(Buffer.from(zip.file('sdn/evidence/source-1.json')!.asUint8Array())).toEqual(original);expect(zip.file('reports/sdn-evidence.md')!.asText()).toContain('EXAMPLE scoped traffic capture and failover observation');expect(JSON.parse(zip.file('plans/sdn-design.json')!.asText()).stages.every((s:{status:string})=>s.status==='not-executed')).toBe(true)
 const book=XLSX.read(zip.file(Object.keys(zip.files).find(p=>p.endsWith('.xlsx'))!)!.asUint8Array(),{type:'array'});expect(XLSX.utils.sheet_to_json(book.Sheets['SDN evidence history'])).toContainEqual(expect.objectContaining({ID:result.id,SHA256:hash}));expect(XLSX.utils.sheet_to_json(book.Sheets['SDN evidence results'])).toHaveLength(result.results.length)
 for(const entry of JSON.parse(zip.file('manifest.json')!.asText()).files){const bytes=zip.file(entry.path)!.asUint8Array();expect(bytes.length).toBe(entry.sizeBytes);expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256)}
 expect(errors).toEqual([])
})

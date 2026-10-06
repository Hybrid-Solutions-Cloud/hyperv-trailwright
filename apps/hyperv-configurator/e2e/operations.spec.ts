import {test,expect} from '@playwright/test'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import PizZip from 'pizzip'
import {operationsFixture} from '../src/testing/operationsFixture'
test('recovery evidence correction and resource policies survive reopen and export',async({page},info)=>{
 const {project}=operationsFixture();project.design.recoveryTests[0].values.durationMinutes=90
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept())
 await page.goto('./');await page.locator('input[type=file]').first().setInputFiles({name:'operations.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))})
 const nav=page.getByRole('navigation',{name:'Design sections'});await nav.getByRole('button',{name:/Operations and recovery/}).click()
 const results=page.getByRole('region',{name:'Recovery objective results',exact:true});await expect(results).toContainText('Missed in this test')
 await nav.getByRole('button',{name:/Review and exports/}).click();await page.getByRole('button',{name:'Measured recovery duration exceeds the agreed RTO.',exact:true}).click()
 const observed=page.locator('[data-record-id="ops-test"]');await expect(observed.getByLabel('Measured recovery duration (minutes)',{exact:true})).toBeFocused();await observed.getByLabel('Measured recovery duration (minutes)',{exact:true}).fill('45');await expect(results.getByRole('row').filter({hasText:'ops-test'})).toContainText('Met in this test')
 await observed.getByLabel('Recovery measurements',{exact:true}).selectOption('unknown');await expect(results.getByRole('row').filter({hasText:'ops-test'})).toContainText('Not established');await observed.getByLabel('Recovery measurements',{exact:true}).selectOption('confirmed')
 await page.getByRole('button',{name:'+ Add capacity threshold',exact:true}).click()
 const threshold=page.locator('[data-record-id]').filter({has:page.getByLabel('Exact counter / management-pack monitor identity',{exact:true})}).last()
 await expect(threshold.getByLabel('Name *',{exact:true})).toBeFocused()
 await threshold.getByLabel('Name *',{exact:true}).fill('Example free capacity');await threshold.getByLabel('Owner *',{exact:true}).fill('Example operations team');await threshold.getByLabel('Monitored resource assignment *',{exact:true}).selectOption('ops-assignment');await threshold.getByLabel('Metric *',{exact:true}).selectOption('freeSpace');await threshold.getByLabel('Exact counter / management-pack monitor identity',{exact:true}).fill('EXAMPLE free GiB counter');await threshold.getByLabel('Metric unit *',{exact:true}).selectOption('gib');await threshold.getByLabel('Alert direction *',{exact:true}).selectOption('low');await threshold.getByLabel('Warning threshold',{exact:true}).fill('100');await threshold.getByLabel('Critical threshold',{exact:true}).fill('50');await threshold.getByLabel('Sustained interval (minutes)',{exact:true}).fill('5');await threshold.getByLabel('Threshold, alert routing and recovery verification',{exact:true}).fill('EXAMPLE low-free-space alert acceptance')
 await nav.getByRole('button',{name:/Identity, security and media/}).click();const security=page.locator('[data-record-id="ops-security"]');await security.getByLabel('Certificate / trust identity',{exact:true}).selectOption('ops-admin')
 await nav.getByRole('button',{name:/Review and exports/}).click();await page.getByRole('button',{name:'Select an identity with the role required by this security control.',exact:true}).click();await expect(security.getByLabel('Certificate / trust identity',{exact:true})).toBeFocused();await security.getByLabel('Certificate / trust identity',{exact:true}).selectOption('ops-pki')
 const save=page.waitForEvent('download');await page.getByRole('button',{name:'Download project',exact:true}).click();const saved=await readFile((await(await save).path())!,'utf8');expect(JSON.parse(saved)).toMatchObject({schemaVersion:32,design:{recoveryTests:[{values:{durationMinutes:45,measurementState:'confirmed',testedResource:'ops-node'}}],securityPolicies:[{values:{trustIdentity:'ops-pki'}}]}})
 await page.locator('input[type=file]').first().setInputFiles({name:'reopened-operations.json',mimeType:'application/json',buffer:Buffer.from(saved)});await nav.getByRole('button',{name:/Operations and recovery/}).click();await expect(results).toContainText('Met in this test')
 await page.setViewportSize({width:390,height:844});await results.scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('operations-mobile.png')})
 await nav.getByRole('button',{name:/Review and exports/}).click();const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download design package (.zip)',exact:true}).click();const download=await downloadEvent;await download.saveAs(info.outputPath('operations-design.zip'))
 const zip=new PizZip(await readFile((await download.path())!)),plan=JSON.parse(zip.file('plans/operations.json')!.asText())
 expect(plan.findings).toEqual([]);expect(plan.recovery[0]).toMatchObject({resourceId:'ops-node',evidenceComplete:true,rtoMet:true,rpoMet:true,runtimeQualified:false});expect(plan.thresholds).toHaveLength(2);expect(plan.thresholds.find((r:{values:{name:string}})=>r.values.name==='Example free capacity').values).toMatchObject({direction:'low',unit:'gib',warning:100,critical:50})
 expect(zip.file('diagrams/topology.drawio')!.asText()).toContain('source="n:ops-assignment" target="n:ops-test"')
 for(const entry of JSON.parse(zip.file('manifest.json')!.asText()).files){const bytes=zip.file(entry.path)!.asUint8Array();expect(bytes.length).toBe(entry.sizeBytes);expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256)}
 expect(errors).toEqual([])
})

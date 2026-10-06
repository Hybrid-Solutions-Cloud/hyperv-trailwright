import {test,expect} from '@playwright/test'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import PizZip from 'pizzip'
import * as XLSX from 'xlsx'

test('readiness keeps future observations blocked and preserves corrected review across reopen and exports',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept())
  await page.goto('./');await page.getByRole('button',{name:'Load example',exact:true}).click()
  const originalDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Download project',exact:true}).click()
  const original=JSON.parse(await readFile((await(await originalDownload).path())!,'utf8'))
  await page.getByRole('button',{name:/Implementation handoff/}).click()
  await page.getByLabel('Explicit target resource IDs').fill(original.components[0].id)
  await page.getByLabel('Observed state').selectOption('passed')
  await page.getByLabel('Runtime evidence reference').fill('Example operator acceptance record')
  await page.getByLabel('Observation time (UTC)').fill('2099-01-01T00:00:00Z')
  await expect(page.getByRole('cell',{name:'blocked',exact:true})).toBeVisible()
  await page.getByRole('button',{name:/Review and exports/}).click()
  const readiness=page.locator('section.panel').filter({has:page.getByRole('heading',{name:'Project readiness',exact:true})})
  await expect(readiness).toContainText('review-required')
  await expect(readiness.getByText('Deployment verified',{exact:true})).toBeVisible()
  await page.getByRole('button',{name:/Implementation handoff/}).click()
  await page.getByLabel('Observation time (UTC)').fill('2026-09-10T12:30:00Z')
  await expect(page.getByRole('cell',{name:'reported passed',exact:true})).toBeVisible()
  const savedEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download project',exact:true}).click()
  const saved=await readFile((await(await savedEvent).path())!,'utf8')
  await page.locator('input[type=file]').first().setInputFiles({name:'readiness-reopen.json',mimeType:'application/json',buffer:Buffer.from(saved)})
  await page.getByRole('button',{name:/Review and exports/}).click()
  await expect(readiness).toContainText('operator-reported');await expect(readiness).toContainText('draft')
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
  await readiness.screenshot({path:info.outputPath('readiness-mobile.png')})
  const archiveEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download design package (.zip)',exact:true}).click()
  const archive=await archiveEvent;await archive.saveAs(info.outputPath('readiness-design.zip'))
  const zip=new PizZip(await readFile((await archive.path())!)),r=JSON.parse(zip.file('plans/project-readiness.json')!.asText())
  expect(r).toMatchObject({designState:'draft',runtimeState:'operator-reported',automationReady:false,deploymentVerified:false,allStagesReportedPassed:true})
  expect(JSON.parse(zip.file('validation/results.json')!.asText()).readiness).toEqual(r)
  const manifest=JSON.parse(zip.file('manifest.json')!.asText());expect(manifest.readiness).toEqual(r)
  for(const path of ['reports/project-readiness.md','reports/design.md','reports/implementation-plan.md'])expect(zip.file(path)!.asText()).toContain('Runtime: operator-reported. Deployment verified: no.')
  const book=XLSX.read(zip.file('reports/inventory.xlsx')!.asUint8Array(),{type:'array'})
  expect(XLSX.utils.sheet_to_json(book.Sheets['Project readiness'])[0]).toMatchObject({Design:'draft',Runtime:'operator-reported',DeploymentVerified:'No'})
  for(const entry of manifest.files){const bytes=zip.file(entry.path)!.asUint8Array();expect(bytes.length).toBe(entry.sizeBytes);expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256)}
  expect(errors).toEqual([])
})

import {test,expect} from '@playwright/test'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import PizZip from 'pizzip'
import {licenseDependencyFixture} from '../src/testing/licenseDependencyFixture'

test('access, metered service benefits and shared feature entitlements remain explicit through review and export',async({page},info)=>{
  page.on('dialog',d=>d.accept());const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
  const {project}=licenseDependencyFixture();await page.goto('./')
  await page.locator('input[type=file]').first().setInputFiles({name:'dependencies.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))})
  await page.getByRole('button',{name:/Licensing and costs/}).click()
  const gaps=page.getByRole('table',{name:'License purchase gaps'}),azure=gaps.getByRole('row').filter({hasText:'EXAMPLE monitor-meter'}),rds=gaps.getByRole('row').filter({hasText:'EXAMPLE rds-access'})
  await expect(azure).toContainText('USD 30.75');await expect(rds).toContainText('USD 70')
  const meter=page.locator('details[data-record-id="monitor-scope"]');if(await meter.getAttribute('open')===null)await meter.locator('summary').click()
  await meter.getByLabel('Existing benefit treatment *',{exact:true}).selectOption('none');await expect(azure).toContainText('Review rights / quantity')
  await page.getByRole('button',{name:/Review and exports/}).click()
  await page.getByRole('button',{name:/Benefit selection must match allocated/}).click()
  await expect(page.getByLabel('Existing benefit treatment *',{exact:true})).toBeFocused()
  await page.getByLabel('Existing benefit treatment *',{exact:true}).selectOption('allocation');await expect(azure).toContainText('USD 30.75')
  const audience=page.locator('details[data-record-id="audience"]');if(await audience.getAttribute('open')===null)await audience.locator('summary').click()
  await audience.getByLabel('Stable audience / server scope identifier *',{exact:true}).fill('EXAMPLE changed audience');await expect(rds).toContainText('Review rights / quantity')
  await audience.getByLabel('Stable audience / server scope identifier *',{exact:true}).fill('EXAMPLE operators');await expect(rds).toContainText('USD 70')
  const savedEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download project',exact:true}).click()
  const saved=await readFile((await(await savedEvent).path())!,'utf8');expect(JSON.parse(saved).schemaVersion).toBe(32)
  await page.locator('input[type=file]').first().setInputFiles({name:'dependencies-reopened.json',mimeType:'application/json',buffer:Buffer.from(saved)})
  await expect(azure).toContainText('USD 30.75')
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
  await page.screenshot({path:info.outputPath('dependency-mobile.png'),fullPage:true})
  await page.getByRole('button',{name:/Review and exports/}).click()
  const event=page.waitForEvent('download');await page.getByRole('button',{name:'Download design package (.zip)',exact:true}).click()
  const download=await event;await download.saveAs(info.outputPath('dependency-design.zip'))
  const zip=new PizZip(await readFile((await download.path())!)),plan=JSON.parse(zip.file('plans/licensing-assessment.json')!.asText())
  expect(plan.rows.find((r:any)=>r.id==='monitor-meter')).toMatchObject({purchaseUnits:10.25,estimatedCost:30.75})
  expect(plan.rows.find((r:any)=>r.id==='ome-entitlement')).toMatchObject({purchaseUnits:0,estimatedCost:0})
  expect(plan.coverage.objects.licenseDependencies).toHaveLength(2)
  expect(plan.coverage.baseAccessDependencies).toEqual([{licenseId:'rds-access',sourceLicenseId:'base-access',recordId:'rds-audience'}])
  expect(zip.file('environment/licensing.yml')!.asText()).toContain('azureLicenseMeters:')
  const manifest=JSON.parse(zip.file('manifest.json')!.asText())
  for(const entry of manifest.files){const bytes=zip.file(entry.path)!.asUint8Array();expect(bytes.length,entry.path).toBe(entry.sizeBytes);expect(createHash('sha256').update(bytes).digest('hex'),entry.path).toBe(entry.sha256)}
  expect(errors).toEqual([])
})

import {test,expect} from '@playwright/test'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import PizZip from 'pizzip'
import {licenseCoverageFixture} from '../src/testing/licenseCoverageFixture'

test('shared System Center estate and supporting SQL rights survive correction, reopen and export',async({page},info)=>{
  page.on('dialog',d=>d.accept());const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
  const {project}=licenseCoverageFixture();await page.goto('./')
  await page.locator('input[type=file]').first().setInputFiles({name:'coverage.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))})
  await page.getByRole('button',{name:/Licensing and costs/}).click()
  const gaps=page.getByRole('table',{name:'License purchase gaps'}),sql=gaps.getByRole('row').filter({hasText:'EXAMPLE included SQL'})
  await expect(sql).toContainText('USD 0');await expect(gaps.getByRole('row').filter({hasText:'EXAMPLE System Center estate'})).toContainText('USD 480')
  await expect(page.getByRole('table',{name:'Resource licensing coverage'})).toContainText('example-vmm')
  await page.getByLabel('SQL workload scope *',{exact:true}).selectOption('mixed')
  await expect(sql).toContainText('Review rights / quantity')
  await page.getByRole('button',{name:/Review and exports/}).click()
  await page.getByRole('button',{name:/Mixed or unrelated workloads do not receive included/}).click()
  await expect(page.getByLabel('SQL workload scope *',{exact:true})).toBeFocused()
  await page.getByLabel('SQL workload scope *',{exact:true}).selectOption('supporting')
  const database=page.locator('details[data-record-id="vmm-db"]');if(await database.getAttribute('open')===null)await database.locator('summary').click()
  await database.getByLabel('SQL workload purpose *',{exact:true}).selectOption('other');await expect(sql).toContainText('Review rights / quantity')
  await database.getByLabel('SQL workload purpose *',{exact:true}).selectOption('vmm');await expect(sql).toContainText('USD 0')
  const savedEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download project',exact:true}).click()
  const saved=await readFile((await(await savedEvent).path())!,'utf8');expect(JSON.parse(saved).schemaVersion).toBe(32)
  await page.locator('input[type=file]').first().setInputFiles({name:'coverage-reopened.json',mimeType:'application/json',buffer:Buffer.from(saved)})
  await expect(sql).toContainText('USD 0')
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
  await page.screenshot({path:info.outputPath('coverage-mobile.png'),fullPage:true})
  await page.getByRole('button',{name:/Review and exports/}).click()
  const zipEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download design package (.zip)',exact:true}).click()
  const download=await zipEvent;await download.saveAs(info.outputPath('coverage-design.zip'))
  const zip=new PizZip(await readFile((await download.path())!)),plan=JSON.parse(zip.file('plans/licensing-assessment.json')!.asText())
  expect(plan.rows.find((r:any)=>r.id==='sc-estate')).toMatchObject({coreLicenses:48,required:24,estimatedCost:480})
  expect(plan.rows.find((r:any)=>r.id==='sql-license')).toMatchObject({required:1,purchaseUnits:0,estimatedCost:0,rightsResolved:true})
  const coverage=JSON.parse(zip.file('plans/license-coverage.json')!.asText());expect(coverage.addsLicenseQuantity).toBe(false)
  expect(coverage.objects.systemCenterConsumers).toHaveLength(2);expect(coverage.objects.sqlWorkloads).toHaveLength(2)
  expect(coverage.mapped).toHaveLength(4);expect(zip.file('reports/license-coverage.md')!.asText()).toContain('These mappings add no license quantities')
  const manifest=JSON.parse(zip.file('manifest.json')!.asText())
  for(const entry of manifest.files){const bytes=zip.file(entry.path)!.asUint8Array();expect(bytes.length,entry.path).toBe(entry.sizeBytes);expect(createHash('sha256').update(bytes).digest('hex'),entry.path).toBe(entry.sha256)}
  expect(errors).toEqual([])
})

test('dedicated physical management inventory changes core quantity without adding VM demand',async({page})=>{
  page.on('dialog',d=>d.accept());const {project,vm,license,add}=licenseCoverageFixture();project.design.licenseCoverage=[];vm.hosting='physical'
  add('licenseServers','external-server',{name:'EXAMPLE physical management server',provider:'physical',nativeId:'EXAMPLE physical identity',providerScope:'EXAMPLE provider',component:vm.id,sockets:1,coresPerSocket:6,inventoryEvidence:'EXAMPLE hardware and licensing responsibility'})
  add('licenseAssignments','external-assignment',{license:license.id,kind:'host',host:'external-server',peakVirtualOSEs:0,physicalOSE:'other',placementReview:'EXAMPLE dedicated management OSE'})
  await page.goto('./');await page.locator('input[type=file]').first().setInputFiles({name:'physical-license.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))})
  await page.getByRole('button',{name:/Licensing and costs/}).click()
  const gap=page.getByRole('table',{name:'License purchase gaps'}).getByRole('row').filter({hasText:'Windows core coverage'})
  await expect(gap).toContainText('USD 240')
  await page.getByLabel('Physical cores per processor *',{exact:true}).fill('20');await expect(gap).toContainText('USD 260')
  await expect(page.getByRole('table',{name:'License assignment calculations'})).toContainText('EXAMPLE physical management server')
  await page.getByLabel('Physical inventory and licensing responsibility evidence *',{exact:true}).fill('');await expect(gap).toContainText('Review rights / quantity')
})

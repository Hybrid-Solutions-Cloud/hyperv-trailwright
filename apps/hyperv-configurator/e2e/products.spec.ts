import {test,expect} from '@playwright/test'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import PizZip from 'pizzip'
import {newProject,newComponent} from '../src/project'

test('management role review preserves dependency contracts and exports the selected role',async({page},info)=>{
  page.on('dialog',d=>d.accept());const project=newProject();project.name='Management roles example';project.owner='Design team';project.scope='management'
  const c=newComponent('scom');c.name='Example SCOM';c.version='2025';c.owner='Monitoring team';c.hosting='hyperv-existing';c.placement='Existing management cluster';c.vCpu=4;c.memoryGiB=8;c.diskGiB=100;c.hostingDetails.installProduct=true
  Object.assign(c.productDetails,{role:'reporting',osRelease:'ws2025',osEdition:'standard',osInstallType:'core',managementGroup:'Example management group'})
  project.components.push(c)
  await page.goto('./');await page.locator('input[type=file]').first().setInputFiles({name:'roles.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))})
  const nav=page.getByRole('navigation',{name:'Design sections'});await nav.getByRole('button',{name:/Review and exports/}).click()
  await page.getByRole('button',{name:'Example SCOM: This role is outside the reviewed SCOM Server Core management/gateway baseline.',exact:true}).click()
  await expect(page.getByLabel('Reviewed component OS installation type',{exact:true})).toBeFocused()
  await page.getByLabel('Reviewed component OS installation type',{exact:true}).selectOption('desktop')
  await page.getByLabel('SSRS endpoint / version / database contract',{exact:true}).fill('https://reports.example.test, SQL 2022 SSRS, EXAMPLE-DB-1')
  await page.getByLabel('SCOM primary role on this component',{exact:true}).selectOption('gateway')
  await page.getByLabel('Reviewed component OS installation type',{exact:true}).selectOption('core')
  await page.getByLabel('Exact component OS build, role and support evidence',{exact:true}).fill('Example Windows Server 2025 Core gateway review, pinned build in change record.')
  await page.getByLabel('Management server endpoints / component IDs',{exact:true}).fill('https://scom.example.test, existing service contract')
  await page.getByLabel('Gateway trust, certificate enrollment/renewal and connectivity',{exact:true}).fill('Gateway certificate enrollment and renewal owned by monitoring team.')
  await page.getByLabel('SCOM role, alert, agent and recovery acceptance',{exact:true}).fill('Check gateway trust, heartbeat, agent failover and recovery; return signed evidence.')
  await expect(page.getByRole('region',{name:'Management role review'})).toContainText('Installation or integration is selected')
  const savedEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download project',exact:true}).click();const saved=await readFile((await(await savedEvent).path())!,'utf8');expect(JSON.parse(saved)).toMatchObject({schemaVersion:32,components:[{productDetails:{role:'gateway',osInstallType:'core',reportingEndpoint:'https://reports.example.test, SQL 2022 SSRS, EXAMPLE-DB-1'}}]})
  await page.locator('input[type=file]').first().setInputFiles({name:'reopen.json',mimeType:'application/json',buffer:Buffer.from(saved)})
  await nav.getByRole('button',{name:/Product configuration/}).click();await expect(page.getByLabel('SCOM primary role on this component',{exact:true})).toHaveValue('gateway')
  await page.setViewportSize({width:390,height:844});await page.getByRole('region',{name:'Management role review'}).scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('products-mobile.png')})
  await nav.getByRole('button',{name:/Review and exports/}).click();await expect(page.getByRole('button',{name:'Example SCOM: This role is outside the reviewed SCOM Server Core management/gateway baseline.',exact:true})).toHaveCount(0)
  const event=page.waitForEvent('download');await page.getByRole('button',{name:'Download design package (.zip)',exact:true}).click();const download=await event;await download.saveAs(info.outputPath('products-design.zip'))
  const zip=new PizZip(await readFile((await download.path())!)),plan=JSON.parse(zip.file('plans/management-products.json')!.asText())
  expect(plan.components).toHaveLength(1);expect(plan.components[0]).toMatchObject({role:'gateway',configurationRequested:true,runtimeQualified:false,inputs:{osInstallType:'core'}});expect(plan.findings).toEqual([])
  for(const entry of JSON.parse(zip.file('manifest.json')!.asText()).files){const bytes=zip.file(entry.path)!.asUint8Array();expect(bytes.length).toBe(entry.sizeBytes);expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256)}
})

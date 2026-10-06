import {test,expect} from '@playwright/test'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import PizZip from 'pizzip'
import {newProject,newComponent} from '../src/project'
import {collections,newRecord} from '../src/catalog'

test('component omission retains configuration and blocks active targets until restoration',async({page},info)=>{
  const project=newProject();project.name='Reversible omission example';project.owner='Design team';project.scope='management'
  const c=newComponent('vmm');c.name='Existing VMM';c.version='2025';c.owner='Platform team';c.hosting='hyperv-existing';c.lifecycle='configure';c.vCpu=4;c.memoryGiB=16;c.diskGiB=100;c.hostingDetails.installProduct=true;c.productDetails.dkm='CN=Example-VMM,DC=example,DC=test';c.credentialRef='secret-ref://example/vmm';project.components.push(c)
  const stage=newRecord(collections.find(c=>c.key==='stages')!);Object.assign(stage.values,{name:'Configure existing VMM',kind:'management',executor:'operator',targets:JSON.stringify([c.id]),status:'planned',acceptance:'Operator role acceptance'});project.design.stages.push(stage)
  page.on('dialog',d=>d.accept());await page.goto('./');await page.locator('input[type=file]').first().setInputFiles({name:'omission.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))})
  const nav=page.getByRole('navigation',{name:'Design sections'});await nav.getByRole('button',{name:/Management requirements/}).click();await page.getByRole('button',{name:'Omit from design',exact:true}).click();await expect(page.getByLabel('Omission reason',{exact:true})).toBeFocused()
  await page.getByLabel('Omission reason',{exact:true}).fill('Excluded from this customer scope; retain the existing service configuration.')
  await page.getByLabel('Omission review owner',{exact:true}).fill('Platform architect')
  const savedEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download project',exact:true}).click();const saved=await readFile((await(await savedEvent).path())!,'utf8'),omitted=JSON.parse(saved);expect(omitted.schemaVersion).toBe(32);expect(omitted.components).toEqual([]);expect(omitted.omittedComponents[0].component).toEqual(c)
  await nav.getByRole('button',{name:/Review and exports/}).click();const event=page.waitForEvent('download');await page.getByRole('button',{name:'Download design package (.zip)',exact:true}).click();const download=await event;await download.saveAs(info.outputPath('omissions-design.zip'))
  const zip=new PizZip(await readFile((await download.path())!)),summary=JSON.parse(zip.file('plans/component-omissions.json')!.asText());expect(summary.components[0]).toMatchObject({componentId:c.id,active:false,reviewOwner:'Platform architect'});expect(JSON.parse(zip.file('plans/component-hosting.json')!.asText()).components).toEqual([]);expect(JSON.parse(zip.file('plans/stage-plan.json')!.asText()).findings.map((f:any)=>f.code)).toContain('STAGE_TARGET_MISSING')
  for(const entry of JSON.parse(zip.file('manifest.json')!.asText()).files){const bytes=zip.file(entry.path)!.asUint8Array();expect(bytes.length).toBe(entry.sizeBytes);expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256)}
  await page.locator('input[type=file]').first().setInputFiles({name:'reopen-omitted.json',mimeType:'application/json',buffer:Buffer.from(saved)})
  await nav.getByRole('button',{name:/Management requirements/}).click();await expect(page.getByLabel('Omission review owner',{exact:true})).toHaveValue('Platform architect')
  await page.setViewportSize({width:390,height:844});await page.getByRole('heading',{name:'Omitted components',exact:true}).scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('omissions-mobile.png')})
  await page.getByRole('button',{name:'Restore to active design',exact:true}).click();await expect(page.getByLabel('Component / server name',{exact:true})).toBeFocused();await expect(page.getByLabel('Component / server name',{exact:true})).toHaveValue('Existing VMM')
  const restoredEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download project',exact:true}).click();const restored=JSON.parse(await readFile((await(await restoredEvent).path())!,'utf8'));expect(restored.components).toEqual([c]);expect(restored.omittedComponents).toEqual([]);expect(restored.design.stages[0]).toEqual(stage)
})

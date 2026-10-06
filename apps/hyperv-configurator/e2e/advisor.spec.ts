import {test,expect} from '@playwright/test'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import PizZip from 'pizzip'
import {newProject,newComponent} from '../src/project'

test('management ownership, Azure conflicts and preview support survive review and export',async({page},info)=>{
  page.on('dialog',d=>d.accept());const project=newProject();project.name='Management decisions example';project.owner='Design team';project.scope='management';project.requirements.browserAdmin=true;project.requirements.bareMetal=true
  const wac=newComponent('wac');wac.name='Example preview gateway';wac.hosting='hyperv-existing';wac.productDetails.mode='virtualization';project.components.push(wac)
  await page.goto('./');await page.locator('input[type=file]').first().setInputFiles({name:'advisor.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))})
  const nav=page.getByRole('navigation',{name:'Design sections'})
  await nav.getByRole('button',{name:/Review and exports/}).click();await page.getByRole('button',{name:'Choose the owner of bare-metal OS deployment.',exact:true}).click()
  await expect(page.getByLabel('Bare-metal OS deployment owner',{exact:true})).toBeFocused()
  await page.getByLabel('Bare-metal OS deployment owner',{exact:true}).selectOption('oem')
  await page.getByLabel('OS provisioning tool, version and qualification evidence',{exact:true}).fill('Example OEM contract, version pinned for operator review.')
  await page.getByLabel('Manage on-premises VMs through Azure portal / ARM / Azure RBAC',{exact:true}).selectOption('yes')
  await page.getByLabel('Azure subscription, identity, external DNS and outbound HTTPS are available',{exact:true}).selectOption('no')
  await expect(page.getByRole('heading',{name:'Azure Arc-enabled VMM · excluded',exact:true})).toBeVisible()
  await page.getByLabel('Azure subscription, identity, external DNS and outbound HTTPS are available',{exact:true}).selectOption('yes')
  await expect(page.getByRole('heading',{name:'Azure Arc-enabled VMM · candidate',exact:true})).toBeVisible()
  await page.getByLabel('Preview capabilities accepted for evaluation',{exact:true}).check()
  await page.getByLabel('Every selected component must be generally available at go-live',{exact:true}).selectOption('yes')
  await expect(page.getByRole('heading',{name:'Windows Admin Center Virtualization Mode · excluded',exact:true})).toBeVisible()
  await page.getByLabel('Every selected component must be generally available at go-live',{exact:true}).selectOption('no')
  await expect(page.getByRole('heading',{name:'Windows Admin Center Virtualization Mode · review',exact:true})).toBeVisible()
  await page.getByLabel('Management architecture decision owner',{exact:true}).fill('Platform architect')
  await page.getByLabel('Selected management approach and decision evidence',{exact:true}).fill('OEM prepares hosts; VMM and Arc provide the selected Azure operation path. Preview gateway is for evaluation.')
  await nav.getByRole('button',{name:/Product configuration/}).click()
  const support=page.locator('details').filter({has:page.locator('summary').filter({hasText:'WAC Virtualization Mode gateway'})});await support.locator('summary').click()
  await expect(support).toContainText('Preview baseline')
  await expect(support.getByRole('link',{name:/Vendor reference/}).first()).toHaveAttribute('href',/learn.microsoft.com/)
  const savedEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download project',exact:true}).click()
  const saved=await readFile((await(await savedEvent).path())!,'utf8');expect(JSON.parse(saved)).toMatchObject({schemaVersion:32,managementPlan:{deploymentOwner:'oem',answers:{azureReady:'yes',productionSupport:'no'}}})
  await page.locator('input[type=file]').first().setInputFiles({name:'reopen.json',mimeType:'application/json',buffer:Buffer.from(saved)})
  await nav.getByRole('button',{name:/Management requirements/}).click();await expect(page.getByLabel('Bare-metal OS deployment owner',{exact:true})).toHaveValue('oem')
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
  await page.getByRole('heading',{name:'Management options and rationale',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('advisor-mobile.png')})
  await nav.getByRole('button',{name:/Review and exports/}).click();const zipEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download design package (.zip)',exact:true}).click()
  const file=await zipEvent;await file.saveAs(info.outputPath('advisor-design.zip'));const zip=new PizZip(await readFile((await file.path())!))
  const advice=JSON.parse(zip.file('plans/management-advice.json')!.asText()),supportPlan=JSON.parse(zip.file('plans/support-baselines.json')!.asText())
  expect(advice.options.find((o:any)=>o.id==='oem').status).toBe('review');expect(advice.options.find((o:any)=>o.id==='arc').status).toBe('candidate')
  expect(supportPlan.rows.every((r:any)=>r.entry.status==='preview')).toBe(true)
  expect(JSON.parse(zip.file('catalogs/support.json')!.asText()).reviewedAt).toBe('2026-09-11')
  const manifest=JSON.parse(zip.file('manifest.json')!.asText());for(const entry of manifest.files){const bytes=zip.file(entry.path)!.asUint8Array();expect(bytes.length).toBe(entry.sizeBytes);expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256)}
})

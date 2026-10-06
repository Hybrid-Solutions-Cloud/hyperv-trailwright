import {test,expect} from '@playwright/test'
import {readFile} from 'node:fs/promises'
import PizZip from 'pizzip'
import {sdnVmFixture} from '../src/testing/sdnVmFixture'

test('controller architecture choices retain hidden answers and export reviewed VMM mappings',async({page},info)=>{
 const {project}=sdnVmFixture(),errors:string[]=[]
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept())
 await page.goto('./');await page.locator('input[type=file]').first().setInputFiles({name:'controllers.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))})
 const nav=page.getByRole('navigation',{name:'Design sections'});await nav.getByRole('button',{name:/SDN design and setup/}).click()
 const review=page.getByRole('region',{name:'SDN setup review'});await expect(review).toContainText('Network Controller Production Generation 2 VM.xml')
 await expect(page.getByLabel('FCNC shared database path',{exact:true})).toHaveCount(0)
 await page.getByLabel('Controller VM hosting availability',{exact:true}).selectOption('clustered');await expect(review).toContainText('Highly available controller VMs require an inventoried failover cluster');await page.getByLabel('Controller VM hosting availability',{exact:true}).selectOption('standalone')
 await page.getByLabel('Controller architecture',{exact:true}).selectOption('host-cluster-role');await expect(page.getByLabel('FCNC shared database path',{exact:true})).toBeVisible();await expect(page.getByLabel('Dedicated VMM SDN host group ID',{exact:true})).toHaveCount(0)
 await page.getByLabel('Controller architecture',{exact:true}).selectOption('controller-vms');await expect(page.getByLabel('Dedicated VMM SDN host group ID',{exact:true})).toHaveValue('example-host-group')
 const save=page.waitForEvent('download');await page.getByRole('button',{name:'Download project',exact:true}).click();const saved=await readFile((await(await save).path())!);expect(JSON.parse(saved.toString()).schemaVersion).toBe(32)
 await page.locator('input[type=file]').first().setInputFiles({name:'reopened.json',mimeType:'application/json',buffer:saved});await nav.getByRole('button',{name:/SDN design and setup/}).click();await expect(page.getByLabel('Controller VM hosting availability',{exact:true})).toHaveValue('standalone')
 await page.setViewportSize({width:390,height:844});await review.scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('controller-mobile.png')})
 await nav.getByRole('button',{name:/Review and exports/}).click();const event=page.waitForEvent('download');await page.getByRole('button',{name:'Download design package (.zip)',exact:true}).click();const download=await event;await download.saveAs(info.outputPath('sdn-controller.zip'))
 const zip=new PizZip(await readFile((await download.path())!)),controller=JSON.parse(zip.file('plans/sdn-controller.json')!.asText())
 expect(controller).toMatchObject({expectedVmCount:3,templateName:'Network Controller Production Generation 2 VM.xml',runtimeQualified:false,executionAllowed:false});expect(controller.findings).toEqual([]);expect(controller.mapping.parameters.LocalAdmin).toBe('example-local-run-as');expect(zip.file('reports/sdn-design.md')!.asText()).toContain(controller.templateName);expect(zip.file('environment/sdn.yml')!.asText()).not.toContain('databasePath:');expect(errors).toEqual([])
})

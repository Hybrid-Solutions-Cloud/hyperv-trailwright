import {test,expect} from '@playwright/test'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import PizZip from 'pizzip'
import {vmmFixture} from '../src/testing/vmmFixture'
import {clusterFixture} from '../src/testing/clusterFixture'
import {quorumFixture} from '../src/testing/quorumFixture'

for(const [name,fixture] of [['vmm',()=>vmmFixture().project],['cluster',()=>clusterFixture().project],['quorum',()=>quorumFixture('cloud').project]] as const){
  test(`${name} configuration edits and package contain no deployment automation`,async({page},info)=>{
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept())
    const project=fixture();project.name=`${name.toUpperCase()} configuration`;await page.goto('./')
    await page.locator('input[type=file]').first().setInputFiles({name:'configuration.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))})
    await expect(page.locator('.project-bar strong')).toHaveText(project.name)
    if(name==='quorum'){
      await page.getByRole('button',{name:/Sites and clusters/}).click()
      await page.getByRole('combobox',{name:'Witness',exact:true}).selectOption('file')
      await expect(page.getByLabel('Cloud witness storage account name')).toHaveCount(0)
      await page.getByRole('combobox',{name:'Witness',exact:true}).selectOption('cloud')
      await expect(page.getByLabel('Cloud witness storage account name')).toHaveValue('examplewitness')
    }
    await page.getByRole('button',{name:/Implementation handoff/}).click()
    await expect(page.getByRole('heading',{name:/adapter|execution request/i})).toHaveCount(0)
    const saveEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download project',exact:true}).click()
    const saved=await readFile((await(await saveEvent).path())!,'utf8')
    expect(JSON.parse(saved).design).toEqual(project.design)
    await page.locator('input[type=file]').first().setInputFiles({name:'reopen.json',mimeType:'application/json',buffer:Buffer.from(saved)})
    await page.getByRole('button',{name:/Review and exports/}).click()
    await page.setViewportSize({width:390,height:844})
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
    const zipEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download design package (.zip)',exact:true}).click()
    const file=await zipEvent;await file.saveAs(info.outputPath(`${name}-configuration.zip`))
    const zip=new PizZip(await readFile((await file.path())!)),manifest=JSON.parse(zip.file('manifest.json')!.asText())
    expect(manifest.packagePurpose).toBe('configuration-design');expect(manifest).not.toHaveProperty('automationAdapters')
    expect(Object.keys(zip.files).filter(p=>/\.(ps1|psm1|sh|tf|bat|cmd)$/i.test(p)||p.startsWith('adapters/')||p.startsWith('execution/'))).toEqual([])
    expect(JSON.parse(zip.file('project.json')!.asText()).design).toEqual(project.design)
    for(const entry of manifest.files){const bytes=zip.file(entry.path)!.asUint8Array();expect(bytes.length,entry.path).toBe(entry.sizeBytes);expect(createHash('sha256').update(bytes).digest('hex'),entry.path).toBe(entry.sha256)}
    await page.screenshot({path:info.outputPath(`${name}-configuration-mobile.png`),fullPage:true})
    expect(errors).toEqual([])
  })
}

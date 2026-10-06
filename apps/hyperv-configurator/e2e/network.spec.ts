import {test,expect} from '@playwright/test'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import PizZip from 'pizzip'
import {networkFixture} from '../src/testing/networkFixture'
import {load} from 'js-yaml'
test('firewall, ToR and OOB gates reveal, hide and retain answers through save, reopen and export',async({page})=>{
 const {project}=networkFixture()
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept())
 await page.goto('./');await page.locator('input[type=file]').first().setInputFiles({name:'gates.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))})
 const nav=page.getByRole('navigation',{name:'Design sections'});await nav.getByRole('button',{name:/Networking and IP plan/}).click()
 const panel=(title:string)=>page.locator('section.panel').filter({has:page.getByRole('heading',{name:title,exact:true})})
 await expect(page.getByLabel('FortiGate model',{exact:true})).toHaveCount(0);await expect(panel('Firewall units')).toHaveCount(0);await expect(panel('Top-of-rack switches')).toHaveCount(0)
 await page.getByLabel('Firewall in this design *',{exact:true}).selectOption('tierpoint-fortigate')
 await page.getByLabel('FortiGate model',{exact:true}).fill('FortiGate-90G')
 await page.getByLabel('Top-of-rack switches *',{exact:true}).selectOption('dell-powerswitch')
 await page.getByLabel('Out-of-band management *',{exact:true}).selectOption('opengear')
 await expect(page.getByLabel('Lighthouse server address',{exact:true})).toBeVisible()
 for(const [title,button,label,name,ip] of [['Firewall units','+ Add firewall unit','Firewall hostname *','example-fw-a','192.0.2.8'],['Top-of-rack switches','+ Add ToR switch','Switch hostname *','example-tor-a','192.0.2.2'],['Out-of-band devices','+ Add OOB device','Device hostname *','example-og-1','192.0.2.3']] as const){
  const section=panel(title);await section.getByRole('button',{name:button,exact:true}).click()
  await section.getByLabel(label,{exact:true}).fill(name);await section.getByLabel('Management IP address *',{exact:true}).fill(ip)
 }
 const nic=page.locator('[data-record-id="nic-1-1"]');if(await nic.getAttribute('open')===null)await nic.locator('summary').click()
 await nic.getByLabel('Connected ToR switch',{exact:true}).selectOption({label:'example-tor-a'});await nic.getByLabel('Connected ToR switch port',{exact:true}).fill('ethernet1/1/5')
 const save=async()=>{const event=page.waitForEvent('download');await page.getByRole('button',{name:'Download project',exact:true}).click();return readFile((await(await event).path())!,'utf8')}
 const first=await save();expect(JSON.parse(first)).toMatchObject({schemaVersion:32,decisions:{firewallProvider:'tierpoint-fortigate',torProvider:'dell-powerswitch',oobModel:'opengear',fwModel:'FortiGate-90G'},design:{firewallDevices:[{values:{name:'example-fw-a'}}],torSwitches:[{values:{name:'example-tor-a'}}],oobDevices:[{values:{name:'example-og-1'}}]}})
 await page.locator('input[type=file]').first().setInputFiles({name:'gates-reopen.json',mimeType:'application/json',buffer:Buffer.from(first)})
 await expect(page.getByText(/^Opened /)).toBeVisible();await nav.getByRole('button',{name:/Networking and IP plan/}).click()
 await expect(panel('Firewall units').getByLabel('Firewall hostname *',{exact:true})).toHaveValue('example-fw-a')
 await expect(page.getByLabel('Firewall in this design *',{exact:true})).toHaveValue('tierpoint-fortigate')
 await page.getByLabel('Firewall in this design *',{exact:true}).selectOption('none')
 await expect(panel('Firewall units')).toHaveCount(0);await expect(page.getByLabel('FortiGate model',{exact:true})).toHaveCount(0)
 const second=JSON.parse(await save());expect(second.decisions).toMatchObject({firewallProvider:'none',fwModel:'FortiGate-90G'});expect(second.design.firewallDevices[0].values.name).toBe('example-fw-a')
 await nav.getByRole('button',{name:/Review and exports/}).click();const zipEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download design package (.zip)',exact:true}).click()
 const zip=new PizZip(await readFile((await(await zipEvent).path())!)),text=zip.file('infrastructure.yml')!.asText(),infra=load(text) as any
 expect(infra.decisions.firewall).toEqual({answer:'none',used:false});expect(infra.decisions.tor_switches).toEqual({answer:'dell-powerswitch',used:true})
 const devices=infra.networking.onprem.network_devices
 expect(devices.map((d:any)=>d.device_hostname)).toEqual(['example-tor-a','example-og-1'])
 expect(devices[0]).toMatchObject({device_type:'switch',device_vendor:'Dell',device_port_config:[{port:'ethernet1/1/5'}]});expect(devices[1]).toMatchObject({device_type:'console_server',device_vendor:'OpenGear'})
 expect(text).not.toContain('example-fw-a');expect(text).not.toContain('FortiGate-90G')
 expect(JSON.parse(zip.file('project.json')!.asText()).design.firewallDevices[0].values.name).toBe('example-fw-a')
 expect(errors).toEqual([])
})
test('host network ownership and scoped pool correction survive reopen and export',async({page},info)=>{
 const {project}=networkFixture();project.design.adapters[0].values.authority='vmm'
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept())
 await page.goto('./');await page.locator('input[type=file]').first().setInputFiles({name:'network.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))})
 const nav=page.getByRole('navigation',{name:'Design sections'});await nav.getByRole('button',{name:/Review and exports/}).click()
 await page.getByRole('button',{name:'The adapter and its switch or intent must have one configuration owner.',exact:true}).click()
 await expect(page.locator('[data-record-id="nic-1-1"]').getByLabel('Configuration owner *',{exact:true})).toBeFocused()
 await page.locator('[data-record-id="nic-1-1"]').getByLabel('Configuration owner *',{exact:true}).selectOption('atc')
 const pool=page.getByRole('region',{name:'Address pool capacity',exact:true});await expect(pool.getByRole('row').filter({hasText:'management-net'})).toContainText('5')
 const assignment=page.locator('[data-record-id="address-1"]');await assignment.locator('summary').click();await assignment.getByLabel('Address / exclusion start *',{exact:true}).fill('192.0.2.16')
 await nav.getByRole('button',{name:/Review and exports/}).click();await page.getByRole('button',{name:/Address assignment overlaps .* in the same routing scope\./}).click()
 await nav.getByRole('button',{name:/Networking and IP plan/}).click();if(await assignment.getAttribute('open')===null)await assignment.locator('summary').click();await assignment.getByLabel('Address / exclusion start *',{exact:true}).fill('192.0.2.13')
 const saveEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download project',exact:true}).click();const saved=await readFile((await(await saveEvent).path())!,'utf8');expect(JSON.parse(saved)).toMatchObject({schemaVersion:32,design:{hostSwitches:[{id:'switch-1'},{id:'switch-2'}]}})
 await page.locator('input[type=file]').first().setInputFiles({name:'reopened-network.json',mimeType:'application/json',buffer:Buffer.from(saved)});await nav.getByRole('button',{name:/Networking and IP plan/}).click()
 await expect(assignment.getByLabel('Address / exclusion start *',{exact:true})).toHaveValue('192.0.2.13')
 await page.setViewportSize({width:390,height:844});await pool.scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('network-mobile.png')})
 await nav.getByRole('button',{name:/Review and exports/}).click();const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download design package (.zip)',exact:true}).click();const download=await downloadEvent;await download.saveAs(info.outputPath('network-design.zip'))
 const zip=new PizZip(await readFile((await download.path())!)),plan=JSON.parse(zip.file('plans/network-design.json')!.asText())
 expect(plan.runtimeQualified).toBe(false);expect(plan.findings).toEqual([]);expect(plan.pools[0]).toMatchObject({remainingAddresses:5,unavailableAddresses:5,totalAddresses:10});expect(plan.assignments.find((r:{id:string})=>r.id==='address-1').values.start).toBe('192.0.2.13')
 expect(zip.file('diagrams/topology.drawio')!.asText()).toContain('source="n:nic-1-1" target="n:member-1-1"')
 for(const entry of JSON.parse(zip.file('manifest.json')!.asText()).files){const bytes=zip.file(entry.path)!.asUint8Array();expect(bytes.length).toBe(entry.sizeBytes);expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256)}
 expect(errors).toEqual([])
})

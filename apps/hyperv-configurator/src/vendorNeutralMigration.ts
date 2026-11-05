import {defaultAnswers,type Answer,type Answers,type Field} from './catalog'
import {decisionFields,networkDeviceCollections} from './componentDecisionFields'

/*
 * Schema 32 -> 33: vendor-neutral firewall, ToR, out-of-band and server hardware answers.
 *
 * Answers that still mean the same thing are kept. Single-vendor answers map to the new questions where the meaning is
 * explicit (a Dell OS10 ToR, an Opengear console server, a Dell OME appliance). Any other answer that is no longer an
 * option becomes unanswered, so the designer asks again instead of guessing. The step tolerates data that earlier
 * migrations already created in the schema-33 shape.
 */
type Raw=Record<string,unknown>
type Row={id:string;values:Answers}
const record=(value:unknown):value is Raw=>!!value&&typeof value==='object'&&!Array.isArray(value)
const str=(value:unknown)=>typeof value==='string'?value.trim():''
const collection=(key:string)=>networkDeviceCollections.find(c=>c.key===key)!
/** Keep the values a collection still defines, with defaults for new fields. */
const pick=(values:Answers,fields:Field[])=>({...defaultAnswers(fields),...Object.fromEntries(fields.filter(f=>f.key in values).map(f=>[f.key,values[f.key]]))}) as Answers
const rows=(design:Raw,key:string)=>(Array.isArray(design[key])?design[key]:[]) as Row[]

/** Copy every answer the current decision questions still accept; anything else starts unanswered. */
function currentDecisions(old:Raw):Answers{
  const next=defaultAnswers(decisionFields)
  for(const field of decisionFields){
    if(!(field.key in old))continue
    const value=old[field.key] as Answer
    if(field.options&&value!==''&&!(String(value) in field.options))continue
    next[field.key]=value
  }
  return next
}
/** A firewall or ToR gate is a plain used / not-used question; who supplied the device is not design data. */
const inScope=(value:unknown,used:string[])=>used.includes(String(value))?'yes':value==='none'?'no':''

/** Decision answers in the current shape, from schema 32. */
export function vendorNeutralDecisions(old:Raw):Answers{
  const next=currentDecisions(old)
  const set=(key:string,value:unknown)=>{if(value!==undefined&&value!=='')next[key]=value as Answer}

  // Firewall: a customer firewall keeps its recorded vendor text.
  if(!next.firewallInScope)next.firewallInScope=inScope(old.firewallProvider,['customer'])
  if(old.firewallProvider==='customer'&&str(old.customerFirewallVendor)&&!next.firewallPlatform){next.firewallPlatform='other';set('firewallVendor',str(old.customerFirewallVendor))}
  if(!next.fwGatewayIps)set('fwGatewayIps',str(old.customerFirewallGatewayIps)||undefined)
  if(!next.fwVirtualContexts)set('fwVirtualContexts',str(old.fwVdoms)||undefined)

  // ToR: the Dell PowerSwitch option and the OS answer name the platform.
  if(!next.torInScope)next.torInScope=inScope(old.torProvider,['dell-powerswitch','customer'])
  if(!next.torPlatform){
    if(old.torOs==='os10')next.torPlatform='dell-os10'
    else if(old.torOs==='sonic')next.torPlatform='dell-sonic'
    else if(old.torProvider==='customer'&&str(old.torVendor))next.torPlatform='other'
  }
  if(old.torPairMode==='vlt')next.torPairMode='mlag'
  if(!next.torPairDomain)set('torPairDomain',str(old.torVltDomain)||undefined)

  // OOB: the single choice becomes a management switch question and a console server question.
  if(old.oobModel==='oob-switch'){next.oobSwitch='yes';next.consoleServer='no'}
  if(old.oobModel==='none'){next.oobSwitch='no';next.consoleServer='no'}
  if(old.oobModel==='opengear'){
    next.consoleServer='yes';next.consoleServerPlatform='opengear'
    if(['existing','new'].includes(String(old.lighthouseInstance))){
      next.consoleManagement=String(old.lighthouseInstance);next.consoleManagementProduct='Opengear Lighthouse'
      set('consoleManagementAddress',str(old.lighthouseAddress)||undefined);set('consoleManagementPort',old.lighthousePort||undefined)
      set('consoleEnrollmentRef',str(old.lighthouseEnrollmentAuthRef)||undefined);set('consoleEnrollmentBundle',str(old.lighthouseEnrollmentBundle)||undefined)
    }
  }
  return next
}

/** Infer a server platform only from a manufacturer name the user already recorded. */
export function serverPlatformFromVendor(vendor:unknown):string{
  const v=str(vendor).toLowerCase()
  if(!v)return ''
  if(/\bdell\b/.test(v))return 'dell'
  if(/\bhpe?\b|hewlett/.test(v))return 'hpe'
  if(/lenovo/.test(v))return 'lenovo'
  if(/dataon/.test(v))return 'dataon'
  if(/cisco/.test(v))return 'cisco'
  if(/supermicro|super micro/.test(v))return 'supermicro'
  return 'other'
}

/**
 * Schema 33 -> 34: the firewall and ToR gates become used / not-used questions, and the owner, provider and
 * customer answers are removed because they are not design data.
 */
export function migrateDesignGatesV34(raw:Raw){
  if(!record(raw.decisions))throw new Error('Invalid schema 33 component decisions.')
  const old=raw.decisions,next=currentDecisions(old)
  if('firewallProvider' in old)next.firewallInScope=inScope(old.firewallProvider,['provider','customer'])
  if('torProvider' in old)next.torInScope=inScope(old.torProvider,['provider','customer'])
  raw.decisions=next
  raw.schemaVersion=34
}

export function migrateVendorNeutralV33(raw:Raw){
  if(!record(raw.decisions)||!record(raw.design))throw new Error('Invalid schema 32 component decisions or design collections.')
  const old=raw.decisions,design=raw.design
  raw.decisions=vendorNeutralDecisions(old)

  // Opengear appliances were recorded as OOB devices; they become console servers with the same IDs, so the console
  // port map keeps its references. A BMC can only be cabled to an OOB switch, so BMC references to them are cleared.
  const oob=rows(design,'oobDevices'),consoleServers=rows(design,'consoleServers')
  const opengear=old.oobModel==='opengear'
  const moved=new Set(opengear?oob.map(r=>r.id):[])
  if(!opengear&&!str((raw.decisions as Answers).oobSwitchVendor)){
    const vendor=oob.map(r=>str(r.values?.vendor)).find(Boolean)
    if(vendor&&!(raw.decisions as Answers).oobSwitchPlatform){(raw.decisions as Answers).oobSwitchPlatform='other';(raw.decisions as Answers).oobSwitchVendor=vendor}
  }
  design.oobDevices=oob.filter(r=>!moved.has(r.id)).map(r=>({id:r.id,values:pick(r.values,collection('oobDevices').fields)}))
  design.consoleServers=[...consoleServers.map(r=>({id:r.id,values:pick(r.values,collection('consoleServers').fields)})),...oob.filter(r=>moved.has(r.id)).map(r=>({id:r.id,values:pick(r.values,collection('consoleServers').fields)}))]
  const consoleIds=new Set((design.consoleServers as Row[]).map(r=>r.id)),oobIds=new Set((design.oobDevices as Row[]).map(r=>r.id))
  for(const port of rows(design,'consolePorts'))if(port.values&&port.values.consoleServer&&!consoleIds.has(String(port.values.consoleServer)))port.values.consoleServer=''
  for(const host of rows(design,'hosts')){
    if(!record(host.values))continue
    if(host.values.bmcOobDevice&&!oobIds.has(String(host.values.bmcOobDevice)))host.values.bmcOobDevice=''
    if(!('hardwarePlatform' in host.values))host.values={...host.values,hardwarePlatform:serverPlatformFromVendor(host.values.vendor)}
  }
  for(const gateway of rows(design,'firewallGateways')){
    if(!record(gateway.values)||!('vdom' in gateway.values))continue
    const {vdom,...values}=gateway.values;gateway.values={...values,virtualContext:values.virtualContext??vdom??''}
  }

  // Every hardware management appliance recorded before schema 33 is Dell OpenManage Enterprise.
  const components=[...(Array.isArray(raw.components)?raw.components:[]),...(Array.isArray(raw.omittedComponents)?raw.omittedComponents.map(row=>record(row)?row.component:undefined):[])]
  for(const c of components)if(record(c)&&c.product==='ome'&&record(c.productDetails)&&!('platform' in c.productDetails))c.productDetails={...c.productDetails,platform:'dell-ome',platformName:''}
  raw.schemaVersion=33
}

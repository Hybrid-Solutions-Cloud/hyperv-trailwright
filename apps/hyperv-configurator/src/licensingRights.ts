import type {Field,Answers} from './catalog'
import type {Finding} from './validation'

const text=(key:string,label:string,required=true):Field=>({key,label,type:'text',required})
const notes=(key:string,label:string,required=true):Field=>({key,label,type:'notes',required})
const select=(key:string,label:string,options:Record<string,string>):Field=>({key,label,type:'select',options,required:true})
const when=(field:Field,key:string,...values:string[]):Field=>({...field,when:{key,values}})

/** Independent of the v9 quantity fields so old migrations never invent commercial review. */
export const licensingRightsFields:Field[]=[
  select('commercialProgram','Commercial program family',{commercial:'Microsoft Commercial Licensing',oem:'OEM',spla:'SPLA',provider:'Provider-supplied service',other:'Other reviewed agreement'}),
  text('agreementRef','Agreement evidence reference'),
  text('rightsOwner','Rights review owner'),
  text('rightsEvidence','Applicable product terms / entitlement evidence'),
  select('entitlementTerm','Entitlement term',{perpetual:'Perpetual without active SA',sa:'Perpetual with active SA',subscription:'Subscription',provider:'Provider-supplied entitlement'}),
  text('termStart','Entitlement / SA term start (YYYY-MM-DD)'),
  text('assignedAt','License assignment date (YYYY-MM-DD)'),
  select('reassignmentBasis','Assignment and mobility basis',{fixed:'Fixed assignment; destinations licensed separately',vmMobility:'Eligible per-VM mobility within the reviewed server farm',exception:'Separately reviewed reassignment / DR exception',provider:'Provider assignment contract'}),
  notes('mobilityEvidence','Assignment, server farm and failover rights review'),
  when(notes('providerRightsEvidence','Provider, outsourcing and customer ownership review'),'context','hosted'),
  select('activationMethod','Activation method',{kms:'KMS',adba:'Active Directory-based activation',mak:'MAK',avma:'Automatic VM activation',subscription:'Subscription / service activation',provider:'Provider-managed activation',none:'No activation required after review',other:'Other reviewed activation method'}),
  when(text('activationRef','Activation runtime reference (no keys)'),'activationMethod','kms','adba','mak','avma','subscription','provider','other'),
  notes('activationEvidence','Activation prerequisites and responsible owner'),
]

const validDate=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s
const known=(s:string)=>!!s&&!/^(withheld for sharing|secret-ref:\/\/withheld\/)/i.test(s)

export function licensingRightsReview(values:Answers,recordId:string,asOf:string){
  const s=(key:string)=>String(values[key]??'').trim(),findings:(Finding&{domain:'rights'|'activation'})[]=[]
  const add=(fieldKey:string,message:string,domain:'rights'|'activation'='rights')=>findings.push({code:`LICENSE_COMMERCIAL_${fieldKey.toUpperCase()}`,section:'licensing',recordId,fieldKey,severity:'error',message:`${s('name')||'License item'}: ${message}`,domain})
  for(const key of ['commercialProgram','entitlementTerm','reassignmentBasis','activationMethod']){
    const field=licensingRightsFields.find(f=>f.key===key)!
    if(!Object.prototype.hasOwnProperty.call(field.options!,s(key)))add(key,`Select ${field.label.toLowerCase()}.`,key==='activationMethod'?'activation':'rights')
  }
  for(const key of ['agreementRef','rightsOwner','rightsEvidence','mobilityEvidence'])if(!known(s(key)))add(key,`Record ${licensingRightsFields.find(f=>f.key===key)!.label.toLowerCase()}.`)
  for(const key of ['termStart','assignedAt'])if(!validDate(s(key))||s(key)>asOf)add(key,'Record a valid date no later than this design assessment date.')
  const timed=['sa','subscription','provider'].includes(s('entitlementTerm'))
  if(timed&&(!validDate(s('saExpiry'))||s('saExpiry')<asOf||s('saExpiry')<s('termStart')))add('saExpiry','The selected term requires a valid end date covering this design date and following its start.')
  if(s('calculationModel')==='virtual'){
    if(!['sa','subscription'].includes(s('entitlementTerm'))||s('vmEligibility')!==s('entitlementTerm'))add('entitlementTerm','Per-VM eligibility must match the reviewed active SA or subscription term.')
  }
  if(s('calculationModel')!=='manual'&&s('commercialProgram')!=='commercial')add('commercialProgram','Use a reviewed manual quantity for this program; the automatic core profile covers Microsoft Commercial Licensing only.')
  if(s('context')==='hosted'&&!known(s('providerRightsEvidence')))add('providerRightsEvidence','Record the exact provider, infrastructure ownership, customer rights and outsourcing review.')
  if(s('reassignmentBasis')==='vmMobility'&&(s('calculationModel')!=='virtual'||!['sa','subscription'].includes(s('entitlementTerm'))))add('reassignmentBasis','This mobility basis requires eligible per-VM licensing and an active SA or subscription term; VM movement alone does not move licenses.')
  if((s('commercialProgram')==='provider')!==(s('entitlementTerm')==='provider'))add('entitlementTerm','Provider-supplied entitlements need a matching provider program and term.')
  if(s('reassignmentBasis')==='provider'&&s('commercialProgram')!=='provider')add('reassignmentBasis','Provider assignment requires a provider-supplied entitlement contract.')
  if(!known(s('activationEvidence')))add('activationEvidence','Record activation prerequisites and an owner; activation does not establish usage rights.','activation')
  if(s('activationMethod')&&s('activationMethod')!=='none'&&!known(s('activationRef')))add('activationRef','Supply a runtime reference or endpoint, never a product key.','activation')
  if(/\b[A-Z0-9]{5}(?:-[A-Z0-9]{5}){4}\b/i.test(s('activationRef')))add('activationRef','Remove the product key and supply an external runtime reference.','activation')
  const rightsResolved=!findings.some(f=>f.domain==='rights')
  const activationResolved=!findings.some(f=>f.domain==='activation')
  return {recordId,commercialProgram:s('commercialProgram'),agreementRef:s('agreementRef'),rightsOwner:s('rightsOwner'),rightsEvidence:s('rightsEvidence'),entitlementTerm:s('entitlementTerm'),termStart:s('termStart'),termEnd:timed?s('saExpiry'):'',assignedAt:s('assignedAt'),reassignmentBasis:s('reassignmentBasis'),mobilityEvidence:s('mobilityEvidence'),providerRightsEvidence:s('providerRightsEvidence'),activation:{method:s('activationMethod'),reference:s('activationRef'),evidence:s('activationEvidence'),resolved:activationResolved,establishesEntitlement:false},rightsResolved,findings}
}

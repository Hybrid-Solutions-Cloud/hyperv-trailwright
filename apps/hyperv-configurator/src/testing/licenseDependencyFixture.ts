import {licenseCoverageFixture} from './licenseCoverageFixture'
import {newComponent} from '../project'
import type {Answers} from '../catalog'
export function licenseDependencyFixture(){
  const f=licenseCoverageFixture(),{project,add,license,vm}=f
  const commercial=(id:string,product:string,values:Answers={})=>add('licenses',id,{...license.values,name:'EXAMPLE '+id,product,calculationModel:'manual',basis:'unit',required:1,owned:0,entitlementId:'',entitlementTotalUnits:0,rights:'purchase',unitPrice:5,...values})
  const base=commercial('base-access','access',{basis:'user',required:10,owned:4,entitlementId:'example-cal-pool',entitlementTotalUnits:4})
  const access=add('accessRights','audience',{license:base.id,kind:'windows',metric:'user',audience:'EXAMPLE operators',quantity:10,actualUse:'EXAMPLE distinct users and endpoints reviewed',versionEvidence:'EXAMPLE Windows CAL edition and suite reviewed',scopeEvidence:'EXAMPLE complete audience allocation'})
  const rds=commercial('rds-access','access',{basis:'user',required:10,unitPrice:7})
  add('accessRights','rds-audience',{...access.values,name:'EXAMPLE RDS audience',license:rds.id,kind:'rds',baseLicense:base.id})
  const azure=commercial('monitor-meter','azure',{basis:'GB ingested',required:12.5,owned:2.25,entitlementId:'example-monitor-benefit',entitlementTotalUnits:2.25,unitPrice:3,term:'monthly',commercialProgram:'other',entitlementTerm:'subscription'})
  const meter=add('azureLicenseMeters','monitor-scope',{license:azure.id,service:'monitor',target:vm.id,scope:'EXAMPLE monitor billing scope',meter:'EXAMPLE ingestion meter',region:'EXAMPLE quote region',unit:'GB ingested',quantity:12.5,period:'monthly',ingestionGB:12.5,retentionDays:30,benefit:'allocation',benefitEvidence:'EXAMPLE 2.25 GB allocated benefit and separate retention review',usageEvidence:'EXAMPLE VMM guest and full linked ingestion scope'})
  const appliance=newComponent('ome');appliance.id='ome-example';appliance.name='EXAMPLE OME';project.components.push(appliance)
  const ome=commercial('ome-entitlement','ome',{basis:'device',owned:1,entitlementTotalUnits:1,entitlementId:'example-ome-pool',commercialProgram:'other'})
  const dependency=add('licenseDependencies','ome-feature',{license:ome.id,category:'ome',target:appliance.id,feature:'EXAMPLE Advanced+ partner plugin',inventoryEvidence:'EXAMPLE exact covered device allocation',versionEvidence:'EXAMPLE OME and plugin compatibility / tier',coverageEvidence:'EXAMPLE existing tier includes this feature; iDRAC prerequisites reviewed'})
  add('licenseDependencies','ome-power',{...dependency.values,name:'EXAMPLE power feature',feature:'EXAMPLE Power Manager'})
  return {...f,base,access,rds,azure,meter,ome,appliance,dependency,commercial}
}

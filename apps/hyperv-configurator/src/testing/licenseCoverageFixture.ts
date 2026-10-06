import {licensingFixture} from './licensingFixture'
import {newComponent} from '../project'

export function licenseCoverageFixture(){
  const f=licensingFixture(),{project,add,license,vm}=f
  const scom=newComponent('scom');scom.id='scom-service';scom.name='EXAMPLE SCOM';scom.vCpu=4;project.components.push(scom)
  const sql=newComponent('sql');sql.id='sql-service';sql.name='EXAMPLE supporting SQL';sql.vCpu=8;sql.version='SQL Server 2022 CU reviewed example';Object.assign(sql.productDetails,{edition:'standard',instance:'EXAMPLE instance',topology:'standalone'});project.components.push(sql)
  const sc=add('licenses','sc-estate',{...license.values,name:'EXAMPLE System Center estate',product:'systemcenter',edition:'System Center 2025 Standard',entitlementId:'example-sc-pool',entitlementTotalUnits:0,owned:0,unitPrice:20})
  for(const a of [...project.design.licenseAssignments])add('licenseAssignments','sc-'+a.id,{...a.values,name:'SC '+String(a.values.name),license:sc.id})
  const sqlLicense=add('licenses','sql-license',{...license.values,name:'EXAMPLE included SQL',product:'sql',edition:'SQL Server Standard supporting runtime',calculationModel:'manual',basis:'Reviewed SQL OSE scope',rights:'included',restrictedUse:'EXAMPLE exact supporting technology review',required:1,owned:0,entitlementId:'',entitlementTotalUnits:0,unitPrice:0,quoteStatus:'nocharge',quoteSource:'EXAMPLE supporting SQL no-additional-charge review',activationMethod:'none',activationRef:'',activationEvidence:'EXAMPLE SQL activation review'})
  for(const component of [vm,scom])add('systemCenterConsumers','consumer-'+component.id,{component:component.id,license:sc.id,estateEvidence:'EXAMPLE shared managed estate; no per-service license charge'})
  const use=add('sqlLicenseUses','sql-scope',{license:sqlLicense.id,component:sql.id,mode:'included',supportingLicense:sc.id,workloadScope:'supporting',oseEvidence:'EXAMPLE one SQL OSE, all instances and reporting scope reviewed',editionHaEvidence:'EXAMPLE Standard standalone edition and recovery rights',hostingEvidence:'EXAMPLE customer-owned hosting rights'})
  const database=add('sqlWorkloads','vmm-db',{name:'EXAMPLE VMM database',use:use.id,consumer:vm.id,purpose:'vmm',evidence:'EXAMPLE VMM database rights'})
  add('sqlWorkloads','scom-db',{name:'EXAMPLE SCOM operational database',use:use.id,consumer:scom.id,purpose:'operational',evidence:'EXAMPLE SCOM database rights'})
  const mapping=add('licenseCoverage','vmm-normal',{license:license.id,target:vm.id,basis:'assignment',assignment:'assignment-a',scenario:'normal',osClass:'windows',evidence:'EXAMPLE normal physical destination and Windows coverage'})
  add('licenseCoverage','vmm-failover',{...mapping.values,name:'EXAMPLE VMM failover',assignment:'assignment-b',scenario:'failover'})
  add('licenseCoverage','scom-normal',{...mapping.values,name:'EXAMPLE SCOM normal',target:scom.id})
  add('licenseCoverage','sql-normal',{...mapping.values,name:'EXAMPLE SQL normal',target:sql.id,assignment:'assignment-b'})
  return {...f,scom,sql,sc,sqlLicense,use,database,mapping}
}

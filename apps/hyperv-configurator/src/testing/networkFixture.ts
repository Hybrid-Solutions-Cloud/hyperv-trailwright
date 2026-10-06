import {collections,newRecord,type Answers} from '../catalog'
import {newProject} from '../project'
export function networkFixture(){
 const project=newProject();project.name='Host networking example';project.owner='Example network team';project.scope='cluster';project.environment='lab'
 const add=(key:string,id:string,values:Answers)=>{const row=newRecord(collections.find(c=>c.key===key)!);row.id=id;Object.assign(row.values,{name:id,owner:project.owner},values);project.design[key].push(row);return row}
 add('clusters','cluster-net',{os:'ws2025',edition:'datacenter',topology:'cluster'})
 const network=add('networks','management-net',{purpose:'management',routingScope:'example-lab',cidr:'192.0.2.0/24',vlan:100,mtu:1500,gateway:'192.0.2.1',poolStart:'192.0.2.10',poolEnd:'192.0.2.19',poolMode:'static',authority:'native',dns:'192.0.2.2',ntp:'time.example.test'})
 for(let i=1;i<=2;i++){
  add('hosts',`host-net-${i}`,{cluster:'cluster-net'})
  add('hostSwitches',`switch-${i}`,{name:'ExampleConverged',host:`host-net-${i}`,mode:'atc',authority:'atc',action:'create',management:true,compute:true,physicalReview:'EXAMPLE physical switch prerequisites reviewed',acceptance:'EXAMPLE management, failover and recovery review',managementRecovery:'EXAMPLE approved independent management recovery'})
  for(let port=1;port<=2;port++){
   add('adapters',`nic-${i}-${port}`,{host:`host-net-${i}`,nativeName:`pNIC${port}`,manufacturer:'EXAMPLE vendor',modelId:'EXAMPLE model',driverVersion:'EXAMPLE 1.0',firmwareVersion:'EXAMPLE 2.0',speedGbps:25,authority:'atc',mac:`02:00:00:00:0${i}:0${port}`,rdma:'none',mtu:1500,allowedVlans:'100,200-210',linkState:'up'})
   add('switchMembers',`member-${i}-${port}`,{switch:`switch-${i}`,adapter:`nic-${i}-${port}`})
  }
  add('hostVnics',`interface-${i}`,{host:`host-net-${i}`,switch:`switch-${i}`,network:network.id,nativeName:'vEthernet (Management)',vlan:100,mtu:1500,rdma:'none'})
  add('addressAssignments',`address-${i}`,{network:network.id,interface:`interface-${i}`,resource:`host-net-${i}`,kind:'static',start:`192.0.2.${10+i}`})
 }
 add('addressAssignments','excluded-a',{network:network.id,kind:'exclusion',start:'192.0.2.15',end:'192.0.2.17'})
 return {project,add,network}
}

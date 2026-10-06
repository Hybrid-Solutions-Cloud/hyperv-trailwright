import {sdnFixture} from './sdnFixture'
export function sdnServicesFixture(){
 const {project,add}=sdnFixture();project.name='Example SDN tenant services'
 add('networks','tenant-a',{name:'Tenant A subnet',purpose:'tenant',cidr:'10.0.0.0/24',routingScope:'tenant-a'})
 add('networks','public-vip',{name:'Public VIP pool',purpose:'vip',cidr:'203.0.113.0/24',routingScope:'vip',poolStart:'203.0.113.10',poolEnd:'203.0.113.100'})
 add('media','sdn-image',{});Object.assign(project.sdn.details,{image:'sdn-image',vmLocation:'C:\\ClusterStorage\\Volume1\\SDN',publicVipNetwork:'public-vip'})
 const service=(id:string,kind:string)=>add('tenantServices',id,{tenantId:'Tenant-A',network:'tenant-a',service:kind,lifecycle:'create',lifecycleOwner:'powershell',validation:'EXAMPLE exact allowed/denied traffic and failure tests'})
 const network=service('tenant-network','network'),policy=service('tenant-policy','policy'),lb=service('tenant-lb','loadBalancer'),gateway=service('tenant-gateway','gateway')
 for(const [id,role,address,host]of [['mux','mux','192.0.2.30','sdn-host-1'],['gateway-a','gateway','192.0.2.31','sdn-host-1'],['gateway-b','gateway','192.0.2.32','sdn-host-2']])add('sdnResources',id,{role,cluster:'sdn-cluster',host,lifecycle:'create',lifecycleOwner:'powershell',failureDomain:host,managementNetwork:'sdn-management',managementIp:address,vCpu:4,memoryGiB:8,diskGiB:80,throughputGbps:1,prerequisites:'EXAMPLE role readiness'})
 gateway.values.gatewayResource='gateway-a'
 const common={acceptance:'EXAMPLE exact traffic and failure expectations'}
 const acl=add('sdnAclRules','allow-web',{...common,service:policy.id,attachment:'subnet',network:'tenant-a',direction:'inbound',action:'allow',protocol:'tcp',priority:100,sourcePrefix:'*',destinationPrefix:'10.0.0.0/24',sourcePorts:'0-65535',destinationPorts:'80-443',logging:'enabled'})
 const frontend=add('sdnFrontends','public-web',{...common,service:lb.id,exposure:'public',network:'public-vip',address:'203.0.113.10'})
 const pool=add('sdnBackendPools','web-pool',{...common,service:lb.id})
 const member=add('sdnBackendMembers','web-1',{pool:pool.id,network:'tenant-a',interfaceId:'/networkInterfaces/example-web/ipConfigurations/example-ip',address:'10.0.0.10',preservation:'EXAMPLE preserve unrelated interface memberships'})
 const probe=add('sdnProbes','web-probe',{...common,service:lb.id,protocol:'http',port:80,path:'/health',intervalSeconds:5,threshold:3,sourceReachability:'EXAMPLE permit controller-defined probe sources through ACL'})
 const rule=add('sdnTrafficRules','web-rule',{...common,service:lb.id,kind:'loadBalance',frontend:frontend.id,pool:pool.id,probe:probe.id,protocol:'tcp',frontendPort:443,backendPort:443,idleMinutes:4,distribution:'default',floatingIp:'disabled'})
 const gatewayPool=add('sdnGatewayPools','ipsec-pool',{...common,connectionType:'ipsec',lifecycle:'create',lifecycleOwner:'powershell',reserveMembers:1,capacityEvidence:'EXAMPLE vendor qualification'})
 for(const resource of ['gateway-a','gateway-b'])add('sdnGatewayMembers',`${resource}-member`,{pool:gatewayPool.id,resource,capacityMbps:1000,capacityEvidence:'EXAMPLE throughput qualification'})
 const connection=add('sdnConnections','site-a',{...common,service:gateway.id,pool:gatewayPool.id,kind:'ipsec',network:'tenant-a',remoteAddress:'198.51.100.50',inboundMbps:100,outboundMbps:50,authRef:'secret-ref://example/ipsec',ipsecPolicy:'EXAMPLE AES256 / SHA256 / reviewed IKE lifetime and PFS',routing:'static',routePolicy:'EXAMPLE only approved destination; withdraw on failure'})
 const route=add('sdnRoutes','site-a-route',{...common,connection:connection.id,destination:'10.20.0.0/16',metric:10})
 return {project,add,network,policy,lb,gateway,acl,frontend,pool,member,probe,rule,gatewayPool,connection,route}
}

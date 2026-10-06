import type {Project} from './project'
import {networkDesign} from './networkDesign'
import {cidr} from './networkAddress'
import {collections} from './catalog'
import {referenceOptions} from './references'
import type {Finding} from './validation'
/** Return only errors affecting the selected physical hosts and their network scope. */
export function networkCandidateFindings(project:Project,hostIds:Set<string>,clusterIds:Set<string>=new Set()):Finding[]{
 if(!hostIds.size&&!clusterIds.size)return []
 const assessment=networkDesign(project),ids=new Set([...hostIds,...clusterIds]),networks=new Set<string>()
 for(const c of project.design.clusters)if(clusterIds.has(c.id)||project.design.hosts.some(h=>hostIds.has(h.id)&&h.values.cluster===c.id)){if(c.values.managementNetwork)networks.add(String(c.values.managementNetwork))}
 for(const key of ['adapters','hostSwitches','hostVnics','networkTrafficClasses'])for(const row of project.design[key])if(hostIds.has(String(row.values.host))){ids.add(row.id);if(row.values.network)networks.add(String(row.values.network))}
 for(const address of assessment.declaredAddresses)if(hostIds.has(address.targetId))networks.add(address.networkId)
 const selectedNetworks=project.design.networks.filter(n=>networks.has(n.id))
 for(const net of project.design.networks){const range=cidr(String(net.values.cidr));if(range&&selectedNetworks.some(n=>{const other=cidr(String(n.values.cidr));return n.values.routingScope&&String(n.values.routingScope).trim().toLowerCase()===String(net.values.routingScope).trim().toLowerCase()&&other&&range.first<=other.last&&other.first<=range.last}))networks.add(net.id)}
 for(const id of networks)ids.add(id)
 for(const key of ['switchMembers','addressAssignments','managementNetworks'])for(const row of project.design[key])if(ids.has(String(row.values.switch))||ids.has(String(row.values.adapter))||ids.has(String(row.values.interface))||networks.has(String(row.values.network)))ids.add(row.id)
 for(const address of assessment.declaredAddresses)if(networks.has(address.networkId))ids.add(address.recordId)
 const findings=assessment.findings.filter(f=>f.severity==='error'&&ids.has(f.recordId||''))
 for(const c of collections.filter(c=>c.section==='network'))for(const row of project.design[c.key].filter(r=>ids.has(r.id)))for(const field of c.fields.filter(f=>f.collection&&row.values[f.key]))if(!referenceOptions(project,field.collection!).some(r=>r.id===row.values[field.key]))findings.push({code:'NETWORK_CANDIDATE_REFERENCE',section:'network',recordId:row.id,fieldKey:field.key,severity:'error',message:'Resolve the missing network resource reference before preparing this host or cluster consumer.'})
 return findings
}

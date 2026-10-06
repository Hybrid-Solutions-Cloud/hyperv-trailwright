import type {Project,Component} from './project'

export type SupportStatus='supported'|'preview'|'unknown'|'unavailable'
export interface SupportEntry {id:string;topic:string;baseline:string;status:SupportStatus;basis:'vendor'|'configurator';summary:string;conditions:string[];sources:string[]}
export const SUPPORT_SOURCES={
  vmm:'https://learn.microsoft.com/en-us/system-center/vmm/system-requirements?view=sc-vmm-2025',
  vmmHa:'https://learn.microsoft.com/en-us/system-center/vmm/plan-ha-install?view=sc-vmm-2025',
  scom:'https://learn.microsoft.com/en-us/system-center/scom/system-requirements?view=sc-om-2025',
  scomSql:'https://learn.microsoft.com/en-us/system-center/scom/plan-sqlserver-design?view=sc-om-2025',
  wac:'https://learn.microsoft.com/en-us/windows-server/manage/windows-admin-center/plan/installation-options',
  wacPreview:'https://learn.microsoft.com/en-us/windows-server/manage/windows-admin-center/install-virtualization-mode',
  wacHosts:'https://learn.microsoft.com/en-us/windows-server/manage/windows-admin-center/add-virtualization-mode-resources',
  arc:'https://learn.microsoft.com/en-us/azure/azure-arc/system-center-virtual-machine-manager/support-matrix-for-system-center-virtual-machine-manager',
  ome:'https://www.dell.com/support/kbdoc/en-uk/000423997/openmanage-enterprise-4-7-support-matrix?lang=en',
  omeHost:'https://www.dell.com/support/manuals/en-us/dell-openmanage-enterprise/ome_p_4_7_online_help_user_guide/host-system-requirements?guid=guid-54cbd632-cf9e-40b1-8420-085d49196e10&lang=en-us',
  sdn:'https://learn.microsoft.com/en-us/windows-server/networking/sdn/technologies/network-controller/network-controller-failover-clustering',
  sdnVmm:'https://learn.microsoft.com/en-us/system-center/vmm/deploy-sdn?view=sc-vmm-2025',
} as const
const entry=(id:string,topic:string,baseline:string,status:SupportStatus,summary:string,conditions:string[],sources:string[],basis:SupportEntry['basis']='vendor'):SupportEntry=>({id,topic,baseline,status,basis,summary,conditions,sources})
export const SUPPORT_CATALOG={
  kind:'hyperv-support-catalog',version:'0.1.0',reviewedAt:'2026-09-11',
  meaning:'Status applies only to the stated vendor baseline and conditions. It does not certify this design, licensing or an external implementation tool. Unlisted combinations remain unknown.',
  entries:[
    entry('vmm-2025-server','VMM management server','System Center VMM 2025','supported','Management-server and remote-library OS: Windows Server 2025 Core or Desktop Experience.',['Domain membership; server name at most 15 characters.','SQL Server 2019/2022/2025 dependencies require supported updates and their own OS/edition review.','ADK/WinPE and PowerShell prerequisites remain required.'],[SUPPORT_SOURCES.vmm]),
    entry('vmm-2025-hosts','VMM managed hosts','System Center VMM 2025','supported','The managed-host matrix includes Windows Server 2019, 2022 and 2025.',['Hyper-V Server 2019 is explicitly excluded.','Do not apply this host matrix to the VMM management server.'],[SUPPORT_SOURCES.vmm]),
    entry('vmm-parent-os','VMM installation placement','System Center VMM 2025','unavailable','VMM installation in a Hyper-V host parent OS is unsupported.',['Use a separate VM or dedicated management server.'],[SUPPORT_SOURCES.vmm]),
    entry('vmm-2025-ha','VMM service availability','System Center VMM 2025','supported','Service, SQL and library availability are separate designs.',['Service cluster: Windows Server 2025, DKM and service identity.','Stretched VMM service clusters are unsupported.','SQL and highly available library shares must be separate from the VMM service cluster.'],[SUPPORT_SOURCES.vmmHa]),
    entry('scom-2025-roles','SCOM role operating systems','System Center Operations Manager 2025','supported','Server roles support Windows Server 2022/2025; installation-type support depends on the role.',['Core supports management/gateway roles; web, ACS collector, console and reporting have separate restrictions.','VM pause/save-state and snapshot-style recovery are restricted.'],[SUPPORT_SOURCES.scom]),
    entry('scom-2025-sql','SCOM database dependencies','System Center Operations Manager 2025','supported','SQL version, rollup, SSRS and database configuration require a separate review.',['SQL Server 2025 begins at SCOM 2025 UR1.','Ordinary SCOM requires SQL Server on Windows; SQL PaaS is not interchangeable.','Check supported CU, collation, Windows authentication, Full Text Search and matching engine/SSRS major versions.'],[SUPPORT_SOURCES.scomSql]),
    entry('wac-administration','WAC gateway operating systems','Administration Mode','supported','Gateway/server/cluster installation options list Windows Server 2016, 2019, 2022 and 2025.',['Pin the WAC release, extension versions and deployment topology.','Gateway installation support does not establish every managed feature.'],[SUPPORT_SOURCES.wac]),
    entry('wac-virtualization','WAC Virtualization Mode gateway','Virtualization Mode preview','preview','Separate dedicated system; Windows Server 2025+ Standard or Datacenter.',['At least 4 CPUs, 8 GB RAM and 10 GB free disk.','Domain membership/FQDN and same-domain managed hosts.','Install separately from Administration Mode; review preview certificates and recovery limits.'],[SUPPORT_SOURCES.wacPreview]),
    entry('wac-virtualization-hosts','WAC Virtualization Mode compute hosts','Virtualization Mode preview','preview','Compute hosts require Windows Server 2025+ Datacenter.',['Do not apply the gateway Standard-edition allowance to compute hosts.','Existing host readiness, networking, storage and capacity prerequisites apply.'],[SUPPORT_SOURCES.wacHosts]),
    entry('arc-vmm','Azure management integration','Arc-enabled VMM','supported','Arc projects the existing VMM fabric into Azure; it requires a resource bridge and Azure ownership.',['Outbound networking, DNS, subscription and RBAC prerequisites apply.','Server/console LTSC and rollup must match; direct guest-agent installation has additional gates.','Offline local operation cannot depend on Arc services.'],[SUPPORT_SOURCES.arc]),
    entry('ome-47-hyperv','OME appliance on Hyper-V','OpenManage Enterprise 4.7','supported','The release matrix lists Windows Server 2022 and 2025 Hyper-V; the host guide specifies Generation 2.',['Verify exact appliance image, device count, plug-ins, VM disks and platform release.','Use the release matrix when the general guide has a broader OS range.'],[SUPPORT_SOURCES.ome,SUPPORT_SOURCES.omeHost]),
    entry('ome-47-vsphere','OME appliance on vSphere','OpenManage Enterprise 4.7','supported','The matrix lists ESXi 8.0/U1/U2/U3, 9.0 and 9.1.',['Appliance release, device/plug-in capacity and exact ESXi build still need review.'],[SUPPORT_SOURCES.ome]),
    entry('ome-47-provider-wrapper','OME through another provider','OpenManage Enterprise 4.7','unknown','A supported underlying hypervisor does not certify Cloud Director or another provider deployment contract.',['Review the appliance import path, platform mapping and vendor evidence independently.'],[SUPPORT_SOURCES.ome]),
    entry('ome-manual-install','OME installation execution','Configurator operator handoff','unavailable','Automatic OME appliance installation is outside the authorized implementation scope.',['Appliance import, first boot, licensing and operational acceptance remain manual tasks.','HTTPS reachability is not installation evidence.'],[SUPPORT_SOURCES.omeHost],'configurator'),
    entry('sdn-controller-vms','SDN controller architecture','Windows Server 2025','supported','Service Fabric-based Network Controller remains supported.',['Review role counts, placement, certificates and exact deployment tools.'],[SUPPORT_SOURCES.sdn]),
    entry('sdn-controller-cluster','SDN controller architecture','Windows Server 2025','supported','Network Controller can run as a host failover-cluster service.',['SLB and gateways remain separate VMs.','Floating management address, DNS and host-cluster prerequisites still apply.'],[SUPPORT_SOURCES.sdn]),
    entry('sdn-vmm','VMM SDN deployment','System Center VMM 2025','supported','VMM documents controller, load-balancer and gateway deployment and management.',['Use VMM fabric identities and a single lifecycle owner.','The overview alone does not qualify every controller architecture.'],[SUPPORT_SOURCES.sdnVmm]),
    entry('sdn-vmm-host-controller','VMM with host-cluster Network Controller','Exact version combination','unknown','Host-controller OS support does not establish compatibility with the selected VMM or SDN Express build.',['Obtain architecture-specific tool evidence and qualify the consumer before execution.'],[SUPPORT_SOURCES.sdn,SUPPORT_SOURCES.sdnVmm]),
    entry('native-consumers','Configurator execution consumers','Candidate adapters','unknown','VMM, prepared-cluster and quorum candidates have contract checks; native runtime qualification is pending.',['Product installation, additional providers/DSC and SDN require named, pinned qualified consumers.','A vendor-supported product is not an executable Configurator adapter.'],[],'configurator'),
  ] as SupportEntry[],
}

/** Only explicit release labels select a baseline. Build numbers and ambiguous strings stay unreviewed. */
export function releaseLabel(value:string,release:string){return new RegExp('^(?:'+release.replace(/\./g,'\\.')+')(?:\\.\\d+)*(?:\\s+(?:UR\\d+|CU\\d+))?$','i').test(value.trim())}
export function componentSupportIds(component:Component):string[]{
  if(component.product==='vmm'&&releaseLabel(component.version,'2025'))return ['vmm-2025-server','vmm-2025-hosts','vmm-parent-os','vmm-2025-ha']
  if(component.product==='scom'&&releaseLabel(component.version,'2025'))return ['scom-2025-roles','scom-2025-sql']
  if(component.product==='wac')return component.productDetails.mode==='virtualization'?['wac-virtualization','wac-virtualization-hosts']:component.productDetails.mode==='administration'?['wac-administration']:[]
  if(component.product==='arc')return ['arc-vmm']
  if(component.product==='ome'&&releaseLabel(component.version,'4.7'))return [component.hosting.startsWith('hyperv-')?'ome-47-hyperv':component.hosting==='vsphere'?'ome-47-vsphere':'ome-47-provider-wrapper','ome-manual-install']
  return []
}
export function supportPlan(project:Project){
  const rows=project.components.flatMap(component=>{
    const ids=componentSupportIds(component)
    if(!ids.length)return [{targetId:component.id,targetName:component.name||component.product,entry:entry('unlisted-component','Product / version / role','Unlisted or incomplete selection','unknown','No reviewed catalog baseline matches this exact product selection.',['Record exact product/OS/role and dated vendor support evidence.'],[],'configurator')}]
    return ids.map(id=>({targetId:component.id,targetName:component.name||component.product,entry:SUPPORT_CATALOG.entries.find(e=>e.id===id)!}))
  })
  if(project.sdn.scope!=='none'){
    const years=[...new Set(project.sdn.osVersion.match(/\b20\d{2}\b/g)||[])]
    if(years.length===1&&years[0]==='2025')rows.push({targetId:'sdn',targetName:'SDN design',entry:SUPPORT_CATALOG.entries.find(e=>e.id===(project.sdn.architecture==='host-cluster-role'?'sdn-controller-cluster':'sdn-controller-vms'))!})
    else rows.push({targetId:'sdn',targetName:'SDN design',entry:entry('unlisted-sdn-os','SDN OS baseline','Unlisted or incomplete selection','unknown','The reviewed SDN architecture baseline requires an explicit Windows Server 2025 release.',['Identify the exact OS and use version-specific architecture evidence.'],[SUPPORT_SOURCES.sdn],'configurator')})
    if(project.sdn.owner==='vmm'&&releaseLabel(project.sdn.toolVersion,'2025'))rows.push({targetId:'sdn',targetName:'SDN design',entry:SUPPORT_CATALOG.entries.find(e=>e.id==='sdn-vmm')!})
    if(project.sdn.architecture==='host-cluster-role'&&project.sdn.owner==='vmm')rows.push({targetId:'sdn',targetName:'SDN design',entry:SUPPORT_CATALOG.entries.find(e=>e.id==='sdn-vmm-host-controller')!})
  }
  return {kind:'hyperv-support-baselines',schemaVersion:1,projectId:project.id,projectRevision:project.revision,catalogVersion:SUPPORT_CATALOG.version,reviewedAt:SUPPORT_CATALOG.reviewedAt,meaning:SUPPORT_CATALOG.meaning,rows}
}

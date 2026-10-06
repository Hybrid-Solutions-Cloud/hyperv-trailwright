import type {Field} from './catalog'

const text=(key:string,label:string):Field=>({key,label,type:'text'})
const notes=(key:string,label:string):Field=>({key,label,type:'notes'})
const select=(key:string,label:string,options:Record<string,string>):Field=>({key,label,type:'select',options})
const number=(key:string,label:string):Field=>({key,label,type:'number',min:0})
export const managementSystemFields:Field[]=[
  select('osRelease','Reviewed component OS release',{ws2016:'Windows Server 2016',ws2019:'Windows Server 2019',ws2022:'Windows Server 2022',ws2025:'Windows Server 2025',win10:'Windows 10 client',win11:'Windows 11 client',other:'Other / external service'}),
  select('osEdition','Reviewed component OS edition',{standard:'Standard',datacenter:'Datacenter',pro:'Client Pro',enterprise:'Client Enterprise',other:'Other / external service'}),
  select('osInstallType','Reviewed component OS installation type',{core:'Server Core',desktop:'Desktop Experience',client:'Windows client',other:'Other / external service'}),
  notes('osEvidence','Exact component OS build, role and support evidence'),
  number('physicalCores','Physical CPU cores (physical servers only)'),
]
/** Additional product contracts. Unanswered inputs never imply a new dependency or an installed role. */
export const managementProductFields:Record<string,Field[]>={
  vmm:[
    select('role','VMM role on this component',{service:'Management service',console:'Console only'}),
    select('serviceTopology','VMM service topology',{standalone:'Standalone',clustered:'Supported clustered service',external:'Externally supplied service'}),
    text('serviceEndpoint','VMM service endpoint / port'),text('serviceAddress','VMM clustered service address'),
    text('serviceCredentialRef','VMM service runtime credential reference'),notes('dkmPermissions','DKM permissions and delegated ownership'),
    notes('runAsReferences','VMM Run As object IDs, purposes and delegated scope'),
    text('sqlComponent','SQL component design ID or external service contract'),text('sqlInstance','VMM SQL instance / listener'),text('databaseName','VMM database name'),
    text('libraryComponents','Library component design IDs / external contracts'),notes('libraryAccess','Library share permissions, service identity and recovery'),
    text('adkBuild','VMM ADK build'),text('winpeBuild','VMM WinPE add-on build'),notes('fabricDelegation','Fabric, cloud and host-group delegation'),
    notes('roleAcceptance','VMM role installation, connection and recovery acceptance'),
  ],
  scom:[
    select('role','SCOM primary role on this component',{management:'Management server',gateway:'Gateway',web:'Web console',reporting:'Reporting server',console:'Operations console',acs:'ACS collector'}),
    notes('additionalRoles','Additional co-located SCOM roles and support review'),
    text('managementServers','Management server endpoints / component IDs'),text('poolMembership','Resource pool names and membership / observer'),
    text('operationalSql','Operational database SQL component / external contract'),text('warehouseSql','Warehouse SQL component / external contract'),
    number('operationalDataGiB','Operational database data capacity (GiB)'),number('operationalLogGiB','Operational database log capacity (GiB)'),
    number('warehouseDataGiB','Warehouse data capacity (GiB)'),number('warehouseLogGiB','Warehouse log capacity (GiB)'),
    text('reportingEndpoint','SSRS endpoint / version / database contract'),text('webEndpoint','Web console HTTPS endpoint and certificate reference'),
    text('actionCredentialRef','SCOM action runtime credential reference'),text('readerCredentialRef','SCOM reader runtime credential reference'),text('writerCredentialRef','SCOM writer runtime credential reference'),
    notes('agentDeployment','Agent operating systems, versions, deployment authority and failover'),
    notes('gatewayTrust','Gateway trust, certificate enrollment/renewal and connectivity'),
    notes('acsDesign','ACS scope, database, retention and collector recovery'),notes('roleAcceptance','SCOM role, alert, agent and recovery acceptance'),
  ],
  sql:[
    select('engineHost','SQL engine hosting model',{windows:'SQL Server on Windows',external:'External SQL service requiring product qualification'}),
    text('serviceCredentialRef','SQL engine runtime credential reference'),text('agentCredentialRef','SQL Agent runtime credential reference'),
    select('authenticationMode','SQL authentication mode',{windows:'Windows authentication',mixed:'Mixed mode after product review'}),
    select('fullText','Full Text Search decision',{installed:'Required / installed',notRequired:'Not required after review'}),
    notes('databaseMap','Exact database names, consuming components, owners and recovery objectives'),
    text('enginePort','SQL engine TCP port'),text('haEndpoint','SQL HA endpoint / authentication / TCP port'),
    notes('replicaPlacement','Replica/node design IDs, site and failure-domain placement'),
    text('patchLevel','SQL build / cumulative update'),notes('editionEvidence','Edition feature limits and product-specific HA support evidence'),
    notes('storageLayout','Per-database data/log/tempdb/backup disk mappings, growth and I/O review'),
    notes('roleAcceptance','SQL connectivity, database restore and failover acceptance'),
  ],
  wac:[
    select('deploymentTopology','WAC deployment topology',{desktop:'Local desktop',gateway:'Gateway server',cluster:'Supported highly available gateway',virtualization:'Dedicated Virtualization Mode gateway'}),
    text('gatewayBuild','WAC exact gateway build'),text('certificateThumbprint','WAC gateway certificate thumbprint / source reference'),
    number('gatewayFreeDiskGiB','WAC gateway free disk allowance (GiB)'),
    text('certificateExpiry','WAC certificate expiry (YYYY-MM-DD)'),notes('delegationEvidence','WAC authentication/delegation scope and evidence'),
    notes('modeIsolation','Administration / Virtualization Mode separation and placement'),notes('roleAcceptance','WAC connection, role access and recovery acceptance'),
  ],
  identity:[notes('dnsDesign','DNS zones, forwarders, registration and management records'),notes('ouDelegation','OU, computer object pre-staging and delegated permissions'),notes('timeSource','Directory time source and hierarchy'),notes('roleAcceptance','Identity, DNS, trust and restore acceptance')],
  pki:[notes('enrollment','Enrollment permissions, automation identity and issuance workflow'),notes('keyProtection','Private-key protection and recovery ownership'),notes('renewal','Certificate renewal, revocation and outage procedure'),notes('roleAcceptance','PKI enrollment, chain, revocation and recovery acceptance')],
  library:[notes('sharePermissions','Library share/NTFS permissions and service identities'),notes('artifactIntegrity','Image/driver/template source hashes and update ownership'),notes('roleAcceptance','Library availability, content access and restore acceptance')],
  pxe:[text('serverEndpoint','WDS / PXE endpoint and server component ID'),text('vmmServer','VMM registration owner and server reference'),notes('networkReadiness','PXE interfaces, DHCP/relay boundaries and boot acceptance'),notes('roleAcceptance','PXE registration, image boot and recovery acceptance')],
  arc:[text('subscriptionId','Azure subscription ID'),text('resourceGroup','Azure resource group'),text('customLocation','Azure custom location resource ID'),text('bridgeResource','Resource bridge resource ID / intended identity'),text('bridgeBuild','Resource bridge exact version'),text('vmmExtensionBuild','Arc VMM extension exact version'),notes('identityScope','Azure principal, RBAC scope and tenant ownership'),notes('bridgeCapacity','Resource bridge placement, network/IP pool and reserved capacity'),notes('roleAcceptance','Arc connectivity, inventory projection and recovery acceptance')],
  runner:[text('runnerEndpoint','Runner endpoint and immutable identity'),text('credentialRef','Runner runtime credential reference'),notes('artifactTrust','Artifact signatures/hashes, allowed consumers and approval binding'),notes('receiptContract','Returned evidence authenticity, target binding and retention')],
}

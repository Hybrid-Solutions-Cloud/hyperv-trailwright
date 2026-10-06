import type {Field,Collection} from './catalog'
const text=(key:string,label:string):Field=>({key,label,type:'text'})
const notes=(key:string,label:string):Field=>({key,label,type:'notes'})
const choice=(key:string,label:string,options:Record<string,string>):Field=>({key,label,type:'select',options})
const ref=(key:string,label:string,collection:string):Field=>({key,label,type:'reference',collection})
const kinds=(field:Field,...values:string[]):Field=>({...field,when:{key:'kind',values}})
export const identityReadinessFields:Field[]=[
  text('forest','Forest FQDN'),ref('serviceComponent','Owning identity / PKI component','$components'),
  kinds(choice('forestIntent','Forest lifecycle intent',{existing:'Use existing forest',new:'Establish new forest',external:'Externally owned forest'}),'domain'),
  kinds(notes('dnsAuthority','Authoritative DNS, resolver and forwarding ownership'),'domain'),
  kinds(notes('objectPermissions','Computer pre-staging, OU delegation and join permissions'),'domain'),
  kinds(notes('timeHierarchy','Time hierarchy and domain reachability'),'domain'),
  kinds(notes('trustScope','Named source/target domains, direction and trust acceptance'),'domain'),
  kinds(notes('kdsEvidence','gMSA KDS root readiness and replication evidence'),'gmsa'),
  kinds(notes('retrievalPrincipals','gMSA permitted retrieval hosts / security groups'),'gmsa'),
  kinds(notes('serviceLogon','Service logon, SPN and product eligibility review'),'service','gmsa'),
  kinds(choice('accountScope','Service account authority',{domain:'Domain account',localSystem:'Local System',local:'Local user account',virtual:'Virtual service account'}),'service'),
  kinds(choice('caRole','Certificate authority role',{root:'Root CA',issuing:'Issuing CA',external:'External certificate provider'}),'pki'),
  kinds(text('rootAuthority','Root trust authority and owner'),'pki'),
  kinds(text('template','Certificate template / issuance policy'),'pki'),
  kinds(text('certificateExpiresAt','Certificate expiration (UTC)'),'pki'),
  kinds(notes('chainEvidence','Trust chain and revocation reachability review'),'pki'),
  kinds(notes('enrollmentScope','Enrollment identities and private-key ownership'),'pki'),
  notes('readinessAcceptance','Identity / security prerequisite acceptance'),
  choice('reviewBasis','Identity review basis',{planned:'Planned prerequisite',observed:'Operator-observed prerequisite'}),
  text('reviewedAt','Identity review time (UTC)'),text('reviewOwner','Identity review owner'),notes('reviewEvidence','Identity review evidence'),
]
export const mediaReadinessFields:Field[]=[
  choice('acquisition','Artifact acquisition',{download:'Approved online source',cache:'Controlled offline cache',external:'External artifact owner'}),
  text('downloadOwner','Artifact acquisition / cache owner'),text('observedSha256','Observed artifact SHA-256'),
  text('sourceCredentialRef','Artifact source runtime credential reference'),
  choice('integrityBasis','Integrity assessment',{planned:'Verification planned',observed:'Operator-observed verification'}),
  text('verifiedAt','Artifact verification time (UTC)'),text('verificationOwner','Artifact verification owner'),
  notes('verificationEvidence','Hash, signature and provenance verification evidence'),notes('signaturePolicy','Publisher trust / unsigned-artifact exception review'),
]
const bindingIdentity:Field[]=[{...text('name','Name'),required:true},{...text('owner','Owner'),required:true},{...ref('resource','Consuming resource','$resources'),required:true}]
export const identityBindingsCollection:Collection={key:'identityBindings',title:'Resource identity assignments',singular:'identity assignment',section:'identity',description:'Link an exact resource to a directory, service account, certificate or runner identity. An assignment is a design contract, not an account change.',fields:[
  ...bindingIdentity,{...ref('identity','Identity prerequisite','identities'),required:true},
  {...choice('usage','Identity usage',{directory:'Directory / DNS',service:'Service logon',certificate:'Certificate / trust',runner:'Execution identity'}),required:true},
  notes('permissions','Resource-specific permissions and acceptance'),
]}
export const mediaBindingsCollection:Collection={key:'mediaBindings',title:'Resource artifact assignments',singular:'artifact assignment',section:'identity',description:'Pin each installation, update, driver or automation artifact to its consuming resource. No artifact is downloaded or executed.',fields:[
  ...bindingIdentity,{...ref('artifact','Assigned artifact','media'),required:true},
  {...choice('phase','Artifact use',{install:'Initial installation',update:'Servicing / update',driver:'Driver injection',automation:'Automation consumer'}),required:true},
  notes('acceptance','Build, edition, hardware and deployment-method acceptance'),
]}
export const arcReadinessFields:Field[]=[
  ref('vmmComponent','Arc owning VMM service','$components'),
  text('azureTenant','Azure tenant ID'),text('providerPool','VMM cloud / host group immutable identity'),
  ref('bridgeNetwork','Resource bridge VM network','networks'),text('nativeNetworkId','Native VMM VM network ID'),
  choice('addressAllocation','Resource bridge address allocation',{pool:'Static VMM pool',range:'Static custom range',dhcp:'DHCP (requires support review)'}),
  text('nativePoolId','Native VMM static pool ID'),notes('applianceAddresses','Appliance and upgrade IP assignments'),text('controlPlaneAddress','Resource bridge control-plane IP'),
  choice('outboundMode','Resource bridge outbound connectivity',{direct:'Direct public endpoints',proxy:'Explicit proxy',private:'Private-link-only'}),
  text('proxyEndpoint','Explicit proxy endpoint'),text('proxyCredentialRef','Proxy runtime credential reference'),text('proxyCertificate','Single proxy X509 certificate file / trust review'),notes('noProxy','Local endpoint and subnet proxy exclusions'),
  notes('networkAcceptance','DNS, firewall, proxy and all appliance/control-plane paths'),
  notes('capacityAcceptance','Free host-pool capacity, storage support and vendor unit review'),
  notes('onboardingScope','Inventory projection, guest management and paid-service scope'),
  text('supportReviewedAt','Arc integration support review date (YYYY-MM-DD)'),notes('integrationEvidence','Exact VMM, bridge, extension and Azure-region support evidence'),
]

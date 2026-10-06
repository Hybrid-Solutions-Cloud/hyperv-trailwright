import {collections,hostingFields,productFields,type Answers,type Field} from './catalog'
import {products,type Project} from './project'
import {parseIds} from './stagePlan'
import {sdnCollectionKeys} from './sdnFields'
import {collectionApplies} from './collectionScope'

export const topologyViews={overview:'Design overview',management:'Management services',physical:'Physical infrastructure',logical:'Logical platform',network:'Network topology',storage:'Storage topology',deployment:'Deployment dependencies'} as const
export type TopologyView=keyof typeof topologyViews
export interface TopologyNode {id:string;name:string;category:string;detail:string}
export interface TopologyEdge {id:string;from:string;to:string;relationship:string}
export interface TopologyGraph {kind:'hyperv-topology';version:string;projectId:string;revision:number;nodes:TopologyNode[];edges:TopologyEdge[];unresolved:{recordId:string;field:string;target:string}[]}
const sdns=new Set(sdnCollectionKeys)
const seeds:Record<Exclude<TopologyView,'overview'>,string[]>={
 management:['components','availabilityGroups','availabilityMembers','availabilityDatabases','managementNetworks','identities','identityBindings','mediaBindings','operationsTargets','securityPolicies'],
 physical:['sites','clusters','hosts','adapters','switchMembers','disks','storageInterfaces','sanPaths','firewallDevices','torSwitches','oobDevices','consolePorts'],
 logical:['clusters','components','workloads','availabilityGroups','availabilityMembers','availabilityDatabases','hostSwitches','hostVnics','networks','sdnResources','tenantServices'],
 network:['networks','adapters','hostSwitches','switchMembers','hostVnics','addressAssignments','networkTrafficClasses','managementNetworks','firewallDevices','firewallInterfaces','firewallGateways','torSwitches','oobDevices',...sdnCollectionKeys],
 storage:['storageSystems','disks','volumes','storagePaths','storageAllocations','sanPaths','storageInterfaces'],
 deployment:['stages','profiles','media','mediaBindings','identityBindings'],
}
const compare=(a:string,b:string)=>a<b?-1:a>b?1:0
export function topologyGraph(project:Project):TopologyGraph{
 const nodes:TopologyNode[]=project.components.map(c=>({id:c.id,name:c.name||products[c.product],category:'components',detail:`${products[c.product]} / ${c.hosting}${c.product==='ome'?' / manual installation':''}`}))
 for(const c of collections)if(collectionApplies(c,project))for(const r of project.design[c.key])nodes.push({id:r.id,name:String(r.values.name||c.singular),category:c.key,detail:c.singular})
 nodes.sort((a,b)=>compare(a.category,b.category)||compare(a.id,b.id))
 const ids=new Set(nodes.map(n=>n.id)),edges:TopologyEdge[]=[],unresolved:TopologyGraph['unresolved']=[]
 const link=(from:string,to:string,relationship:string,field:string,recordId=to)=>{if(!from)return;if(!ids.has(from)||!ids.has(to)){unresolved.push({recordId,field,target:!ids.has(from)?from:to});return}const id=JSON.stringify([from,to,relationship]);if(!edges.some(e=>e.id===id))edges.push({id,from,to,relationship})}
 const references=(recordId:string,values:Answers,fields:Field[])=>{for(const f of fields)if(f.collection&&values[f.key])link(String(values[f.key]),recordId,f.label,f.key)}
 for(const c of project.components){references(c.id,c.hostingDetails,hostingFields);references(c.id,c.productDetails,productFields[c.product])}
 for(const c of collections)if(collectionApplies(c,project))for(const r of project.design[c.key]){
  references(r.id,r.values,c.fields)
  if(c.key==='dependencies')link(String(r.values.prerequisite||''),String(r.values.dependent||''),`${r.values.phase||'Declared'} prerequisite`,'prerequisite',r.id)
  if(c.key==='availabilityMembers')link(String(r.values.group||''),String(r.values.component||''),'Availability membership','component',r.id)
  if(c.key==='stages')for(const field of ['targets','dependsOn']){try{for(const target of parseIds(r.values[field]))link(target,r.id,field==='targets'?'Stage target':'Preceding stage',field)}catch{unresolved.push({recordId:r.id,field,target:'Invalid ID list'})}}
 }
 edges.sort((a,b)=>compare(a.id,b.id));unresolved.sort((a,b)=>compare(JSON.stringify(a),JSON.stringify(b)))
 return {kind:'hyperv-topology',version:'1.0.0',projectId:project.id,revision:project.revision,nodes,edges,unresolved}
}
export function topologyView(graph:TopologyGraph,view:TopologyView){
 if(view==='overview')return {nodes:graph.nodes,edges:graph.edges}
 const selected=new Set(graph.nodes.filter(n=>seeds[view].includes(n.category)).map(n=>n.id)),included=new Set(selected)
 // Include both ends of relationships touching the view's seed resources; do not infer links from prose.
 for(const edge of graph.edges)if(selected.has(edge.from)||selected.has(edge.to)){included.add(edge.from);included.add(edge.to)}
 return {nodes:graph.nodes.filter(n=>included.has(n.id)),edges:graph.edges.filter(e=>included.has(e.from)&&included.has(e.to))}
}
export interface TopologyPage {key:string;title:string;nodes:TopologyNode[];edges:TopologyEdge[];relationshipPage:boolean}
export function topologyPages(graph:TopologyGraph,view:TopologyView):TopologyPage[]{
 const selected=topologyView(graph,view),pages:TopologyPage[]=[],nodePage=new Map<string,number>(),limit=24
 for(let i=0;i<selected.nodes.length||i===0;i+=limit){const nodes=selected.nodes.slice(i,i+limit),index=pages.length;for(const n of nodes)nodePage.set(n.id,index);pages.push({key:`${view}-${index+1}`,title:topologyViews[view],nodes,edges:[],relationshipPage:false})}
 const cross:TopologyEdge[]=[]
 for(const e of selected.edges){if(nodePage.get(e.from)===nodePage.get(e.to)&&pages[nodePage.get(e.from)!].edges.length<12)pages[nodePage.get(e.from)!].edges.push(e);else cross.push(e)}
 // Cross-page relationships have dedicated bounded pages with both endpoints. Every edge remains editable and visible.
 for(let i=0;i<cross.length;i+=12){const edges=cross.slice(i,i+12),ids=new Set(edges.flatMap(e=>[e.from,e.to]));pages.push({key:`${view}-${pages.length+1}`,title:`${topologyViews[view]} — cross-page relationships`,nodes:selected.nodes.filter(n=>ids.has(n.id)),edges,relationshipPage:true})}
 return pages
}
const xml=(value:unknown)=>Array.from(String(value)).map(c=>c.length===1&&c.charCodeAt(0)>=0xd800&&c.charCodeAt(0)<=0xdfff?'\ufffd':c).join('').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')
export const topologyCellId=(id:string)=>'n:'+id.replace(/[^A-Za-z0-9_.~-]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase().padStart(4,'0'))
const renderId=topologyCellId
function wrap(value:string,width=35){const words=value.replace(/\s+/g,' ').trim().match(new RegExp(`.{1,${width}}`,'gu'))||[''];return words.length>3?[...words.slice(0,2),words[2].slice(0,width-1)+'…']:words}
export function renderTopologyPage(page:TopologyPage,index=0,total=1){
 const width=1280,nodeWidth=360,nodeHeight=120,colStep=420,rowStep=180
 const placed=page.nodes.map((n,i)=>({...n,x:40+i%3*colStep,y:110+Math.floor(i/3)*rowStep})),legendY=Math.max(190,Math.ceil(placed.length/3)*rowStep+140),height=legendY+(page.edges.length?50+page.edges.length*44:70)
 const locations=new Map(placed.map(n=>[n.id,n]))
 const palette=['#246b8e','#9e4827','#6655a4','#397a4b','#934f80','#756217']
 const route=(e:TopologyEdge)=>{const a=locations.get(e.from)!,b=locations.get(e.to)!,out=page.edges.filter(r=>r.from===e.from),incoming=page.edges.filter(r=>r.to===e.to),i=page.edges.indexOf(e),y1=a.y+15+(out.indexOf(e)+1)*(nodeHeight-30)/(out.length+1),y2=b.y+15+(incoming.indexOf(e)+1)*(nodeHeight-30)/(incoming.length+1);return {x1:a.x+nodeWidth,y1,x2:b.x,y2,exitY:(y1-a.y)/nodeHeight,entryY:(y2-b.y)/nodeHeight,color:palette[i%palette.length],points:[[a.x+nodeWidth+18+(i%4)*5,y1],[a.x+nodeWidth+18+(i%4)*5,b.y-20-(i%3)*4],[b.x-18-(i%3)*4,b.y-20-(i%3)*4],[b.x-18-(i%3)*4,y2]]}}
 const shorten=(value:string,max:number)=>value.length>max?value.slice(0,max-1)+'…':value
 const edgeName=(e:TopologyEdge)=>`${locations.get(e.from)!.name} → ${locations.get(e.to)!.name}`
 const legendCells=page.edges.map((e,i)=>`<mxCell id="legend:${i}" hvLegend="1" value="${xml('['+(i+1)+'] '+edgeName(e)+'\n'+e.relationship)}" style="text;html=0;whiteSpace=wrap;overflow=hidden;align=left;" vertex="1" parent="1"><mxGeometry x="40" y="${legendY+30+i*44}" width="1200" height="42" as="geometry"/></mxCell>`).join('')
 const legendSvg=page.edges.length?`<text x="40" y="${legendY+10}" font-family="Arial" font-size="18" fill="#17384e">Connections</text>${page.edges.map((e,i)=>`<text x="40" y="${legendY+35+i*44}" font-family="monospace" font-size="13" fill="${route(e).color}">[${i+1}] ${xml(shorten(locations.get(e.from)!.name,65)+' → '+shorten(locations.get(e.to)!.name,65))}</text><text x="70" y="${legendY+53+i*44}" font-family="Arial" font-size="13" fill="#375b72">${xml(shorten(e.relationship,150))}</text>`).join('')}`:''

 const label=(n:TopologyNode)=>`${n.name}\n${n.detail}`
 const cells=placed.map(n=>`<mxCell id="${renderId(n.id)}" value="${xml(label(n))}" style="rounded=1;whiteSpace=wrap;html=0;fillColor=#e7f5f7;strokeColor=#1a788e;" vertex="1" parent="1"><mxGeometry x="${n.x}" y="${n.y}" width="${nodeWidth}" height="${nodeHeight}" as="geometry"/></mxCell>`).join('')
 const edges=page.edges.map((e,i)=>`<mxCell id="e:${i}" value="[${i+1}]" hvRelationship="${xml(e.relationship)}" style="endArrow=block;html=0;strokeColor=${route(e).color};exitX=1;exitY=${route(e).exitY};entryX=0;entryY=${route(e).entryY};" edge="1" source="${renderId(e.from)}" target="${renderId(e.to)}" parent="1"><mxGeometry relative="1" as="geometry"><Array as="points">${route(e).points.map(([x,y])=>`<mxPoint x="${x}" y="${y}"/>`).join('')}</Array></mxGeometry></mxCell>`).join('')
 const diagram=`<diagram id="${page.key}" name="${xml(page.title)} (${index+1}/${total})"><mxGraphModel pageWidth="${width}" pageHeight="${height}"><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells}${edges}${legendCells}</root></mxGraphModel></diagram>`
 const svgEdges=page.edges.map(e=>{const r=route(e);return `<path data-from="${xml(e.from)}" data-to="${xml(e.to)}" d="M ${r.x1} ${r.y1} ${r.points.map(([x,y])=>`L ${x} ${y}`).join(' ')} L ${r.x2} ${r.y2}" fill="none" stroke="${r.color}" stroke-width="2" marker-end="url(#arrow)"><title>${xml(e.relationship)}</title></path><text x="${r.x1+4}" y="${r.y1-4}" font-family="Arial" font-size="11" fill="${r.color}">${page.edges.indexOf(e)+1}</text>`}).join('')
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${xml(page.title)}"><defs><marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#668b9e"/></marker></defs><rect width="100%" height="100%" fill="white"/><text x="40" y="38" font-family="Arial" font-size="23" fill="#17384e">${xml(page.title)}</text><text x="40" y="70" font-family="Arial" font-size="14" fill="#375b72">Page ${index+1} of ${total} · Declared relationships · Runtime acceptance pending</text>${svgEdges}${placed.map(n=>`<g data-node-id="${xml(n.id)}"><title>${xml(label(n))}</title><rect x="${n.x}" y="${n.y}" width="${nodeWidth}" height="${nodeHeight}" rx="8" fill="#e7f5f7" stroke="#1a788e"/>${wrap(n.name).map((line,i)=>`<text x="${n.x+12}" y="${n.y+26+i*19}" font-family="monospace" font-size="15" fill="#17384e">${xml(line)}</text>`).join('')}<text x="${n.x+12}" y="${n.y+105}" font-family="monospace" font-size="12" fill="#375b72">${xml(n.detail.length>44?n.detail.slice(0,43)+'…':n.detail)}</text></g>`).join('')}${legendSvg}${!placed.length?'<text x="40" y="150" font-family="Arial" font-size="17" fill="#375b72">No resources are declared for this view.</text>':''}</svg>`
 return {diagram,svg,width,height}
}
export function topology(project:Project,view:TopologyView='overview'){
 const graph=topologyGraph(project),pages=topologyPages(graph,view),rendered=pages.map((page,i)=>({...page,...renderTopologyPage(page,i,pages.length)}))
 return {...rendered[0],drawio:`<mxfile host="Hyper-V Configurator">${rendered.map(p=>p.diagram).join('')}</mxfile>`,pages:rendered,graph}
}

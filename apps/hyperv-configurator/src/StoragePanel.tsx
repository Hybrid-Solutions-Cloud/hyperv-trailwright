import type { Project } from './project'
import { capacityText, storagePlan } from './storagePlan'
import {storageReadiness,storageMetadataSchedule} from './storageReadiness'

export function StoragePanel({ project }: { project: Project }) {
  const plan = storagePlan(project)
  const readiness=storageReadiness(project)
  return <section className="panel" aria-label="Storage capacity review"><h2>Storage capacity review</h2>
    <p>Fixed volumes reserve their full size. Thin volumes count expected consumption now, with growth to their logical limits shown separately. Each backend has its own capacity budget.</p>
    {!plan.systems.length && <p>Add a storage system and its volumes below to review allocations.</p>}
    {!!readiness.systems.some(s=>s.cacheMemory.length)&&<div className="table-scroll" tabIndex={0} role="region" aria-label="S2D cache metadata memory"><table><caption>S2D cache metadata memory</caption><thead><tr><th scope="col">Host</th><th scope="col">Cache (decimal TB)</th><th scope="col">Additional memory (decimal GB)</th></tr></thead><tbody>{storageMetadataSchedule(project).map(m=><tr key={m.SystemId+'/'+m.HostId}><th scope="row">{m.Host}</th><td>{m.CacheDecimalTB.toFixed(3)}</td><td>{m.AdditionalMetadataDecimalGB.toFixed(3)}</td></tr>)}</tbody></table><p>This allowance is additional to OS, VM and application memory.</p></div>}
    {!!readiness.disks.length&&<div className="table-scroll" tabIndex={0} role="region" aria-label="Physical storage eligibility"><table><caption>Physical storage eligibility</caption><thead><tr><th scope="col">Drive group</th><th scope="col">Physical host</th><th scope="col">Review</th></tr></thead><tbody>{readiness.disks.map(d=><tr key={d.id}><th scope="row">{String(d.inputs.name)}</th><td>{String(project.design.hosts.find(h=>h.id===d.hostId)?.values.name||d.hostId)}</td><td>{d.status}</td></tr>)}</tbody></table><p>Incompatible pool devices leave physical inventory headroom unknown. Operator review does not establish runtime qualification.</p></div>}
    {plan.systems.map(s=><div key={s.id}><h3>{s.name}</h3><p>{s.volumeCount} volumes · {s.csvCount} CSV paths · {s.fixedCount} fixed · {s.thinCount} thin</p>
      <div className="table-scroll"><table><caption>{s.name} capacity</caption><thead><tr><th>Measure</th><th>Capacity</th></tr></thead><tbody>
        <tr><td>Usable after logical reserve</td><td>{capacityText(s.availableTiB)}</td></tr>
        <tr><td>Expected data</td><td>{capacityText(s.consumedTiB)}</td></tr>
        <tr><td>Committed logical demand</td><td>{capacityText(s.committedTiB)}</td></tr>
        <tr><td>Remaining logical capacity</td><td>{capacityText(s.headroomTiB)}</td></tr>
        <tr><td>All volumes at full size</td><td>{capacityText(s.logicalTiB)}</td></tr>
        <tr><td>Remaining at full growth</td><td>{capacityText(s.fullGrowthHeadroomTiB)}</td></tr>
        {s.kind==='s2d' && <><tr><td>Capacity-drive inventory</td><td>{capacityText(s.inventoryRawTiB)}</td></tr><tr><td>Physical repair allowance</td><td>{capacityText(s.repairReserveTiB)}</td></tr><tr><td>Estimated raw committed footprint</td><td>{capacityText(s.rawCommittedTiB)}</td></tr><tr><td>Estimated raw remaining</td><td>{capacityText(s.rawHeadroomTiB)}</td></tr></>}
      </tbody></table></div></div>)}
    {!!plan.placement.volumes.length && <div className="table-scroll"><table><caption>Disk placement within volume budgets</caption><thead><tr><th>Volume</th><th>Lifecycle</th><th>Directories</th><th>SAN I/O paths</th><th>Mapped GiB</th><th>Unallocated GiB</th></tr></thead><tbody>{plan.placement.volumes.map(v=><tr key={v.id}><td>{v.name}</td><td>{v.lifecycle || 'Not selected'}</td><td>{v.directoryCount}</td><td>{v.ioPathCount}</td><td>{v.allocatedGiB}</td><td>{v.unallocatedGiB}</td></tr>)}</tbody></table></div>}
    {!!plan.placement.resources.length && <div className="table-scroll"><table><caption>Resource disk coverage</caption><thead><tr><th>Resource</th><th>Required GiB</th><th>Mapped GiB</th><th>Unmapped GiB</th></tr></thead><tbody>{plan.placement.resources.map(r=><tr key={r.id}><td>{r.name}</td><td>{r.sizeGiB}</td><td>{r.mappedGiB}</td><td>{r.unmappedGiB}</td></tr>)}</tbody></table></div>}
    {!!plan.findings.length && <div><h3>Storage decisions to resolve</h3><ul>{plan.findings.map((f,i)=><li key={i}>{f.severity === 'error' ? 'Required' : 'Review'}: {f.message}</li>)}</ul></div>}
    <details><summary>Calculation assumptions and support references</summary><ul>{plan.assumptions.map(a=><li key={a}>{a}</li>)}</ul><p>Windows Server sources reviewed {plan.review.reviewedAt}.</p><ul>{plan.review.sources.map((url,i)=><li key={url}><a href={url} target="_blank" rel="noreferrer">{['Volume planning','S2D hardware requirements','Storage architectures','Cluster Shared Volumes','Nested resiliency','Fault tolerance and encoding efficiency'][i]}</a></li>)}</ul></details>
  </section>
}

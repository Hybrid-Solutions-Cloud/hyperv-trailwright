# Resource operations and recovery

Operations plans bind exact resources to monitoring, patch, backup and security responsibilities. Existing free-text plans remain intact on schema21 migration; schema22 adds empty assignments and evidence records without inferring successful tests or interpreting default zero objectives as agreements.

Each resource area has one assigned policy. CAU cluster assignments also cover member-host patch scope, so a second member-host policy cannot silently compete with the cluster owner. CAU self-updating and remote-updating are separate choices. Remote coordinators must be inventoried servers or VMs outside cluster membership; the target must be a failover cluster. Tool/plugin versions, identity, remoting, maintenance/drain, reserve capacity, recovery and rollback remain explicit acceptance inputs. Selection never promises uninterrupted availability or executes updates.

Backup contracts retain provider/version, repository, schedule, consistency, retention, access/protection and ownership. A no-backup choice requires a documented exception. Explicit objectives can include zero; unspecified objectives remain unknown. A backup interval longer than the RPO requires review of additional protection or a revised design, not a fabricated assertion that the RPO is met.

Recovery tests retain operator-reported state, exact tested resource/policy/provider/repository, strict nonfuture UTC, consumer/version, evidence, acceptance and explicitly confirmed measurements. Reassigning the resource or changing the backup source invalidates comparison with that observation. Only complete reported passes with confirmed measurements are compared against agreed RTO/RPO. Planned, failed, partial and incomplete observations leave the result unknown. Results apply to each individual test; they are not a statement of current service health or authenticated runtime qualification.

Thresholds use exact monitored resource assignments, counter identities, units, warning/critical values and high/low trigger direction. Percentage ranges and metric/unit compatibility are checked. Security policies retain hardening baseline, privileged/runner/certificate identities, access controls, WinRM/SSH, endpoint protection, trust, audit and verification responsibilities. Certificate and runner references must have the appropriate identity types.

The shared assessment feeds the editor, field navigation, JSON, Markdown, PDF, workbook/CSV and topology. Native maintenance, backup/restore, monitoring and security consumers still require separate qualification and authorized targets.

## Sources reviewed2026-09-11

- [Cluster-Aware Updating overview and coordinator modes](https://learn.microsoft.com/en-us/windows-server/failover-clustering/cluster-aware-updating)
- [CAU feature, identity and remote-management requirements](https://learn.microsoft.com/en-us/windows-server/failover-clustering/cluster-aware-updating-requirements)
- [Operations Manager management packs, monitors and thresholds](https://learn.microsoft.com/en-us/system-center/scom/manage-overview-management-pack?view=sc-om-2025)

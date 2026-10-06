# Hyper-V configuration traceability

Updated: 2026-09-11

The original 0.2 design proposal included deployment automation. The user confirmed that automation already exists outside this application. The current completion contract is configuration-only; the historical line-by-line automation acceptance map and its generator were removed so they cannot redefine product scope.

| Required capability | Owned implementation | Primary verification |
| --- | --- | --- |
| Project identity, schema, migrations, limits and save/open | `src/project.ts`, `src/App.tsx` | `src/project.test.ts`, `e2e/designer.spec.ts`, `e2e/workflow.spec.ts` |
| Optional Surveyor import and provenance | `src/surveyorImport.ts` | `src/surveyorImport.test.ts`, `e2e/workflow.spec.ts` |
| Scope-aware workflow and completeness | `src/workflow.ts`, `src/review.ts`, `src/projectReadiness.ts` | corresponding unit tests, `e2e/review.spec.ts`, `e2e/readiness.spec.ts` |
| Management selection, products, hosting and omissions | management, hosting and omission planners/panels | management unit tests; advisor, products, hosting and omissions browser journeys |
| Availability, dependencies and prerequisites | availability and prerequisite planners/panels | availability and prerequisite unit/browser journeys |
| Hosts, clusters, witnesses and VMM profiles | host deployment, VMM profile and quorum configuration planners | host/profile/quorum configuration unit tests and browser journeys |
| Storage and placement | storage plan, layout and readiness modules | storage unit tests and storage browser journeys |
| Networking and IP ownership | network design and control modules | network unit tests and network browser journeys |
| SDN architecture and tenant services | SDN plan, architecture, services and evidence modules | SDN unit tests and four SDN browser journeys |
| Identity, media, security, operations and recovery | prerequisite and operations modules | prerequisite and operations unit/browser journeys |
| Licensing, rights, coverage and cost | licensing modules and panel | licensing unit tests and three licensing browser journeys |
| Observation import and drift review | discovery contract, import and review modules | discovery unit tests and browser journeys |
| Reports, schedules, diagrams and package integrity | `src/exports.ts`, `src/topology.ts`, `src/designSchedules.ts` | export/topology tests and actual browser downloads |
| Configuration-only boundary | removal of `consumers/`; no adapter or execution export paths | `src/configurationPackage.test.ts`, `e2e/configuration.spec.ts`, source/package extension audit |
| Publication identity | Vite version artifact and GitLab CI/Pages | exact-SHA pipeline and live `version.json` verification |

The [completion plan](implementation.md) is the authoritative checklist. The [original proposal](hyperv-configurator-design/outline.md) remains historical source material and carries an explicit scope-correction notice. No proposal text can restore automation work without a new user instruction.

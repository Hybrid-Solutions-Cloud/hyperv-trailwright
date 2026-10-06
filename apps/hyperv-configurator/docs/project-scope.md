# Project scope and management dependencies

Choose management only, cluster only, a combined design, or documentation of an existing environment. Scope controls the suggested editor sequence. It does not change resource lifecycle, erase records or authorize deployment.

Management-only designs retain hosting, sites, storage, networking, identity and recovery inputs. The empty host-provisioning editor is skipped when management uses an external platform. Selecting dedicated Hyper-V management hosting makes host and cluster prerequisites applicable. Empty SDN details are optional; select **Show all 14 sections** to start an additional branch.

Cluster-only designs ask how management is supplied: an existing service, another team, not required, or deferred. Record the service/decision owner, dependency boundary and acceptance evidence. Known component records can still describe external capacity and configuration. Empty hosting/product editors are skipped until a component or related record is added. A deferred choice remains a review finding; a “not required” choice conflicts with retained management components or capabilities.

An existing-environment design can document management services, host platforms, or both. It requires some inventory, but never invents a workload cluster for management-only documentation. Resource lifecycle and consumer-specific execution restrictions remain independent of this navigation choice.

All fourteen editors remain available through **Show all 14 sections**. Populated editors are never removed from the sequence. Review links open their owning editor and focus the unresolved field, even if it is outside the suggested sequence. Previous/Continue follow the displayed sequence.

Project context records the scenario identifier, customer/business context, naming convention and support target. JSON, scenario YAML, design Markdown/PDF and the Project context workbook/CSV schedule retain it. Management boundary answers are retained when scope changes and labeled as applicable to cluster-only scope. Shareable exports replace free-text context while preserving the selected source category.

Schema 10 adds an empty context object to schema 9 projects. It does not infer a management owner or acceptance decision from earlier prose. Older migrations still preserve all existing data. A file claiming schema 9 while carrying schema 10 context is rejected, as are unknown context properties and source choices.

Verification: `src/workflow.test.ts` covers scope prerequisites, preserved editors, migration, review routing, conflicts and private/shared exports. `e2e/workflow.spec.ts` covers conditional navigation, keyboard focus, previous/continue behavior, save/open, mobile layout and actual package download. Native infrastructure qualification remains separate.

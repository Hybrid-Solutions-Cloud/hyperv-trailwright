import { removeProfilesV8 } from './legacyProfiles'
/** Restore the actual pre-v7 shape before exercising older schema migrations. */
export function removeStorageV7(project: {design: Record<string, any>}) {
  removeProfilesV8(project)
  for (const key of ['storagePaths','storageAllocations','sanPaths']) delete project.design[key]
  for (const row of project.design.storageSystems) delete row.values.localHost
  for (const row of project.design.volumes) for (const key of ['lifecycle','sourceIdentity','currentSizeGiB','currentResiliency','currentPath','currentProvisioning','replacementApproval','parityLayout','parityMedia','mirrorTierGiB','parityTierGiB','parityColumns','layoutEvidence']) delete row.values[key]
}

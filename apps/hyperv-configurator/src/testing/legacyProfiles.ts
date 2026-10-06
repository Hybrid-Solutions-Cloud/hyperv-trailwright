import { profileCreationFields } from '../catalog'
import { removeLicensingV9 } from './legacyLicensing'

/** Restore pre-v8 shape before testing older migrations. */
export function removeProfilesV8(project: {design: Record<string, any>}) {
  removeLicensingV9(project)
  for (const row of project.design.profiles) for (const field of profileCreationFields) delete row.values[field.key]
}

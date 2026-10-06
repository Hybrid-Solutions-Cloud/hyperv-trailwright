import {operationsFields,operationsCollections} from '../operationsFields'
import {removeNetworkControlsV23} from './legacyNetworkControls'
export function removeOperationsV22(project:any){removeNetworkControlsV23(project);for(const c of operationsCollections)delete project.design[c.key];for(const row of project.design.operations||[])for(const field of operationsFields)delete row.values[field.key]}

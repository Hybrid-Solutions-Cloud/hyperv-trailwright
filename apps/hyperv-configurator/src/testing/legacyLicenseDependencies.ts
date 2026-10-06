import {licenseDependencyKeys} from '../licenseDependencyFields'
import {removeNetworkDecisionsV31} from './legacyNetworkDecisions'
export function removeLicenseDependenciesV30(project:any){removeNetworkDecisionsV31(project);for(const key of licenseDependencyKeys)delete project.design[key]}

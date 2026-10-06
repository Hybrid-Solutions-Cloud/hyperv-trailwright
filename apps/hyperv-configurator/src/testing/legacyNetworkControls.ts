import {networkControlFields} from '../networkControlFields'
import {removeSdnV24} from './legacySdn'
export function removeNetworkControlsV23(project:any){removeSdnV24(project);delete project.design.networkTrafficClasses;for(const [key,fields]of networkControlFields)for(const row of project.design[key]||[])for(const field of fields)delete row.values[field.key]}

import { describe,it,expect } from 'vitest'
import { reviewTarget,designProgress } from './review'
import { storageFixture } from './testing/storageFixture'
import { newComponent } from './project'

describe('finding navigation and required-input progress',()=>{
  it('locates the owning screen when a storage finding refers to a workload or component',()=>{
    const {project,add}=storageFixture(),workload=add('workloads','workload-a',{name:'Workload'})
    const component=newComponent('vmm');project.components.push(component)
    const finding={code:'STORAGE_RESOURCE_UNMAPPED',section:'storage',severity:'warning' as const,message:'Disk demand needs placement'}
    expect(reviewTarget(project,{...finding,recordId:workload.id})).toMatchObject({section:'project',recordId:workload.id})
    expect(reviewTarget(project,{...finding,recordId:component.id})).toMatchObject({section:'hosting',recordId:component.id})
  })
  it('preserves an explicit field target and provides a safe fallback for deleted records',()=>{
    const {project,fixed}=storageFixture()
    expect(reviewTarget(project,{code:'REQUIRED',section:'storage',severity:'error',message:'Name required',recordId:fixed.id,fieldKey:'name'})).toEqual({section:'storage',recordId:fixed.id,fieldKey:'name'})
    expect(reviewTarget(project,{code:'PROJECT_OWNER',section:'project',severity:'error',message:'Owner required'})).toEqual({section:'project',fieldKey:'owner'})
    expect(reviewTarget(project,{code:'X',section:'unknown',recordId:'removed',severity:'error',message:'Unknown'})).toEqual({section:'review'})
  })
  it('counts only visible required inputs and keeps unresolved rules separate',()=>{
    const {project,pool}=storageFixture();project.owner=' '
    let progress=designProgress(project,[])
    expect(progress.find(s=>s.section==='project')).toMatchObject({required:2,answered:1,errors:0})
    const baseline=progress.find(s=>s.section==='storage')!.required
    pool.values.kind='local'
    progress=designProgress(project,[{code:'LOCAL_STORAGE_HOST',recordId:pool.id,section:'storage',severity:'error',message:'Host required'}])
    expect(progress.find(s=>s.section==='storage')).toMatchObject({required:baseline+1,errors:1})
  })
})

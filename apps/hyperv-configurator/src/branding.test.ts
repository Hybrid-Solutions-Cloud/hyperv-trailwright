import {describe,expect,it} from 'vitest'
import {readdirSync,readFileSync,statSync} from 'node:fs'
import {join,relative} from 'node:path'
import {fileURLToPath} from 'node:url'

// The solution is independent: no former service-provider, lab or repository name may appear anywhere in it.
// Names are assembled from parts so this guard does not itself contain them.
const banned=[['tier','point'],['product','labs'],['prod','tech']].map(parts=>new RegExp(parts.join('[\\s_-]*'),'i'))
const root=fileURLToPath(new URL('../../../',import.meta.url))
const skip=new Set(['node_modules','.git','dist','.artifacts','test-results','playwright-report'])
const textFile=/\.(?:ts|tsx|js|cjs|mjs|json|md|html|css|yml|yaml|drawio|txt)$/i

function files(dir:string):string[]{
  return readdirSync(dir).flatMap((name:string)=>{
    if(skip.has(name))return []
    const path=join(dir,name)
    return statSync(path).isDirectory()?files(path):textFile.test(name)?[path]:[]
  })
}

describe('solution branding',()=>{
  it('names no former service provider, lab environment or repository',()=>{
    const all=files(root)
    expect(all.length).toBeGreaterThan(50)
    const hits=all.flatMap(path=>{const text=readFileSync(path,'utf8');return banned.filter(pattern=>pattern.test(text)).map(pattern=>`${relative(root,path)}: ${pattern.source}`)})
    expect(hits).toEqual([])
  })
})

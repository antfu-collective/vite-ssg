import { RollupOutput, OutputChunk } from 'rollup'
import { DEFAULT_ASSETS_RE } from './constants'

interface Manifest {
  [key: string]: string[]
}

export function renderPreloadLinks(document: Document, modules: Set<string>, manifest: Manifest, prefetchAssets: boolean) {
  const seen = new Set()

  let preloadLinks: string[] = []
  
  // preload assets
  const srcDoms = document.body.querySelectorAll('[src]')
  
  srcDoms.forEach((dom: any) => {
    const src = dom.src as string
    if (src && DEFAULT_ASSETS_RE.test(src))
      preloadLinks.push(src)
  })

  // preload modules
  Array.from(modules).forEach((id) => {
    const files = manifest[id] || []
    files.forEach((file) => {
      if (!preloadLinks.includes(file))
        preloadLinks.push(file)
    })
  })
  
  if (preloadLinks) {
    preloadLinks.forEach((file) => {
      if (!seen.has(file)) {
        seen.add(file)
        renderPreloadLink(document, file, prefetchAssets)
      }
    })
  }
}

function renderPreloadLink(document: Document, file: string, prefetchAssets: boolean) {
  if (file.endsWith('.js')) {
    appendLink(document, 'modulepreload', file, true)
  }
  else if (file.endsWith('.css')) {
    appendLink(document, 'stylesheet', file)
  }
  else if (prefetchAssets && DEFAULT_ASSETS_RE.test(file)) {
    appendLink(document, 'prefetch', file)
  }
  else {
    // TODO
    return
  }
}

const createLink = (document: Document) => document.createElement('link')

function appendLink(document: Document, rel: string, file: string, crossOrigin?: boolean) {
  const link = createLink(document)
  link.rel = rel
  if (crossOrigin) {
    link.crossOrigin = ''
  }
  link.href = file
  const exits = document.head.querySelector(`link[href='${file}']`)
  if (!exits)
    document.head.appendChild(link)
}
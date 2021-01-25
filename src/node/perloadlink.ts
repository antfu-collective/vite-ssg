import { RollupOutput, OutputChunk } from 'rollup'

interface Manifest {
  [key: string]: string[]
}

export function renderPreloadLinks(document: Document, modules: Set<string>, manifest: Manifest, clientResult: RollupOutput, base: string) {
  const seen = new Set()
  const appChunk = clientResult.output.find(
    chunk => chunk.type === 'chunk' && chunk.isEntry && chunk,
  ) as OutputChunk
  modules.forEach((id) => {
    const pageChunk = clientResult.output.find(
      chunk => chunk.type === 'chunk' && chunk.facadeModuleId === id,
    ) as OutputChunk

    const files = manifest[id]?.map((path) => {
      return path.substring(1)
    })

    const preloadLinks: string[] = [
      ...(pageChunk ? resolvePageImports(appChunk, pageChunk) : []),
      ...files || [],
    ]

    if (preloadLinks) {
      preloadLinks.forEach((file) => {
        if (!seen.has(file)) {
          seen.add(file)
          renderPreloadLink(document, file, base)
        }
      })
    }
  })
}

const createLink = (document: Document) => document.createElement('link')

function renderPreloadLink(document: Document, file: string, base: string) {
  if (file.endsWith('.js')) {
    const link = createLink(document)
    link.rel = 'modulepreload'
    link.crossOrigin = ''
    link.href = base + file
    const exits = document.head.querySelector(`link[href='${base + file}']`)
    if (!exits)
      document.head.appendChild(link)
  }
  else if (file.endsWith('.css')) {
    const link = createLink(document)
    link.rel = 'stylesheet'
    link.href = base + file
    const exits = document.head.querySelector(`link[href='${base + file}']`)
    if (!exits)
      document.head.appendChild(link)
  }
  else {
    // TODO
    return ''
  }
}

function resolvePageImports(
  appChunk: OutputChunk,
  pageChunk?: OutputChunk,
) {
  return Array.from(
    new Set([
      ...appChunk.imports,
      // ...appChunk.dynamicImports,
      ...pageChunk?.imports || [],
      ...pageChunk?.dynamicImports || [],
    ]),
  )
}

import type { Manifest } from './build'

export function renderPreloadLinks(document: Document, modules: Set<string>, ssrManifest: Manifest) {
  const seen = new Set()

  const preloadLinks: string[] = []

  // preload modules
  Array.from(modules).forEach((id) => {
    const files = ssrManifest[id] || []
    files.forEach((file) => {
      if (!preloadLinks.includes(file))
        preloadLinks.push(file)
    })
  })

  if (preloadLinks) {
    preloadLinks.forEach((file) => {
      if (!seen.has(file)) {
        seen.add(file)
        renderPreloadLink(document, file)
      }
    })
  }
}

function renderPreloadLink(document: Document, file: string) {
  if (file.endsWith('.js')) {
    appendLink(document, {
      rel: 'modulepreload',
      crossOrigin: '',
      href: file,
    })
  }
  else if (file.endsWith('.css')) {
    appendLink(document, {
      rel: 'stylesheet',
      href: file,
    })
  }
}

function createLink(document: Document) {
  return document.createElement('link')
}

function setAttrs(el: Element, attrs: Record<string, any>) {
  const keys = Object.keys(attrs)
  for (const key of keys)
    el.setAttribute(key, attrs[key])
}

function appendLink(document: Document, attrs: Record<string, any>) {
  const exits = document.head.querySelector(`link[href='${attrs.file}']`)
  if (exits)
    return
  const link = createLink(document)
  setAttrs(link, attrs)
  document.head.appendChild(link)
}

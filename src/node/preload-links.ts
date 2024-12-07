import type { Manifest } from './build'
import { injectInHtml } from './utils'


type PreloadLinkTransport = Document | { html:string }

export function renderPreloadLinks(document: PreloadLinkTransport, modules: Set<string>, ssrManifest: Manifest) {
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

function renderPreloadLink(document: PreloadLinkTransport, file: string) {
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

function appendLink(document: PreloadLinkTransport, attrs: Record<string, any>) {
  if(!('querySelector' in document)){
    const regex = new RegExp(`<link[^>]*href\s*=\s*["']${attrs.href}["'][^>]*>`,'m')
    const exits = regex.test(document.html)
    if(exits) return ;
    const crossOrigin = attrs.crossOrigin !== undefined ? `crossorigin='${attrs.crossOrigin}'` : ''    
    document.html = injectInHtml(document.html, 'head' , {prepend: `<link rel='${attrs.rel}' href='${attrs.href}' ${crossOrigin}>`} )
    return 
  }
  const exits = document.head.querySelector(`link[href='${attrs.file}']`)
  if (exits)
    return
  const link = createLink(document)
  setAttrs(link, attrs)
  document.head.appendChild(link)
}

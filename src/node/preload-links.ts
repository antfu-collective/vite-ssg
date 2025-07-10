import type { Manifest } from './build'
// import { injectInHtml } from './utils'


type PreloadLinkTransport = Document | { html:string }

export function buildPreloadLinks<
  T extends PreloadLinkTransport, 
  R = T extends Document ? HTMLLinkElement : string 
  >(document: PreloadLinkTransport, modules: Set<string>, ssrManifest: Manifest): R[] 
  {
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
    preloadLinks.map((file) => {
      if (!seen.has(file)) {
        seen.add(file)
        return buildPreloadLink(document, file) as R
      }
    }).filter((file) => !!file)
  }
  return []
}

function buildPreloadLink(document: PreloadLinkTransport, file: string) {
  if (file.endsWith('.js')) {
    return buildLink(document, {
      rel: 'modulepreload',
      crossOrigin: '',
      href: file,
    })
  }
  else if (file.endsWith('.css')) {
    return buildLink(document, {
      rel: 'stylesheet',
      href: file,
    })
  }
}

function createLink(document: Document, attrs?: Record<string, string>) {
  const link =  document.createElement('link')
  if (attrs) {
    setAttrs(link, attrs)
  }
  return link
}

function setAttrs(el: Element, attrs: Record<string, any>) {
  const keys = Object.keys(attrs)
  for (const key of keys)
    el.setAttribute(key, attrs[key])
}

function buildLink<
  T extends PreloadLinkTransport, 
  R = T extends Document ? HTMLLinkElement : string 
>(document: T, attrs: Record<string, any>): R|undefined {
  if(!('querySelector' in document)){
    const regex = new RegExp(`<link[^>]*href\s*=\s*("|')${attrs.href}\\1[^>]*>`,'m')
    const exits = regex.test(document.html)
    if(exits) return ;
    const crossOrigin = attrs.crossOrigin !== undefined ? `crossorigin='${attrs.crossOrigin}'` : ''
    const base = process.env.BASE_ASSETS_URL ?? ''    
    return `<link rel='${attrs.rel}' href='${base}${attrs.href}' ${crossOrigin}>` as R
  }  
  const exits = document.head.querySelector(`link[href='${attrs.file}']`)
  if (exits)
    return
  return createLink(document, attrs) as R
  
  
}

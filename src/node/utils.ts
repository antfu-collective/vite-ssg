import { blue, gray, yellow } from 'kolorist'
import type { RouteRecordRaw } from 'vue-router'

export function buildLog(text: string, count?: number) {
  // eslint-disable-next-line no-console
  console.log(`\n${gray('[vite-ssg]')} ${yellow(text)}${count ? blue(` (${count})`) : ''}`)
}

export function getSize(str: string) {
  return `${(str.length / 1024).toFixed(2)} KiB`
}

export function routesToPaths(routes?: Readonly<RouteRecordRaw[]>) {
  if (!routes)
    return ['/']

  const paths: Set<string> = new Set()

  const getPaths = (routes: Readonly<RouteRecordRaw[]>, prefix = '') => {
    // remove trailing slash
    prefix = prefix.replace(/\/$/g, '')
    for (const route of routes) {
      let path = route.path

      // check for leading slash
      if (route.path != null) {
        path = (prefix && !route.path.startsWith('/'))
          ? `${prefix}${route.path ? `/${route.path}` : ''}`
          : route.path

        paths.add(path)
      }
      if (Array.isArray(route.children))
        getPaths(route.children, path)
    }
  }

  getPaths(routes)
  return Array.from(paths)
}



export function injectInHtml(html: string, inTag: string, opts: {attrs?: string, prepend?:string, append?: string}): string {
  const tagOpen= `<${inTag}`
  let tagStart = html.indexOf(`${tagOpen}>`)
  tagStart = tagStart > -1 ? tagStart : html.indexOf(`${tagOpen} `)
  tagStart = html.indexOf('>', tagStart)
  const {attrs='' , prepend='', append} = opts

  html = !(prepend.length || attrs.length) ? html : `${html.substring(0, tagStart)} ${attrs.trim()}>${prepend}${html.substring(tagStart + 1)}`                
  if (!append?.length) {
    return html
  }
  const tagClose= `</${inTag}`
  let tagEnd = html.lastIndexOf(`${tagClose}>`) 
  tagEnd = tagEnd > -1 ? tagEnd : html.lastIndexOf(`${tagClose} `)
  return `${html.substring(0, tagEnd)}${append}${html.substring(tagEnd)}`
}
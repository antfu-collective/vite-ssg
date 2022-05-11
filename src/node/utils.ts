import { blue, gray, yellow } from 'kolorist'
import type { RouteRecordRaw } from 'vue-router'

export function buildLog(text: string, count?: number) {
  // eslint-disable-next-line no-console
  console.log(`\n${gray('[vite-ssg]')} ${yellow(text)}${count ? blue(` (${count})`) : ''}`)
}

export function getSize(str: string) {
  return `${(str.length / 1024).toFixed(2)} KiB`
}

export function routesToPaths(routes?: RouteRecordRaw[]) {
  if (!routes)
    return ['/']

  const pathsSet: Set<string> = new Set()

  const getPath = (prefix: string, path: string): string => (prefix && !path.startsWith('/')
    ? `${prefix}/${path}`
    : path)

  const pathWitPrefix = (prefixes: string[], paths: string[]): string[] => paths
    .flatMap((path: string) => prefixes
      .map((prefix: string) => getPath(prefix, path)))

  const getPaths = (routes: RouteRecordRaw[], prefixes: string[] = ['']) => {
    const tempPrefixes: string[] = prefixes.map((prefix: string) => prefix.replace(/\/$/g, ''))

    routes.forEach((route) => {
      const generatedPaths: string[] = []

      if (route.path)
        generatedPaths.push(...pathWitPrefix(tempPrefixes, [route.path]))

      if (Array.isArray(route.alias))
        generatedPaths.push(...pathWitPrefix(tempPrefixes, route.alias))

      generatedPaths.forEach(generatedPath => pathsSet.add(generatedPath))

      if (Array.isArray(route.children))
        getPaths(route.children, generatedPaths)
    })
  }

  getPaths(routes)

  return [...pathsSet]
}

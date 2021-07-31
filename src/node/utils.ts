import chalk from 'chalk'
import { RouteRecordRaw } from 'vue-router'

export function buildLog(text: string, count?: number) {
  // eslint-disable-next-line no-console
  console.log(`\n${chalk.gray('[vite-ssg]')} ${chalk.yellow(text)}${count ? chalk.blue(` (${count})`) : ''}`)
}

export function getSize(str: string) {
  return `${(str.length / 1024).toFixed(2)}kb`
}

export function routesToPaths(routes?: RouteRecordRaw[]) {
  if (!routes)
    return ['/']

  const paths: Set<string> = new Set()

  const getPaths = (routes: RouteRecordRaw[], prefix = '') => {
    // remove trailing slash
    prefix = prefix.replace(/\/$/g, '')
    for (const route of routes) {
      // check for leading slash
      if (route.path) {
        paths.add(
          prefix && !route.path.startsWith('/')
            ? `${prefix}/${route.path}`
            : route.path,
        )
      }
      if (Array.isArray(route.children))
        getPaths(route.children, route.path)
    }
  }

  getPaths(routes)
  return [...paths]
}

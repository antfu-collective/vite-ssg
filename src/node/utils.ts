import chalk from 'chalk'
import { RouteRecordRaw } from 'vue-router'

export function buildLog(text: string, count?: number) {
  console.log(`\n${chalk.gray('[vite-ssg]')} ${chalk.yellow(text)}${count ? chalk.blue(` (${count})`) : ''}`)
}

export function getSize(str: string) {
  return `${(str.length / 1024).toFixed(2)}kb`
}

export function routesToPaths(routes?: RouteRecordRaw[]) {
  if (!routes)
    return ['/']

  const paths: string[] = []

  const getPaths = (routes: RouteRecordRaw[], prefix = '') => {
    // remove tailing slash
    prefix = prefix.replace(/\/$/g, '')
    for (const route of routes) {
      // remove leading slash
      if (route.path) {
        paths.push(
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

  return paths
}

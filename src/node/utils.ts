import chalk from 'chalk'

export function buildLog(text: string, count?: number) {
  console.log(`\n${chalk.gray('[vite-ssg]')} ${chalk.yellow(text)}${count ? chalk.blue(` (${count})`) : ''}`)
}

export function getSize(str: string) {
  return `${(str.length / 1024).toFixed(2)}kb`
}

export function collectRoutePaths(routes: any[]) {
  const pathsFromRoute = (prefix: string) => (route: any): string[] => {
    // include the prefix from the parent in this path
    const paths = [
      prefix ? `${prefix}/${route.path}` : route.path
    ]

    // if the route has children, recursively traverse those as well
    if (Array.isArray(route.children)) {
      paths.push(...route.children.flatMap(pathsFromRoute(route.path)))
    }

    return paths
  }


  return routes
    .flatMap(pathsFromRoute(''))
    .filter(i => !i.includes(':')) // ignore dynamic routes
}
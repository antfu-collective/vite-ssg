import fs from 'node:fs/promises'
import { glob } from 'tinyglobby'
import { describe, expect, it } from 'vitest'

function sortFiles(files: string[]) {
  return files.map(f => f.replace(/\\/g, '/')).sort((a, b) => {
    return a.localeCompare(b)
  })
}

describe('multiple-pages', () => {
  it('generates list', async () => {
    const files = await glob('**/*.html', {
      cwd: 'examples/multiple-pages/dist',
    })
    expect(sortFiles(files)).toMatchInlineSnapshot(`
      [
        "a.html",
        "b.html",
        "index.html",
        "nested/deep/b.html",
      ]
    `)
  })

  it('generates content', async () => {
    const file = await fs.readFile('examples/multiple-pages/dist/a.html', 'utf-8')
    expect(file).toContain('Page A')
  })
})

describe('multiple-pages-with-store', () => {
  it('routes are nested', async () => {
    const files = await glob('**/*.html', {
      cwd: 'examples/multiple-pages-with-store/dist',
    })
    expect(sortFiles(files)).toMatchInlineSnapshot(`
      [
        "a/index.html",
        "b/index.html",
        "index.html",
        "nested/deep/b/index.html",
      ]
    `)
  })
})

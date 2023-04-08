import fs from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import fg from 'fast-glob'

describe('multiple-pages', () => {
  it('generates', async () => {
    const files = await fg('**/*.html', {
      cwd: 'examples/multiple-pages/dist',
    })
    expect(files).toMatchInlineSnapshot(`
      [
        "a.html",
        "b.html",
        "index.html",
        "nested/deep/b.html",
      ]
    `)
  })

  it('generates', async () => {
    const file = await fs.readFile('examples/multiple-pages/dist/a.html', 'utf-8')
    expect(file).toContain('Page A')
  })
})

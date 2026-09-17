import fs from 'node:fs/promises'
import { JSDOM } from 'jsdom'
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

  it('renders route head tags and preserves template assets', async () => {
    const file = await fs.readFile('examples/multiple-pages/dist/b.html', 'utf-8')
    const { document } = new JSDOM(file).window
    expect(document.title).toBe('Hello')
    expect(document.querySelectorAll('title')).toHaveLength(1)
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Website description')
    expect(document.querySelector('meta[name="viewport"]')).not.toBeNull()
    expect(document.querySelector('link[href*="github-markdown"]')).not.toBeNull()
    expect(document.querySelector('link[rel="modulepreload"]')).not.toBeNull()
  })
})

describe('single-page', () => {
  it('renders SSR head attributes and body tags', async () => {
    const file = await fs.readFile('examples/single-page/dist/index.html', 'utf-8')
    const { document } = new JSDOM(file).window
    expect(document.title).toBe('Hello World')
    expect(document.querySelectorAll('title')).toHaveLength(1)
    expect(document.documentElement.lang).toBe('sv')
    expect(document.body.className).toBe('single-page')
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('A single page example')
    expect(document.body.firstElementChild?.id).toBe('body-open')
    expect(document.querySelector('#body-close')?.parentElement).toBe(document.body)
    expect([...document.body.querySelectorAll('script')].at(-1)?.id).toBe('body-close')
    expect(document.querySelector('#app')?.textContent).toContain('Hello')
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

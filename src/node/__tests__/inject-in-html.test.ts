import { describe, expect, it } from 'vitest'

import html5Parser from 'html5parser'
import type { InjectOptions } from '../utils'
import { injectInHtml, isMatchOption } from '../utils'

const html = `<!doctype html>
<html id='myid'>
<head>
  <link rel="stylesheet" href="..."/>
  <title id="myTitle">My Title</title>
</head>
<body>
  <!--before-->
  <div id="app"></div>
  <!--after-->
</body>
</html>`

describe('injectInHtml', () => {
  it('should to matchOption work as expected', () => {
    const docType = html5Parser.parse('<!doctype html>')[0]
    expect(isMatchOption(docType as any, { match: { attr: { id: 'app' } } })).not.toBeTruthy()
    expect(isMatchOption(docType as any, { match: { attr: { html: '' } } })).toBeTruthy()
    expect(isMatchOption(docType as any, { match: { tag: 'div' } })).not.toBeTruthy()

    const divApp = html5Parser.parse('<div id="app">')[0]
    expect(isMatchOption(divApp as any, { match: { attr: { id: 'app' } } })).toBeTruthy()
    expect(isMatchOption(divApp as any, { match: { tag: 'div' } })).toBeTruthy()
  })
  it('should match only by attribute without tag', () => {
    const stateScript = '__STATE__=true'
    const appHTML = 'My App'
    const rootContainerId = 'app'
    const injectOpts: InjectOptions = {
      match: {

        attr: { id: rootContainerId },
      },
      throwException: true,
      attrs: 'data-server-rendered="true"',
      append: appHTML,
      after: stateScript,
    }

    const result = injectInHtml(html, injectOpts)
    expect(result).toContain(`<div id="app" data-server-rendered="true">${appHTML}</div>${stateScript}`)
  })
  it('should delete title', () => {
    const injectOpts: InjectOptions = { match: { tag: 'head' }, removeChildren: { tag: 'title', attr: { id: 'myTitle' } } }
    const result = injectInHtml(html, injectOpts)
    expect(result).not.toContain('</title>')
  })
  it('should replace title', () => {
    const injectOpts: InjectOptions = { match: { tag: 'head' }, prepend: '<title>Replaced</title>', removeChildren: { tag: 'title', attr: { id: 'myTitle' } } }
    const result = injectInHtml(html, injectOpts)
    expect(result).toContain('<title>Replaced</title>')
    expect(result).not.toContain('<title id="myTitle">')
  })
  it('should make 2 operations in same element', () => {
    const injectOpts: InjectOptions[] = [
      { match: { tag: 'head' }, prepend: '\n<title>Replaced New Title</title>\n', removeChildren: { tag: 'title' } },
      { match: { tag: 'head' }, prepend: '\n<link hell=\'stylesheet\'>\n' },
    ]
    const result = injectInHtml(html, injectOpts)
    expect(result).toContain('<title>Replaced New Title</title>')
    expect(result).toContain('<link hell=\'stylesheet\'>')
    expect(result).not.toContain('<title id="myTitle">')
  })
  it('it should throw exceptions if throwException is true and not match anything', () => {
    const injectOpts: InjectOptions[] = [
      { match: { tag: 'div', attr: { id: 'nonExists' } }, throwException: true, append: 'App Data' },
    ]
    expect(() => injectInHtml(html, injectOpts)).toThrow()
  })
  it('it should not throw exceptions if throwException is true but match', () => {
    const injectOpts: InjectOptions[] = [
      { match: { tag: 'div', attr: { id: 'app' } }, throwException: true, append: 'App Data' },
    ]
    let result: any = ''
    expect(() => result = injectInHtml(html, injectOpts)).not.toThrow()
    expect(result).toContain('App Data')
  })

  it('should not delete title when id not match', () => {
    const injectOpts: InjectOptions = { match: { tag: 'head' }, removeChildren: { tag: 'title', attr: { id: 'nonExist' } } }
    const result = injectInHtml(html, injectOpts)
    expect(result).toContain('</title>')
  })
  it('should append attr', () => {
    const injectOpts: InjectOptions = { match: { tag: 'html', attr: { id: 'myid' } }, attrs: ' attr="test"' }
    const result = injectInHtml(html, injectOpts)
    expect(result).toContain('<html id=\'myid\' attr="test"')
  })
  it('should append attr in body', () => {
    const injectOpts: InjectOptions = { match: { tag: 'body' }, attrs: ' attr="test"' }
    const result = injectInHtml(html, injectOpts)
    expect(result).toContain('<body attr="test"')
  })
  it('should append tag', () => {
    const injectOpts: InjectOptions = { match: { tag: 'body' }, append: '<!--xurupita-->' }
    const result = injectInHtml(html, injectOpts)
    expect(result).toContain('<!--xurupita--></body>')
  })

  it('should prepend tag', () => {
    const injectOpts: InjectOptions = { match: { tag: 'body' }, prepend: '<!--xurupita-->' }
    const result = injectInHtml(html, injectOpts)
    expect(result).toContain('<body><!--xurupita-->')
  })

  it('should add before tag', () => {
    const injectOpts: InjectOptions = { match: { tag: 'body' }, before: '<!--xurupita-->' }
    const result = injectInHtml(html, injectOpts)
    expect(result).toContain('<!--xurupita--><body>')
  })
  it('should add after tag', () => {
    const injectOpts: InjectOptions = { match: { tag: 'body' }, after: '<!--xurupita-->' }
    const result = injectInHtml(html, injectOpts)
    expect(result).toContain('</body><!--xurupita-->')
  })
})

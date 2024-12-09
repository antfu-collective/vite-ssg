import { describe, expect, it } from 'vitest'

import type { InjectOptions } from '../utils'
import { injectInHtml } from '../utils'

const html = `<html id='myid'>
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

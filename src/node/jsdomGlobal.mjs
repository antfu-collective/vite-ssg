/*
MIT License

Copyright for portions of global-jsdom are held by Rico Sta. Cruz, 2016 as part of
jsdom-global. All other copyright for global-jsdom are held by jonathan schatz, 2017.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

// https://github.com/modosc/global-jsdom/blob/44f28b29c7d2a17d5d64fb97fc584aaa51863cfa/esm/index.mjs

/*
 * enables jsdom globally.
 */
import JSDOM from 'jsdom'

const defaultHtml = '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>'

// define this here so that we only ever dynamically populate KEYS once.

const KEYS = []

export function jsdomGlobal(html = defaultHtml, options = {}) {
  // Idempotency
  if (global.navigator
    && global.navigator.userAgent
    && global.navigator.userAgent.includes('Node.js')
    && global.document
    && typeof global.document.destroy === 'function')
    return global.document.destroy

  // set a default url if we don't get one - otherwise things explode when we copy localstorage keys
  if (!('url' in options))
    Object.assign(options, { url: 'http://localhost:3000' })

  // enable pretendToBeVisual by default since react needs
  // window.requestAnimationFrame, see https://github.com/jsdom/jsdom#pretending-to-be-a-visual-browser
  if (!('pretendToBeVisual' in options))
    Object.assign(options, { pretendToBeVisual: true })

  const jsdom = new JSDOM.JSDOM(html, options)
  const { window } = jsdom
  const { document } = window

  // generate our list of keys by enumerating document.window - this list may vary
  // based on the jsdom version. filter out internal methods as well as anything
  // that node already defines

  if (KEYS.length === 0) {
    KEYS.push(...Object.getOwnPropertyNames(window).filter(k => !k.startsWith('_')).filter(k => !(k in global)))
    // going to add our jsdom instance, see below
    KEYS.push('$jsdom')
  }

  KEYS.forEach(key => global[key] = window[key])

  // setup document / window / window.console
  global.document = document
  global.window = window
  window.console = global.console

  // add access to our jsdom instance
  global.$jsdom = jsdom

  const cleanup = () => KEYS.forEach(key => delete global[key])

  document.destroy = cleanup

  return cleanup
}

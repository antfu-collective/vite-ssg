import html5Parser, { type ITag, SyntaxKind } from 'html5parser'

type MaybeArray<T> = T | T[]
export interface InjectOptions {
  match: {
    attr?: Record<string, string | RegExp>
    tag?: string
  }
  removeChildren?: MaybeArray<{
    tag?: string
    attr?: Record<string, string | RegExp>
  }>
  throwException?: boolean
  mode?: 'first' // maybe create match last tag mode
  attrs?: string
  prepend?: string
  append?: string
  before?: string
  after?: string
}

export function isMatchOption(node: ITag, opts: InjectOptions) {
  if (opts.match.tag && !(node.name === opts.match.tag)) {
    return false
  }
  if (opts.match.attr && !(
    Array.isArray(node.attributes) && node.attributes.length > 0
    && Object.entries(opts.match.attr).every(([attrName, attrValue]) => node.attributes.find(attr => attr.name.value === attrName && `${attr.value?.value ?? ''}`.match(attrValue))))
  ) {
    return false
  }
  return !!opts.match.tag || !!opts.match.attr // only match if have tag or attribute
}

export function injectInHtml(html: string, options: InjectOptions | InjectOptions[]): string {
  const ast = html5Parser.parse(html)
  let result = ''
  const optionsAry = [options].flat()
  const enterOptsAry = optionsAry.filter(opts => opts.attrs || opts.prepend || opts.before || opts.removeChildren)
  const leaveOptsAry = optionsAry.filter(opts => opts.after || opts.append)

  html5Parser.walk(ast, {
    enter(node) {
      if (node.type === SyntaxKind.Text) {
        result = `${result}${node.value}`
        return
      }
      let fullBefore = ''
      let fullAttr = ''
      let fullPrepend = ''

      for (const opts of [...enterOptsAry]) {
        if (!isMatchOption(node, opts)) {
          continue
        }

        // remove option from array can used only once
        enterOptsAry.splice(enterOptsAry.indexOf(opts), 1)
        const { attrs = '', prepend = '', before = '', removeChildren } = opts
        fullBefore = before ? `${fullBefore}${before}` : fullBefore
        fullPrepend = prepend ? `${fullPrepend}${prepend}` : fullPrepend
        fullAttr = attrs ? `${fullAttr} ${attrs.trim()}` : fullAttr

        if (!removeChildren) {
          continue
        }

        const removeChildrenAry = [removeChildren].flat()
        for (const child of (node.body ?? [])) {
          if (child.type !== html5Parser.SyntaxKind.Tag)
            continue
          for (const rmChildOpt of removeChildrenAry) {
            if (!isMatchOption(child, { match: rmChildOpt })) {
              continue
            }
            node.body?.splice(node.body.indexOf(child), 1)
          }
        }
      }

      const tagValue = node.open.value
      const lastTagCharIdx = tagValue.length - 1
      const NEW_TAG_OPEN = fullAttr ? `${tagValue.substring(0, lastTagCharIdx)}${fullAttr}${tagValue[lastTagCharIdx]}` : node.open.value
      result = `${result}${fullBefore}${NEW_TAG_OPEN}${fullPrepend}`
    },
    leave(node) {
      if (node.type !== SyntaxKind.Tag || !node.close)
        return
      let fullAfter = ''
      let fullAppend = ''
      for (const opts of [...leaveOptsAry]) {
        if (!isMatchOption(node, opts)) {
          continue
        }
        // remove option from array can used only once
        leaveOptsAry.splice(leaveOptsAry.indexOf(opts), 1)
        const { append = '', after = '' } = opts
        fullAppend = append ? `${fullAppend}${append}` : fullAppend
        fullAfter = after ? `${fullAfter}${after}` : fullAfter
      }
      // write close tag
      result = `${result}${fullAppend}${node.close?.value}${fullAfter}`
    },
  })

  if (!(enterOptsAry.length || leaveOptsAry.length)) {
    // all options have processed ok
    return result
  }

  const missingOptions = new Set([...enterOptsAry, ...leaveOptsAry])
  const notMatched: InjectOptions[] = []
  for (const opts of missingOptions) {
    if (!opts.throwException)
      continue
    notMatched.push(opts)
  }
  if (notMatched.length) {
    throw new Error(`Required injections doesn't can't match with anything "${JSON.stringify(notMatched, null, 2)}"`)
  }

  return result
}
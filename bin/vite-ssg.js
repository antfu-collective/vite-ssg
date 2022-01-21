#!/usr/bin/env node
'use strict'
if (typeof __dirname !== 'undefined')
  require('../dist/node/cli.cjs')
else
  import('../dist/node/cli.mjs')

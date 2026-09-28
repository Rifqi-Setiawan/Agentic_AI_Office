#!/usr/bin/env node
// Parse/transpile only. This is explicitly NOT a replacement for npm run build.
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const root = path.resolve(__dirname, '..')
let ts
try { ts = require(require.resolve('typescript', { paths: [path.join(root, 'frontend')] })) }
catch { ts = require(path.join(execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim(), 'typescript')) }
const folder = path.join(root, 'frontend/src/components/CommandCenter')
let failures = 0, count = 0
for (const name of fs.readdirSync(folder).filter(name => /\.tsx?$/.test(name))) {
  const result = ts.transpileModule(fs.readFileSync(path.join(folder, name), 'utf8'), {
    fileName: name, reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, strict: true, isolatedModules: true },
  })
  const errors = (result.diagnostics || []).filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error)
  for (const error of errors) console.error(name, ts.flattenDiagnosticMessageText(error.messageText, '\n'))
  failures += errors.length; count++
}
console.log(`${count} TypeScript/TSX modules parsed and transpiled; ${failures} syntax diagnostics. Dependency type checking NOT performed here.`)
process.exitCode = failures ? 1 : 0

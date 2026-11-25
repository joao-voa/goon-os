// Copia para apps/api/vendor o que a conversão .docx -> PDF lê em tempo de execução
// (Chromium do @sparticuz e os scripts de navegador do docx-preview/jszip).
// Roda no build do Vercel; a pasta entra na função por "includeFiles": "vendor/**".
const { cpSync, mkdirSync, rmSync } = require('fs')
const { dirname, join } = require('path')

const out = join(__dirname, '..', 'vendor')
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
// (docx-preview não exporta package.json: parte do arquivo principal de cada pacote)
const main = name => dirname(require.resolve(name))
cpSync(join(main('@sparticuz/chromium'), '..', 'bin'), join(out, 'chromium'), { recursive: true })
cpSync(join(main('docx-preview'), 'docx-preview.min.js'), join(out, 'docx-preview.min.js'))
cpSync(join(main('jszip'), '..', 'dist', 'jszip.min.js'), join(out, 'jszip.min.js'))
console.log('vendor ok:', out)

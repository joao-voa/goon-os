import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

// Converte o .docx do contrato em PDF: o Chromium renderiza o Word com o docx-preview
// (fontes embutidas no .docx: Sora, Inter, JetBrains Mono) e imprime em A4 com rodapé e paginação.
// No Vercel usa o @sparticuz/chromium; local, o Chrome instalado.

const LOCAL_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const CSS = `body{margin:0;background:#fff}
.docx-wrapper{background:#fff!important;padding:0!important;display:block!important}
.docx-wrapper>section.docx{box-shadow:none!important;margin:0!important;padding:0!important;width:auto!important;min-height:0!important}
.docx-wrapper>section.docx>header,.docx-wrapper>section.docx>footer{display:none!important}
.docx table td{border-left:none!important;border-right:none!important}
.docx table,.docx tr{break-inside:avoid}
.keep{break-after:avoid}`

// apps/api/vendor, montada por scripts/copy-vendor.js (build do Vercel e `node scripts/copy-vendor.js` local)
function vendorDir() {
  const dirs = [join(__dirname, '..', '..', '..', 'vendor'), join(process.cwd(), 'vendor'), join(process.cwd(), 'apps', 'api', 'vendor')]
  const dir = dirs.find(d => existsSync(join(d, 'docx-preview.min.js')))
  if (!dir) throw new Error(`Conversor de PDF sem arquivos (vendor). Procurado em: ${dirs.join(', ')}`)
  return dir
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export async function docxToPdf(docx: Buffer, footerLabel: string): Promise<Buffer> {
  const vendor = vendorDir()
  const jszip = readFileSync(join(vendor, 'jszip.min.js'), 'utf8')
  const preview = readFileSync(join(vendor, 'docx-preview.min.js'), 'utf8')
  const puppeteer = await import('puppeteer-core')
  let launch: Parameters<typeof puppeteer.launch>[0]
  if (process.env.VERCEL || !existsSync(LOCAL_CHROME)) {
    const chromium = (await import('@sparticuz/chromium')).default
    launch = { args: chromium.args, executablePath: await chromium.executablePath(join(vendor, 'chromium')), headless: true }
  } else {
    launch = { executablePath: LOCAL_CHROME, headless: true }
  }
  const browser = await puppeteer.launch(launch)
  try {
    const page = await browser.newPage()
    await page.setContent(`<html><head><meta charset="utf-8"><style>${CSS}</style></head><body><div id="c"></div><script>${jszip}</script><script>${preview}</script></body></html>`)
    await page.evaluate(async (b64: string) => {
      const w = window as unknown as { docx: { renderAsync: (d: ArrayBuffer, el: HTMLElement, s: null, o: object) => Promise<void> } }
      const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
      await w.docx.renderAsync(bin.buffer, document.getElementById('c')!, null, {
        inWrapper: true, ignoreWidth: true, ignoreHeight: true, breakPages: true,
        renderHeaders: false, renderFooters: false, useBase64URL: true, experimental: true,
      })
      // títulos (curtos, em caixa alta) não ficam sozinhos no fim da página
      for (const p of Array.from(document.querySelectorAll('p'))) {
        const t = (p.textContent ?? '').trim()
        if (t && t.length < 80 && t === t.toUpperCase() && /[A-Z]/.test(t)) p.classList.add('keep')
      }
      // parágrafos vazios no fim do documento geravam uma página em branco
      const body = document.querySelector('section.docx article') ?? document.querySelector('section.docx')
      while (body?.lastElementChild && !(body.lastElementChild.textContent ?? '').trim() && !body.lastElementChild.querySelector('img,table')) body.lastElementChild.remove()
      await document.fonts.ready
    }, docx.toString('base64'))
    const pdf = await page.pdf({
      format: 'A4', printBackground: true,
      margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
      displayHeaderFooter: true, headerTemplate: '<span></span>',
      footerTemplate: `<div style="width:100%;margin:0 20mm;padding-top:6px;border-top:0.5px solid #ddd;display:flex;justify-content:space-between;font-family:Menlo,'DejaVu Sans Mono','Courier New',monospace;font-size:7.5px;letter-spacing:1px;color:#777"><span>${esc(footerLabel)}</span><span style="font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0;color:#333"><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}

import type React from 'react'

// Logo GOON (wordmark com o infinito neon). Usa a versão escura (fundo claro)
// ou branca (fundo escuro) conforme a cor pedida em `fill` — mantém a API antiga.
export function GoonLogo({ height = 22, fill = '#0f172a', chrome: _chrome, style }: { height?: number; fill?: string; chrome?: boolean; style?: React.CSSProperties }) {
  const light = (() => {
    const m = (fill ?? '').replace('#', '')
    if (m.length >= 6) {
      const r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16)
      return (0.299 * r + 0.587 * g + 0.114 * b) > 140
    }
    return fill === 'white' || fill === '#fff' || fill === '#fff'
  })()
  const src = light ? '/goon-logo-white.png' : '/goon-logo.png'
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="GOON" style={{ display: 'block', height, width: 'auto', ...style }} />
  )
}

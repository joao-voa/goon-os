import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'GOON OS — Sistema de Gestão',
  description: 'Sistema operacional da GOON Consultoria',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&family=Space+Grotesk:wght@400;700&family=Press+Start+2P&family=Permanent+Marker&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}

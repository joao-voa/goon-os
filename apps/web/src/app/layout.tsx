import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'GOON OS — Sistema de Gestão',
  description: 'Sistema operacional da GOON Consultoria',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body className="min-h-screen" suppressHydrationWarning>
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('goon-theme');if(t==='light'){document.documentElement.classList.remove('dark');document.documentElement.classList.add('light')}})();`,
          }}
        />
        {children}
      </body>
    </html>
  )
}

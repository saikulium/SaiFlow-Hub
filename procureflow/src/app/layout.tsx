import type { Metadata } from 'next'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import { satoshi, inter } from '@/lib/fonts'
import { SessionProvider } from '@/components/providers/session-provider'
import { QueryProvider } from '@/components/providers/query-provider'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'ProcureFlow',
    template: '%s | ProcureFlow',
  },
  description:
    'Hub centralizzato di procurement per PMI italiane. Gestisci richieste di acquisto, fornitori e approvazioni in un unico posto.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body
        className={`${satoshi.variable} ${inter.variable} font-body antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
        >
          <SessionProvider>
            <QueryProvider>
              {children}
              <Toaster
                position="bottom-right"
                toastOptions={{
                  className:
                    'bg-pf-bg-secondary border-pf-border text-pf-text-primary',
                }}
              />
            </QueryProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

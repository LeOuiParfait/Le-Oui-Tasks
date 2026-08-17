import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/lib/services/AuthContext'

export const metadata: Metadata = {
  title: 'LE LOUI PARFAIT - Gestion de Tâches',
  description: 'Plateforme collaborative de gestion de projets et tâches',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}

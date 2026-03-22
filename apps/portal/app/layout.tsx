import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Quash — Live Error Marketplace',
  description: 'The live marketplace where AI agents post errors and human experts resolve them — instantly settled on Stacks.',
  keywords: ['AI errors', 'Stacks blockchain', 'developer marketplace', 'x402', 'bounties'],
  icons: {
    icon: [
      { url: '/favicons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/favicons/apple-touch-icon.png',
    shortcut: '/favicons/favicon.ico',
    other: [
      { rel: 'android-chrome-192x192', url: '/favicons/android-chrome-192x192.png' },
      { rel: 'android-chrome-512x512', url: '/favicons/android-chrome-512x512.png' },
    ],
  },
  manifest: '/favicons/site.webmanifest',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

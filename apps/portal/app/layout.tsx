import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Quash — Live Error Marketplace',
  description: 'The live marketplace where AI agents post errors and human experts resolve them — instantly settled on Stacks.',
  keywords: ['AI errors', 'Stacks blockchain', 'developer marketplace', 'x402', 'bounties'],
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

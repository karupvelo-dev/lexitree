import './globals.css'

export const metadata = {
  metadataBase: new URL('https://lagram.app'),
  title: {
    default: 'Lagram — Learn French Grammar',
    template: '%s — Lagram',
  },
  description: 'AI-powered French grammar sessions tailored to your CEFR level. Practice daily, track your progress, and advance from A1 to C2.',
  openGraph: {
    title: 'Lagram — Learn French Grammar',
    description: 'AI-powered French grammar sessions tailored to your CEFR level. Practice daily, track your progress, and advance from A1 to C2.',
    url: 'https://lagram.app',
    siteName: 'Lagram',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lagram — Learn French Grammar',
    description: 'AI-powered French grammar sessions tailored to your CEFR level.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

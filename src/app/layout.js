import './globals.css'

export const metadata = {
  metadataBase: new URL('https://lexitree.app'),
  title: {
    default: 'LexiTree — Learn French Grammar',
    template: '%s — LexiTree',
  },
  description: 'AI-powered French grammar sessions tailored to your CEFR level. Practice daily, track your progress, and advance from A1 to C2.',
  openGraph: {
    title: 'LexiTree — Learn French Grammar',
    description: 'AI-powered French grammar sessions tailored to your CEFR level. Practice daily, track your progress, and advance from A1 to C2.',
    url: 'https://lexitree.app',
    siteName: 'LexiTree',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LexiTree — Learn French Grammar',
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

import './globals.css'

export const metadata = {
  title: 'Lexitree — Learn French Grammar',
  description: 'AI-powered French grammar sessions tailored to your level.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}

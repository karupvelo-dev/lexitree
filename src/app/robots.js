export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/map', '/assess', '/vocab', '/vocab-map', '/share/'],
        disallow: ['/session', '/archive', '/api/', '/auth/'],
      },
    ],
    sitemap: 'https://lagram.app/sitemap.xml',
  }
}

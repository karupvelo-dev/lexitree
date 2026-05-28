export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/map', '/assess', '/vocab', '/share/'],
        disallow: ['/session', '/archive', '/vocab-practice', '/api/', '/auth/'],
      },
    ],
    sitemap: 'https://lexitree.app/sitemap.xml',
  }
}

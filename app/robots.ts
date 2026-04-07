import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/mypage/',
          '/admin/',
        ],
      },
    ],
    sitemap: 'https://moveiq.vercel.app/sitemap.xml',
    host: 'https://moveiq.vercel.app',
  };
}

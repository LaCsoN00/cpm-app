import withPWA from '@ducanh2912/next-pwa';
import { Configuration } from 'webpack';

const withPWAInit = withPWA({
    dest: 'public',
    register: true,
    sw: 'sw.js',
    fallbacks: {
        document: '/offline.html',
    },
    workboxOptions: {
        runtimeCaching: [
            {
                urlPattern: ({ url }) => {
                  return url.pathname === '/';
                },
                handler: 'CacheFirst',
                options: {
                    cacheName: 'start-page-cache',
                    expiration: {
                        maxEntries: 1,
                        maxAgeSeconds: 24 * 60 * 60, // 24 hours
                    },
                },
            },
            {
                urlPattern: ({ url }) => {
                  return url.pathname.startsWith('/general-projects');
                },
                handler: 'CacheFirst',
                options: {
                    cacheName: 'general-projects-cache',
                    expiration: {
                        maxEntries: 10,
                        maxAgeSeconds: 24 * 60 * 60, // 24 hours
                    },
                },
            },
            {
                urlPattern: ({ request }) => request.method === 'POST' && new URL(request.url).origin === self.location.origin,
                handler: 'NetworkFirst',
                options: {
                    backgroundSync: {
                        name: 'mySync',
                        options: {
                            maxRetentionTime: 24 * 60 * 60, // 24 hours
                        },
                    },
                },
            },
            {
                urlPattern: ({ request }) => request.mode === 'navigate',
                handler: 'NetworkFirst',
                options: {
                    cacheName: 'next-pages',
                    networkTimeoutSeconds: 10,
                    plugins: [
                        {
                            cacheWillUpdate: async ({ response }) => {
                                if (response && response.type === 'opaqueredirect') {
                                    return new Response(response.body, { status: 200, statusText: 'OK', headers: response.headers });
                                }
                                return response;
                            },
                        },
                    ],
                },
            },
            {
                urlPattern: /^\/_next\/data\/.+\/.+\.json$/i, // API calls for Next.js data
                handler: 'StaleWhileRevalidate',
                options: {
                    cacheName: 'next-data',
                    expiration: {
                        maxEntries: 32,
                        maxAgeSeconds: 86400, // 24 hours
                    },
                },
            },
            {
                urlPattern: /\/_next\/static\/.+\.(js|css)$/i, // Next.js static assets
                handler: 'CacheFirst',
                options: {
                    cacheName: 'next-static-assets',
                    expiration: {
                        maxEntries: 64,
                        maxAgeSeconds: 86400, // 24 hours
                    },
                },
            },
            {
                urlPattern: /\.(?:css)$/i, // Styles CSS
                handler: 'CacheFirst',
                options: {
                    cacheName: 'static-css-assets',
                    expiration: {
                        maxEntries: 16,
                        maxAgeSeconds: 86400, // 24 hours
                    },
                },
            },
            {
                urlPattern: /\/_next\/image\?url=.+\&w=.+\&q=.+$/i, // Next.js optimized images
                handler: 'CacheFirst',
                options: {
                    cacheName: 'next-image-assets',
                    expiration: {
                        maxEntries: 64,
                        maxAgeSeconds: 2592000, // 30 days
                    },
                },
            },
            {
                urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i, // Images
                handler: 'CacheFirst',
                options: {
                    cacheName: 'static-image-assets',
                    expiration: {
                        maxEntries: 64,
                        maxAgeSeconds: 2592000, // 30 days
                    },
                },
            },
        ],
        skipWaiting: true,
        clientsClaim: true,
    },
});

const nextConfig = {
    images: {
        unoptimized: true,
    },
    async headers() {
        return [
          {
            source: '/sw.js',
            headers: [
              {
                key: 'Cache-Control',
                value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
              },
              {
                key: 'Service-Worker-Allowed',
                value: '/',
              },
            ],
          },
          {
            source: '/manifest.json',
            headers: [
              {
                key: 'Content-Type',
                value: 'application/manifest+json',
              },
              {
                key: 'Cache-Control',
                value: 'public, max-age=0, must-revalidate',
              },
            ],
          },
        ];
    },
    webpack: (config: Configuration, { isServer }: { isServer: boolean }) => {
      // Pour le Service Worker, assurez-vous que regenerator-runtime est inclus.
      // Cela est souvent nécessaire pour les fonctions async/await dans les Workers.
      if (!isServer) {
        if (!config.resolve) {
          config.resolve = {};
        }
        config.resolve.alias = {
          ...(config.resolve.alias || {}),
          'regenerator-runtime': require.resolve('regenerator-runtime'),
        };
      }
      return config;
    },
};

export default withPWAInit(nextConfig);

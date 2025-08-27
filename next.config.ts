import withPWA from '@ducanh2912/next-pwa';

const withPWAInit = withPWA({
    dest: 'public',
    register: true,
    sw: 'sw.js',
});

const nextConfig = {
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
};

export default withPWAInit(nextConfig);

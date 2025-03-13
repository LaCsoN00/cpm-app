import withPWA from 'next-pwa';

export default withPWA({
    dest: "public",   
    disable: process.env.NODE_ENV === "development",       
    register: true,         
    skipWaiting: true,      
    sw: "service-worker.js"
});

export async function headers() {
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
}
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/mcp',
        destination: '/api/mcp',
      },
    ];
  },
};

module.exports = nextConfig;

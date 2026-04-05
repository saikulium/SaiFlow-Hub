/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  eslint: {
    // ESLint runs in CI — skip during production build to avoid blocking on warnings
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;

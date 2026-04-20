/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  eslint: {
    // ESLint runs in CI — skip during production build to avoid blocking on warnings
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Node built-ins that may appear transitively in client bundles via barrel
      // re-exports (e.g. audit-log AsyncLocalStorage). They are never executed
      // client-side — tree-shaking removes unused server code at runtime — but
      // webpack still needs to resolve the import during bundling.
      config.resolve.fallback = {
        ...config.resolve.fallback,
        async_hooks: false,
      };
    }
    return config;
  },
};

export default nextConfig;

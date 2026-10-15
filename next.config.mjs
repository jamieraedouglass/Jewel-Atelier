/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["three"],
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
};
export default nextConfig;

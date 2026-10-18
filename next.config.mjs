const nextConfig = {
  transpilePackages: ["three"],
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
    serverComponentsExternalPackages: ["rhino3dm"],
    outputFileTracingIncludes: { "/api/cad": ["./node_modules/rhino3dm/rhino3dm.wasm"] },
  },
};
export default nextConfig;

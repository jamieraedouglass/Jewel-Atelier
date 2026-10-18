const nextConfig = {
  transpilePackages: ["three"],
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
    serverComponentsExternalPackages: ["rhino3dm", "manifold-3d"],
    outputFileTracingIncludes: { "/api/cad": ["./node_modules/rhino3dm/rhino3dm.wasm", "./node_modules/manifold-3d/manifold.wasm"] },
  },
};
export default nextConfig;

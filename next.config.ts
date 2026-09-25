import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Netlify's build containers are ephemeral (a clean container per
    // build), so Turbopack's persistent build cache under .next/cache is
    // never restored between builds anyway — it only adds dead weight to
    // the build output, and its serialized files can embed literal env
    // var values, which trips Netlify's secret-scanning safeguard. Since
    // there's no benefit to keeping it in this environment, disable it.
    turbopackFileSystemCacheForBuild: false,
  },
};

export default nextConfig;

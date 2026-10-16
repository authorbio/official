/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  basePath: "/official",
  assetPrefix: "/official/",
  trailingSlash: true,
  images: { unoptimized: true }
};

export default nextConfig;

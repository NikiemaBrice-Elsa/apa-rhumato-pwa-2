/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@apa/domain", "@apa/rules-engine"],
};

export default nextConfig;

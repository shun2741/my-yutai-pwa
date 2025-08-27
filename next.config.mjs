// GitHub Pages のサブパスに対応
const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
const isProjectPage = base && base !== "/";

export default {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  assetPrefix: isProjectPage ? base : undefined,
  basePath: isProjectPage ? base : undefined,
  eslint: { ignoreDuringBuilds: true },
};

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // 서버 렌더 라우트(playwright/sharp)는 번들링 대신 node_modules 직접 사용
    serverComponentsExternalPackages: ['playwright-core', '@sparticuz/chromium', 'sharp'],
  },
}
module.exports = nextConfig

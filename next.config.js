/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // 서버 렌더 라우트(playwright/sharp)는 번들링 대신 node_modules 직접 사용
    serverComponentsExternalPackages: ['playwright-core', '@sparticuz/chromium', 'sharp'],
  },
  async redirects() {
    // 상세페이지 생성기는 별도 프로젝트로 분리됨 (oa-detail-gen)
    return [
      { source: '/detail', destination: 'https://oa-detail-gen.vercel.app/detail', permanent: false },
      { source: '/share', destination: 'https://oa-detail-gen.vercel.app/share', permanent: false },
    ]
  },
}
module.exports = nextConfig

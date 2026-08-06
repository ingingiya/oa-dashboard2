/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // 서버 렌더 라우트(playwright/sharp)는 번들링 대신 node_modules 직접 사용
    serverComponentsExternalPackages: ['playwright-core', '@sparticuz/chromium', 'sharp'],
    // chromium 압축 바이너리(bin/*.br)가 트레이싱에서 빠져 서버리스에 미포함되는 문제 방지
    outputFileTracingIncludes: {
      '/api/detail/render': ['./node_modules/@sparticuz/chromium/bin/**'],
    },
  },
}
module.exports = nextConfig

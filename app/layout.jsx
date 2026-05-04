export const metadata = {
  title: 'OA HQ — Marketing Dashboard',
  description: '메타광고 · 인플루언서 · 재고 · 스케줄 통합 대시보드',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </head>
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  )
}

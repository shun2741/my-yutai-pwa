import './globals.css';

export const metadata = {
  title: '株主優待管理（PWA）',
  description: '端末ローカル保存で動く趣味向けPWA',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <nav style={{ padding: 12, display: 'flex', gap: 12, borderBottom: '1px solid #eee' }}>
          <a href="/">ホーム</a>
          <a href="/holdings">優待券</a>
          <a href="/map">マップ</a>
          <a href="/settings">設定</a>
        </nav>
        <main style={{ padding: 16 }}>{children}</main>
      </body>
    </html>
  );
}

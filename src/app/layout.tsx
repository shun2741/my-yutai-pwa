import './globals.css';
import Link from 'next/link';
import ServiceWorkerRegister from '../components/ServiceWorkerRegister';
import ThemeToggle from '../components/ThemeToggle';

export const metadata = {
  title: '株主優待管理アプリ YutaiGO',
  description: '端末ローカル保存で動く趣味向けPWA',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{const t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(_){}
          `}}
        />
      </head>
      <body className="min-h-dvh bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-50">
        <nav className="sticky top-0 z-40 flex items-center gap-3 border-b border-gray-200 bg-white/70 px-4 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-900/70">
          <div className="flex-1">
            <Link href="/" className="font-semibold">YutaiGO</Link>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="rounded-md px-2 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800">ホーム</Link>
            <Link href="/holdings" className="rounded-md px-2 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800">優待券</Link>
            <Link href="/map" className="rounded-md px-2 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800">マップ</Link>
            <Link href="/settings" className="rounded-md px-2 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800">設定</Link>
            <ThemeToggle />
          </div>
        </nav>
        <main className="mx-auto max-w-screen-lg p-4">
          {children}
        </main>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

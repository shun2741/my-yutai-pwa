import './globals.css';
import Link from 'next/link';
import ServiceWorkerRegister from '../components/ServiceWorkerRegister';
import ThemeToggle from '../components/ThemeToggle';
import { Inter } from 'next/font/google';
import { Noto_Sans_JP } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const noto = Noto_Sans_JP({ subsets: ['latin'], weight: ['400','600','700'], variable: '--font-noto' });

export const metadata = {
  title: '株主優待管理アプリ YutaiGO',
  description: '端末ローカル保存で動く趣味向けPWA',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${inter.variable} ${noto.variable}`}>
      <head>
        <link rel="manifest" href={(process.env.NEXT_PUBLIC_BASE_PATH || '') + '/manifest.webmanifest'} />
        <meta name="theme-color" content="#2563EB" />
        <link rel="apple-touch-icon" sizes="180x180" href={(process.env.NEXT_PUBLIC_BASE_PATH || '') + '/icons/icon-192.png'} />
        <link rel="icon" type="image/png" sizes="32x32" href={(process.env.NEXT_PUBLIC_BASE_PATH || '') + '/icons/icon-192.png'} />
        <link rel="icon" type="image/png" sizes="192x192" href={(process.env.NEXT_PUBLIC_BASE_PATH || '') + '/icons/icon-192.png'} />
        {/* Expose Mapbox public config for runtime fallback (static export safe) */}
        {process.env.NEXT_PUBLIC_MAPBOX_TOKEN ? (
          <>
            <meta name="mb-token" content={process.env.NEXT_PUBLIC_MAPBOX_TOKEN} />
            <meta name="mb-style" content={process.env.NEXT_PUBLIC_MAPBOX_STYLE || 'mapbox/streets-v12'} />
          </>
        ) : null}
        {/* Optional runtime config (generated into /out by CI): */}
        <script defer src={(process.env.NEXT_PUBLIC_BASE_PATH || '') + '/mb-config.js'} />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{const t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(_){}
          `}}
        />
      </head>
      <body className="min-h-dvh bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-50">
        <nav className="sticky top-0 z-40 flex items-center gap-3 border-b border-gray-200 bg-white/70 px-4 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-900/70">
          <div className="flex-1">
            <Link href="/" className="inline-flex items-center gap-2 font-semibold text-brand-600">
              YutaiGO
            </Link>
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

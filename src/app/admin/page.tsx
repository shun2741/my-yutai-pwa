export default function AdminIndex() {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">管理者メニュー</h1>
      <ul className="list-disc pl-6">
        <li>
          <a className="text-blue-600 hover:underline" href="/admin/catalog">カタログ管理（企業/チェーン/店舗）</a>
        </li>
      </ul>
      <p className="text-sm text-gray-600 dark:text-gray-400">このページは管理用です。通常のユーザーには案内しないでください。</p>
    </div>
  );
}


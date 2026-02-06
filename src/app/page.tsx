import { Shield } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <main className="flex flex-col items-center gap-8 px-6 text-center">
        <div className="flex items-center gap-3">
          <Shield className="h-12 w-12 text-zinc-800 dark:text-zinc-200" />
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Surety
          </h1>
        </div>
        <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
          家庭风险管理急救包。本地运行，数据不离机。
        </p>
        <div className="flex gap-4">
          <span className="rounded-full bg-zinc-200 px-4 py-2 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            极简
          </span>
          <span className="rounded-full bg-zinc-200 px-4 py-2 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            本地化
          </span>
          <span className="rounded-full bg-zinc-200 px-4 py-2 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            隐私安全
          </span>
        </div>
      </main>
    </div>
  );
}

import Link from "next/link";
import { exitViewAs } from "@/lib/admin/actions";
import type { Session } from "next-auth";

/** Sticky banner while an admin is previewing candidate/employer UI. */
export function ViewAsBanner({ session }: { session: Session }) {
  const meta = session.user.viewAs;
  if (!meta) return null;

  const roleJa = meta.as === "candidate" ? "候補者" : "企業";
  const home = meta.as === "candidate" ? "/me" : "/portal";

  return (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
        <p>
          <span className="font-semibold">プレビュー中</span>
          {" — "}
          {roleJa}として表示中:{" "}
          <span className="font-mono">{meta.label}</span>
          <span className="text-amber-800">
            {" "}
            （読み取り専用・変更はできません）
          </span>
        </p>
        <div className="flex items-center gap-3">
          <Link href={home} className="underline hover:no-underline">
            {meta.as === "candidate" ? "候補者ホーム" : "企業ポータル"}
          </Link>
          <Link href="/admin" className="underline hover:no-underline">
            管理画面
          </Link>
          <form action={exitViewAs}>
            <button
              type="submit"
              className="rounded-md bg-amber-800 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-900"
            >
              プレビュー終了
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

import { requireCandidate } from "@/lib/auth/helpers";
import { getD1Db } from "@/lib/db/client";
import { getCandidateByUserId } from "@/lib/candidate/profile";
import { addLink, deleteLink } from "@/lib/candidate/actions";

const inputCls =
  "w-full rounded-md border border-line px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

const KIND_LABEL: Record<string, string> = {
  linkedin: "LinkedIn",
  github: "GitHub",
  portfolio: "Portfolio",
  website: "Website",
  other: "Other",
};

export default async function LinksPage() {
  const session = await requireCandidate();
  const db = await getD1Db();
  const candidate = await getCandidateByUserId(db, session.user.id);
  const links = candidate?.links ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Links</h1>
        <p className="mt-1 text-sm text-muted">
          LinkedIn, GitHub, portfolio, and more.
        </p>
      </div>

      <div className="space-y-2">
        {links.length === 0 && (
          <p className="text-sm text-muted">No links added yet.</p>
        )}
        {links.map((l) => (
          <div key={l.id} className="card flex items-center justify-between p-4">
            <div className="min-w-0">
              <span className="rounded bg-surface-2 px-2 py-0.5 text-xs text-frog-dark">
                {KIND_LABEL[l.kind] ?? l.kind}
              </span>
              <span className="ml-2 truncate text-sm text-ink">
                {l.label ?? l.url}
              </span>
            </div>
            <form action={deleteLink}>
              <input type="hidden" name="id" value={l.id} />
              <button className="text-xs text-danger hover:underline">Delete</button>
            </form>
          </div>
        ))}
      </div>

      <form action={addLink} className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-end">
        <label className="block sm:w-40">
          <span className="mb-1 block text-sm font-medium text-ink">Type</span>
          <select name="kind" defaultValue="linkedin" className={inputCls}>
            <option value="linkedin">LinkedIn</option>
            <option value="github">GitHub</option>
            <option value="portfolio">Portfolio</option>
            <option value="website">Website</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="block flex-1">
          <span className="mb-1 block text-sm font-medium text-ink">URL</span>
          <input name="url" type="url" placeholder="https://" required className={inputCls} />
        </label>
        <label className="block sm:w-48">
          <span className="mb-1 block text-sm font-medium text-ink">Label (optional)</span>
          <input name="label" className={inputCls} />
        </label>
        <button type="submit" className="btn-primary px-6 py-2.5">
          Add
        </button>
      </form>
    </div>
  );
}

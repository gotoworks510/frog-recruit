import { requireCandidate } from "@/lib/auth/helpers";
import { getD1Db } from "@/lib/db/client";
import { getCandidateByUserId } from "@/lib/candidate/profile";
import { addExperience, deleteExperience } from "@/lib/candidate/actions";
import { formatRange } from "@/lib/date";

const inputCls =
  "w-full rounded-md border border-line px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

export default async function ExperiencePage() {
  const session = await requireCandidate();
  const db = await getD1Db();
  const candidate = await getCandidateByUserId(db, session.user.id);
  const experiences = candidate?.experiences ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Experience</h1>
        <p className="mt-1 text-sm text-muted">
          Focus on recent work. Use bullet points to show what you solved and the impact you made.
        </p>
      </div>

      <div className="space-y-3">
        {experiences.length === 0 && (
          <p className="text-sm text-muted">No work experience added yet.</p>
        )}
        {experiences.map((e) => (
          <div key={e.id} className="card flex items-start justify-between p-5">
            <div>
              <p className="font-semibold text-ink">
                {e.title} <span className="text-muted">@ {e.company}</span>
              </p>
              <p className="text-xs text-muted">
                {formatRange(e.startDate, e.endDate, e.isCurrent)}
                {e.location ? ` · ${e.location}` : ""}
              </p>
              {e.description && (
                <p className="mt-2 whitespace-pre-line text-sm text-ink">
                  {e.description}
                </p>
              )}
              {e.techStack && (
                <p className="mt-2 text-xs text-frog-dark">{e.techStack}</p>
              )}
            </div>
            <form action={deleteExperience}>
              <input type="hidden" name="id" value={e.id} />
              <button className="text-xs text-danger hover:underline">Delete</button>
            </form>
          </div>
        ))}
      </div>

      <form action={addExperience} className="card space-y-4 p-6">
        <h2 className="font-semibold text-ink">Add experience</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <input name="company" placeholder="Company *" required className={inputCls} />
          <input name="title" placeholder="Role / title *" required className={inputCls} />
          <input name="startDate" type="date" className={inputCls} />
          <input name="endDate" type="date" className={inputCls} />
          <input name="location" placeholder="Location" className={inputCls} />
          <select name="employmentType" defaultValue="" className={inputCls}>
            <option value="">Employment type</option>
            <option value="full_time">Full-time</option>
            <option value="contract">Contract</option>
            <option value="freelance">Freelance</option>
            <option value="internship">Internship</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="isCurrent" /> Current role
        </label>
        <textarea
          name="description"
          rows={3}
          placeholder="Achievements (bullet points recommended)"
          className={inputCls}
        />
        <input name="techStack" placeholder="Tech stack (e.g. Node.js, TypeScript, AWS)" className={inputCls} />
        <div className="flex justify-end">
          <button type="submit" className="btn-primary px-6 py-2.5">
            Add
          </button>
        </div>
      </form>
    </div>
  );
}

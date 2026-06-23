import { requireCandidate } from "@/lib/auth/helpers";
import { getD1Db } from "@/lib/db/client";
import { getCandidateByUserId } from "@/lib/candidate/profile";
import { uploadResume, removeResume } from "@/lib/candidate/actions";
import { formatDateTime } from "@/lib/date";

const ERRORS: Record<string, string> = {
  empty: "No file selected.",
  size: "The file is too large (10MB maximum).",
  type: "Only PDF files can be uploaded.",
};

export default async function ResumePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const session = await requireCandidate();
  const db = await getD1Db();
  const candidate = await getCandidateByUserId(db, session.user.id);
  const p = candidate?.profile;
  const { error, ok } = await searchParams;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Resume</h1>
        <p className="mt-1 text-sm text-muted">
          PDF only, 10MB maximum. When an employer views it, the resume is watermarked with the viewer and timestamp.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {ERRORS[error] ?? "Upload failed."}
        </div>
      )}
      {ok && (
        <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
          Upload complete.
        </div>
      )}

      <div className="card p-6">
        {p?.resumeKey ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-ink">{p.resumeFileName ?? "resume.pdf"}</p>
              <p className="text-xs text-muted">
                Uploaded: {formatDateTime(p.resumeUploadedAt)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="/api/profile/resume"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                View
              </a>
              <form action={removeResume}>
                <button className="text-sm text-danger hover:underline">Delete</button>
              </form>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">No resume uploaded yet.</p>
        )}
      </div>

      <form action={uploadResume} className="card space-y-4 p-6">
        <h2 className="font-semibold text-ink">
          {p?.resumeKey ? "Replace" : "Upload"}
        </h2>
        <input
          type="file"
          name="file"
          accept="application/pdf"
          required
          className="block w-full text-sm text-ink file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-[#3aa189]"
        />
        <div className="flex justify-end">
          <button type="submit" className="btn-primary px-6 py-2.5">
            Upload
          </button>
        </div>
      </form>
    </div>
  );
}

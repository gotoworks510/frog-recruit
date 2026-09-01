"use client";

import { useState } from "react";
import {
  INTEREST_OPTIONS,
  DECLINE_REASONS,
  type InterestLevel,
  type CandidateFeedbackData,
} from "@/lib/employer/feedback";

interface Props {
  candidateProfileId: string;
  candidateName: string;
  initial: CandidateFeedbackData | null;
  /** Server action (passed from the server component). */
  action: (formData: FormData) => void;
  saved?: boolean;
}

const textareaCls =
  "w-full rounded-md border border-line px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

/**
 * Low-friction employer feedback widget. One click on Interested / Maybe /
 * Not interested is enough; contextual fields (interview + questions, or
 * decline reasons) reveal inline. Submits to the saveCandidateFeedback action.
 */
export function CandidateFeedbackForm({
  candidateProfileId,
  candidateName,
  initial,
  action,
  saved,
}: Props) {
  const [interest, setInterest] = useState<InterestLevel | null>(
    initial?.interest ?? null
  );
  const [wantsInterview, setWantsInterview] = useState<boolean>(
    initial?.wantsInterview ?? false
  );
  const [reasons, setReasons] = useState<string[]>(
    initial?.declineReasons ?? []
  );

  const toggleReason = (code: string) =>
    setReasons((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );

  const positive = interest === "interested" || interest === "maybe";

  return (
    <form action={action} className="card p-6">
      <input type="hidden" name="candidateProfileId" value={candidateProfileId} />
      <input type="hidden" name="interest" value={interest ?? ""} />
      <input
        type="hidden"
        name="declineReasons"
        value={JSON.stringify(reasons)}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-ink">
          Your take on {candidateName}
        </h2>
        {saved ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-frog-dark">
            <CheckIcon /> Saved
          </span>
        ) : (
          initial?.updatedAt && (
            <span className="text-xs text-muted">
              Last saved {formatWhen(initial.updatedAt)}
            </span>
          )
        )}
      </div>
      <p className="mt-1 text-sm text-muted">
        Let Frog know where you stand — one click is enough, and you can update it
        anytime.
      </p>

      {/* Primary interest — big one-click buttons */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {INTEREST_OPTIONS.map((opt) => {
          const active = interest === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setInterest(opt.value)}
              aria-pressed={active}
              className={interestBtnCls(opt.value, active)}
            >
              <span className="block text-base font-semibold">{opt.label}</span>
              <span className="mt-0.5 block text-xs opacity-80">{opt.hint}</span>
            </button>
          );
        })}
      </div>

      {/* Contextual: interested / maybe */}
      {positive && (
        <div className="mt-5 space-y-4 border-t border-line pt-5">
          <label className="flex items-center gap-3 text-sm text-ink">
            <input
              type="checkbox"
              name="wantsInterview"
              value="1"
              checked={wantsInterview}
              onChange={(e) => setWantsInterview(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            <span className="font-medium">
              I&apos;d like to interview this candidate
            </span>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">
              Anything you&apos;d like us to ask, or more info you need?{" "}
              <span className="font-normal text-muted">(optional)</span>
            </span>
            <textarea
              name="questionsMd"
              rows={3}
              defaultValue={initial?.questionsMd ?? ""}
              placeholder="e.g. Ask about Python depth at scale; share notice period and comp expectations…"
              className={textareaCls}
            />
          </label>
        </div>
      )}

      {/* Contextual: not interested */}
      {interest === "not_interested" && (
        <div className="mt-5 space-y-4 border-t border-line pt-5">
          <div>
            <span className="mb-2 block text-sm font-medium text-ink">
              Help us learn why — select any that apply
            </span>
            <div className="flex flex-wrap gap-2">
              {DECLINE_REASONS.map((r) => {
                const on = reasons.includes(r.value);
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => toggleReason(r.value)}
                    aria-pressed={on}
                    className={`rounded-full border px-3 py-1.5 text-xs transition ${
                      on
                        ? "border-primary bg-primary text-white"
                        : "border-line bg-surface text-ink hover:border-primary"
                    }`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">
              Anything else?{" "}
              <span className="font-normal text-muted">(optional)</span>
            </span>
            <textarea
              name="declineNote"
              rows={2}
              defaultValue={initial?.declineNote ?? ""}
              placeholder="A sentence on what would have made this a yes helps us send better matches."
              className={textareaCls}
            />
          </label>
        </div>
      )}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          disabled={!interest}
          className="btn-primary px-6 py-2.5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {initial ? "Update" : "Submit"} feedback
        </button>
        {!interest && (
          <span className="text-xs text-muted">
            Pick an option above to continue.
          </span>
        )}
      </div>
    </form>
  );
}

function interestBtnCls(value: InterestLevel, active: boolean): string {
  const base = "rounded-xl border px-4 py-3 text-left transition";
  if (!active) {
    return `${base} border-line bg-surface text-ink hover:border-primary hover:bg-surface-2`;
  }
  switch (value) {
    case "interested":
      return `${base} border-emerald-500 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500`;
    case "maybe":
      return `${base} border-amber-500 bg-amber-50 text-amber-800 ring-1 ring-amber-500`;
    case "not_interested":
      return `${base} border-red-400 bg-red-50 text-red-700 ring-1 ring-red-400`;
    default:
      return base;
  }
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function formatWhen(d: Date): string {
  try {
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

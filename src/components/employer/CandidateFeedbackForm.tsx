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
    <form action={action} className="card p-5 shadow-sm sm:p-6">
      <input type="hidden" name="candidateProfileId" value={candidateProfileId} />
      <input type="hidden" name="interest" value={interest ?? ""} />
      <input
        type="hidden"
        name="declineReasons"
        value={JSON.stringify(reasons)}
      />

      <p className="label-caps">Your next step</p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-lg font-semibold text-ink">
          Would you like to connect?
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
        Share your take with Frog after reviewing this introduction
        {candidateName ? ` for ${candidateName}` : ""}.
      </p>

      <fieldset className="mt-5 space-y-2">
        <legend className="mb-2 text-sm font-medium text-ink">
          Your feedback
        </legend>
        {INTEREST_OPTIONS.map((opt) => {
          const active = interest === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setInterest(opt.value)}
              aria-pressed={active}
              className={`flex w-full flex-col rounded-lg border px-4 py-3 text-left transition ${
                active
                  ? "border-brand bg-mint ring-1 ring-brand"
                  : "border-line bg-paper hover:border-brand/40"
              }`}
            >
              <span className="text-sm font-semibold text-ink">{opt.label}</span>
              <span className="mt-0.5 text-xs text-muted">{opt.hint}</span>
            </button>
          );
        })}
      </fieldset>

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
              className="h-4 w-4 accent-brand"
            />
            <span className="font-medium">
              I&apos;d like to interview this candidate
            </span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">
              Anything you&apos;d like us to ask, or more info you need?{" "}
              <span className="font-normal text-muted">(optional)</span>
            </span>
            <textarea
              name="questionsMd"
              rows={3}
              defaultValue={initial?.questionsMd ?? ""}
              placeholder="e.g. Ask about Python depth at scale; share notice period and comp expectations…"
              className="input-field"
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
                        ? "border-brand bg-brand text-white"
                        : "border-line bg-surface text-ink hover:border-brand"
                    }`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">
              Anything else?{" "}
              <span className="font-normal text-muted">(optional)</span>
            </span>
            <textarea
              name="declineNote"
              rows={2}
              defaultValue={initial?.declineNote ?? ""}
              placeholder="A sentence on what would have made this a yes helps us send better matches."
              className="input-field"
            />
          </label>
        </div>
      )}

      <div className="mt-5 space-y-2">
        <button
          type="submit"
          disabled={!interest}
          className="btn-primary w-full px-6 py-2.5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {initial ? "Update feedback" : "Submit feedback"}
        </button>
        <p className="text-center text-xs text-muted">
          {!interest
            ? "Pick an option above to continue."
            : "You can update your feedback at any time."}
        </p>
      </div>
    </form>
  );
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

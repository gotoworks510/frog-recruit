import { Logo } from "@/components/brand/Logo";

export default function RejectedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md rounded-2xl bg-paper p-8 text-center shadow-sm ring-1 ring-line">
        <div className="mb-6 flex justify-center">
          <Logo variant="green" height={36} />
        </div>
        <h1 className="text-xl font-bold text-ink">Access unavailable</h1>
        <p className="mt-3 text-sm text-muted">
          This account is currently not available for use. Please contact your Frog
          representative for details.
        </p>
      </div>
    </div>
  );
}

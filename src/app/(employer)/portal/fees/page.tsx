import Link from "next/link";
import { requireEmployerReady } from "@/lib/employer/guard";
import { FeeSchedule } from "@/components/employer/FeeSchedule";

export default async function EmployerFeesPage() {
  await requireEmployerReady();

  return (
    <div className="space-y-6">
      <Link
        href="/portal"
        className="text-sm font-medium text-muted transition hover:text-ink"
      >
        ← Back to introductions
      </Link>
      <FeeSchedule variant="full" />
    </div>
  );
}

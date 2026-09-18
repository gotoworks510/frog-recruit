import { requireMobile } from "@/lib/api/v1/require-mobile";
import { deleteLinkCore } from "@/lib/candidate/profile-core";
import { jsonOk, notFound } from "@/lib/api/v1/errors";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireMobile(request, {
    role: "candidate",
    mutation: true,
  });
  if (error) return error;

  const { id } = await params;
  const result = await deleteLinkCore(ctx.db, ctx.user.id, id);
  if (!result.ok) return notFound("That link was not found.");
  return jsonOk({ ok: true });
}

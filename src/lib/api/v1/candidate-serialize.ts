import type { candidateExperiences, candidateLinks } from "@/lib/db/schema";

export function serializeExperience(
  e: typeof candidateExperiences.$inferSelect
) {
  return {
    id: e.id,
    company: e.company,
    title: e.title,
    employmentType: e.employmentType,
    startDate: e.startDate ? e.startDate.toISOString() : null,
    endDate: e.endDate ? e.endDate.toISOString() : null,
    isCurrent: e.isCurrent,
    location: e.location,
    description: e.description,
    techStack: e.techStack,
    sortOrder: e.sortOrder,
  };
}

export function serializeLink(l: typeof candidateLinks.$inferSelect) {
  return {
    id: l.id,
    kind: l.kind,
    url: l.url,
    label: l.label,
    sortOrder: l.sortOrder,
  };
}

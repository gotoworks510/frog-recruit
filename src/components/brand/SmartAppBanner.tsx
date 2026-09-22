import { APP_STORE, type AppStoreVariant } from "@/lib/apps/app-store";

/**
 * Safari Smart App Banner. Rendered as a <meta> from a Server Component
 * (Next.js hoists it into <head>). Prefer this over metadata.other so a
 * child page's `other` export cannot wipe the banner.
 */
export function SmartAppBanner({ variant }: { variant: AppStoreVariant }) {
  return (
    <meta
      name="apple-itunes-app"
      content={`app-id=${APP_STORE[variant].id}`}
    />
  );
}

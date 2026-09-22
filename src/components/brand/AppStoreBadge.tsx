import Image from "next/image";
import {
  APP_STORE,
  type AppStoreVariant,
} from "@/lib/apps/app-store";

type BadgeTone = "black" | "white";

interface AppStoreBadgeProps {
  variant: AppStoreVariant;
  /** Black for light backgrounds; white for dark brand surfaces. */
  tone?: BadgeTone;
  /** Display height in CSS pixels (Apple badge aspect ~3:1). */
  height?: number;
  className?: string;
}

const BADGE_SRC: Record<BadgeTone, string> = {
  black: "/brand/download-on-the-app-store-black.svg",
  white: "/brand/download-on-the-app-store-white.svg",
};

/** Official “Download on the App Store” badge linking to the listing. */
export function AppStoreBadge({
  variant,
  tone = "black",
  height = 40,
  className = "",
}: AppStoreBadgeProps) {
  const app = APP_STORE[variant];
  // Official artwork viewBox ≈ 119.66 × 40
  const width = Math.round(height * (119.66407 / 40));

  return (
    <a
      href={app.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-block transition opacity-95 hover:opacity-100 ${className}`}
      aria-label={`Download ${app.name} on the App Store`}
    >
      <Image
        src={BADGE_SRC[tone]}
        alt=""
        width={width}
        height={height}
        className="h-auto"
        unoptimized
      />
    </a>
  );
}

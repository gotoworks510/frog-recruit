import Image from "next/image";

interface LogoProps {
  /** "green" for light backgrounds, "white" for dark backgrounds. */
  variant?: "green" | "white";
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Frog corporate logo, sourced unchanged from frogagent.com's header asset.
 * Recruit is not a School service; never use the graduation-cap School mark here.
 */
export function Logo({
  variant = "green",
  width = 132,
  height = 40,
  className,
}: LogoProps) {
  const src = "/brand/logo-frog-corporate.png";
  return (
    <Image
      src={src}
      alt="Frog"
      width={width}
      height={height}
      className={className}
      priority
      style={{ height, width: "auto", maxWidth: width, objectFit: "contain", filter: variant === "white" ? "brightness(0) invert(1)" : undefined }}
    />
  );
}

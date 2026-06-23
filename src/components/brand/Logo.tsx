import Image from "next/image";

interface LogoProps {
  /** "green" for light backgrounds, "white" for dark backgrounds. */
  variant?: "green" | "white";
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Official Frog wordmark (graduation-cap frog + "Frog"). NEVER substitute a 🐸
 * emoji or a generic frog icon — see root CLAUDE.md brand rule.
 */
export function Logo({
  variant = "green",
  width = 132,
  height = 40,
  className,
}: LogoProps) {
  const src =
    variant === "white" ? "/brand/logo-frog-w.png" : "/brand/logo-frog-green.png";
  return (
    <Image
      src={src}
      alt="Frog"
      width={width}
      height={height}
      className={className}
      priority
      style={{ height: "auto", width: "auto", maxHeight: height }}
    />
  );
}

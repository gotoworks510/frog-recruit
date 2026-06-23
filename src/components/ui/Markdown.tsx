import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders a Markdown string (bullets, bold, headings, links) as styled HTML.
 * Used for Frog's recommendation strengths/considerations so they read cleanly.
 * Text color/size is inherited from the wrapper via `className`.
 */
export function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={`md ${className ?? ""}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}

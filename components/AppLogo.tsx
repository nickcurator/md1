import { FileText } from "lucide-react";

export default function AppLogo({
  iconSize = 18,
  showLabel = true,
  labelClassName = "text-sm font-semibold tracking-tight",
  className = "",
}: {
  iconSize?: number;
  showLabel?: boolean;
  labelClassName?: string;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <FileText
        size={iconSize}
        strokeWidth={2.25}
        className="shrink-0"
        aria-hidden
      />
      {showLabel && <span className={labelClassName}>md1</span>}
    </span>
  );
}

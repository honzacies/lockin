import { Rocket } from "lucide-react";

interface ProjectIconProps {
  icon?: string | null;
  size?: number;
  className?: string;
}

/** Renders a project's icon — an uploaded image (data URL), an emoji, or the
 * default Rocket when no custom icon has been set. */
export function ProjectIcon({ icon, size = 20, className }: ProjectIconProps) {
  if (icon?.startsWith("data:")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- small inline data-URL avatar, next/image is overkill here
      <img
        src={icon}
        alt=""
        className={`shrink-0 rounded-md object-cover ${className ?? ""}`}
        style={{ width: size, height: size }}
      />
    );
  }
  if (icon) {
    return (
      <span
        className={`shrink-0 leading-none ${className ?? ""}`}
        style={{ fontSize: size * 0.85 }}
      >
        {icon}
      </span>
    );
  }
  return (
    <Rocket
      size={size}
      strokeWidth={1.5}
      className={`shrink-0 text-[#91918e] ${className ?? ""}`}
    />
  );
}

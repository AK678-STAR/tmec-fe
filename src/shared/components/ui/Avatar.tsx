import { cx } from "@/shared/lib/cx";
import { useState } from "react";
import { initials } from "@/shared/lib/format";
import styles from "./Avatar.module.css";

interface AvatarProps {
  name: string;
  url?: string | null;
  size?: number;
  tone?: "brand" | "neutral";
}

export function Avatar({ name, url, size = 36, tone = "brand" }: AvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string>();
  return (
    <span
      title={name}
      className={cx(styles.avatar, styles[tone])}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.3) }}
      aria-hidden="true"
    >
      {url && failedUrl !== url
        ? <img src={url} alt="" onError={() => setFailedUrl(url)} />
        : initials(name)}
    </span>
  );
}

import type { ReactNode } from "react";
import { Children } from "react";
import { cx } from "@/shared/lib/cx";
import { Icon } from "./Icon";
import styles from "./KpiTile.module.css";
import { trNode } from "@/shared/i18n/tr";

interface KpiTileProps {
  label: string;
  value: string | number;
  unit?: string;
  caption?: string;
  icon?: string;
  /** bad: tô đỏ dù tăng (vd. nợ quá hạn tăng là xấu). */
  trend?: { dir: "up" | "down"; value: string; bad?: boolean };
  /** Bấm ô để mở chi tiết (vd. lọc bảng theo chỉ số này). */
  onClick?: () => void;
  active?: boolean;
  accent?: boolean; // Nhấn chỉ số bằng màu thông tin, không dùng màu lỗi.
}

// Ô chỉ số (KPI) trên dashboard: nhãn, số lớn, đơn vị, chú thích và xu hướng.
export function KpiTile({ label, value, unit, caption, icon, trend, accent, onClick, active }: KpiTileProps) {
  return (
    <div
      className={cx(styles.tile, onClick && styles.clickable, active && styles.active)}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-pressed={onClick ? Boolean(active) : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
    >
      <div className={styles.head}>
        <span className={styles.label}>{trNode(label)}</span>
        {icon && (
          <span className={styles.icon}>
            <Icon name={icon} size={16} />
          </span>
        )}
      </div>
      <div className={styles.valueRow}>
        <strong className={cx(styles.value, accent && styles.accent)}>{value}</strong>
        {unit && <span className={styles.unit}>{unit}</span>}
      </div>
      {(caption || trend) && (
        <p className={styles.caption}>
          {trend && (
            <span className={cx(styles.trend, (trend.bad ?? trend.dir === "down") && styles.down)}>
              {/* Bộ icon chỉ có "trend" (mũi tên đi lên); xu hướng giảm thì lật hình. */}
              <span className={cx(trend.dir === "down" && styles.flip)}>
                <Icon name="trend" size={12} />
              </span>
              {trend.value}
            </span>
          )}
          {trNode(caption)}
        </p>
      )}
    </div>
  );
}

// Hàng các KpiTile chia đều cột, ngăn cách bằng đường kẻ.
export function KpiRow({ children }: { children: ReactNode }) {
  const items = Children.toArray(children);
  return (
    <div className={styles.row} style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((child, i) => (
        <div key={i} className={styles.cell}>
          {child}
        </div>
      ))}
    </div>
  );
}

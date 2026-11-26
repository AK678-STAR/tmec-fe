import React from "react";
import { Icon } from "@/shared/components/ui/Icon";
import { Badge } from "@/shared/components/ui/Badge";
import { evaluateReadiness } from "../lib/readiness";
import type { ReadinessCriteria } from "../lib/readiness";

interface Props {
  criteria: ReadinessCriteria;
}

export function ReadinessChecklistWidget({ criteria }: Props) {
  const items = [
    {
      label: "1. Y tế & Thể trạng",
      ok: criteria.healthOk,
      details: criteria.healthDetails,
    },
    {
      label: "2. Tiến độ giáo án",
      ok: criteria.planOk,
      details: criteria.planDetails,
    },
    {
      label: "3. Điểm phong độ chạy thử",
      ok: criteria.scoreOk,
      details: criteria.scoreDetails,
    },
    {
      label: "4. An toàn tải trọng 7 ngày",
      ok: criteria.loadOk,
      details: criteria.loadDetails,
    },
  ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        background: "var(--surface-sunken)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "1rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 600, fontSize: "var(--fs-body)", color: "var(--text)" }}>
          Bảng thẩm định tiêu chuẩn thi đấu:
        </span>
        <Badge tone={criteria.isEligible ? "ok" : "warn"}>
          {criteria.isEligible ? "⭐ Đủ chuẩn thi đấu (4/4)" : `⚠️ Đạt ${criteria.passedCount}/4 tiêu chuẩn`}
        </Badge>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {items.map((it, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.6rem",
              fontSize: "var(--fs-caption)",
              padding: "0.4rem 0.5rem",
              borderRadius: "4px",
              background: it.ok ? "rgba(16, 185, 129, 0.08)" : "rgba(239, 68, 68, 0.08)",
              border: `1px solid ${it.ok ? "rgba(16, 185, 129, 0.25)" : "rgba(239, 68, 68, 0.25)"}`,
            }}
          >
            <span style={{ color: it.ok ? "var(--ok)" : "var(--danger)", marginTop: "1px" }}>
              <Icon name={it.ok ? "check" : "x"} size={14} />
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: "var(--text)" }}>{it.label}</div>
              <div style={{ color: "var(--text-muted)", marginTop: "2px" }}>{it.details}</div>
            </div>
          </div>
        ))}
      </div>

      {!criteria.isEligible && (
        <div style={{ fontSize: "12px", color: "var(--warn)", fontStyle: "italic", marginTop: "2px" }}>
          💡 Lưu ý HLV trưởng: Chiến mã chưa thỏa mãn đầy đủ các chỉ số an toàn. Bạn vẫn có thể tiếp tục nếu đã thẩm định chuyên môn thực địa.
        </div>
      )}
    </div>
  );
}

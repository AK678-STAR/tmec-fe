import { useState, useEffect } from "react";
import { Badge } from "@/shared/components/ui/Badge";
import { Icon } from "@/shared/components/ui/Icon";
import { getBarnStaffing, type BarnStaffingItem } from "@/features/accounts/api";

interface BarnLeadershipBannerProps {
  zoneId: string;
  zoneName: string;
}

export function BarnLeadershipBanner({ zoneId, zoneName }: BarnLeadershipBannerProps) {
  const [barnStaffing, setBarnStaffing] = useState<BarnStaffingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getBarnStaffing()
      .then((data) => {
        if (active) setBarnStaffing(data.barns || []);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const barn = barnStaffing.find((b) => b.id === zoneId || b.name === zoneName);
  const trainers = barn?.trainers || [];
  const trainersCount = trainers.length;
  const maxTrainers = barn?.maxTrainers || 2;

  if (loading) {
    return null;
  }

  return (
    <div
      style={{
        background: "var(--surface, #ffffff)",
        border: "1px solid var(--border, #cbd5e1)",
        borderRadius: "12px",
        padding: "14px 18px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
      }}
    >
      {/* Hàng 1: Tiêu đề Barn & Định mức HLV */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "6px",
              background: "rgba(37, 99, 235, 0.1)",
              color: "var(--brand, #2563eb)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="users" size={17} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "14.5px", fontWeight: 700, color: "var(--ink)" }}>
              Ban Huấn Luyện Phụ Trách: {barn?.name || zoneName || "Khu chuồng"}
            </h3>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Định mức tối đa 2 Huấn luyện viên trưởng trên một Khu chuồng (Barn)
            </span>
          </div>
        </div>

        <div>
          {trainersCount >= maxTrainers ? (
            <Badge tone="ok">{trainersCount}/{maxTrainers} HLV [Đã đủ định mức]</Badge>
          ) : trainersCount > 0 ? (
            <Badge tone="warn">{trainersCount}/{maxTrainers} HLV [Còn {maxTrainers - trainersCount} suất HLV]</Badge>
          ) : (
            <Badge tone="danger">0/{maxTrainers} HLV [Chưa có HLV phụ trách]</Badge>
          )}
        </div>
      </div>

      {/* Hàng 2: Danh sách Thẻ HLV của Barn */}
      {trainers.length === 0 ? (
        <div
          style={{
            fontSize: "13px",
            color: "var(--text-muted)",
            background: "var(--surface-sunken, #f8fafc)",
            padding: "10px 14px",
            borderRadius: "8px",
            border: "1px dashed var(--border)",
          }}
        >
          Khu chuồng này hiện chưa được phân công Huấn luyện viên trưởng. Quản lý có thể gán HLV tại trang Quản lý tài khoản.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "10px" }}>
          {trainers.map((t) => {
            const load = t.currentLoad ?? 0;
            const max = t.maxCapacity ?? 8;
            const isFull = load >= max;

            return (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: isFull ? "rgba(239, 68, 68, 0.04)" : "var(--surface-sunken, #f8fafc)",
                  border: isFull ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid var(--border-subtle, #e2e8f0)",
                  borderRadius: "8px",
                  padding: "10px 14px",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Icon name="user" size={14} />
                    <strong style={{ fontSize: "13.5px", color: "var(--ink)" }}>{t.fullName}</strong>
                  </div>
                  <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "2px" }}>
                    {t.email}
                  </div>
                </div>

                <div>
                  {isFull ? (
                    <Badge tone="danger">Tải: {load}/{max} con [Đầy]</Badge>
                  ) : (
                    <Badge tone="ok">Tải: {load}/{max} con [Còn {max - load} chỗ]</Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

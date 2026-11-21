import { useState, useEffect } from "react";
import { Icon } from "@/shared/components/ui/Icon";
import { Modal } from "@/shared/components/ui/Modal";
import { Button } from "@/shared/components/ui/Button";
import { Badge } from "@/shared/components/ui/Badge";
import { SearchSelect } from "@/shared/components/form/SearchSelect";
import { isVietnamese, localizeServerText, tr } from "@/shared/i18n/tr";
import { useAppLanguage } from "@/shared/lib/language";
import { useCurrentUser } from "@/shared/components/layout/AuthProvider";
import { fetchEligibility, registerHorseForRace, scratchHorseFromRace, fetchTournamentDetail } from "../api";
import { vndUnit } from "@/shared/lib/format";
import type { EligibilityResponse, Tournament } from "../types";

function formatIneligibleReason(reason: string, isVi: boolean): string {
  if (!isVi) return reason;

  // 1. Khóa y tế
  if (/veterinary medical lock/i.test(reason)) {
    return "Đang bị Khóa y tế thú y (Cấm xuất chuồng / Cấm thi đấu)";
  }

  // 1b. Lưu giữ do nợ phí
  if (/debt impound|overdue payment/i.test(reason)) {
    return "Đang bị Lưu giữ do nợ phí quá hạn (Cấm thi đấu / Cấm chuyển nhượng)";
  }

  // 2. Trạng thái sức khỏe
  if (/Horse health status is (currently\s+)?(\w+)/i.test(reason)) {
    const match = reason.match(/Horse health status is (currently\s+)?(\w+)/i);
    const code = match ? match[2].toUpperCase() : "";
    const map: Record<string, string> = {
      ISOLATED: "Đang cách ly kiểm dịch y tế (ISOLATED)",
      INJURED: "Đang điều trị chấn thương (INJURED)",
      UNDER_OBSERVATION: "Đang theo dõi sức khỏe đặc biệt (UNDER_OBSERVATION)",
      SICK: "Đang bị bệnh / trị liệu (SICK)",
      RESTING: "Đang nghỉ dưỡng phục hồi (RESTING)",
      RETIRED: "Đã giải nghệ (RETIRED)",
    };
    return `Tình trạng sức khỏe: ${map[code] || code}`;
  }

  // 3. Thiếu số buổi tập gần đây
  const workoutMatch = reason.match(/Insufficient recent training sessions \((\d+)\/(\d+) required in past (\d+) days\)/i);
  if (workoutMatch) {
    const [, curr, req, days] = workoutMatch;
    return `Chưa đủ thể lực thi đấu (Mới hoàn thành ${curr}/${req} buổi tập yêu cầu trong ${days} ngày qua)`;
  }

  if (/insufficient recent training/i.test(reason)) {
    return "Chưa hoàn thành đủ các bài tập chuẩn bị thi đấu";
  }

  return reason;
}

interface RaceRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournament: Tournament;
  onSuccess: () => void;
}

export function RaceRegistrationModal({
  isOpen,
  onClose,
  tournament,
  onSuccess,
}: RaceRegistrationModalProps) {
  useAppLanguage();
  const currentUser = useCurrentUser();
  const canManageScratch =
    currentUser.role === "CLUB_MANAGER" || currentUser.role === "HEAD_TRAINER";
  const [currentTournament, setCurrentTournament] = useState<Tournament>(tournament);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<EligibilityResponse | null>(null);
  const [selectedHorseIds, setSelectedHorseIds] = useState<string[]>([]);
  const toggleHorse = (id: string) =>
    setSelectedHorseIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const [notes, setNotes] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  // Scratch states
  const [scratchingRegId, setScratchingRegId] = useState<string | null>(null);
  const [scratchReason, setScratchReason] = useState<string>("");
  const [scratchSubmitting, setScratchSubmitting] = useState(false);

  useEffect(() => {
    if (tournament) {
      setCurrentTournament(tournament);
    }
  }, [tournament]);

  useEffect(() => {
    if (isOpen && tournament) {
      loadEligibility();
    }
  }, [isOpen, tournament]);

  async function loadEligibility() {
    setLoading(true);
    setError(null);
    try {
      const [res, fresh] = await Promise.all([
        fetchEligibility(tournament.id),
        fetchTournamentDetail(tournament.id).catch(() => tournament),
      ]);
      setData(res);
      if (fresh) setCurrentTournament(fresh);

      // Giữ các ngựa đang chọn còn hợp lệ; không tự chọn sẵn khi đăng ký nhiều ngựa.
      const available = new Set(res.eligible.filter((h) => !h.isRegistered).map((h) => h.id));
      setSelectedHorseIds((cur) => cur.filter((id) => available.has(id)));
    } catch (err: any) {
      setError(localizeServerText(err?.message) || tr("Failed to load race eligibility"));
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    if (selectedHorseIds.length === 0) {
      setError(tr("Please select an eligible horse to register"));
      return;
    }

    setSubmitting(true);
    setError(null);
    // Đăng ký lần lượt để BE kiểm tra từng ngựa; ngựa lỗi được báo lại, ngựa thành công vẫn giữ.
    const failed: string[] = [];
    let okCount = 0;
    for (const horseId of selectedHorseIds) {
      try {
        await registerHorseForRace(tournament.id, horseId, notes.trim());
        okCount++;
      } catch (err: any) {
        const name = data?.eligible.find((h) => h.id === horseId)?.name ?? horseId;
        failed.push(`${name}: ${localizeServerText(err?.message) || tr("Failed to register horse for tournament")}`);
      }
    }
    setSubmitting(false);
    if (okCount > 0) onSuccess();
    if (failed.length === 0) {
      onClose();
      return;
    }
    setError(failed.join("\n"));
    await loadEligibility();
  }

  async function handleScratch(regId: string) {
    if (!scratchReason.trim()) {
      setError(isVietnamese() ? "Lý do rút ngựa là bắt buộc" : tr("Scratch reason is required"));
      return;
    }

    setScratchSubmitting(true);
    setError(null);
    try {
      await scratchHorseFromRace(tournament.id, regId, scratchReason.trim());
      setScratchingRegId(null);
      setScratchReason("");
      onSuccess();
      await loadEligibility();
    } catch (err: any) {
      setError(localizeServerText(err?.message) || tr("Failed to scratch horse"));
    } finally {
      setScratchSubmitting(false);
    }
  }

  if (!isOpen) return null;

  const isClosed = currentTournament.status === "CLOSED_REGISTRATION";
  const isOpenReg = currentTournament.status === "OPEN_REGISTRATION";
  const registrations = currentTournament.registrations || [];
  const activeRegistrations = registrations.filter((r) => r.status !== "SCRATCHED_MEDICAL");

  return (
    <Modal
      title={
        isClosed
          ? (isVietnamese() ? "Quản lý danh sách thi đấu & Rút ngựa" : tr("Manage Entries & Scratch"))
          : tr("Register Horse for Tournament")
      }
      subtitle={`${currentTournament.name} · ${currentTournament.distanceMeters}m (${tr(currentTournament.trackType)})${currentTournament.entryFee ? ` · ${isVietnamese() ? "Phí:" : "Fee:"} ${Number(currentTournament.entryFee).toLocaleString("vi-VN")} ${vndUnit()}` : ""}`}
      width={720}
      onClose={onClose}
      foot={
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", flexWrap: "wrap", gap: "0.5rem" }}>
          <span style={{ fontSize: "var(--fs-xs, 0.75rem)", color: "var(--muted)" }}>
            {tr("Deadline:")} {new Date(currentTournament.registrationDeadline).toLocaleDateString()}
          </span>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            {isClosed ? (
              <Button tone="primary" onClick={onClose}>
                {tr("Close")}
              </Button>
            ) : (
              <>
                <Button tone="secondary" onClick={onClose} disabled={submitting}>
                  {tr("Cancel")}
                </Button>
                <Button
                  tone="primary"
                  onClick={handleRegister}
                  disabled={submitting || selectedHorseIds.length === 0 || !isOpenReg}
                >
                  {submitting
                    ? tr("Registering...")
                    : `${tr("Confirm Registration")}${selectedHorseIds.length > 1 ? ` (${selectedHorseIds.length})` : ""}`}
                </Button>
              </>
            )}
          </div>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {error && (
          <div
            style={{
              padding: "0.75rem 1rem",
              background: "var(--danger-bg, #fef2f2)",
              color: "var(--danger, #dc2626)",
              borderRadius: "var(--r-sm, 6px)",
              fontSize: "var(--fs-sm, 0.875rem)",
              border: "1px solid var(--danger-border, #fecaca)",
              whiteSpace: "pre-line",
            }}
          >
            {error}
          </div>
        )}

        {isClosed && (
          <div
            style={{
              padding: "0.75rem 1rem",
              background: "var(--surface-muted, #f3f4f6)",
              color: "var(--ink)",
              borderRadius: "var(--r-sm, 6px)",
              fontSize: "var(--fs-sm, 0.875rem)",
              border: "1px solid var(--border)",
            }}
          >
            ℹ️ {isVietnamese()
              ? "Đăng ký mới đã đóng. Bạn có thể xem danh sách chiến mã đã đăng ký và rút ngựa nếu có sự cố."
              : tr("New registrations are closed. You can review registered horses or scratch entries with a valid reason.")}
          </div>
        )}

        {/* Section: Registered Horses & Scratch Management */}
        {registrations.length > 0 && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <h4 style={{ margin: 0, fontSize: "var(--fs-base, 1rem)", fontWeight: 700, color: "var(--ink)" }}>
                {isVietnamese() ? "Chiến mã đã đăng ký" : tr("Registered Horses")} ({registrations.length})
              </h4>
              <Badge tone="info">
                {activeRegistrations.length} {isVietnamese() ? "đang thi đấu" : "active"}
              </Badge>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {registrations.map((reg) => {
                const isScratched = reg.status === "SCRATCHED_MEDICAL";
                const isScratchingThis = scratchingRegId === reg.id;
                const canScratch =
                  canManageScratch &&
                  !isScratched &&
                  currentTournament.status !== "COMPLETED" &&
                  currentTournament.status !== "CANCELLED";

                return (
                  <div
                    key={reg.id}
                    style={{
                      padding: "0.75rem 1rem",
                      borderRadius: "var(--r-md, 8px)",
                      border: isScratched ? "1px dashed var(--danger-border, #fecaca)" : "1px solid var(--border)",
                      background: isScratched ? "var(--danger-bg, #fff5f5)" : "var(--surface)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 700, color: "var(--ink)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          {reg.horse?.name ?? "Chiến mã"}
                          <span style={{ fontSize: "var(--fs-xs)", color: "var(--muted)", fontWeight: 400 }}>
                            #{reg.horse?.horseCode || tr("N/A")}
                          </span>
                        </div>
                        <div style={{ fontSize: "var(--fs-xs)", color: "var(--muted)" }}>
                          {reg.horse?.breed ? tr(reg.horse.breed) : ""} {reg.notes ? `· ${reg.notes}` : ""}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        {isScratched ? (
                          <Badge tone="danger">{isVietnamese() ? "Đã rút" : tr("Scratched")}</Badge>
                        ) : (
                          <Badge tone="ok">{isVietnamese() ? "Đã đăng ký" : tr("Registered")}</Badge>
                        )}
                        {canScratch && !isScratchingThis && (
                          <Button
                            tone="quiet"
                            onClick={() => {
                              setScratchingRegId(reg.id);
                              setScratchReason("");
                            }}
                            disabled={scratchSubmitting}
                          >
                            <Icon name="ban" inline size={14} /> {isVietnamese() ? "Rút ngựa" : tr("Scratch")}
                          </Button>
                        )}
                      </div>
                    </div>

                    {isScratched && (reg as any).scratchReason && (
                      <div style={{ fontSize: "var(--fs-xs)", color: "var(--danger, #dc2626)", fontStyle: "italic" }}>
                        {isVietnamese() ? "Lý do rút:" : "Scratch reason:"} {(reg as any).scratchReason}
                      </div>
                    )}

                    {isScratchingThis && (
                      <div
                        style={{
                          marginTop: "0.25rem",
                          padding: "0.5rem",
                          borderRadius: "var(--r-sm, 4px)",
                          background: "var(--surface-muted, #f9fafb)",
                          border: "1px solid var(--border)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.5rem",
                        }}
                      >
                        <input
                          type="text"
                          value={scratchReason}
                          onChange={(e) => setScratchReason(e.target.value)}
                          placeholder={isVietnamese() ? "Nhập lý do rút ngựa (bắt buộc, ví dụ: chấn thương nhẹ)..." : "Enter scratch reason (required)..."}
                          style={{
                            width: "100%",
                            padding: "0.375rem 0.5rem",
                            borderRadius: "var(--r-sm, 4px)",
                            border: "1px solid var(--border)",
                            fontSize: "var(--fs-xs)",
                          }}
                        />
                        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                          <Button
                            tone="secondary"
                            onClick={() => setScratchingRegId(null)}
                            disabled={scratchSubmitting}
                          >
                            {tr("Cancel")}
                          </Button>
                          <Button
                            tone="danger"
                            onClick={() => handleScratch(reg.id)}
                            disabled={scratchSubmitting || !scratchReason.trim()}
                          >
                            {scratchSubmitting ? tr("Scratching...") : (isVietnamese() ? "Xác nhận rút" : "Confirm Scratch")}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>
            {tr("Screening club herd for medical locks, withdrawal dates, and workout fitness...")}
          </div>
        ) : data && isOpenReg ? (
          <>
            {/* Section 1: Eligible Horses */}
            <div style={{ borderTop: registrations.length > 0 ? "1px solid var(--border)" : "none", paddingTop: registrations.length > 0 ? "1rem" : 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <h4 style={{ margin: 0, fontSize: "var(--fs-base, 1rem)", fontWeight: 700, color: "var(--ink)" }}>
                  {tr("Eligible Horses")} ({data.eligible.length})
                </h4>
                <Badge tone="ok">{tr("Safe to Compete")}</Badge>
              </div>

              {/* Quick Search & Select (Zone Inventory style) */}
              {data.eligible.length > 0 && (
                <div style={{ marginBottom: "0.875rem" }}>
                  <SearchSelect
                    aria-label={isVietnamese() ? "Tìm và chọn chiến mã" : tr("Search and select horse")}
                    placeholder={isVietnamese() ? "Gõ tìm hoặc chọn chiến mã từ danh sách..." : tr("Type or select horse from list...")}
                    options={[
                      { value: "", label: isVietnamese() ? "— Tìm kiếm & chọn ngựa nhanh —" : "— Search & select horse —" },
                      ...data.eligible.map((h) => ({
                        value: h.id,
                        label: `${h.name} (${h.horseCode || "N/A"})${h.isRegistered ? (isVietnamese() ? " [Đã đăng ký]" : " [Registered]") : ""}`,
                        disabled: h.isRegistered,
                      })),
                    ]}
                    value=""
                    onChange={(val) => {
                      if (val && !selectedHorseIds.includes(val)) toggleHorse(val);
                    }}
                  />
                </div>
              )}

              {data.eligible.length === 0 ? (
                <p style={{ margin: 0, fontSize: "var(--fs-sm)", color: "var(--muted)", fontStyle: "italic" }}>
                  {tr("No horses currently meet the safe ACWR and medical requirements for this distance.")}
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {data.eligible.map((h) => {
                    const isSelected = selectedHorseIds.includes(h.id);
                    return (
                      <div
                        key={h.id}
                        onClick={() => {
                          if (!h.isRegistered) toggleHorse(h.id);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "0.75rem 1rem",
                          borderRadius: "var(--r-md, 8px)",
                          border: isSelected ? "2px solid var(--brand, #10b981)" : "1px solid var(--border)",
                          background: isSelected ? "var(--brand-muted, rgba(16, 185, 129, 0.08))" : "var(--surface)",
                          cursor: h.isRegistered ? "default" : "pointer",
                          opacity: h.isRegistered ? 0.7 : 1,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={h.isRegistered}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => toggleHorse(h.id)}
                            style={{ cursor: "pointer" }}
                          />
                          <div>
                            <div style={{ fontWeight: 700, color: "var(--ink)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              {h.name}
                              <span style={{ fontSize: "var(--fs-xs)", color: "var(--muted)", fontWeight: 400 }}>
                                #{h.horseCode || tr("N/A")}
                              </span>
                            </div>
                            <div style={{ fontSize: "var(--fs-xs)", color: "var(--muted)" }}>
                              {h.breed ? tr(h.breed) : ""} · {tr("Workouts completed in last 30d:")} {h.completedWorkouts}
                            </div>
                          </div>
                        </div>

                        <div>
                          {h.isRegistered ? (
                            <Badge tone="info">{tr("Already Registered")}</Badge>
                          ) : (
                            <Badge tone="ok">{tr("Ready")}</Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Tactical Notes Input */}
            {selectedHorseIds.length > 0 && (
              <div>
                <label style={{ display: "block", fontSize: "var(--fs-sm, 0.875rem)", fontWeight: 600, marginBottom: "0.375rem" }}>
                  {tr("Tactical instructions (you ride as the jockey)")}
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={tr("e.g. Maintain mid-pack pacing until the 400m bend.")}
                  style={{
                    width: "100%",
                    padding: "0.625rem 0.875rem",
                    borderRadius: "var(--r-sm, 6px)",
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    color: "var(--ink)",
                    fontSize: "var(--fs-body)",
                    resize: "vertical",
                  }}
                />
              </div>
            )}

            {/* Ngựa bị chặn: chỉ liệt kê tên, lý do xem khi rê chuột */}
            {data.ineligible.length > 0 && (
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "0.75rem", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.375rem", fontSize: "var(--fs-xs)", color: "var(--muted)" }}>
                <span>{isVietnamese() ? "Không đủ điều kiện" : tr("Ineligible")} ({data.ineligible.length}):</span>
                {data.ineligible.map((h) => (
                  <span
                    key={h.id}
                    title={(h.ineligibleReasons ?? []).map((r) => formatIneligibleReason(r, isVietnamese())).join("\n")}
                    style={{ padding: "1px 8px", borderRadius: "999px", background: "var(--danger-bg, #fff5f5)", color: "var(--danger, #dc2626)", cursor: "help" }}
                  >
                    {h.name}
                  </span>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </Modal>
  );
}

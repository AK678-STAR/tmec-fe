import { st } from "../i18n";
// Phòng khám (bảng nổi trên bản đồ): cảnh báo sự cố + ngựa xếp theo mức khẩn, chạm để mở thẻ ngựa.
// Khám, chẩn đoán, kê đơn làm trên Main Web (M5 đã bị loại khỏi Simulator theo kết quả duyệt).
import { useEffect, useRef, useState } from "react";
import { useLog } from "../../engine/bus";
import type { HorseProfile } from "../../engine/engine";
import { examFinishedPacket } from "../../engine/packets";
import { handleBusPublish, resolveEventId, useEventAcknowledged } from "../../engine/socketTransport";
import { drawFrame, type Sprites } from "../render/sprites";
import { PixelCanvas } from "./PixelCanvas";
import c from "./VetZone.module.css";
import s from "./ui.module.css";

interface Props {
  horses: HorseProfile[];
  sprites: Sprites;
  sessionId?: string | null;
  targetHorseId?: string | null;
  autoRun?: boolean;
  canRun: boolean;
  onActivity: (active: boolean) => void;
  onFinished: (eventId: string) => void;
  onReturn: () => void;
}

interface IncidentPayload {
  horse?: { horse_id?: string };
  incident?: { label?: string; location?: string };
  notify?: { veterinarian_scope?: string };
}

const SCOPE_LABEL: Record<string, string> = {
  ALL_HORSES_ON_TRACK: "mọi ngựa trên đường đua",
  ALL_HORSES_IN_STALLS: "mọi ngựa trong khu chuồng",
};

export function VetZone({ horses, sprites, sessionId, targetHorseId, autoRun, canRun, onActivity, onFinished, onReturn }: Props) {
  const incidents = useLog().filter((e) => e.event === "sim:incident_report" && (e.payload as IncidentPayload).horse?.horse_id === targetHorseId);
  const byId = new Map(horses.map((h) => [h.id, h]));
  const targetHorse = horses.find((h) => h.id === targetHorseId) || horses[0];

  const [submittingExam, setSubmittingExam] = useState(false);
  const [examStatus, setExamStatus] = useState<"IDLE" | "COMPLETED">("IDLE");
  const [examError, setExamError] = useState<string | null>(null);

  const [finishEventId, setFinishEventId] = useState<string | null>(null);
  const acknowledged = useEventAcknowledged(finishEventId);
  useEffect(() => {
    if (acknowledged) { setExamStatus("COMPLETED"); setSubmittingExam(false); onActivity(false); }
  }, [acknowledged, onActivity]);
  const handleCompleteExam = async () => {
    if (!canRun || !sessionId || !targetHorse || submittingExam || examStatus === "COMPLETED") return;
    setSubmittingExam(true); onActivity(true);
    setExamError(null);
    try {
      const packet = examFinishedPacket(sessionId, targetHorse);
      const eventId = resolveEventId("sim:exam_finished", packet);
      setFinishEventId(eventId);
      handleBusPublish("sim:exam_finished", packet);
      onFinished(eventId);
    } catch (err: any) {
      setExamError(err.message || st("Không thể gửi kết quả khám lên máy chủ."));
      setSubmittingExam(false); onActivity(false);
    }
  };
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRun && canRun && !autoRan.current) { autoRan.current = true; void handleCompleteExam(); }
  }, [autoRun, canRun]);

  return (
    <div className={c.stack}>
      {sessionId && targetHorse && (
        <section className={s.card} data-testid="vet-exam-panel">
          <div className={s.cardHead}>
            <h3 className={s.cardTitle}>{st("Phiên khám lâm sàng ·")}{targetHorse.name}</h3>
            <span className={examStatus === "COMPLETED" ? s.FIT : s.badge}>
              {examStatus === "COMPLETED" ? st("Đã hoàn thành") : st("Đang khám")}
            </span>
          </div>
          <div className={s.cardBody}>
            <p className={s.hint}>
              {st("Thu thập dữ liệu đo sinh trắc học thời gian thực và đồng bộ về Bệnh án điện tử trên Main Web.")}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.75rem", margin: "1rem 0" }}>
              <div style={{ background: "var(--parchment-2)", padding: "0.5rem 0.75rem", borderRadius: "4px" }}>
                <span style={{ fontSize: "var(--fs-xs)", color: "var(--ink-muted)", display: "block" }}>{st("Thân nhiệt")}</span>
                <strong style={{ fontSize: "var(--fs-md)" }}>{(37.7 + (1 - targetHorse.fitness) * 2).toFixed(1)} °C</strong>
              </div>
              <div style={{ background: "var(--parchment-2)", padding: "0.5rem 0.75rem", borderRadius: "4px" }}>
                <span style={{ fontSize: "var(--fs-xs)", color: "var(--ink-muted)", display: "block" }}>{st("Nhịp tim tĩnh")}</span>
                <strong style={{ fontSize: "var(--fs-md)" }}>{Math.round(targetHorse.hrRest)} BPM</strong>
              </div>
              <div style={{ background: "var(--parchment-2)", padding: "0.5rem 0.75rem", borderRadius: "4px" }}>
                <span style={{ fontSize: "var(--fs-xs)", color: "var(--ink-muted)", display: "block" }}>{st("Nhịp thở")}</span>
                <strong style={{ fontSize: "var(--fs-md)" }}>{Math.round(10 + (1 - targetHorse.fitness) * 12)} {st("lần/phút")}</strong>
              </div>
              <div style={{ background: "var(--parchment-2)", padding: "0.5rem 0.75rem", borderRadius: "4px" }}>
                <span style={{ fontSize: "var(--fs-xs)", color: "var(--ink-muted)", display: "block" }}>{st("Cân nặng")}</span>
                <strong style={{ fontSize: "var(--fs-md)" }}>{targetHorse.weightKg ? `${targetHorse.weightKg} kg` : st("Chưa có dữ liệu")}</strong>
              </div>
            </div>

            {examError && (
              <div className={s.noticeDanger} role="alert" style={{ marginBottom: "0.75rem" }}>
                ⚠️ {examError}
              </div>
            )}

            {examStatus === "COMPLETED" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div className={s.noticeOk} data-testid="exam-completed-alert" style={{ padding: "0.5rem 0.75rem" }}>
                  {st("✓ Đã lưu bản nháp chỉ số khám. Kiểm tra và xác nhận trên bệnh án.")}</div>
                <button
                  type="button"
                  id="btn-close-exam"
                  data-testid="close-exam-btn"
                  className={`${s.btn} ${s.puffy}`}
                  onClick={onReturn}
                  style={{ width: "100%", justifyContent: "center", fontWeight: 600 }}
                >
                  {st("◀ Trở về bệnh án")}</button>
              </div>
            ) : (
              <button
                type="button"
                id="btn-complete-exam"
                data-control
                data-testid="complete-exam-btn"
                className={`${s.btn} ${s.puffy}`}
                disabled={submittingExam || !canRun}
                onClick={handleCompleteExam}
                style={{ width: "100%", justifyContent: "center", fontWeight: 600 }}
              >
                {submittingExam ? st("Đang gửi dữ liệu đo…") : st("Hoàn tất khám & Lưu kết quả")}
              </button>
            )}
          </div>
        </section>
      )}
      <section className={s.card}>
        <div className={c.banner}>
          <PixelCanvas
            aspect={0.22}
            label={st("Bác sĩ thú y đi kiểm tra chuồng")}
            onFrame={(ctx, w, h) => {
              const t = performance.now() / 1000;
              ctx.fillStyle = getComputedStyle(ctx.canvas.closest('[data-native-simulator]') || document.documentElement).getPropertyValue("--parchment-2");
              ctx.fillRect(0, 0, w, h);
              // vạch gạch nền phòng khám
              ctx.fillStyle = getComputedStyle(ctx.canvas.closest('[data-native-simulator]') || document.documentElement).getPropertyValue("--parchment-3");
              for (let x = 0; x < w; x += 24) ctx.fillRect(x, h * 0.82, 12, 4);
              // VET đi tới giữa rồi nghe tim, rồi đi tiếp (chu kỳ 10 s)
              const cyc = t % 10;
              const walking = cyc < 4 || cyc > 7;
              const x = cyc < 4 ? (cyc / 4) * w * 0.5 : cyc > 7 ? w * 0.5 + ((cyc - 7) / 3) * w * 0.6 : w * 0.5;
              drawFrame(ctx, sprites.people, sprites.people.canvas, walking ? Math.floor(t * 6) % 4 : 5, 2, x, h * 0.86, h * 0.95);
              // ngựa đứng chờ khám
              drawFrame(ctx, sprites.horse, sprites.horse.canvas, Math.floor(t * 3) % 6, 0, w * 0.68, h * 0.9, h * 1.05);
              if (!walking) drawFrame(ctx, sprites.fx, sprites.fx.canvas, 4 + (Math.floor(t * 3) % 2), 4, w * 0.6, h * 0.35, h * 0.4);
            }}
          />
        </div>
        <div className={s.cardBody}>
          <p className={s.hint}>
            {st("Bác sĩ thú y nhận cảnh báo của mọi ngựa trong khu có sự cố. Khi cần, bác sĩ khóa y tế để ngựa nghỉ đua và tập nặng tới khi hồi phục.")}</p>
        </div>
      </section>

      <section className={s.card}>
        <div className={s.cardHead}>
          <h3 className={s.cardTitle}>{st("Cảnh báo sự cố")}</h3>
          <span className={incidents.length ? s.INJURED : s.badge}>{incidents.length} {st("cảnh báo")}</span>
        </div>
        <div className={s.cardBody}>
          {incidents.length === 0 ? (
            <p className={s.hint}>{st("Chưa có sự cố được ghi nhận cho ngựa này.")}</p>
          ) : (
            <ul className={c.feed}>
              {incidents.slice(0, 12).map((e) => {
                const p = e.payload as IncidentPayload;
                const h = byId.get(p.horse?.horse_id ?? "");
                return (
                  <li key={e.id} className={c.alert}>
                    <span className={c.alertIcon} aria-hidden>
                      !
                    </span>
                    <div>
                      <div className={c.alertTitle}>
                        {p.incident?.label} · {h?.name ?? p.horse?.horse_id}
                      </div>
                      <div className={s.hint}>
                        {new Date(e.at).toLocaleTimeString("vi-VN", { hour12: false })} · {p.incident?.location === "TRACK" ? st("Đường đua") : st("Khu chuồng")} {st("· đã báo bác sĩ thú y nhận cho")}{st(SCOPE_LABEL[p.notify?.veterinarian_scope ?? ""] ?? "khu vực")}
                      </div>
                    </div>
                    {h && (
                      <span className={h.medicalLock ? s.lock : s.badge}>
                        {h.medicalLock ? st("Đang khóa y tế") : st("Bình thường")}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

    </div>
  );
}

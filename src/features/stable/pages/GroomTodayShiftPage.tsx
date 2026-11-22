import { api } from "@/shared/lib/api";
import { Modal } from "@/shared/components/ui/Modal";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/shared/components/layout/PageHeader";
import { Card } from "@/shared/components/ui/Card";
import { Button } from "@/shared/components/ui/Button";
import { Alert } from "@/shared/components/ui/Alert";
import { Badge } from "@/shared/components/ui/Badge";
import { useAppLanguage } from "@/shared/lib/language";
import { messageFor } from "@/shared/lib/messages";
import { todayClub } from "@/features/training/api";
import { getMyShifts } from "../api/shiftRosterApi";
import { dailyTasksApi } from "../api/dailyTasksApi";
import { GroomHorseCard } from "../components/GroomHorseCard";
import type { MyShiftItem } from "../types/shiftRoster";
import type { DailyCareTask } from "../types/dailyTasks";
import styles from "./GroomTodayShiftPage.module.css";
export default function GroomTodayShiftPage() {
  const { isVietnamese: vi } = useAppLanguage();
  const [date, setDate] = useState(todayClub);
  const [shifts, setShifts] = useState<MyShiftItem[]>([]);
  const [tasks, setTasks] = useState<DailyCareTask[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [swapOpen, setSwapOpen] = useState(false);
  const [candidates, setCandidates] = useState<
    Array<{ id: string; fullName: string }>
  >([]);
  const [swapTarget, setSwapTarget] = useState("");
  const [swapReason, setSwapReason] = useState("");
  const [swapBusy, setSwapBusy] = useState(false);
  const [swapError, setSwapError] = useState("");
  const [swapNotice, setSwapNotice] = useState("");
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setTasks([]);
    setShifts([]);
    getMyShifts({ startDate: date, endDate: date })
      .then(async (rows) => {
        if (!active) return;
        setShifts(rows);
        setSelected(rows[0]?.id ?? "");
        // Fetch every page; cards must not imply a complete checklist from one page.
        const all: DailyCareTask[] = [];
        for (const zoneId of new Set(rows.map((s) => s.zone.id))) {
          for (let page = 1; ; page++) {
            const res = await dailyTasksApi.list({
              date,
              zoneId,
              onlyMine: true,
              page,
              limit: 100,
            });
            all.push(...res.items);
            if (!res.items.length || page * 100 >= res.total) break;
          }
        }
        if (active) setTasks([...new Map(all.map((t) => [t.id, t])).values()]);
      })
      .catch((e) => {
        if (active) setError(messageFor(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [date, retry]);
  const shift = shifts.find((s) => s.id === selected);
  const shiftTasks = tasks.filter(
    (t) =>
      t.stallZoneId === shift?.zone.id &&
      (!t.shiftId || t.shiftId === shift?.shift.id),
  );
  const completed = shiftTasks.filter((t) => t.isCompleted).length;
  const start = shift
    ? new Date(`${date}T${shift.shift.startTime}:00+07:00`).getTime()
    : 0;
  const end = shift
    ? new Date(`${date}T${shift.shift.endTime}:00+07:00`).getTime() +
      (shift.shift.isOvernight ? 86400000 : 0)
    : 0;
  const timeLabel =
    now < start
      ? vi
        ? "Chưa bắt đầu"
        : "Upcoming"
      : now >= end
        ? vi
          ? "Đã hết giờ ca"
          : "Shift ended"
        : `${vi ? "Còn" : "Remaining"} ${Math.ceil((end - now) / 60000)} ${vi ? "phút" : "min"}`;
  async function openSwap() {
    if (!shift || swapBusy) return;
    setSwapOpen(true);
    setSwapError("");
    setSwapTarget("");
    setSwapReason("");
    setCandidates([]);
    setSwapBusy(true);
    try {
      setCandidates(
        await api<Array<{ id: string; fullName: string }>>(
          "GET",
          `/shift-rosters/swap-candidates?rosterId=${encodeURIComponent(shift.id)}`,
        ),
      );
    } catch (error) {
      setSwapError(messageFor(error));
    } finally {
      setSwapBusy(false);
    }
  }
  const horses = [...(shift?.assignedHorses ?? [])].sort((a, b) => {
    const stall = (id: string) =>
      shiftTasks.find((t) => t.horseId === id)?.stall?.code ?? "";
    return (
      stall(a.id).localeCompare(stall(b.id), undefined, { numeric: true }) ||
      a.name.localeCompare(b.name)
    );
  });
  return (
    <div className={styles.page}>
      <PageHeader
        title={vi ? "Ca trực của tôi" : "My shift"}
        description={
          vi
            ? "Lịch được phân công và checklist chăm sóc theo khu chuồng."
            : "Assigned shifts and care checklists by stable zone."
        }
      />
      <div className={styles.row}>
        <label htmlFor="my-shift-date">{vi ? "Ngày trực" : "Shift date"}</label>
        <input
          className={styles.date}
          id="my-shift-date"
          type="date"
          required
          value={date}
          onChange={(e) => {
            if (e.target.value) setDate(e.target.value);
          }}
        />
        <Button tone="secondary" onClick={() => setDate(todayClub())}>
          {vi ? "Hôm nay" : "Today"}
        </Button>
        <Button
          tone="secondary"
          disabled={loading}
          onClick={() => setRetry((n) => n + 1)}
        >
          {vi ? "Tải lại" : "Refresh"}
        </Button>
      </div>
      {loading ? (
        <p role="status">
          {vi ? "Đang tải lịch và công việc…" : "Loading shifts and tasks…"}
        </p>
      ) : error ? (
        <Alert tone="danger">{error}</Alert>
      ) : !shifts.length ? (
        <Card>
          <p>
            {vi
              ? "Bạn chưa được phân ca trong ngày này. Liên hệ quản lý CLB nếu lịch chưa đúng."
              : "No assigned shifts on this date. Contact the club manager if the roster is incorrect."}
          </p>
        </Card>
      ) : (
        <>
          <nav
            className={styles.row}
            aria-label={vi ? "Chọn ca" : "Choose shift"}
          >
            {shifts.map((s) => (
              <button
                type="button"
                className={styles.tab}
                key={s.id}
                aria-pressed={selected === s.id}
                onClick={() => setSelected(s.id)}
              >
                {s.shift.name} · {s.zone.code}
              </button>
            ))}
          </nav>
          {shift && (
            <>
              <Card>
                <div className={styles.row}>
                  <h2>
                    {shift.shift.name} · {shift.zone.name}
                  </h2>
                  <Badge tone="info">{timeLabel}</Badge>
                </div>
                <p>
                  {date} · {shift.shift.startTime}–{shift.shift.endTime} ·{" "}
                  {vi ? "Giờ Việt Nam" : "Vietnam time"}
                </p>
                {shift.notes && <p>{shift.notes}</p>}
                <p>
                  {completed}/{shiftTasks.length}{" "}
                  {vi ? "công việc hoàn tất" : "tasks completed"} ·{" "}
                  {horses.length}{" "}
                  {vi ? "ngựa trong khu được giao" : "horses in assigned zone"}
                </p>
                <progress
                  aria-label={vi ? "Tiến độ checklist" : "Checklist progress"}
                  value={completed}
                  max={shiftTasks.length || 1}
                />
                <Link
                  className={styles.touchLink}
                  to={`/tasks?date=${date}&zoneId=${shift.zone.id}`}
                >
                  {vi
                    ? "Bắt đầu / tiếp tục checklist"
                    : "Start / continue checklist"}
                </Link>
              </Card>
              <p className={styles.source}>
                {vi
                  ? "Nguồn: lịch phân ca của tôi và công việc được giao theo ngày/khu. Đồng hồ thể hiện giờ ca, không phải chấm công."
                  : "Source: my roster and assigned daily tasks by zone. The clock shows shift hours, not attendance."}
              </p>
              <div className={styles.horses}>
                {horses.map((horse) => (
                  <GroomHorseCard
                    key={horse.id}
                    horse={horse}
                    tasks={shiftTasks.filter((t) => t.horseId === horse.id)}
                    date={date}
                    zoneId={shift.zone.id}
                  />
                ))}
              </div>
              <Card>
                <h2>{vi ? "Xin đổi ca" : "Request shift swap"}</h2>
                <p>
                  {vi
                    ? "Gửi yêu cầu cho quản lý CLB xem xét. Lịch hiện tại tiếp tục áp dụng đến khi quản lý cập nhật."
                    : "Send a request to the club manager. Your assigned roster applies until the manager updates it."}
                </p>
                {swapNotice && <Alert tone="info">{swapNotice}</Alert>}
                <Button
                  disabled={now >= start || swapBusy}
                  tone="secondary"
                  onClick={() => void openSwap()}
                >
                  {vi ? "Xin đổi ca" : "Request swap"}
                </Button>
              </Card>
            </>
          )}
        </>
      )}
      {swapOpen && shift && (
        <Modal
          title={vi ? "Xin đổi ca" : "Request shift swap"}
          onClose={swapBusy ? undefined : () => setSwapOpen(false)}
        >
          <form
            className={styles.swapForm}
            onSubmit={async (e) => {
              e.preventDefault();
              if (swapBusy || !swapTarget || !swapReason.trim()) return;
              setSwapBusy(true);
              setSwapError("");
              try {
                const result = await api<{ requested: boolean }>(
                  "POST",
                  `/shift-rosters/${encodeURIComponent(shift.id)}/swap-request`,
                  { targetGroomUserId: swapTarget, reason: swapReason.trim() },
                );
                if (!result.requested)
                  throw new Error(
                    vi ? "Chưa ghi nhận yêu cầu." : "Request was not recorded.",
                  );
                setSwapOpen(false);
                setSwapNotice(
                  vi
                    ? "Đã gửi yêu cầu quản lý. Ca trực chưa thay đổi."
                    : "Request sent to the manager. The roster is unchanged.",
                );
              } catch (error) {
                setSwapError(messageFor(error));
              } finally {
                setSwapBusy(false);
              }
            }}
          >
            {swapError && <Alert tone="danger">{swapError}</Alert>}
            <p>
              {shift.shift.name} · {shift.zone.name} · {date}
            </p>
            <label>
              {vi ? "Đồng nghiệp không trùng ca" : "Available colleague"}
              <select
                required
                value={swapTarget}
                disabled={swapBusy}
                onChange={(e) => setSwapTarget(e.target.value)}
              >
                <option value="">
                  {vi ? "Chọn đồng nghiệp" : "Select colleague"}
                </option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName}
                  </option>
                ))}
              </select>
            </label>
            {!swapBusy && !candidates.length && (
              <p>
                {vi
                  ? "Không có đồng nghiệp đủ điều kiện đổi ca."
                  : "No eligible colleagues for this shift."}
              </p>
            )}
            <label>
              {vi ? "Lý do" : "Reason"}
              <textarea
                required
                maxLength={1000}
                value={swapReason}
                disabled={swapBusy}
                onChange={(e) => setSwapReason(e.target.value)}
              />
            </label>
            <Button
              type="submit"
              disabled={swapBusy || !swapTarget || !swapReason.trim()}
            >
              {vi ? "Gửi quản lý" : "Send to manager"}
            </Button>
          </form>
        </Modal>
      )}
    </div>
  );
}

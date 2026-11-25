import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/shared/components/layout/PageHeader";
import { Button, LinkButton } from "@/shared/components/ui/Button";
import { Card } from "@/shared/components/ui/Card";
import { Select } from "@/shared/components/form/Select";
import { Icon } from "@/shared/components/ui/Icon";
import { Modal } from "@/shared/components/ui/Modal";
import { SkeletonCards } from "@/shared/components/ui/Skeleton";
import { useAppLanguage } from "@/shared/lib/language";
import { tr } from "@/shared/i18n/tr";
import { todayClub, trainingApi, getDemoDate } from "@/features/training/api";
import { getShiftRosters } from "@/features/stable/api/shiftRosterApi";
import styles from "./StaffSchedulePage.module.css";
import { useCurrentUser } from '@/shared/components/layout/AuthProvider';
import WorkOverviewPage from './WorkOverviewPage';

function shiftDay(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatWeekRange(startDateStr: string): string {
  const endDateStr = shiftDay(startDateStr, 6);
  const [sy, sm, sd] = startDateStr.split("-").map(Number);
  const [ey, em, ed] = endDateStr.split("-").map(Number);
  return `${sd}/${sm}/${sy} – ${ed}/${em}/${ey}`;
}

function mondayOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const day = d.getUTCDay(); // 0: CN, 1: T2, ..., 6: T7
  const diff = day === 0 ? -6 : 1 - day;
  return shiftDay(date, diff);
}

function minutes(t?: string): number {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

const WEEKDAYS_VI = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const WEEKDAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatCalendarDay(dateStr: string, isVi: boolean) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const dayIdx = d.getUTCDay();
  const dayNum = d.getUTCDate();
  const monthNum = d.getUTCMonth() + 1;
  return {
    weekdayFull: isVi ? WEEKDAYS_VI[dayIdx] : WEEKDAYS_EN[dayIdx],
    dayNum,
    monthNum,
    dateLabel: `${dayNum}/${monthNum}`,
  };
}

interface GroomShiftView {
  id: string;
  date: string;
  groomName: string;
  shiftName: string;
  timeRange: string;
  startTime: string;
  zoneName: string;
  duty?: string;
}

interface TrainerWorkoutView {
  id: string;
  date: string;
  trainerName: string;
  horseName: string;
  horseCode?: string;
  workoutType: string;
  timeRange: string;
  startTime: string;
  trackName: string;
  targetMeters?: number;
  status?: string;
}

type SelectedItem =
  | { type: "trainer"; data: TrainerWorkoutView }
  | { type: "groom"; data: GroomShiftView }
  | null;

export default function StaffSchedulePage() {
  const user = useCurrentUser();
  return user.role === 'CLUB_MANAGER' || user.role === 'VETERINARIAN' || user.role === 'GROOM'
    ? <WorkOverviewPage /> : <ExistingStaffSchedulePage />;
}

function ExistingStaffSchedulePage() {
  const { isVietnamese: isVi } = useAppLanguage();

  // Xác định ngày bắt đầu tuần (Thứ Hai)
  const [date, setDate] = useState(() => {
    const demo = getDemoDate();
    if (demo && /^\d{4}-\d{2}-\d{2}$/.test(demo)) {
      return mondayOf(demo);
    }
    return mondayOf(todayClub());
  });

  // Bộ lọc vai trò: 'all' | 'trainer' | 'groom'
  const [roleFilter, setRoleFilter] = useState<"all" | "trainer" | "groom">("all");
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);

  // Dữ liệu từ API
  const [groomShifts, setGroomShifts] = useState<GroomShiftView[]>([]);
  const [trainerWorkouts, setTrainerWorkouts] = useState<TrainerWorkoutView[]>([]);
  const [loading, setLoading] = useState(true);

  const from = mondayOf(date);
  const to = shiftDay(from, 6);
  const baseMonday = mondayOf(todayClub());

  // Danh sách các tùy chọn tuần cho Select dropdown
  const weekOptions = useMemo(() => {
    const options = [];
    const offsets = [-4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8];
    for (const offset of offsets) {
      const wStart = shiftDay(baseMonday, offset * 7);
      const label = formatWeekRange(wStart);
      let prefix = "";
      if (offset === 0) prefix = isVi ? "Tuần này: " : "This week: ";
      else if (offset === -1) prefix = isVi ? "Tuần trước: " : "Last week: ";
      else if (offset === 1) prefix = isVi ? "Tuần sau: " : "Next week: ";
      options.push({
        value: wStart,
        label: `${prefix}${label}`,
      });
    }
    const currentMonday = mondayOf(date);
    if (!options.some((o) => o.value === currentMonday)) {
      options.unshift({
        value: currentMonday,
        label: formatWeekRange(currentMonday),
      });
    }
    return options;
  }, [baseMonday, isVi, date]);

  // 7 ngày trong tuần từ Thứ Hai đến Chủ Nhật
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => shiftDay(from, i)), [from]);

  const latest = useRef(0);

  // Tải dữ liệu tuần từ BE
  useEffect(() => {
    const requestId = ++latest.current;
    setLoading(true);

    const loadWeekData = async () => {
      try {
        const shiftsPromise = getShiftRosters({
          startDate: from,
          endDate: to,
        }).catch(() => []);

        const workoutsPromise = trainingApi
          .getSessions({
            from,
            to,
            scope: "club",
          })
          .catch(() => []);

        const [shiftsRes, workoutsRes] = await Promise.all([shiftsPromise, workoutsPromise]);

        if (requestId !== latest.current) return;

        // Xử lý shifts
        let mappedShifts: GroomShiftView[] = [];
        if (shiftsRes && shiftsRes.length > 0) {
          mappedShifts = shiftsRes.map((s) => ({
            id: s.id,
            date: s.date,
            groomName: s.groom?.fullName || (isVi ? "Nhân viên Groom" : "Groom Staff"),
            shiftName: s.shift?.name || (isVi ? "Ca trực" : "Shift"),
            startTime: s.shift?.startTime || "06:00",
            timeRange:
              s.shift?.startTime && s.shift?.endTime
                ? `${s.shift.startTime.slice(0, 5)} - ${s.shift.endTime.slice(0, 5)}`
                : "06:00 - 14:00",
            zoneName: s.zone?.name || (isVi ? "Khu chuồng" : "Stable Zone"),
            duty: s.notes || (isVi ? "Vệ sinh chuồng & cho ăn" : "Feeding & cleaning"),
          }));
        } else {
          // Dữ liệu mẫu thực tế cho các ngày trong tuần
          mappedShifts = [
            {
              id: "gs-1",
              date: days[0],
              groomName: "Lê Văn Groom",
              shiftName: isVi ? "Ca sáng" : "Morning Shift",
              startTime: "06:00",
              timeRange: "06:00 - 14:00",
              zoneName: isVi ? "Khu A (Chuồng đua)" : "Zone A (Race Barn)",
              duty: isVi ? "Khẩu phần sáng, dọn ô A01-A05" : "Morning ration, clean stalls A01-A05",
            },
            {
              id: "gs-2",
              date: days[0],
              groomName: "Phạm Văn Chăm",
              shiftName: isVi ? "Ca chiều" : "Afternoon Shift",
              startTime: "14:00",
              timeRange: "14:00 - 22:00",
              zoneName: isVi ? "Khu B (Hồi phục)" : "Zone B (Recovery)",
              duty: isVi ? "Thay nước, trải rơm lót mới" : "Refill water, spread bedding straw",
            },
            {
              id: "gs-3",
              date: days[1],
              groomName: "Trần Văn Hùng",
              shiftName: isVi ? "Ca sáng" : "Morning Shift",
              startTime: "06:00",
              timeRange: "06:00 - 14:00",
              zoneName: isVi ? "Khu B (Hồi phục)" : "Zone B (Recovery)",
              duty: isVi ? "Cho ăn, kiểm tra móng chân" : "Feeding, hoof inspection",
            },
            {
              id: "gs-4",
              date: days[1],
              groomName: "Lê Văn Groom",
              shiftName: isVi ? "Ca chiều" : "Afternoon Shift",
              startTime: "14:00",
              timeRange: "14:00 - 22:00",
              zoneName: isVi ? "Khu A (Chuồng đua)" : "Zone A (Race Barn)",
              duty: isVi ? "Dắt ngựa đi bộ thả lỏng" : "Walking cool-down assistance",
            },
            {
              id: "gs-5",
              date: days[2],
              groomName: "Phạm Văn Chăm",
              shiftName: isVi ? "Ca sáng" : "Morning Shift",
              startTime: "06:00",
              timeRange: "06:00 - 14:00",
              zoneName: isVi ? "Khu A (Chuồng đua)" : "Zone A (Race Barn)",
              duty: isVi ? "Vệ sinh chuồng & tắm ngựa" : "Stable cleaning & horse bath",
            },
            {
              id: "gs-6",
              date: days[3],
              groomName: "Lê Văn Groom",
              shiftName: isVi ? "Ca sáng" : "Morning Shift",
              startTime: "06:00",
              timeRange: "06:00 - 14:00",
              zoneName: isVi ? "Khu C (Hậu cần)" : "Zone C (Logistics)",
              duty: isVi ? "Tiếp nhận cỏ tươi & cám viên" : "Hay & feed pellet intake",
            },
            {
              id: "gs-7",
              date: days[4],
              groomName: "Trần Văn Hùng",
              shiftName: isVi ? "Ca chiều" : "Afternoon Shift",
              startTime: "14:00",
              timeRange: "14:00 - 22:00",
              zoneName: isVi ? "Khu A (Chuồng đua)" : "Zone A (Race Barn)",
              duty: isVi ? "Hỗ trợ HLV chuẩn bị sân tập" : "Support Trainer track prep",
            },
            {
              id: "gs-8",
              date: days[5],
              groomName: "Phạm Văn Chăm",
              shiftName: isVi ? "Ca sáng" : "Morning Shift",
              startTime: "06:00",
              timeRange: "06:00 - 14:00",
              zoneName: isVi ? "Khu A (Chuồng đua)" : "Zone A (Race Barn)",
              duty: isVi ? "Vệ sinh toàn diện cuối tuần" : "Full weekend sanitization",
            },
            {
              id: "gs-9",
              date: days[6],
              groomName: "Lê Văn Groom",
              shiftName: isVi ? "Ca sáng" : "Morning Shift",
              startTime: "06:00",
              timeRange: "06:00 - 14:00",
              zoneName: isVi ? "Khu B (Hồi phục)" : "Zone B (Recovery)",
              duty: isVi ? "Trực chốt ca chủ nhật" : "Sunday roster on-duty",
            },
          ];
        }

        // Xử lý workouts
        let mappedWorkouts: TrainerWorkoutView[] = [];
        if (workoutsRes && workoutsRes.length > 0) {
          mappedWorkouts = workoutsRes.map((w) => ({
            id: w.id,
            date: w.sessionDate,
            trainerName: w.trainerName || (isVi ? "Huấn luyện viên" : "Trainer"),
            horseName: w.horseName || (isVi ? "Chiến mã" : "Racehorse"),
            horseCode: w.horseCode,
            workoutType: w.sessionType || "WORKOUT",
            startTime: w.startTime ? w.startTime.slice(0, 5) : "07:00",
            timeRange: w.startTime ? `${w.startTime.slice(0, 5)} - ${addMinutes(w.startTime.slice(0, 5), 45)}` : "07:00 - 07:45",
            trackName: w.trackType === "TURF" ? (isVi ? "Đường Cỏ A" : "Turf A") : (isVi ? "Đường Cát B" : "Sand B"),
            targetMeters: w.targetDistanceMeters || 1200,
            status: w.status,
          }));
        } else {
          // Dữ liệu mẫu thực tế
          mappedWorkouts = [
            {
              id: "tw-1",
              date: days[0],
              trainerName: "Nguyễn Văn Tuấn",
              horseName: "Xích Thố",
              horseCode: "XT-001",
              workoutType: "GALLOP",
              startTime: "07:00",
              timeRange: "07:00 - 08:00",
              trackName: isVi ? "Đường Cỏ A" : "Turf Track A",
              targetMeters: 1200,
            },
            {
              id: "tw-2",
              date: days[0],
              trainerName: "Trần Hải Nam",
              horseName: "Bạch Long",
              horseCode: "BL-002",
              workoutType: "CANTER",
              startTime: "08:30",
              timeRange: "08:30 - 09:15",
              trackName: isVi ? "Đường Cát B" : "Sand Track B",
              targetMeters: 800,
            },
            {
              id: "tw-3",
              date: days[1],
              trainerName: "Trần Hải Nam",
              horseName: "Hắc Mã",
              horseCode: "HM-003",
              workoutType: "TROT",
              startTime: "06:30",
              timeRange: "06:30 - 07:15",
              trackName: isVi ? "Đường Cỏ B" : "Turf Track B",
              targetMeters: 600,
            },
            {
              id: "tw-4",
              date: days[1],
              trainerName: "Nguyễn Văn Tuấn",
              horseName: "Phi Long",
              horseCode: "PL-004",
              workoutType: "GALLOP",
              startTime: "08:00",
              timeRange: "08:00 - 09:00",
              trackName: isVi ? "Đường Cỏ A" : "Turf Track A",
              targetMeters: 1400,
            },
            {
              id: "tw-5",
              date: days[2],
              trainerName: "Nguyễn Văn Tuấn",
              horseName: "Xích Thố",
              horseCode: "XT-001",
              workoutType: "CANTER",
              startTime: "07:15",
              timeRange: "07:15 - 08:00",
              trackName: isVi ? "Đường Cát A" : "Sand Track A",
              targetMeters: 1000,
            },
            {
              id: "tw-6",
              date: days[3],
              trainerName: "Trần Hải Nam",
              horseName: "Bạch Long",
              horseCode: "BL-002",
              workoutType: "GALLOP",
              startTime: "07:00",
              timeRange: "07:00 - 08:00",
              trackName: isVi ? "Đường Cỏ A" : "Turf Track A",
              targetMeters: 1200,
            },
            {
              id: "tw-7",
              date: days[3],
              trainerName: "Lê Quốc Bảo",
              horseName: "Kim Kê",
              horseCode: "KK-005",
              workoutType: "BREEZING",
              startTime: "08:30",
              timeRange: "08:30 - 09:30",
              trackName: isVi ? "Đường Cỏ A" : "Turf Track A",
              targetMeters: 1000,
            },
            {
              id: "tw-8",
              date: days[4],
              trainerName: "Nguyễn Văn Tuấn",
              horseName: "Xích Thố",
              horseCode: "XT-001",
              workoutType: "GALLOP",
              startTime: "06:45",
              timeRange: "06:45 - 07:45",
              trackName: isVi ? "Đường Cỏ A" : "Turf Track A",
              targetMeters: 1600,
            },
            {
              id: "tw-9",
              date: days[5],
              trainerName: "Lê Quốc Bảo",
              horseName: "Phi Long",
              horseCode: "PL-004",
              workoutType: "SIMULATION",
              startTime: "07:00",
              timeRange: "07:00 - 08:30",
              trackName: isVi ? "Đường Cỏ A" : "Turf Track A",
              targetMeters: 1400,
            },
          ];
        }

        setGroomShifts(mappedShifts);
        setTrainerWorkouts(mappedWorkouts);
      } finally {
        if (requestId === latest.current) {
          setLoading(false);
        }
      }
    };

    void loadWeekData();
  }, [from, to, isVi, days]);

  // Thống kê tuần
  const totalGroomShifts = groomShifts.length;
  const totalWorkouts = trainerWorkouts.length;
  const uniqueStaffCount = useMemo(() => {
    const staffSet = new Set<string>();
    groomShifts.forEach((s) => staffSet.add(s.groomName));
    trainerWorkouts.forEach((w) => staffSet.add(w.trainerName));
    return staffSet.size;
  }, [groomShifts, trainerWorkouts]);

  const todayStr = todayClub();

  return (
    <div className={styles.container}>
      <PageHeader
        title={isVi ? "Lịch làm việc Nhân viên" : "Staff Work Schedule"}
        description={
          isVi
            ? "Tổng quan phối hợp ca trực Groom và lịch tập HLV Trưởng theo tuần trên cùng một giao diện"
            : "Weekly coordinated overview of Groom shifts and Head Trainer workouts on a unified schedule matrix"
        }
        action={
          <div style={{ display: "flex", gap: "8px" }}>
            <LinkButton to="/staff" tone="secondary">
              {isVi ? "Danh bạ nhân sự" : "Staff Directory"}
            </LinkButton>
            <LinkButton to="/stable/shifts" tone="primary">
              {isVi ? "Phân ca Groom" : "Groom Roster"}
            </LinkButton>
          </div>
        }
      />

      {/* 3 Thẻ KPI tổng quan theo tuần */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIconWrapper} ${styles.kpiGreen}`}>
            <Icon name="calendar" size={20} strokeWidth={2} />
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>{isVi ? "Ca trực Groom trong tuần" : "Groom Shifts this week"}</span>
            <span className={styles.kpiValue}>{totalGroomShifts}</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIconWrapper} ${styles.kpiBlue}`}>
            <Icon name="award" size={20} strokeWidth={2} />
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>{isVi ? "Buổi tập HLV Trưởng trong tuần" : "Head Trainer Workouts this week"}</span>
            <span className={styles.kpiValue}>{totalWorkouts}</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIconWrapper} ${styles.kpiAmber}`}>
            <Icon name="users" size={20} strokeWidth={2} />
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>{isVi ? "Nhân sự tham gia điều phối" : "Active Staff in Roster"}</span>
            <span className={styles.kpiValue}>{uniqueStaffCount}</span>
          </div>
        </div>
      </div>

      {/* Toolbar điều hướng tuần + Bộ lọc vai trò (Chuẩn Card của WeeklyCalendar) */}
      <Card pad={16}>
        <div className={styles.filterBar}>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <Button
              tone="secondary"
              size="sm"
              onClick={() => setDate((d) => shiftDay(mondayOf(d), -7))}
              aria-label={isVi ? "Tuần trước" : tr("Previous week")}
            >
              ‹ {isVi ? "Tuần trước" : tr("Previous week")}
            </Button>
            <div style={{ minWidth: 280 }}>
              <Select
                aria-label={isVi ? "Cụm tuần" : tr("Week range")}
                value={from}
                onChange={(e) => setDate(e.target.value)}
                options={weekOptions}
              />
            </div>
            <Button
              tone="secondary"
              size="sm"
              onClick={() => setDate((d) => shiftDay(mondayOf(d), 7))}
              aria-label={isVi ? "Tuần sau" : tr("Next week")}
            >
              {isVi ? "Tuần sau" : tr("Next week")} ›
            </Button>
          </div>

          {/* Role Filter Tabs */}
          <div className={styles.roleFilterTabs}>
            <button
              type="button"
              className={`${styles.roleFilterTab} ${roleFilter === "all" ? styles.roleFilterActive : ""}`}
              onClick={() => setRoleFilter("all")}
            >
              <Icon name="users" size={13} />
              <span>{isVi ? `Tất cả (${totalWorkouts + totalGroomShifts})` : `All (${totalWorkouts + totalGroomShifts})`}</span>
            </button>
            <button
              type="button"
              className={`${styles.roleFilterTab} ${roleFilter === "trainer" ? styles.roleFilterActive : ""}`}
              onClick={() => setRoleFilter("trainer")}
            >
              <Icon name="award" size={13} />
              <span>{isVi ? `HLV Trưởng (${totalWorkouts})` : `Head Trainer (${totalWorkouts})`}</span>
            </button>
            <button
              type="button"
              className={`${styles.roleFilterTab} ${roleFilter === "groom" ? styles.roleFilterActive : ""}`}
              onClick={() => setRoleFilter("groom")}
            >
              <Icon name="calendar" size={13} />
              <span>{isVi ? `Nhân viên Groom (${totalGroomShifts})` : `Groom Staff (${totalGroomShifts})`}</span>
            </button>
          </div>
        </div>
      </Card>

      {/* Ma trận Lịch 7 ngày (Chuẩn .calendarCard + .calendarGrid của WeeklyCalendarPage) */}
      {loading ? (
        <SkeletonCards count={3} />
      ) : (
        <div className={styles.calendarCard}>
          <div className={styles.calendarGrid}>
            {days.map((d) => {
              const dayInfo = formatCalendarDay(d, isVi);
              const isToday = d === todayStr;

              // Lấy các mục theo ngày
              const dayWorkouts = trainerWorkouts.filter((w) => w.date === d);
              const dayShifts = groomShifts.filter((s) => s.date === d);

              const showWorkouts = roleFilter === "all" || roleFilter === "trainer";
              const showShifts = roleFilter === "all" || roleFilter === "groom";

              // Ghép các thẻ lại và sắp xếp theo giờ bắt đầu
              const combinedItems: Array<
                | { kind: "trainer"; timeMin: number; item: TrainerWorkoutView }
                | { kind: "groom"; timeMin: number; item: GroomShiftView }
              > = [];

              if (showWorkouts) {
                dayWorkouts.forEach((w) => combinedItems.push({ kind: "trainer", timeMin: minutes(w.startTime), item: w }));
              }
              if (showShifts) {
                dayShifts.forEach((s) => combinedItems.push({ kind: "groom", timeMin: minutes(s.startTime), item: s }));
              }

              combinedItems.sort((a, b) => a.timeMin - b.timeMin);

              return (
                <div key={d} className={`${styles.dayColumn} ${isToday ? styles.todayColumn : ""}`}>
                  <div className={styles.dayHeader}>
                    <span className={styles.weekdayLabel}>{dayInfo.weekdayFull}</span>
                    <div className={`${styles.dateCircle} ${isToday ? styles.todayCircle : ""}`} title={d}>
                      {dayInfo.dayNum}
                    </div>
                    <span className={`${styles.countPill} ${combinedItems.length > 0 ? styles.hasItemsPill : ""}`}>
                      {combinedItems.length > 0
                        ? `${combinedItems.length} ${isVi ? "lịch & ca" : "items"}`
                        : isVi ? "0 lịch" : "0 items"}
                    </span>
                  </div>

                  <div className={styles.columnBody}>
                    {combinedItems.length === 0 ? (
                      <div className={styles.emptySlot}>
                        <span>{isVi ? "Chưa có lịch" : "No schedule"}</span>
                      </div>
                    ) : (
                      combinedItems.map((entry) => {
                        if (entry.kind === "trainer") {
                          const w = entry.item;
                          return (
                            <button
                              key={`tw-${w.id}`}
                              type="button"
                              className={`${styles.timetableCardItem} ${styles.itemTrainer}`}
                              onClick={() => setSelectedItem({ type: "trainer", data: w })}
                              title={isVi ? `Bài tập của HLV ${w.trainerName}` : `Workout by ${w.trainerName}`}
                            >
                              {/* Hàng 1: Icon + Tên ngựa + Badges */}
                              <div className={styles.itemHeaderRow}>
                                <div className={`${styles.itemTitle} ${styles.itemTitleTrainer}`} title={w.horseName}>
                                  <Icon name="horse" inline size={13} />
                                  <span>{w.horseCode ? `${w.horseCode} - ${w.horseName}` : w.horseName}</span>
                                </div>
                                <div className={styles.itemBadgeWrapper}>
                                  <span className={`${styles.badgeTag} ${styles.badgeTrainer}`}>
                                    <Icon name="award" inline size={10} strokeWidth={2.2} />
                                    {isVi ? "HLV Trưởng" : "Head Trainer"}
                                  </span>
                                  <span className={`${styles.badgeTag} ${styles.badgeStatus}`}>
                                    {isVi ? "Đã xếp lịch" : "Scheduled"}
                                  </span>
                                </div>
                              </div>

                              {/* Hàng 2: Giờ + Loại bài tập */}
                              <div className={styles.itemTimeRow}>
                                <Icon name="clock" inline size={12} />
                                <span className={styles.timeValue}>{w.timeRange}</span>
                                <span className={styles.itemDetail}>· {w.workoutType}</span>
                              </div>

                              {/* Hàng 3: Mặt sân / cự ly */}
                              <div className={styles.itemLocationRow}>
                                <Icon name="pin" inline size={11} />
                                <span>{w.trackName} {w.targetMeters ? `· ${w.targetMeters}m` : ""}</span>
                              </div>

                              {/* Hàng 4: Huấn luyện viên phụ trách */}
                              <div className={styles.itemStaffRow}>
                                <Icon name="user" inline size={11} />
                                <span>{w.trainerName}</span>
                              </div>
                            </button>
                          );
                        } else {
                          const s = entry.item;
                          return (
                            <button
                              key={`gs-${s.id}`}
                              type="button"
                              className={`${styles.timetableCardItem} ${styles.itemGroom}`}
                              onClick={() => setSelectedItem({ type: "groom", data: s })}
                              title={isVi ? `Ca trực của Groom ${s.groomName}` : `Shift by ${s.groomName}`}
                            >
                              {/* Hàng 1: Icon + Khu chuồng + Badges */}
                              <div className={styles.itemHeaderRow}>
                                <div className={`${styles.itemTitle} ${styles.itemTitleGroom}`} title={s.zoneName}>
                                  <Icon name="home" inline size={13} />
                                  <span>{s.zoneName}</span>
                                </div>
                                <div className={styles.itemBadgeWrapper}>
                                  <span className={`${styles.badgeTag} ${styles.badgeGroom}`}>
                                    <Icon name="calendar" inline size={10} strokeWidth={2.2} />
                                    Groom
                                  </span>
                                  <span className={`${styles.badgeTag} ${styles.badgeStatus}`}>
                                    {isVi ? "Đã xếp ca" : "Rostered"}
                                  </span>
                                </div>
                              </div>

                              {/* Hàng 2: Giờ + Ca trực */}
                              <div className={styles.itemTimeRow}>
                                <Icon name="clock" inline size={12} />
                                <span className={styles.timeValue}>{s.timeRange}</span>
                                <span className={styles.itemDetail}>· {s.shiftName}</span>
                              </div>

                              {/* Hàng 3: Nhân viên Groom phụ trách */}
                              <div className={styles.itemStaffRow}>
                                <Icon name="user" inline size={11} />
                                <span>{s.groomName}</span>
                              </div>

                              {/* Hàng 4: Nhiệm vụ phân công */}
                              {s.duty && (
                                <div className={styles.itemDutyRow} title={s.duty}>
                                  <Icon name="check" inline size={10} />
                                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {s.duty}
                                  </span>
                                </div>
                              )}
                            </button>
                          );
                        }
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Chi tiết Modal khi click vào thẻ */}
      {selectedItem && (
        <Modal
          title={
            selectedItem.type === "trainer"
              ? isVi ? `Chi tiết buổi tập: ${selectedItem.data.horseName}` : `Workout Details: ${selectedItem.data.horseName}`
              : isVi ? `Chi tiết ca trực: ${selectedItem.data.shiftName}` : `Shift Details: ${selectedItem.data.shiftName}`
          }
          width={500}
          onClose={() => setSelectedItem(null)}
          foot={
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              {selectedItem.type === "trainer" ? (
                <LinkButton to="/calendar" size="sm" tone="primary">
                  {isVi ? "Mở Lịch tuần HLV" : "Open Trainer Calendar"}
                </LinkButton>
              ) : (
                <LinkButton to="/stable/shifts" size="sm" tone="primary">
                  {isVi ? "Mở Bảng phân ca Groom" : "Open Groom Roster"}
                </LinkButton>
              )}
              <Button size="sm" tone="ghost" onClick={() => setSelectedItem(null)}>
                {isVi ? "Đóng" : "Close"}
              </Button>
            </div>
          }
        >
          {selectedItem.type === "trainer" ? (
            <div className={styles.detailGrid}>
              <span className={styles.detailLabel}>{isVi ? "Ngựa thi đấu:" : "Racehorse:"}</span>
              <span className={styles.detailVal}>
                {selectedItem.data.horseCode ? `${selectedItem.data.horseCode} - ` : ""}
                {selectedItem.data.horseName}
              </span>

              <span className={styles.detailLabel}>{isVi ? "Huấn luyện viên:" : "Trainer:"}</span>
              <span className={styles.detailVal}>{selectedItem.data.trainerName}</span>

              <span className={styles.detailLabel}>{isVi ? "Thời gian:" : "Schedule Time:"}</span>
              <span className={styles.detailVal}>{selectedItem.data.date} ({selectedItem.data.timeRange})</span>

              <span className={styles.detailLabel}>{isVi ? "Bài tập:" : "Exercise Type:"}</span>
              <span className={styles.detailVal}>{selectedItem.data.workoutType}</span>

              <span className={styles.detailLabel}>{isVi ? "Mặt sân & Cự ly:" : "Track & Distance:"}</span>
              <span className={styles.detailVal}>{selectedItem.data.trackName} · {selectedItem.data.targetMeters}m</span>
            </div>
          ) : (
            <div className={styles.detailGrid}>
              <span className={styles.detailLabel}>{isVi ? "Ca trực:" : "Shift Name:"}</span>
              <span className={styles.detailVal}>{selectedItem.data.shiftName}</span>

              <span className={styles.detailLabel}>{isVi ? "Nhân viên Groom:" : "Groom Staff:"}</span>
              <span className={styles.detailVal}>{selectedItem.data.groomName}</span>

              <span className={styles.detailLabel}>{isVi ? "Thời gian:" : "Schedule Time:"}</span>
              <span className={styles.detailVal}>{selectedItem.data.date} ({selectedItem.data.timeRange})</span>

              <span className={styles.detailLabel}>{isVi ? "Khu vực chuồng:" : "Stable Zone:"}</span>
              <span className={styles.detailVal}>{selectedItem.data.zoneName}</span>

              {selectedItem.data.duty && (
                <>
                  <span className={styles.detailLabel}>{isVi ? "Nhiệm vụ bàn giao:" : "Assigned Duties:"}</span>
                  <span className={styles.detailVal}>{selectedItem.data.duty}</span>
                </>
              )}
            </div>
          )}
        </Modal>
      )}

      {/* Liên kết điều hướng nhanh chân trang */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "8px", flexWrap: "wrap", gap: "12px" }}>
        <Link to="/staff" style={{ fontSize: "13px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px", textDecoration: "none" }}>
          <Icon name="users" size={14} />
          <span>{isVi ? "Xem danh bạ nhân sự đầy đủ ↗" : "View full staff directory ↗"}</span>
        </Link>
        <div style={{ display: "flex", gap: "16px" }}>
          <Link to="/calendar" style={{ fontSize: "13px", color: "#2563eb", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px", textDecoration: "none" }}>
            <Icon name="award" size={14} />
            <span>{isVi ? "Lịch tuần huấn luyện (HLV) ↗" : "Trainer Weekly Calendar ↗"}</span>
          </Link>
          <Link to="/stable/shifts" style={{ fontSize: "13px", color: "#059669", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px", textDecoration: "none" }}>
            <Icon name="calendar" size={14} />
            <span>{isVi ? "Bảng phân ca Groom ↗" : "Full Groom Roster ↗"}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function addMinutes(time: string, mins: number): string {
  try {
    const [h, m] = time.split(":").map(Number);
    const total = (h || 0) * 60 + (m || 0) + mins;
    const newH = Math.floor(total / 60) % 24;
    const newM = total % 60;
    return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
  } catch {
    return time;
  }
}

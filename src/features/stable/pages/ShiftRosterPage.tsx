import { api } from "@/shared/lib/api";
import { ShiftSwapRequestModal } from "../components/ShiftSwapRequestModal";
import { useTranslation as useScreenTranslation } from "react-i18next";
import rosterStyles from "./ShiftRosterPage.module.css";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/shared/components/layout/PageHeader";
import styles from "./StableOperations.module.css";
import { Button } from "@/shared/components/ui/Button";
import { Badge } from "@/shared/components/ui/Badge";
import { Icon } from "@/shared/components/ui/Icon";
import { Alert } from "@/shared/components/ui/Alert";
import { Select } from "@/shared/components/form/Select";
import { useCurrentUser } from "@/shared/components/layout/AuthProvider";
import { useAppLanguage } from "@/shared/lib/language";
import { messageFor } from "@/shared/lib/messages";
import { tr } from "@/shared/i18n/tr";
import { getShifts } from "@/features/master-data/api/suppliesApi";
import type { ShiftCatalogItem } from "@/features/master-data/types/supplies";
import { getZones } from "../api";
import type { Zone } from "../types";
import {
  getActiveGrooms,
  getMyShifts,
  getShiftRosters,
} from "../api/shiftRosterApi";
import type {
  GroomUserSummary,
  MyShiftItem,
  ShiftRosterItem,
} from "../types/shiftRoster";
import { ShiftRosterModal } from "../components/ShiftRosterModal";
import { CopyWeekRosterModal } from "../components/CopyWeekRosterModal";
import { Modal } from "@/shared/components/ui/Modal";
import {
  getLocalizedShiftName,
  getLocalizedZoneName,
  parseGroomInfo,
} from "../utils/shiftLocalization";

function clubTodayDate() {
  return new Date(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date())+'T12:00:00');
}

function formatYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDMY(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const y = d.getFullYear();
  return `${day}/${m}/${y}`;
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay(); // 0 is Sun
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

const DAY_NAMES_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_NAMES_VI = [
  "Thứ 2",
  "Thứ 3",
  "Thứ 4",
  "Thứ 5",
  "Thứ 6",
  "Thứ 7",
  "Chủ nhật",
];

export default function ShiftRosterPage() {
  return <WeeklyShiftRosterPage />;
}

function WeeklyShiftRosterPage() {
  useScreenTranslation();
  const currentUser = useCurrentUser();
  const isManager = currentUser.role === "CLUB_MANAGER";
  const isGroom = currentUser.role === "GROOM";
  const isTrainer=currentUser.role==='HEAD_TRAINER';
  const [teamScope,setTeamScope]=useState<'mine'|'club'>('mine');
  const [responsibleVets,setResponsibleVets]=useState<Array<{id:string;fullName:string;horses:Array<{id:string;name:string}>}>>([]);
  const { isVietnamese: isVi } = useAppLanguage();

  // State tuần
  const [currentMonday, setCurrentMonday] = useState<Date>(() =>
    getMonday(clubTodayDate()),
  );
  const [selectedZoneId, setSelectedZoneId] = useState<string>("ALL");
  // Lọc theo người + popup thông tin khi bấm vào tên nhân viên chăm sóc.
  const [personId, setPersonId] = useState<string>("");
  const [personInfo, setPersonInfo] = useState<GroomUserSummary | null>(null);
  const [onlyMyShifts, setOnlyMyShifts] = useState<boolean>(false);

  // Dữ liệu
  const [zones, setZones] = useState<Zone[]>([]);
  const [shifts, setShifts] = useState<ShiftCatalogItem[]>([]);
  const [rosters, setRosters] = useState<ShiftRosterItem[]>([]);
  const [myShifts, setMyShifts] = useState<MyShiftItem[]>([]);
  const [allGrooms, setAllGrooms] = useState<GroomUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [swapRoster,setSwapRoster]=useState<ShiftRosterItem|null>(null);

  // Selected slot for modal
  const [selectedSlot, setSelectedSlot] = useState<{
    dateStr: string;
    formattedDate: string;
    shift: ShiftCatalogItem;
    zone: Zone;
    currentRosters: ShiftRosterItem[];
  } | null>(null);

  // Modal sao chép tuần
  const [showCopyModal, setShowCopyModal] = useState(false);

  // Mobile selected day index (0..6)
  const [mobileDayIdx, setMobileDayIdx] = useState(0);

  // Danh sách 7 ngày trong tuần
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date(currentMonday);
      d.setDate(currentMonday.getDate() + idx);
      return {
        date: d,
        dateStr: formatYMD(d),
        formattedDMY: formatDMY(d),
        dayName: isVi ? DAY_NAMES_VI[idx] : DAY_NAMES_EN[idx],
        isToday: formatYMD(d) === formatYMD(clubTodayDate()),
      };
    });
  }, [currentMonday, isVi]);

  const startDateStr = weekDays[0].dateStr;
  const endDateStr = weekDays[6].dateStr;

  const currentWeekMonday = getMonday(clubTodayDate());
  const isPastWeek = currentMonday.getTime() < currentWeekMonday.getTime();

  // Nhãn tuần trước và tuần này
  const prevMonday = new Date(currentMonday);
  prevMonday.setDate(currentMonday.getDate() - 7);
  const prevSunday = new Date(prevMonday);
  prevSunday.setDate(prevMonday.getDate() + 6);

  const sourceWeekLabel = `${tr("Week of")} ${formatDMY(prevMonday)} – ${formatDMY(prevSunday)}`;
  const targetWeekLabel = `${tr("Week of")} ${formatDMY(currentMonday)} – ${formatDMY(weekDays[6].date)}`;

  const fetchVersion=useRef(0);
  // Tải dữ liệu
  const fetchData = useCallback(async () => {
    const version=++fetchVersion.current;
    setLoading(true);
    setError("");
    setRosters([]);
    setResponsibleVets([]);
    setMyShifts([]);
    try {
      const [zList, sList, rList, gList] = await Promise.all([
        getZones(),
        getShifts({ includeInactive: false }),
        isTrainer ? api<{groomRosters:ShiftRosterItem[];responsibleVeterinarians:Array<{id:string;fullName:string;horses:Array<{id:string;name:string}>}>}>('GET',`/shift-rosters/care-team?startDate=${startDateStr}&endDate=${endDateStr}&scope=${teamScope}`) : getShiftRosters({
          startDate: startDateStr,
          endDate: endDateStr,
          zoneId: selectedZoneId !== "ALL" ? selectedZoneId : undefined,
        }),
        isManager ? getActiveGrooms() : Promise.resolve([]),
      ]);

      if(version!==fetchVersion.current)return;
      setZones(zList.filter((z) => z.isActive));
      setShifts(sList.filter((s) => s.isActive));
      if(Array.isArray(rList)){setRosters(rList);setResponsibleVets([]);}else{setRosters(rList.groomRosters);setResponsibleVets(rList.responsibleVeterinarians);}
      setAllGrooms(gList);

      if (isGroom) {
        const my = await getMyShifts({
          startDate: startDateStr,
          endDate: endDateStr,
          zoneId: selectedZoneId !== "ALL" ? selectedZoneId : undefined,
        });
        if(version===fetchVersion.current)setMyShifts(my);
      }
    } catch (err) {
      if(version===fetchVersion.current)setError(messageFor(err));
    } finally {
      if(version===fetchVersion.current)setLoading(false);
    }
  }, [startDateStr, endDateStr, selectedZoneId, isManager, isGroom, isTrainer, teamScope]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Thống kê số ca trực mỗi groom đã làm trong tuần
  const groomWeeklyCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of rosters) {
      map[r.groomUserId] = (map[r.groomUserId] || 0) + 1;
    }
    return map;
  }, [rosters]);

  // Điều hướng tuần
  const handlePrevWeek = () => {
    const d = new Date(currentMonday);
    d.setDate(currentMonday.getDate() - 7);
    setCurrentMonday(d);
  };

  const handleNextWeek = () => {
    const d = new Date(currentMonday);
    d.setDate(currentMonday.getDate() + 7);
    setCurrentMonday(d);
  };

  const handleCurrentWeek = () => {
    setCurrentMonday(getMonday(clubTodayDate()));
  };

  // Lọc khu
  const filteredZones = useMemo(() => {
    const byZone =
      selectedZoneId === "ALL"
        ? zones
        : zones.filter((z) => z.id === selectedZoneId);
    const scoped=(isTrainer && teamScope==='mine')?byZone.filter(zone=>rosters.some(row=>row.zoneId===zone.id)):byZone;
    if (!personId) return scoped;
    return scoped.filter((z) =>
      rosters.some((r) => r.zoneId === z.id && r.groomUserId === personId),
    );
  }, [zones, selectedZoneId, personId, rosters, isTrainer, teamScope]);

  // Ai có ca trong tuần đang xem (mỗi người một lần).
  const personOptions = useMemo(() => {
    const people = new Map<string, string>();
    for (const r of rosters)
      people.set(
        r.groomUserId,
        parseGroomInfo(r.groom.fullName, isVi).cleanName,
      );
    return [
      { value: "", label: tr("Everyone ({{count}})", { count: people.size }) },
      ...[...people]
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([value, label]) => ({ value, label })),
    ];
  }, [rosters, isVi]);

  const personShifts = personInfo
    ? rosters
        .filter((r) => r.groomUserId === personInfo.id)
        .sort(
          (a, b) =>
            a.date.localeCompare(b.date) ||
            a.shift.startTime.localeCompare(b.shift.startTime),
        )
    : [];

  // Lọc ca của tôi theo khu chuồng đã chọn
  const filteredMyShifts = useMemo(() => {
    if (selectedZoneId === "ALL") return myShifts;
    return myShifts.filter((s) => s.zone.id === selectedZoneId);
  }, [myShifts, selectedZoneId]);

  const zoneOptions = useMemo(
    () => [
      { value: "ALL", label: tr("All Zones") },
      ...zones.map((z) => ({
        value: z.id,
        label: getLocalizedZoneName(z, isVi),
      })),
    ],
    [zones, isVi],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {isTrainer && <section aria-label={tr('My horses’ care team')}>
        <label><input type="checkbox" checked={teamScope==='mine'} onChange={e=>setTeamScope(e.target.checked?'mine':'club')} /> {tr('My horses’ care team')}</label>
        <p>{teamScope==='mine'?tr('Showing Groom shifts in the current zones of your active training horses.'):tr('Showing club Groom shifts. Veterinary responsibilities below remain scoped to your horses.')}</p>
        <h2>{tr('Veterinarians responsible for open medical records')}</h2>
        <p>{tr('Veterinary duty schedules are not recorded in this system.')}</p>
        {responsibleVets.length?responsibleVets.map(vet=><p key={vet.id}><strong>{vet.fullName}</strong> · {vet.horses.map(h=>h.name).join(', ')}</p>):<p>{tr('No veterinarian is assigned to an open record for your horses.')}</p>}
      </section>}
      {isGroom && <Alert tone="info" title={tr('Your weekly roster')}>
        {myShifts.filter(row=>row.date.slice(0,10)===new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date())).map(row=><p key={row.id}>{row.shift.name} · {row.zone.name}</p>)}
        <Link to="/stable/my-shift">{tr('Open today’s checklist')}</Link>
      </Alert>}
      <PageHeader
        title={tr("Weekly Shift Roster")}
        description={tr(
          "Staff allocation matrix by date, shift and stall zone.",
        )}
        action={
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <Link to="/stalls" style={{ textDecoration: "none" }}>
              <Button tone="ghost">{tr("View Stall Map")}</Button>
            </Link>
            {isManager && (
              <Button tone="primary" onClick={() => setShowCopyModal(true)}>
                {tr("Copy from previous week")}
              </Button>
            )}
          </div>
        }
      />

      {error && <Alert tone="danger">{error}</Alert>}

      {/* Toolbar điều khiển */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          background: "var(--surface)",
          padding: "0.875rem 1rem",
          borderRadius: "var(--r-md)",
          border: "1px solid var(--border)",
        }}
      >
        {/* Điều hướng tuần */}
        <div className={styles.weekNavigation}>
          <Button tone="ghost" size="sm" onClick={handlePrevWeek}>
            <Icon name="chevronLeft" inline size={14} /> {tr("Previous week")}
          </Button>
          <Button tone="ghost" size="sm" onClick={handleCurrentWeek}>
            {tr("This week")}
          </Button>
          <Button tone="ghost" size="sm" onClick={handleNextWeek}>
            {tr("Next week")} <Icon name="chevronRight" inline size={14} />
          </Button>
          <span
            style={{
              fontWeight: 600,
              fontSize: "0.9375rem",
              marginLeft: "0.5rem",
            }}
          >
            {targetWeekLabel}
          </span>
        </div>

        {/* Bộ lọc */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div style={{ width: 200, maxWidth: "100%" }}>
            <Select
              value={selectedZoneId}
              options={zoneOptions}
              onChange={(e) => setSelectedZoneId(e.target.value)}
            />
          </div>
          <div style={{ width: 220, maxWidth: "100%" }}>
            <Select
              aria-label={tr("Filter by person")}
              value={personId}
              options={personOptions}
              onChange={(e) => setPersonId(e.target.value)}
            />
          </div>

          {isGroom && (
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                cursor: "pointer",
                fontWeight: 500,
                fontSize: "0.875rem",
              }}
            >
              <input
                type="checkbox"
                checked={onlyMyShifts}
                onChange={(e) => setOnlyMyShifts(e.target.checked)}
              />
              <span>{tr("My shifts only")}</span>
            </label>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div
          style={{
            padding: "3rem",
            textAlign: "center",
            color: "var(--muted)",
            background: "var(--surface)",
            borderRadius: "var(--r-md)",
          }}
        >
          {tr("Loading rosters...")}
        </div>
      ) : isGroom && onlyMyShifts ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "1.125rem" }}>
              {tr("Your personal roster for this week ({{count}} shifts)", {
                count: filteredMyShifts.length,
              })}
            </h3>
          </div>

          {filteredMyShifts.length === 0 ? (
            <div
              style={{
                padding: "2rem",
                textAlign: "center",
                color: "var(--muted)",
                background: "var(--surface)",
                borderRadius: "var(--r-md)",
              }}
            >
              {tr("You have no shifts assigned for this week.")}
            </div>
          ) : (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              {weekDays.map((day) => {
                const dayShifts = filteredMyShifts.filter((ms) =>
                  ms.date.startsWith(day.dateStr),
                );
                return (
                  <div
                    key={day.dateStr}
                    style={{
                      background: "var(--surface)",
                      border: day.isToday
                        ? "2px solid var(--brand)"
                        : "1px solid var(--border)",
                      borderRadius: "var(--r-md)",
                      overflow: "hidden",
                    }}
                  >
                    {/* Day Header */}
                    <div
                      style={{
                        padding: "0.75rem 1rem",
                        background: day.isToday
                          ? "var(--brand-50)"
                          : "var(--surface-muted)",
                        borderBottom: "1px solid var(--border)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.75rem",
                        }}
                      >
                        <span style={{ fontWeight: 700, fontSize: "1rem" }}>
                          {day.dayName}
                        </span>
                        <span
                          style={{
                            fontSize: "0.875rem",
                            color: "var(--muted)",
                          }}
                        >
                          {day.formattedDMY}
                        </span>
                        {day.isToday && (
                          <Badge tone="brand">{tr("Today")}</Badge>
                        )}
                      </div>
                      <Badge tone={dayShifts.length > 0 ? "ok" : "neutral"}>
                        {dayShifts.length > 0
                          ? tr("{{count}} shifts", { count: dayShifts.length })
                          : tr("Not assigned")}
                      </Badge>
                    </div>

                    {/* Shifts on this day */}
                    <div style={{ padding: "0.875rem 1rem" }}>
                      {dayShifts.length === 0 ? (
                        <div
                          style={{
                            fontSize: "0.875rem",
                            color: "var(--muted)",
                            fontStyle: "italic",
                            padding: "0.25rem 0",
                          }}
                        >
                          {tr("No duties scheduled for this day.")}
                        </div>
                      ) : (
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fill, minmax(min(100%, 300px), 1fr))",
                            gap: "0.875rem",
                          }}
                        >
                          {dayShifts.map((ms) => (
                            <div
                              key={ms.id}
                              style={{
                                background: "var(--surface-muted)",
                                border: "1px solid var(--border)",
                                borderRadius: "var(--r-sm)",
                                padding: "0.875rem",
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.5rem",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                }}
                              >
                                <Badge tone="brand">
                                  {getLocalizedShiftName(ms.shift, isVi)}
                                </Badge>
                                <span
                                  style={{
                                    fontWeight: 600,
                                    fontSize: "0.875rem",
                                  }}
                                >
                                  {ms.shift.startTime} – {ms.shift.endTime}
                                </span>
                              </div>

                              <div style={{ fontSize: "0.875rem" }}>
                                <span style={{ color: "var(--muted)" }}>
                                  {tr("Zone:")}
                                </span>{" "}
                                <strong>
                                  {getLocalizedZoneName(ms.zone, isVi)}
                                </strong>
                              </div>

                              {ms.notes && (
                                <div
                                  style={{
                                    fontSize: "0.8125rem",
                                    color: "var(--muted)",
                                    background: "var(--surface)",
                                    padding: "0.35rem 0.5rem",
                                    borderRadius: "var(--r-xs)",
                                  }}
                                >
                                  <strong>{tr("Notes:")}</strong> {ms.notes}
                                </div>
                              )}

                              <div
                                style={{
                                  borderTop: "1px solid var(--border)",
                                  paddingTop: "0.5rem",
                                  marginTop: "0.25rem",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    marginBottom: "0.375rem",
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: "0.75rem",
                                      color: "var(--muted)",
                                      fontWeight: 500,
                                    }}
                                  >
                                    {tr("Horses in zone:")}
                                  </span>
                                  <Badge tone="neutral">
                                    {tr("{{count}} horses", {
                                      count: ms.assignedHorsesCount,
                                    })}
                                  </Badge>
                                </div>
                                {ms.assignedHorses.length > 0 && (
                                  <div
                                    style={{
                                      display: "flex",
                                      flexWrap: "wrap",
                                      gap: "0.3rem",
                                    }}
                                  >
                                    {ms.assignedHorses.slice(0, 6).map((h) => (
                                      <span
                                        key={h.id}
                                        style={{
                                          fontSize: "0.75rem",
                                          padding: "0.15rem 0.4rem",
                                          background: "var(--surface)",
                                          borderRadius: "var(--r-xs)",
                                          border: "1px solid var(--border)",
                                        }}
                                      >
                                        {h.name}{" "}
                                        {h.isMedicalLocked &&
                                          `[${tr("Locked")}]`}
                                      </span>
                                    ))}
                                    {ms.assignedHorses.length > 6 && (
                                      <span
                                        style={{
                                          fontSize: "0.75rem",
                                          color: "var(--muted)",
                                        }}
                                      >
                                        +{ms.assignedHorses.length - 6}{" "}
                                        {tr("others")}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Ma trận Matrix Grid 7 ngày x Khu x Ca */
        <div>
          {/* Tabs cho Mobile view */}
          <div className={rosterStyles.daySelector}>
            {weekDays.map((d, i) => (
              <button
                key={d.dateStr}
                type="button"
                onClick={() => setMobileDayIdx(i)}
                aria-pressed={mobileDayIdx === i}
                style={{
                  padding: "0.5rem 0.75rem",
                  borderRadius: "var(--r-sm)",
                  border:
                    mobileDayIdx === i
                      ? "2px solid var(--brand)"
                      : "1px solid var(--border)",
                  background:
                    mobileDayIdx === i
                      ? "var(--brand-muted)"
                      : "var(--surface)",
                  fontWeight: mobileDayIdx === i ? 600 : 400,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {d.dayName} ({d.formattedDMY.slice(0, 5)})
              </button>
            ))}
          </div>

          {/* Lưới Matrix (Desktop/Tablet) */}
          <div
            style={{
              overflowX: "auto",
              background: "var(--surface)",
              borderRadius: "var(--r-md)",
              border: "1px solid var(--border)",
            }}
          >
            <table
              className={rosterStyles.matrix}
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.875rem",
                textAlign: "left",
                minWidth: 960,
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "var(--surface-muted)",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <th className={rosterStyles.zoneHead}>{tr("Zone")}</th>
                  <th className={rosterStyles.shiftHead}>{tr("Shift")}</th>
                  {weekDays.map((d, i) => (
                    <th
                      key={d.dateStr}
                      className={`${rosterStyles.dayHead} ${i === mobileDayIdx ? rosterStyles.selectedDay : rosterStyles.otherDay}`}
                      style={{
                        background: d.isToday ? "var(--brand-50)" : undefined,
                      }}
                    >
                      <div>{d.dayName}</div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: d.isToday
                            ? "var(--brand-700)"
                            : "var(--muted)",
                        }}
                      >
                        {d.formattedDMY} {d.isToday && ` • ${tr("Today")}`}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredZones.length === 0 || shifts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      style={{
                        padding: "2rem",
                        textAlign: "center",
                        color: "var(--muted)",
                      }}
                    >
                      {tr("No active zones or shifts available.")}
                    </td>
                  </tr>
                ) : (
                  filteredZones.flatMap((zone) =>
                    shifts.map((shift, sIdx) => {
                      const isFirstShiftOfZone = sIdx === 0;
                      return (
                        <tr
                          key={`${zone.id}-${shift.id}`}
                          className={
                            isFirstShiftOfZone
                              ? rosterStyles.zoneStart
                              : undefined
                          }
                        >
                          {/* Tên khu gộp cho mọi ca của khu */}
                          {isFirstShiftOfZone && (
                            <th
                              scope="rowgroup"
                              rowSpan={shifts.length}
                              className={rosterStyles.zoneCell}
                            >
                              {getLocalizedZoneName(zone, isVi)}
                            </th>
                          )}
                          <td className={rosterStyles.shiftCell}>
                            <div className={rosterStyles.shiftName}>
                              {getLocalizedShiftName(shift, isVi)}
                            </div>
                            <div className={rosterStyles.shiftTime}>
                              {shift.startTime}–{shift.endTime}
                            </div>
                            {shift.isOvernight && (
                              <div style={{ marginTop: "0.25rem" }}>
                                <Badge tone="warn">{tr("Overnight")}</Badge>
                              </div>
                            )}
                          </td>

                          {/* 7 ô cho 7 ngày trong tuần */}
                          {weekDays.map((day, dayIndex) => {
                            const slotRosters = rosters.filter(
                              (r) =>
                                r.date.startsWith(day.dateStr) &&
                                r.shiftId === shift.id &&
                                r.zoneId === zone.id,
                            );

                            const hasGroom = slotRosters.length > 0;
                            const localizedZone = getLocalizedZoneName(
                              zone,
                              isVi,
                            );
                            const localizedShift = getLocalizedShiftName(
                              shift,
                              isVi,
                            );

                            return (
                              <td
                                key={day.dateStr}
                                className={[
                                  rosterStyles.cell,
                                  day.isToday ? rosterStyles.cellToday : "",
                                  dayIndex === mobileDayIdx
                                    ? rosterStyles.selectedDay
                                    : rosterStyles.otherDay,
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                role={(isManager || isGroom) ? "button" : undefined}
                                tabIndex={(isManager || isGroom) ? 0 : undefined}
                                aria-label={
                                  (isManager || isGroom)
                                    ? [
                                        localizedZone,
                                        localizedShift,
                                        day.formattedDMY,
                                        hasGroom
                                          ? slotRosters
                                              .map(
                                                (r) =>
                                                  parseGroomInfo(
                                                    r.groom.fullName,
                                                    isVi,
                                                  ).cleanName,
                                              )
                                              .join(", ")
                                          : tr("No groom assigned"),
                                      ].join(" · ")
                                    : undefined
                                }
                                onKeyDown={
                                  (isManager || isGroom)
                                    ? (event) => {
                                        if (
                                          event.key === "Enter" ||
                                          event.key === " "
                                        ) {
                                          event.preventDefault();
                                          event.currentTarget.click();
                                        }
                                      }
                                    : undefined
                                }
                                onClick={() => {
                                  if ((isManager || isGroom)) {
                                    setSelectedSlot({
                                      dateStr: day.dateStr,
                                      formattedDate: day.formattedDMY,
                                      shift,
                                      zone,
                                      currentRosters: slotRosters,
                                    });
                                  }
                                }}
                              >
                                {hasGroom ? (
                                  <div className={rosterStyles.groomList}>
                                    {slotRosters.map((r) => {
                                      const groomInfo = parseGroomInfo(
                                        r.groom.fullName,
                                        isVi,
                                      );
                                      const isGroomInactive =
                                        r.groom.status === "LOCKED" ||
                                        r.groom.status === "INACTIVE";
                                      return (
                                        <div
                                          key={r.id}
                                          data-own-shift={r.groomUserId===currentUser.id ? "true":undefined}
                                          className={rosterStyles.groomCard}
                                          role="button"
                                          tabIndex={0}
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            if(isGroom)setSwapRoster(r);else setPersonInfo(r.groom);
                                          }}
                                          onKeyDown={(event) => {
                                            if (
                                              event.key === "Enter" ||
                                              event.key === " "
                                            ) {
                                              event.preventDefault();
                                              event.stopPropagation();
                                              if(isGroom)setSwapRoster(r);else setPersonInfo(r.groom);
                                            }
                                          }}
                                          style={{
                                            cursor: "pointer",
                                            opacity:
                                              personId &&
                                              r.groomUserId !== personId
                                                ? 0.35
                                                : 1,
                                            ...(isGroomInactive
                                              ? {
                                                  border: "1px solid #f87171",
                                                  backgroundColor: "#fef2f2",
                                                }
                                              : {}),
                                          }}
                                          title={
                                            r.notes
                                              ? `${groomInfo.cleanName} · ${groomInfo.roleLabel} (${r.notes})`
                                              : `${groomInfo.cleanName} · ${groomInfo.roleLabel}`
                                          }
                                        >
                                          <div
                                            className={rosterStyles.groomAvatar}
                                            aria-hidden="true"
                                          >
                                            {groomInfo.initialsText}
                                          </div>
                                          <div
                                            className={rosterStyles.groomMeta}
                                          >
                                            <span
                                              className={rosterStyles.groomName}
                                              style={
                                                isGroomInactive
                                                  ? { color: "#b91c1c" }
                                                  : undefined
                                              }
                                            >
                                              {groomInfo.cleanName}{r.groomUserId===currentUser.id && <Badge tone="ok">{tr("Your shift")}</Badge>}
                                              {isGroomInactive && (
                                                <span
                                                  style={{
                                                    marginLeft: 4,
                                                    fontSize: 9,
                                                    fontWeight: 700,
                                                    color: "#dc2626",
                                                    backgroundColor:
                                                      "rgba(239, 68, 68, 0.15)",
                                                    padding: "1px 4px",
                                                    borderRadius: 3,
                                                  }}
                                                >
                                                  {isVi ? "Đã khóa" : "Locked"}
                                                </span>
                                              )}
                                            </span>
                                            {groomInfo.roleLabel && (
                                              <span
                                                className={
                                                  rosterStyles.groomRole
                                                }
                                              >
                                                {groomInfo.roleLabel}
                                              </span>
                                            )}
                                          </div>
                                          {r.notes && (
                                            <span
                                              className={
                                                rosterStyles.groomNoteBadge
                                              }
                                              title={r.notes}
                                            >
                                              <Icon
                                                name="clipboard"
                                                size={11}
                                              />
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : isManager ? (
                                  <div className={rosterStyles.emptySlotAction}>
                                    <div
                                      className={rosterStyles.emptySlotIcon}
                                      aria-hidden="true"
                                    >
                                      <Icon name="plus" size={12} />
                                    </div>
                                    <span
                                      className={rosterStyles.emptySlotTitle}
                                    >
                                      {tr("+ Assign")}
                                    </span>
                                    <span
                                      className={rosterStyles.emptySlotSubtext}
                                    >
                                      {tr("No groom assigned")}
                                    </span>
                                  </div>
                                ) : (
                                  <div
                                    className={rosterStyles.emptySlotReadOnly}
                                  >
                                    <span className={rosterStyles.emptyDot} />
                                    <span>{tr("No groom assigned")}</span>
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    }),
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Popup thông tin nhân viên chăm sóc */}
      {personInfo && (
        <Modal
          title={parseGroomInfo(personInfo.fullName, isVi).cleanName}
          subtitle={tr("Groom")}
          width={420}
          onClose={() => setPersonInfo(null)}
          foot={
            <Button
              tone="secondary"
              size="sm"
              onClick={() => {
                setPersonId(personId === personInfo.id ? "" : personInfo.id);
                setPersonInfo(null);
              }}
            >
              {personId === personInfo.id
                ? tr("Show everyone")
                : tr("Show only this person")}
            </Button>
          }
        >
          <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
            <div>
              {tr("Email")}:{" "}
              <a href={`mailto:${personInfo.email}`}>{personInfo.email}</a>
            </div>
            <div>
              {tr("Phone")}:{" "}
              {personInfo.phoneNumber ? (
                <a href={`tel:${personInfo.phoneNumber}`}>
                  {personInfo.phoneNumber}
                </a>
              ) : (
                "—"
              )}
            </div>
            {(personInfo.status === "LOCKED" ||
              personInfo.status === "INACTIVE") && (
              <Badge tone="danger">{isVi ? "Đã khóa" : "Locked"}</Badge>
            )}
            <strong style={{ marginTop: 8 }}>
              {tr("Shifts this week ({{count}})", {
                count: personShifts.length,
              })}
            </strong>
            {personShifts.map((r) => (
              <div key={r.id}>
                {formatDMY(new Date(r.date)).slice(0, 5)} ·{" "}
                {getLocalizedZoneName(r.zone, isVi)} ·{" "}
                {getLocalizedShiftName(r.shift, isVi)} ({r.shift.startTime}–
                {r.shift.endTime})
              </div>
            ))}
          </div>
        </Modal>
      )}

      {selectedSlot && isGroom && <Modal title={`${selectedSlot.formattedDate} · ${selectedSlot.shift.name} · ${selectedSlot.zone.name}`} onClose={()=>setSelectedSlot(null)}>
        {selectedSlot.currentRosters.length ? selectedSlot.currentRosters.map(row=><Button key={row.id} tone="secondary" onClick={()=>{setSwapRoster(row);setSelectedSlot(null);}}>{row.groomUserId===currentUser.id?tr('Your shift'):row.groom.fullName}</Button>):<p>{tr('No duties scheduled for this day.')}</p>}
      </Modal>}
      {swapRoster && isGroom && <ShiftSwapRequestModal selected={swapRoster} rosters={rosters} onClose={()=>setSwapRoster(null)} />}
      {/* Modal Phân ca một ô DL-4.01 */}
      {selectedSlot && isManager && (
        <ShiftRosterModal
          date={selectedSlot.dateStr}
          formattedDate={selectedSlot.formattedDate}
          shift={selectedSlot.shift}
          zone={selectedSlot.zone}
          currentRosters={selectedSlot.currentRosters}
          allGrooms={allGrooms}
          groomWeeklyCounts={groomWeeklyCounts}
          onClose={() => setSelectedSlot(null)}
          onSaved={() => {
            setSelectedSlot(null);
            fetchData();
          }}
        />
      )}

      {/* Modal Sao chép phân ca tuần DL-4.02 */}
      {showCopyModal && (
        <CopyWeekRosterModal
          sourceWeekStart={formatYMD(prevMonday)}
          sourceWeekLabel={sourceWeekLabel}
          targetWeekStart={formatYMD(currentMonday)}
          targetWeekLabel={targetWeekLabel}
          isPastTargetWeek={isPastWeek}
          onClose={() => setShowCopyModal(false)}
          onCopied={() => {
            setShowCopyModal(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

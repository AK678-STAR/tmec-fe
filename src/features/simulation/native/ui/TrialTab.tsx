import { st } from "../i18n";
import { resolveEventId } from "../../engine/socketTransport";
// Chạy thử 1 ngựa trên 3 mặt sân (SIM-03, SIM-04) + sự cố trên đường chạy (SIM-06) + chặn theo Medical Lock (SIM-07).
import { useEffect, useRef, useState } from "react";
import { publish } from "../../engine/bus";
import {
  completeCooldown,
  COOLDOWN_S,
  createRun,
  createSimulationTicker,
  formatMicrochip,
  INTENSITY_PACE,
  jumpLift,
  stepRun,
  summarize,
  triggerIncident,
  type HorseProfile,
  type Intensity,
  type Obstacle,
  type RunState,
  type RunSummary,
  type SimulationTicker,
  type Surface,
  type TrackCondition,
} from "../../engine/engine";
import { blockReason } from "../../engine/horses";
import { incidentPacket, newSessionId, tickPacket, workoutFinishedPacket } from "../../engine/packets";
import { drawObstacles, drawRunner, drawTrack, drawWeather } from "../render/scenes";
import type { Sprites } from "../render/sprites";
import { PixelCanvas } from "./PixelCanvas";
import { CHART_POINTS, formatTime, Hud, LiveChart, snapshotOf, type ChartPoint, type HudSnapshot } from "./Telemetry";
import s from "./ui.module.css";
import t from "./Tabs.module.css";
import { TrackSetup } from "./TrackSetup";
import { CONDITION_LABEL, DISTANCES, SURFACE_LABEL } from "./trackConstants";

const INTENSITY_LABEL: Record<Intensity, string> = { LIGHT: "Nhẹ", MODERATE: "Vừa", HEAVY: "Nặng" };
const SUBSTEP = 0.05;

type Phase = "IDLE" | "RUNNING" | "COOLDOWN" | "DONE" | "ABORTED";

interface Props {
  horse: HorseProfile;
  sprites: Sprites;
  speed: number;
  sessionId?: string;
  initialWorkout?: {
    surface?: Surface;
    distance?: number;
    intensity?: Intensity;
    condition?: TrackCondition;
    obstacles?: Obstacle[];
  };
  /** Web chính mở với autorun=1: chạy engine ngay, không hoạt ảnh. */
  autoRun?: boolean;
  canRun: boolean;
  onActivity: (active: boolean) => void;
  onFinished: (eventId: string) => void;
}

export function TrialTab({ horse, sprites, speed, sessionId, initialWorkout, autoRun, canRun, onActivity, onFinished }: Props) {
  const [surface, setSurface] = useState<Surface>(initialWorkout?.surface || "GRASS");
  const [distance, setDistance] = useState(initialWorkout?.distance || 1000);
  const [intensity, setIntensity] = useState<Intensity>(initialWorkout?.intensity || "MODERATE");
  const [condition, setCondition] = useState<TrackCondition>(initialWorkout?.condition || "GOOD");
  const [obstacles, setObstacles] = useState<Obstacle[]>(initialWorkout?.obstacles || []);
  const [phase, setPhase] = useState<Phase>("IDLE");
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [incidentKind, setIncidentKind] = useState<RunState['incident']>(null);

  const runRef = useRef<RunState | null>(null);
  const sessionRef = useRef(sessionId?.trim() || "");
  const horseRef = useRef(horse);
  horseRef.current = horse;
  const series = useRef<ChartPoint[]>([]);
  const tickerRef = useRef<SimulationTicker>(createSimulationTicker(1.0));
  const anim = useRef({ phase: 0, hudAcc: 0, finishedSent: false, realT: 0, nextChartT: 1 });

  // Đổi ngựa khi đang chạy → hủy phiên hiện tại để không lẫn dữ liệu.
  const runningHorseId = useRef<string | null>(null);
  if (runningHorseId.current !== null && runningHorseId.current !== horse.id) {
    runningHorseId.current = null;
    runRef.current = null;
    series.current = [];
    tickerRef.current.reset();
  }

  const blocked = blockReason(horse);
  const heavyBlocked = blocked !== null && intensity !== "LIGHT";
  const busy = phase === "RUNNING" || phase === "COOLDOWN";
  const isSessionWorkout = Boolean(sessionId || initialWorkout);
  const hasAuthoritativeObstacles = Boolean(initialWorkout?.obstacles && initialWorkout.obstacles.length > 0);
  const showObstacleAuthoring = !isSessionWorkout || hasAuthoritativeObstacles;
  const distanceOptions = DISTANCES.includes(distance)
    ? DISTANCES
    : [...DISTANCES, distance].sort((a, b) => a - b);

  // Khi khóa y tế được đồng bộ tới (R-5):
  // Lập tức vô hiệu hóa bài tập nặng và chuyển về Nhẹ.
  // Nếu bài Vừa/Nặng đang chạy dở, lập tức chuyển ngay sang trạng thái an toàn (Nhẹ) để không phát thêm telemetry nặng.
  // Khi khóa được gỡ (lift), ngựa trở về trạng thái hợp lệ nhưng không tự ý kích hoạt lại bài nặng không an toàn.
  useEffect(() => {
    if (blocked !== null) {
      if (intensity !== "LIGHT") {
        setIntensity("LIGHT");
      }
      if (runRef.current && (runRef.current.pace > INTENSITY_PACE.LIGHT || intensity !== "LIGHT")) {
        runRef.current.pace = INTENSITY_PACE.LIGHT;
      }
    }
  }, [blocked, intensity]);

  function start() {
    if (!canRun || anim.current.finishedSent || busy) return;
    onActivity(true);
    const seed = (Date.now() & 0x7fffffff) | 0;
    const cfg = { surface, distanceM: distance, pace: INTENSITY_PACE[intensity], condition, obstacles };
    sessionRef.current = sessionId?.trim() || sessionRef.current || newSessionId("WRK");
    publish("sim:workout_command", "IN", {
      event: "sim:workout_command",
      session_id: sessionRef.current,
      horse_id: horse.id,
      action: "START",
      surface,
      target_distance_m: distance,
      intensity,
      track_condition: condition,
      obstacles: obstacles.map((o) => ({ kind: o.kind, at_m: o.atM })),
      source: "LOCAL_OPERATOR",
    });
    runRef.current = createRun(horse, cfg, seed);
    runningHorseId.current = horse.id;
    series.current = [{ speedKmh: runRef.current.v * 3.6, hr: runRef.current.hr }];
    tickerRef.current.reset();
    anim.current = { phase: 0, hudAcc: 0, finishedSent: false, realT: 0, nextChartT: 1 };
    setSummary(null);
    setPhase("RUNNING");
    setHud(snapshotOf(runRef.current));
  }

  function stop() {
    const run = runRef.current;
    // Đã về đích: không coi là sự cố, tua nốt phần hồi phục rồi chốt kết quả.
    if (run && !anim.current.finishedSent && run.status === "COOLDOWN") {
      completeCooldown(run, horseRef.current);
      finish(run);
      return;
    }
    if (run && !anim.current.finishedSent) {
      run.status = "ABORTED_INJURY";
      run.v = 0;
      run.pace = 0;
      finish(run);
      return;
    }
    runRef.current = null;
    runningHorseId.current = null;
    tickerRef.current.reset();
    setPhase("IDLE");
    setHud(null);
  }

  function incident(kind: "FRACTURE" | "LAMENESS") {
    const run = runRef.current;
    if (!run || run.status !== "RUNNING" || run.incident) return;
    triggerIncident(run, kind);
    setIncidentKind(kind);
    publish("sim:incident_report", "OUT", incidentPacket(sessionRef.current, horse, kind, "TRACK", run));
    if (kind === "FRACTURE") setPhase("ABORTED");
  }

  function finish(run: RunState) {
    if (anim.current.finishedSent) return;
    anim.current.finishedSent = true;
    run.v = 0;
    run.pace = 0;
    const packet = workoutFinishedPacket(sessionRef.current, horseRef.current, run);
    publish("sim:session_finished", "OUT", packet);
    onFinished(resolveEventId("sim:session_finished", packet));
    onActivity(false);
    setSummary(summarize(run));
    setPhase(run.status === "ABORTED_INJURY" ? "ABORTED" : "DONE");
    setHud(snapshotOf(run));
  }

  // Web chính bấm "Tải chỉ số từ Simulator": chạy engine thật không hoạt ảnh, gồm 10 phút hồi phục, rồi gửi kết quả.
  // Ref chặn chạy lại khi StrictMode gọi effect hai lần.
  const autoRanRef = useRef(false);
  useEffect(() => {
    if (!autoRun || autoRanRef.current || heavyBlocked || !canRun) return;
    autoRanRef.current = true;
    start();
    const run = runRef.current;
    if (!run) return;
    while (run.status === "RUNNING" && run.t < 2000) stepRun(run, horseRef.current, SUBSTEP);
    completeCooldown(run, horseRef.current);
    finish(run);
  }, [autoRun, heavyBlocked, canRun]);

  const onFrame = (ctx: CanvasRenderingContext2D, w: number, h: number, dtReal: number) => {
    const a = anim.current;
    const run = runRef.current;
    a.realT += dtReal;
    if (run && !a.finishedSent) {
      // R-5: Nếu khóa y tế kích hoạt trong lúc đang chạy, hạ pace xuống Nhẹ ngay lập tức
      if (blocked !== null && run.pace > INTENSITY_PACE.LIGHT) {
        run.pace = INTENSITY_PACE.LIGHT;
      }
      const paceMultiplier = run.status === "COOLDOWN" && speed > 0 ? Math.max(speed, 10) : speed;
      let simDt = canRun ? dtReal * paceMultiplier : 0;
      while (simDt > 1e-6) {
        const step = Math.min(SUBSTEP, simDt);
        simDt -= step;
        stepRun(run, horseRef.current, step);
        const cyclesPerSec = run.v < 2.6 ? run.v * 0.55 : run.strideFreqHz;
        a.phase += cyclesPerSec * step;
        while (run.t + 1e-9 >= a.nextChartT) {
          series.current = [...series.current, { speedKmh: run.v * 3.6, hr: run.hr }].slice(-CHART_POINTS);
          a.nextChartT += 1;
        }
        const injuredStopped = run.status === "ABORTED_INJURY" && run.v < 0.1;
        // Qua vạch đích engine chuyển sang COOLDOWN; chỉ chốt khi đủ 10 phút đi bộ để có nhịp tim hồi phục.
        if (run.status === "FINISHED" || injuredStopped) {
          finish(run);
          break;
        }
      }
      // R-4: Ticker 1.0 Hz ±5% theo đồng hồ thực (dtReal), độc lập với tốc độ mô phỏng speed (1x, 10x, 60x)
      if (!a.finishedSent) {
        tickerRef.current.step(dtReal, () => {
          publish("sim:telemetry_tick", "OUT", tickPacket(sessionRef.current, horseRef.current, run, speed));
        });
      }
      a.hudAcc += dtReal;
      if (a.hudAcc > 0.15) {
        a.hudAcc = 0;
        setHud(snapshotOf(run));
        if (run.status === "COOLDOWN") setPhase((p) => (p === "RUNNING" ? "COOLDOWN" : p));
      }
    }

    // ---- vẽ
    const ppm = w / 42;
    const dist = run?.distance ?? 0;
    const target = run?.targetM ?? distance;
    const cameraM = dist - (w * 0.38) / ppm;
    const railTop = h * 0.4;
    const railBottom = h * 0.93;
    const layout = { cameraM, ppm, railTop, railBottom };
    const baseY = h * 0.86;
    drawTrack(ctx, w, h, run?.surface ?? surface, target, layout);
    drawObstacles(ctx, run?.obstacles ?? obstacles, layout, baseY, h * 0.44, a.realT, run && run.v > 1 ? run.distance : null);
    drawRunner(
      ctx,
      sprites,
      horseRef.current,
      {
        v: run?.v ?? 0,
        status: run?.status ?? "RUNNING",
        incident: run?.incident ?? null,
        phase: a.phase,
        t: run ? run.t : a.realT,
      },
      (dist - cameraM) * ppm,
      baseY - (run ? jumpLift(run) : 0) * h * 0.2,
      h * 0.44,
    );
    drawWeather(ctx, w, h, run?.condition ?? condition, a.realT, railTop, railBottom);
  };

  const cooldownLeft = hud && phase === "COOLDOWN" && runRef.current?.finishTime != null
    ? Math.max(0, COOLDOWN_S - (hud.t - runRef.current.finishTime))
    : null;

  return (
    <div className={t.stack} data-testid="native-trial-screen">
      <section className={s.card}>
        <div className={s.cardHead}>
          <div>
            <h2 className={s.cardTitle}>
              {st("Chạy thử ·")}<span className={t.horseName}>{horse.name}</span>
            </h2>
            <div style={{ display: "flex", gap: "12px", alignItems: "center", fontSize: "0.85rem", color: "var(--muted)", marginTop: "4px" }}>
              <span data-testid="trial-horse-weight">{st("Cân nặng:")}<strong>{horse.weightKg ? `${horse.weightKg} kg` : st("Chưa có dữ liệu")}</strong></span>
              {(horse as any).stallCode && <span data-testid="trial-horse-stall">{st("Chuồng:")}<strong>{(horse as any).stallCode}</strong></span>}
              {horse.microchip && <span data-testid="trial-horse-chip">Chip: <strong>{formatMicrochip(horse.microchip)}</strong></span>}
            </div>
          </div>
          <PhasePill phase={phase} cooldownLeft={cooldownLeft} />
        </div>
        <div className={s.cardBody}>
          {isSessionWorkout && (
            <div style={{ fontSize: "0.82rem", color: "var(--muted)", margin: "0 0 10px 0" }} data-testid="prescribed-workout-notice">
              {st("🔒 Cấu hình bài tập chỉ định từ Hệ thống Web (Bất biến:")}{st(SURFACE_LABEL[surface])} · {distance}m · {st(INTENSITY_LABEL[intensity])})
            </div>
          )}
          {autoRun && (phase === "DONE" || phase === "ABORTED") && (
            <p className={s.notice} data-testid="autorun-done-notice">
              {st("Đã tính xong bài tập và hồi phục. Đang đồng bộ bản nháp vào biểu mẫu bên dưới.")}</p>
          )}
          <div className={s.row} data-control>
            <div className={s.field}>
              {st("Mặt sân")}<div className={s.segmented} role="group" aria-label={st("Mặt sân")}>
                {(Object.keys(SURFACE_LABEL) as Surface[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={s.segment}
                    aria-pressed={surface === k}
                    disabled={busy || isSessionWorkout}
                    onClick={() => setSurface(k)}
                  >
                    {st(SURFACE_LABEL[k])}
                  </button>
                ))}
              </div>
            </div>
            <div className={s.field}>
              {st("Cự ly")}<div className={s.segmented} role="group" aria-label={st("Cự ly")}>
                {distanceOptions.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={s.segment}
                    aria-pressed={distance === d}
                    disabled={busy || isSessionWorkout}
                    onClick={() => setDistance(d)}
                  >
                    {d}m
                  </button>
                ))}
              </div>
            </div>
            <div className={s.field}>
              {st("Cường độ")}<div className={s.segmented} role="group" aria-label={st("Cường độ")}>
                {(Object.keys(INTENSITY_LABEL) as Intensity[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={s.segment}
                    aria-pressed={intensity === k}
                    disabled={busy || isSessionWorkout || (blocked !== null && k !== "LIGHT")}
                    onClick={() => setIntensity(k)}
                  >
                    {st(INTENSITY_LABEL[k])}
                  </button>
                ))}
              </div>
            </div>
            <div className={s.spacer} />
            {busy ? (
              <button type="button" className={s.btn} onClick={stop}>
                {phase === "COOLDOWN" ? st("Bỏ qua hồi phục, lấy kết quả") : st("Dừng phiên")}
              </button>
            ) : (
              <button type="button" className={s.primary} onClick={start} aria-label={st("Bắt đầu chạy thử")} disabled={heavyBlocked || !canRun || phase === "DONE" || phase === "ABORTED"}>
                {st("» Bắt đầu chạy thử")}</button>
            )}
          </div>
          {blocked && (
            <p className={heavyBlocked ? s.noticeDanger : s.notice}>
              {heavyBlocked
                ? st("{{v0}}: bài Vừa/Nặng bị chặn vì đang khóa y tế. Chỉ được chạy bài Nhẹ phục hồi theo chỉ định của bác sĩ thú y.", { v0: blocked })
                : st("{{v0}}: đang chạy bài Nhẹ phục hồi — cần bác sĩ thú y giám sát.", { v0: blocked })}
            </p>
          )}
          {showObstacleAuthoring && (
            <div data-control>
            <TrackSetup
              distance={distance}
              condition={condition}
              obstacles={obstacles}
              disabled={busy || isSessionWorkout}
              onCondition={setCondition}
              onObstacles={setObstacles}
            />
            </div>
          )}
        </div>
        <div className={s.sceneFrame}>
          <PixelCanvas aspect={0.34} onFrame={onFrame} label={st("Đường chạy thử mặt sân {{v0}}", { v0: st(SURFACE_LABEL[surface]) })} />
        </div>
        <div className={`${s.cardBody} ${t.incidentBar}`} data-control>
          <span className={s.hint}>{st("Tạo sự cố trên đường chạy (hệ thống báo cho người quản lý và bác sĩ thú y):")}</span>
          <button type="button" className={s.danger} disabled={phase !== "RUNNING" || incidentKind !== null} aria-label={st("Gãy xương chân cấp tính")} onClick={() => incident("FRACTURE")}>
            {st("!! Gãy xương chân cấp tính")}</button>
          <button type="button" className={`${s.btn}`} disabled={phase !== "RUNNING" || incidentKind !== null} aria-label={st("Khập khiễng")} onClick={() => incident("LAMENESS")}>
            {st("! Khập khiễng")}</button>
        </div>
      </section>

      {hud && (
        <section className={s.card}>
          <div className={s.cardHead}>
            <h3 className={s.cardTitle}>{st("Chỉ số realtime")}</h3>
            {hud.overload && <span className={s.INJURED}>overload_warning</span>}
          </div>
          <div className={s.cardBody}>
            <Hud snap={hud} horse={horse} />
          </div>
          <div className={s.cardBody}>
            <p
              data-testid="trial-chart-meta"
              data-sample-count={series.current.length}
              style={{ margin: "0 0 8px", color: "var(--muted)", fontSize: "0.82rem" }}
            >
              {st("Phát lại:")}{speed === 0 ? st("Tạm dừng") : speed + st("×")} {st("· Thời gian mô phỏng:")}{formatTime(hud.t)} · {series.current.length} {st("mẫu theo giây mô phỏng")}</p>
            <LiveChart series={series} />
          </div>
        </section>
      )}

      {summary && <ResultCard summary={summary} aborted={phase === "ABORTED"} />}
    </div>
  );
}

function PhasePill({ phase, cooldownLeft }: { phase: Phase; cooldownLeft: number | null }) {
  const text: Record<Phase, string> = {
    IDLE: st("Chờ lệnh"),
    RUNNING: st("Đang chạy"),
    COOLDOWN: st("Đi bộ hồi phục · còn {{v0}}", { v0: cooldownLeft !== null ? formatTime(cooldownLeft) : "" }),
    DONE: "DONE",
    ABORTED: "ABORTED_INJURY",
  };
  const cls = phase === "ABORTED" ? s.INJURED : phase === "DONE" ? s.FIT : phase === "IDLE" ? s.badge : s.WATCH;
  return (
    <div className={t.pillGroup}>
      <span className={cls} data-testid="trial-phase-pill">{text[phase]}</span>
    </div>
  );
}

function ResultCard({ summary: r, aborted }: { summary: RunSummary; aborted: boolean }) {
  const rec = r.hrRecovery10m;
  const recovery =
    rec === null ? null : rec <= 85 ? [st("Xuất sắc"), s.noticeOk] : rec > 110 ? [st("Cảnh báo tim mạch"), s.noticeDanger] : [st("Bình thường"), s.notice];
  return (
    <section className={s.card} data-testid="workout-summary-card">
      <div className={s.cardHead}>
        <h3 className={s.cardTitle}>{st("Kết quả buổi chạy")}</h3>
        <span className={aborted ? s.INJURED : s.FIT} data-testid="workout-result-status">{aborted ? st("Dừng do chấn thương") : "DONE"}</span>
      </div>
      <div className={s.cardBody}>
        <table className={s.table}>
          <tbody>
            <tr><th>{st("Quãng đường hoàn thành")}</th><td className={s.num}>{r.distanceCompletedM} m</td><th>{st("Thời gian")}</th><td className={s.num}>{formatTime(r.durationS)}</td></tr>
            <tr><th>{st("Vận tốc TB / tối đa")}</th><td className={s.num}>{r.avgSpeedKmh} / {r.topSpeedKmh} km/h</td><th>{st("Nhịp tim TB / đỉnh")}</th><td className={s.num}>{r.avgHr} / {r.peakHr} bpm</td></tr>
            <tr><th>{st("Sải TB / tần số TB")}</th><td className={s.num}>{r.avgStrideLenM} m · {r.avgStrideFreqHz} Hz</td><th>{st("Calo tiêu hao")}</th><td className={s.num}>{r.kcal} kcal</td></tr>
            <tr><th>{st("Thân nhiệt cuối")}</th><td className={s.num}>{r.finalTempC} °C</td><th>{st("Nhịp tim sau 10 phút")}</th><td className={s.num}>{rec ?? "—"} bpm</td></tr>
            <tr><th>{st("Tình trạng sân")}</th><td className={s.num}>{st(CONDITION_LABEL[r.condition])}</td><th>{st("Chướng ngại đã vượt")}</th><td className={s.num}>{r.obstaclesCleared} / {r.obstaclesTotal}</td></tr>
          </tbody>
        </table>
        {recovery && <p className={recovery[1]}>{st("Hồi phục tim mạch:")}{recovery[0]} {st("(từ 85 bpm trở xuống: xuất sắc · trên 110 bpm: cảnh báo).")}</p>}
        {aborted && <p className={s.noticeDanger}>{st("Đã gửi sự cố để đồng bộ. Bác sĩ thú y sẽ quyết định có khóa y tế hay không.")}</p>}
      </div>
    </section>
  );
}

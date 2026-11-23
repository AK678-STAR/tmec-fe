import { api } from "@/shared/lib/api";
import { TrainingTrackPicker, useTrainingTracks } from "./TrainingTrackPicker";
import formLayout from "@/shared/components/form/FormLayout.module.css";
import gen from "./GenerateSchedule.module.css";
import { useEffect, useMemo, useState } from "react";
import { Alert } from "@/shared/components/ui/Alert";
import { Button } from "@/shared/components/ui/Button";
import { Modal } from "@/shared/components/ui/Modal";
import { Checkbox } from "@/shared/components/form/Checkbox";
import { Field } from "@/shared/components/form/Field";
import { Input } from "@/shared/components/form/Input";
import { SearchSelect } from "@/shared/components/form/SearchSelect";
import { Select } from "@/shared/components/form/Select";
import { Textarea } from "@/shared/components/form/Textarea";
import { useToast } from "@/shared/components/ui/Toast";
import { messageFor } from "@/shared/lib/messages";
import { clubIso, todayClub, trainingApi } from "../api";
import {
  ALWAYS_HEAVY,
  CANCEL_REASON_LABEL,
  EXERCISE_TYPE_LABEL,
  INTENSITY_LABEL,
  NO_SURFACE,
  TRACK_LABEL,
} from "../types";
import type {
  CancelWorkoutReason,
  ExerciseIntensity,
  ExerciseSession,
  ExerciseType,
  SessionInput,
  TrackType,
  TrainingPhase,
  TrainingPlan,
} from "../types";
import { hasCode } from "./PlanDialogs";

import { localizeServerText, tr } from "@/shared/i18n/tr";
import { useAppLanguage } from "@/shared/lib/language";
const WEEKDAYS = [
  { n: 1, label: "Mon" },
  { n: 2, label: "Tue" },
  { n: 3, label: "Wed" },
  { n: 4, label: "Thu" },
  { n: 5, label: "Fri" },
  { n: 6, label: "Sat" },
  { n: 7, label: "Sun" },
];

interface WorkoutDialogProps {
  /** Danh sách giáo án để chọn (mở từ Lịch tập). Bỏ trống nếu đã cố định `plan`. */
  plans?: TrainingPlan[];
  /** Giáo án cố định (mở từ Chi tiết giáo án). */
  plan?: TrainingPlan;
  /** Có = chế độ sửa (BTN-2.20). */
  session?: ExerciseSession;
  defaultDate?: string;
  defaultType?: ExerciseType;
  onClose: () => void;
  onSaved: (date: string) => void;
}

/**
 * DL-2.01 Thêm / Sửa buổi tập. Luật thật ở BE; hộp thoại chặn sớm cho dễ dùng:
 * - Ngựa đang khóa: tắt Chạy tốc độ, Chạy thử và cường độ Nặng.
 * - BE trả VET_CONFIRMATION_REQUIRED -> hiện ô xác nhận (DL-2.06).
 * - BE trả WARNINGS_NEED_CONFIRMATION -> hiện khung vàng, bấm Lưu lần 2 để xác nhận.
 */
export function WorkoutDialog({ plans, plan: fixedPlan, session, defaultDate, defaultType, onClose, onSaved }: WorkoutDialogProps) {
  const { isVietnamese } = useAppLanguage();
  const toast = useToast();
  const editing = Boolean(session);
  const [planId, setPlanId] = useState(session?.planId ?? fixedPlan?.id ?? plans?.[0]?.id ?? "");
  const [phaseId, setPhaseId] = useState(session?.phaseId ?? "");
  const [date, setDate] = useState(session?.sessionDate ?? defaultDate ?? todayClub());
  const [time, setTime] = useState(session?.startTime ?? "06:30");
  const [type, setType] = useState<ExerciseType>(session?.sessionType ?? defaultType ?? "CANTER");
  const [intensity, setIntensity] = useState<ExerciseIntensity>(session?.intensity ?? "MEDIUM");
  const [distance, setDistance] = useState(session?.targetDistanceMeters ?? 1200);
  const [reps, setReps] = useState(session?.repetitions ?? 1);
  const [speed, setSpeed] = useState(session?.targetSpeedKmh?.toString() ?? "");
  const [surface, setSurface] = useState<TrackType>(session?.trackType ?? "TURF");
  const catalog=useTrainingTracks();
  const [trackId,setTrackId]=useState(session?.trackId ?? '');
  const [notes, setNotes] = useState(session?.notes ?? "");
  const [repeat, setRepeat] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [until, setUntil] = useState("");
  const [needVet, setNeedVet] = useState(false);
  const [vetConsulted, setVetConsulted] = useState(Boolean(session?.medicalOverride));
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [validationFailed, setValidationFailed] = useState(false);

  const markTouched = (k: string) => setTouched((cur) => (cur[k] ? cur : { ...cur, [k]: true }));
  const isFieldVisible = (k: string) => submitted || Boolean(touched[k]);

  const plan = fixedPlan ?? plans?.find((p) => p.id === planId);
  const phases = useMemo(() => plan?.phases ?? [], [plan]);

  // Giai đoạn mặc định: giai đoạn chứa ngày đã chọn, nếu không thì giai đoạn đầu.
  useEffect(() => {
    if (phases.length === 0 || phases.some((p) => p.id === phaseId)) return;
    setPhaseId((phases.find((p) => p.startDate <= date && date <= p.endDate) ?? phases[0]).id);
  }, [phases, phaseId, date]);
  const phase = phases.find((p) => p.id === phaseId);
  useEffect(() => {
    if (phase && !until) setUntil(phase.endDate);
  }, [phase, until]);

  // Thêm mới từ Lịch tuần / Lượt chạy thử: ngày mặc định (hôm nay) có thể nằm ngoài giáo án.
  // Khi đổi giáo án, đưa ngày về ngày hợp lệ đầu tiên của giáo án để không bị BE từ chối.
  useEffect(() => {
    if (editing || phases.length === 0) return;
    const today = todayClub();
    if (phases.some((p) => p.startDate <= date && date <= p.endDate)) return;
    const upcoming = phases.find((p) => p.endDate >= today);
    if (!upcoming) return;
    setDate(upcoming.startDate > today ? upcoming.startDate : today);
    setPhaseId(upcoming.id);
    // Chỉ chạy khi đổi giáo án; không theo dõi "date" để người dùng vẫn tự chọn ngày được.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, phases, editing]);

  // Sửa thông tin thì bỏ các cảnh báo / xác nhận cũ.
  useEffect(() => {
    setWarnings([]);
  }, [planId, phaseId, date, time, type, intensity, distance, reps]);

  const locked = Boolean(plan?.isLockedByMedical);
  const impounded = Boolean(plan?.isDebtImpounded || session?.isDebtImpounded);
  const forcedHeavy = ALWAYS_HEAVY.includes(type);
  const noSurface = NO_SURFACE.includes(type);
  const effIntensity: ExerciseIntensity = forcedHeavy ? "HEAVY" : intensity;
  const effSurface: TrackType = noSurface ? "NONE" : surface;

  const fieldErrors = useMemo(() => {
    const errs: Record<string, string> = {};
    if(locked)errs.planId=tr('This horse is medically protected. New workouts require veterinary release.');
    if(!noSurface && (!trackId || catalog.loading || catalog.error))errs.trackId=tr('Select an available physical training track.');
    if (!planId) {
      errs.planId = isVietnamese ? "Vui lòng chọn ngựa và giáo án." : tr("Please select a horse and plan.");
    }
    if (phases.length > 0 && !phaseId) {
      errs.phaseId = isVietnamese ? "Vui lòng chọn giai đoạn." : tr("Please select a phase.");
    }
    if (forcedHeavy && (!speed || Number(speed) < 10 || Number(speed) > 70)) {
      errs.speed = isVietnamese ? "Tốc độ mục tiêu từ 10 đến 70 km/h." : tr("Target speed (10-70 km/h) is required for breeze and trial runs.");
    }
    if (!distance || distance < 100 || distance > 5000) {
      errs.distance = isVietnamese ? "Cự ly phải từ 100 đến 5000 m." : tr("Distance must be 100 to 5000 m.");
    }
    if (!reps || reps < 1 || reps > 10) {
      errs.reps = isVietnamese ? "Số hiệp phải từ 1 đến 10." : tr("Reps must be 1 to 10.");
    } else if (!errs.distance && distance * reps > 10000) {
      errs.reps = isVietnamese
        ? "Tổng cự ly (cự ly mỗi hiệp × số hiệp) không được vượt quá 10 000 m."
        : tr("Total distance (distance per rep × repetitions) cannot exceed 10 000 m.");
    }
    const today = todayClub();
    if (date === today) {
      const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
      const minTimeDate = new Date(now.getTime() + 30 * 60 * 1000);
      const minH = String(minTimeDate.getUTCHours()).padStart(2, "0");
      const minM = String(minTimeDate.getUTCMinutes()).padStart(2, "0");
      const todayMinTime = `${minH}:${minM}`;
      if (time < todayMinTime) {
        errs.time = isVietnamese
          ? `Thời gian bắt đầu buổi tập hôm nay phải sau ít nhất 30 phút theo thời gian thực (từ ${todayMinTime} trở đi).`
          : tr("Start time for today must be at least 30 minutes in the future (from {{time}}).", { time: todayMinTime });
      }
    }
    return errs;
  }, [planId, phases.length, phaseId, forcedHeavy, speed, distance, reps, date, time, isVietnamese, locked, noSurface, trackId, catalog.loading, catalog.error]);

  // Chỉ tự xóa thông báo "kiểm tra các ô" khi các ô đã hợp lệ; lỗi từ BE phải giữ nguyên để người dùng đọc được.
  useEffect(() => {
    if (validationFailed && Object.keys(fieldErrors).length === 0) {
      setError("");
      setValidationFailed(false);
    }
  }, [validationFailed, fieldErrors]);

  const input = (): SessionInput => ({
    scheduledDate: clubIso(date, time),
    phaseId,
    workoutType: type,
    intensity: effIntensity,
    distanceMeters: distance,
    repetitions: reps,
    targetSpeedKmh: speed ? Number(speed) : undefined,
    trackSurface: effSurface,
    trackId: noSurface ? undefined : trackId,
    trainerNotes: notes.trim() || undefined,
    vetConsulted: vetConsulted || undefined,
    acknowledgeWarnings: warnings.length > 0 || undefined,
  });

  const checkPayload=JSON.stringify({...input(),...(session?{excludeWorkoutId:session.id}:{})});
  const [availability,setAvailability]=useState({loading:false,valid:false,error:''});
  const [checkedPayload,setCheckedPayload]=useState('');
  const [checkedPlanId,setCheckedPlanId]=useState('');
  const [availabilityVersion,setAvailabilityVersion]=useState(0);
  type SuggestedSlot={startAt:string;endAt:string;trackId:string|null;availableCapacity?:number;reasons:string[]};
  const [suggestions,setSuggestions]=useState<{key:string;loading:boolean;slots:SuggestedSlot[];error:string}>({key:'',loading:false,slots:[],error:''});
  const suggestionKey=JSON.stringify([planId,checkPayload]);
  const suggest=async()=>{
    if(suggestions.loading || !plan)return;
    const from=date>todayClub()?date:todayClub();
    const last=new Date(`${from}T12:00:00+07:00`);last.setUTCDate(last.getUTCDate()+13);
    const to=[last.toISOString().slice(0,10),phase?.endDate??plan.endDate].sort()[0];
    const query=new URLSearchParams();
    Object.entries({...input(),from,to,excludeWorkoutId:session?.id}).forEach(([key,value])=>{if(value!==undefined && !['scheduledDate','trainerNotes','acknowledgeWarnings'].includes(key))query.set(key,String(value));});
    const key=suggestionKey;setSuggestions({key,loading:true,slots:[],error:''});
    try{const result=await api<{slots:SuggestedSlot[];reasons:string[]}>('GET',`/training/plans/${planId}/suggest-slots?${query}`);setSuggestions({key,loading:false,slots:result.slots,error:result.slots.length?'':result.reasons.join(' ')||tr('No safe slots available in this period.')});}
    catch(e){setSuggestions({key,loading:false,slots:[],error:messageFor(e)});}
  };
  const canCheck=Object.keys(fieldErrors).length===0;
  useEffect(()=>{
    if(!canCheck){setAvailability({loading:false,valid:false,error:''});return;}
    let current=true;setAvailability({loading:true,valid:false,error:''});
    const timer=setTimeout(()=>{api<{available:boolean}>('POST',`/training/plans/${planId}/check-workout`,JSON.parse(checkPayload)).then(result=>{if(current){setAvailability({loading:false,valid:result.available,error:''});setCheckedPayload(checkPayload);setCheckedPlanId(planId);}}).catch(e=>{if(current){if(hasCode(e,'VET_CONFIRMATION_REQUIRED'))setNeedVet(true);setAvailability({loading:false,valid:false,error:messageFor(e)});}});},250);
    return()=>{current=false;clearTimeout(timer);};
  },[checkPayload,planId,canCheck,availabilityVersion]);

  const submit = async () => {
    if(submitting || availability.loading || !availability.valid || checkedPayload!==checkPayload || checkedPlanId!==planId)return;
    setSubmitted(true);
    if (Object.keys(fieldErrors).length > 0) {
      setValidationFailed(true);
      setError(
        isVietnamese
          ? "Vui lòng kiểm tra và sửa các thông tin chưa hợp lệ bên dưới."
          : tr("Please check and correct the invalid fields below."),
      );
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      if (session) {
        await trainingApi.updateSession(session.id, input());
        toast.show(tr("Workout updated."), "ok");
      } else if (repeat) {
        const res = await trainingApi.createRepeatSessions(planId, { ...input(), weekdays, until });
        const skipped = res.skipped.map((s) => `${s.date}: ${s.reason}`).join("; ");
        toast.show(
          tr(`Created ${res.created} workout(s).${res.skipped.length ? ` Skipped ${res.skipped.length} day(s): ${skipped}` : ""}`),
          res.skipped.length ? "warn" : "ok",
        );
      } else {
        await trainingApi.createSession(planId, input());
        toast.show(tr("Workout added."), "ok");
      }
      onSaved(date);
    } catch (err) {
      setAvailability({loading:false,valid:false,error:''});
      setCheckedPayload('');
      if(hasCode(err,'WARNINGS_NEED_CONFIRMATION') || hasCode(err,'VET_CONFIRMATION_REQUIRED'))setAvailabilityVersion(v=>v+1);
      if (hasCode(err, "VET_CONFIRMATION_REQUIRED")) setNeedVet(true);
      if (hasCode(err, "WARNINGS_NEED_CONFIRMATION")) {
        setWarnings(((err.data as { warnings?: string[] }).warnings) ?? [err.message]);
      } else {
        setError(messageFor(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const repeatInvalid = repeat && (weekdays.length === 0 || !until || (phase && until > phase.endDate));

  return (
    <Modal
      title={editing ? tr("Edit Workout") : tr("Schedule Workout")}
      onClose={onClose}
      width={640}
      foot={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
          <Button tone="ghost" onClick={onClose}>{tr("Cancel")}</Button>
          <Button
            tone="primary"
            onClick={() => void submit()}
            disabled={submitting || availability.loading || !availability.valid || checkedPayload!==checkPayload || checkedPlanId!==planId || locked || (!noSurface && (!trackId || catalog.loading || !!catalog.error)) || !planId || (phases.length > 0 && !phaseId) || (needVet && !vetConsulted) || Boolean(repeatInvalid)}
          >
            {warnings.length > 0 ? tr("Save anyway") : tr("Save workout")}
          </Button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {error && <Alert tone="danger" title={tr("Cannot save")}>{error}</Alert>}
        {availability.loading && <p role="status">{tr('Checking current track and trainer availability…')}</p>}
        {availability.error && <Alert tone="warn">{availability.error}</Alert>}
        <Button type="button" tone="secondary" disabled={locked || !planId || !phaseId || suggestions.loading || submitting} onClick={suggest}>{suggestions.loading?tr('Finding available slots…'):tr('Suggest three training slots')}</Button>
        {suggestions.key===suggestionKey && <div aria-live="polite">
          {suggestions.error && <Alert tone="warn">{suggestions.error}</Alert>}
          {suggestions.slots.length>0 && <p>{tr('Suggestions are not reserved. Availability is checked again when saving.')}</p>}
          {suggestions.slots.map(slot=><Button key={`${slot.startAt}-${slot.trackId}`} type="button" tone="secondary" onClick={()=>{const club=new Date(+new Date(slot.startAt)+7*3600000).toISOString();setDate(club.slice(0,10));setTime(club.slice(11,16));setTrackId(slot.trackId??'');setAvailabilityVersion(v=>v+1);}}>{new Intl.DateTimeFormat(isVietnamese?'vi-VN':'en-GB',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'}).format(new Date(slot.startAt))} · {catalog.tracks.find(t=>t.id===slot.trackId)?.name??tr('No physical track')}{slot.availableCapacity!==undefined?` · ${slot.availableCapacity} ${tr('places available')}`:''}</Button>)}
        </div>}
        {availability.valid && <p>{tr('Available when checked. Saving revalidates the current schedule; this is not a reservation.')}</p>}
        {warnings.length > 0 && (
          <Alert tone="warn" title={tr("Please check before saving")}>
            <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
              {warnings.map((w) => (
                <li key={w}>{localizeServerText(w)}</li>
              ))}
            </ul>
          </Alert>
        )}
        {!fixedPlan && !editing && (
          <Field
            label={tr("Horse / plan")}
            required
            error={isFieldVisible("planId") ? fieldErrors.planId : undefined}
          >
            <SearchSelect
              placeholder={tr("Horse / plan")}
              value={planId}
              onChange={(val) => {
                setPlanId(val);
                markTouched("planId");
              }}
              options={(plans ?? []).map((p) => ({
                value: p.id,
                label: `${p.horseName} – ${p.name} (${p.status === "ACTIVE" ? (isVietnamese ? "Đang áp dụng" : "Active") : (isVietnamese ? "Chờ kích hoạt" : "Pending Activation")})${p.isLockedByMedical ? (isVietnamese ? " · Khóa y tế" : " · Training Lock") : ""}`,
              }))}
            />
          </Field>
        )}
        {locked && (
          <Alert tone="danger" title={tr("Training Lock")}>
            {tr("Only light or medium workouts can be scheduled. Breeze, trial run and heavy intensity are disabled.")}
          </Alert>
        )}
        {impounded && (
          <Alert tone="danger" title={tr("Debt Impounded")}>
            {tr("The horse is impounded for unpaid fees: no heavy workouts (Breeze, Trial, Canter). Only walking / light exercise (Walk) is allowed.")}
          </Alert>
        )}
        {phases.length > 0 && (
          <Field
            label={tr("Phase")}
            required
            hint={phase ? `${phase.startDate} → ${phase.endDate}` : undefined}
            error={isFieldVisible("phaseId") ? fieldErrors.phaseId : undefined}
          >
            <SearchSelect
              placeholder={tr("Phase")}
              value={phaseId}
              onChange={(val) => {
                setPhaseId(val);
                markTouched("phaseId");
                // Ngày đang chọn nằm ngoài giai đoạn mới -> đưa về ngày hợp lệ đầu tiên của giai đoạn.
                const next = phases.find((p) => p.id === val);
                if (next && (date < next.startDate || date > next.endDate)) {
                  setDate(next.startDate > todayClub() ? next.startDate : todayClub());
                }
              }}
              options={phases.map((p) => ({ value: p.id, label: p.name }))}
            />
          </Field>
        )}
        <div className={formLayout.columns}>
          <Field label={tr("Date")} required>
            <Input
              type="date"
              min={todayClub()}
              value={date}
              onChange={(e) => {
                const value = e.target.value;
                setDate(value);
                // Giai đoạn đi theo ngày: chọn ngày thuộc giai đoạn khác thì tự đổi giai đoạn.
                const containing = phases.find((p) => p.startDate <= value && value <= p.endDate);
                if (containing) setPhaseId(containing.id);
              }}
            />
          </Field>
          <Field
            label={tr("Start time")}
            required
            hint="04:00 – 20:00"
            error={isFieldVisible("time") ? fieldErrors.time : undefined}
          >
            <Input
              type="time"
              min="04:00"
              max="20:00"
              step={900}
              value={time}
              onChange={(e) => setTime(e.target.value)}
              onBlur={() => markTouched("time")}
            />
          </Field>
        </div>
        <div className={formLayout.columns}>
          <Field label={tr("Workout type")} required>
            <SearchSelect
              value={type}
              onChange={(value) => setType(value as ExerciseType)}
              options={(Object.keys(EXERCISE_TYPE_LABEL) as ExerciseType[]).map((t) => ({
                value: t,
                label: EXERCISE_TYPE_LABEL[t],
                disabled: (locked || impounded) && ALWAYS_HEAVY.includes(t),
              }))}
            />
          </Field>
          <Field label={tr("Intensity")} required hint={forcedHeavy ? tr("Breeze and trial runs are always heavy") : undefined}>
            <Select
              value={effIntensity}
              disabled={forcedHeavy}
              onChange={(e) => setIntensity(e.target.value as ExerciseIntensity)}
              options={(Object.keys(INTENSITY_LABEL) as ExerciseIntensity[]).map((i) => ({
                value: i,
                label: INTENSITY_LABEL[i],
                disabled: (locked || impounded) && i === "HEAVY",
              }))}
            />
          </Field>
        </div>
        <div className={formLayout.columns}>
          <Field
            label={tr("Distance per rep (m)")}
            required
            hint="100 – 5000"
            error={isFieldVisible("distance") ? fieldErrors.distance : undefined}
          >
            <Input
              type="number"
              min={100}
              max={5000}
              value={distance}
              onChange={(e) => setDistance(Number(e.target.value))}
              onBlur={() => markTouched("distance")}
            />
          </Field>
          <Field
            label={tr("Reps")}
            required
            hint="1 – 10"
            error={isFieldVisible("reps") ? fieldErrors.reps : undefined}
          >
            <Input
              type="number"
              min={1}
              max={10}
              value={reps}
              onChange={(e) => setReps(Number(e.target.value))}
              onBlur={() => markTouched("reps")}
            />
          </Field>
          <Field
            label={tr("Target speed (km/h)")}
            required={forcedHeavy}
            hint="10 – 70"
            error={isFieldVisible("speed") ? fieldErrors.speed : undefined}
          >
            <Input
              type="number"
              min={10}
              max={70}
              step={0.1}
              value={speed}
              onChange={(e) => setSpeed(e.target.value)}
              onBlur={() => markTouched("speed")}
            />
          </Field>
        </div>
        <div className={formLayout.columns}>
          <Field label={tr("Track surface")} required>
            <Select
              value={effSurface}
              disabled={noSurface}
              onChange={(e) => setSurface(e.target.value as TrackType)}
              options={(Object.keys(TRACK_LABEL) as TrackType[])
                .filter((t) => noSurface || t !== "NONE")
                .map((t) => ({ value: t, label: TRACK_LABEL[t] }))}
            />
          </Field>
        </div>
        {/* #4, #7: HLV tự dẫn buổi tập và kiêm nài, không giao cho Groom. */}
        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "13px" }}>{tr("You run this workout yourself and ride as the jockey.")}</p>
        <Field label={tr("Instructions")} hint={tr("Up to 500 characters")}>
          <Textarea rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <TrainingTrackPicker value={trackId} onChange={setTrackId} surface={effSurface} catalog={catalog} />
        {!editing && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <Checkbox label={tr("Repeat weekly")} checked={repeat} onChange={setRepeat} />
            {repeat && (
              <>
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                  {WEEKDAYS.map((d) => (
                    <Checkbox
                      key={d.n}
                      label={tr(d.label)}
                      checked={weekdays.includes(d.n)}
                      onChange={(on) => setWeekdays((cur) => (on ? [...cur, d.n] : cur.filter((x) => x !== d.n)))}
                    />
                  ))}
                </div>
                <Field label={tr("Repeat until")} required hint={tr("Up to the end of the phase; at most 60 workouts at once")}>
                  <Input type="date" min={date} max={phase?.endDate} value={until} onChange={(e) => setUntil(e.target.value)} />
                </Field>
              </>
            )}
          </div>
        )}
        {needVet && (
          <Checkbox
            label={tr("I have discussed this with the Veterinarian and take responsibility for this workout")}
            checked={vetConsulted}
            onChange={setVetConsulted}
          />
        )}
      </div>
    </Modal>
  );
}

/** DL-2.05 Hủy buổi tập. */
export function CancelWorkoutDialog({ session, onClose, onDone }: { session: ExerciseSession; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState<CancelWorkoutReason | "">("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const noteOk = reason !== "OTHER" || (note.trim().length >= 10 && note.trim().length <= 500);

  const submit = async () => {
    if (!reason) return;
    setSubmitting(true);
    try {
      await trainingApi.cancelSession(session.id, reason, note.trim());
      toast.show("Workout cancelled.", "ok");
      onDone();
      onClose();
    } catch (err) {
      toast.show(messageFor(err), "danger");
    } finally {
      setSubmitting(false);
    }
  };

  useAppLanguage();
  return (
    <Modal
      title={tr(`Cancel ${EXERCISE_TYPE_LABEL[session.sessionType]} at ${session.sessionDate} ${session.startTime} – ${session.horseName}?`)}
      tone="warn"
      onClose={onClose}
      foot={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
          <Button tone="ghost" onClick={onClose}>{tr("Close")}</Button>
          <Button tone="danger" onClick={() => void submit()} disabled={submitting || !reason || !noteOk}>{tr("Cancel workout")}</Button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <Field label={tr("Reason")} required>
          <Select
            value={reason}
            onChange={(e) => setReason(e.target.value as CancelWorkoutReason)}
            options={[
              { value: "", label: tr("Select a reason"), disabled: true },
              ...(Object.keys(CANCEL_REASON_LABEL) as CancelWorkoutReason[]).map((r) => ({ value: r, label: CANCEL_REASON_LABEL[r] })),
            ]}
          />
        </Field>
        <Field label={tr("Note")} required={reason === "OTHER"} hint={tr("10-500 characters")}>
          <Textarea rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

/** DL-2.07 Khôi phục buổi tập bị chặn (sau khi gỡ khóa), có thể dời ngày giờ. */
export function RestoreWorkoutDialog({ session, onClose, onDone }: { session: ExerciseSession; onClose: () => void; onDone: () => void }) {
  useAppLanguage();
  const toast = useToast();
  const today = todayClub();
  const [date, setDate] = useState(session.sessionDate >= today ? session.sessionDate : today);
  const [time, setTime] = useState(session.startTime);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      await trainingApi.restoreBlockedSession(session.id, clubIso(date, time));
      toast.show(tr("Workout restored."), "ok");
      onDone();
      onClose();
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={tr(`Restore workout – ${session.horseName}`)}
      onClose={onClose}
      foot={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
          <Button tone="ghost" onClick={onClose}>{tr("Cancel")}</Button>
          <Button tone="primary" onClick={() => void submit()} disabled={submitting}>{tr("Restore")}</Button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {error && <Alert tone="danger" title={tr("Cannot restore")}>{error}</Alert>}
        <div className={formLayout.columns}>
          <Field label={tr("Date")} required>
            <Input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label={tr("Start time")} required hint="04:00 – 20:00">
            <Input type="time" min="04:00" max="20:00" step={900} value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

/** T5: Sinh lịch đề xuất từ giai đoạn: chọn các thứ trong tuần, giờ, loại / cường độ mặc định. */
export function GeneratePhaseScheduleDialog({
  plan,
  phase,
  onClose,
  onGenerated,
}: {
  plan: TrainingPlan;
  phase: TrainingPhase;
  onClose: () => void;
  onGenerated: () => void;
}) {
  const { isVietnamese } = useAppLanguage();
  const toast = useToast();

  const defaultDays = useMemo(() => {
    const n = phase.sessionsPerWeek || 5;
    if (n === 1) return [1];
    if (n === 2) return [1, 4];
    if (n === 3) return [1, 3, 5];
    if (n === 4) return [1, 2, 4, 5];
    if (n === 5) return [1, 2, 3, 4, 5];
    if (n === 6) return [1, 2, 3, 4, 5, 6];
    return [1, 2, 3, 4, 5, 6, 7].slice(0, n);
  }, [phase.sessionsPerWeek]);

  const defaultType: ExerciseType = useMemo(() => {
    if (phase.type === "BASE") return "CANTER";
    if (phase.type === "BUILD") return "CANTER";
    if (phase.type === "SPEED") return "BREEZE";
    if (phase.type === "PRE_RACE") return "TRIAL";
    if (phase.type === "RECOVERY") return "WALK";
    return "CANTER";
  }, [phase.type]);

  const defaultIntensity: ExerciseIntensity = useMemo(() => {
    if (phase.type === "RECOVERY") return "LIGHT";
    if (phase.type === "BASE") return "MEDIUM";
    return "HEAVY";
  }, [phase.type]);

  const [weekdays, setWeekdays] = useState<number[]>(defaultDays);
  const [time, setTime] = useState("06:30");
  const [type, setType] = useState<ExerciseType>(defaultType);
  const [intensity, setIntensity] = useState<ExerciseIntensity>(defaultIntensity);
  const [distance, setDistance] = useState(
    String(Math.min(5000, Math.max(500, Math.round(phase.maxWeeklyDistance / (phase.sessionsPerWeek || 5))))),
  );
  const [repetitions, setRepetitions] = useState(1);
  const [surface, setSurface] = useState<TrackType>((phase.surface as TrackType) || "TURF");
  const catalog=useTrainingTracks();
  const [trackId,setTrackId]=useState('');
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);


  const maxDays = phase.sessionsPerWeek || 5;
  const toggleDay = (d: number) => {
    setWeekdays((cur) => {
      if (cur.includes(d)) {
        return cur.filter((x) => x !== d);
      }
      if (cur.length >= maxDays) {
        toast.show(
          isVietnamese
            ? `Giai đoạn này giới hạn tối đa ${maxDays} buổi/tuần.`
            : tr("This phase is limited to {{count}} sessions per week.", { count: maxDays }),
          "warn",
        );
        return cur;
      }
      return [...cur, d].sort((a, b) => a - b);
    });
  };

  const today = todayClub();
  const isStartingToday = phase.startDate <= today;
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const minTimeDate = new Date(now.getTime() + 30 * 60 * 1000);
  const minH = String(minTimeDate.getUTCHours()).padStart(2, "0");
  const minM = String(minTimeDate.getUTCMinutes()).padStart(2, "0");
  const todayMinTime = `${minH}:${minM}`;
  const minTimeAllowed = isStartingToday && phase.startDate === today && todayMinTime > "04:00" ? todayMinTime : "04:00";

  const submit = async () => {
    if(!NO_SURFACE.includes(type) && (!trackId || catalog.loading || catalog.error)){setError(tr('Select an available physical training track.'));return;}
    if (weekdays.length === 0) {
      setError(isVietnamese ? "Vui lòng chọn ít nhất một thứ trong tuần." : tr("Please select at least one weekday."));
      return;
    }
    if (isStartingToday && phase.startDate === today && time < todayMinTime) {
      setError(
        isVietnamese
          ? `Thời gian bắt đầu buổi tập hôm nay phải sau ít nhất 30 phút theo thời gian thực (từ ${todayMinTime} trở đi).`
          : tr("Start time for today must be at least 30 minutes in the future (from {{time}}).", { time: todayMinTime }),
      );
      return;
    }
    const distNum = Number(distance);
    if (!distNum || distNum < 100 || distNum > 5000) {
      setError(isVietnamese ? "Cự ly phải từ 100 đến 5000 m." : tr("Distance must be 100 to 5000 m."));
      return;
    }
    if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 10) {
      setError(isVietnamese ? "Số hiệp phải từ 1 đến 10." : tr("Reps must be 1 to 10."));
      return;
    }
    if (distNum * repetitions > 10000) {
      setError(
        isVietnamese
          ? "Tổng cự ly (cự ly mỗi hiệp × số hiệp) không được vượt quá 10 000 m."
          : tr("Total distance (distance per rep × repetitions) cannot exceed 10 000 m."),
      );
      return;
    }
    const needsSpeed = type === "BREEZE" || type === "TRIAL";
    if (needsSpeed && phase.targetSpeedKmh == null) {
      setError(
        isVietnamese
          ? "Giai đoạn này chưa có tốc độ mục tiêu. Hãy đặt tốc độ mục tiêu cho giai đoạn trước khi sinh lịch chạy tốc độ / chạy thử."
          : tr("This phase has no target speed. Set the phase target speed before generating breeze or trial runs."),
      );
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await trainingApi.createRepeatSessions(plan.id, {
        phaseId: phase.id,
        scheduledDate: `${phase.startDate}T${time}:00+07:00`,
        until: phase.endDate,
        weekdays,
        workoutType: type,
        intensity,
        distanceMeters: distNum,
        repetitions,
        trackSurface: surface,
        trackId:NO_SURFACE.includes(type)?undefined:trackId,
        targetSpeedKmh: phase.targetSpeedKmh ?? undefined,
        acknowledgeWarnings: true,
      });
      if (res.created > 0) {
        toast.show(
          isVietnamese
            ? `Đã sinh thành công ${res.created} buổi tập!`
            : tr("Generated {{count}} workouts successfully!", { count: res.created }),
          "ok",
        );
      }
      if (res.skipped.length > 0) {
        toast.show(
          isVietnamese
            ? `Bỏ qua ${res.skipped.length} buổi do không hợp lệ hoặc đã qua.`
            : tr("Skipped {{count}} dates due to conflicts.", { count: res.skipped.length }),
          "warn",
        );
      }
      onGenerated();
      onClose();
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Số buổi dự kiến: các ngày trong giai đoạn (từ hôm nay) rơi vào thứ đã chọn; hôm nay chỉ tính khi giờ còn hợp lệ.
  const plannedCount = useMemo(() => {
    let n = 0;
    const start = phase.startDate > today ? phase.startDate : today;
    for (let d = new Date(`${start}T00:00:00Z`); d.toISOString().slice(0, 10) <= phase.endDate; d.setUTCDate(d.getUTCDate() + 1)) {
      const iso = d.toISOString().slice(0, 10);
      const weekday = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
      if (!weekdays.includes(weekday)) continue;
      if (iso === today && time < todayMinTime) continue;
      n++;
    }
    return n;
  }, [phase.startDate, phase.endDate, today, weekdays, time, todayMinTime]);


  return (
    <Modal
      title={isVietnamese ? `Sinh lịch buổi tập – ${phase.name}` : tr("Generate workouts – {{name}}", { name: phase.name })}
      onClose={onClose}
      foot={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
          <Button tone="ghost" onClick={onClose}>{tr("Cancel")}</Button>
          <Button tone="primary" onClick={() => void submit()} disabled={submitting || plannedCount === 0}>
            {submitting
              ? tr("Generating...")
              : isVietnamese
                ? `Tạo ${plannedCount} buổi tập`
                : tr("Create {{count}} workouts", { count: plannedCount })}
          </Button>
        </div>
      }
    >
      <div className={gen.form}>
        {error && <Alert tone="danger" title={tr("Cannot generate")}>{error}</Alert>}

        <TrainingTrackPicker value={trackId} onChange={setTrackId} surface={NO_SURFACE.includes(type)?'NONE':surface} catalog={catalog} />
        <section className={gen.section}>
          <h3 className={gen.sectionTitle}>{tr("Schedule")}</h3>
          <p className={gen.range}>
            {phase.startDate} → {phase.endDate}
          </p>
          <div>
            <div className={gen.days} role="group" aria-label={tr("Days of the week")}>
              {WEEKDAYS.map((w) => {
                const isSelected = weekdays.includes(w.n);
                return (
                  <button
                    key={w.n}
                    type="button"
                    className={gen.day}
                    aria-pressed={isSelected}
                    disabled={weekdays.length >= maxDays && !isSelected}
                    onClick={() => toggleDay(w.n)}
                  >
                    {tr(w.label)}
                  </button>
                );
              })}
            </div>
            <div className={gen.daysHint} style={{ marginTop: 6 }}>
              {isVietnamese
                ? `Đã chọn ${weekdays.length}/${maxDays} buổi mỗi tuần theo định mức giai đoạn.`
                : tr("{{selected}} of {{max}} sessions per week (phase quota).", { selected: weekdays.length, max: maxDays })}
            </div>
          </div>
          <div className={formLayout.columns}>
            <Field
              label={tr("Start time")}
              required
              hint={
                isStartingToday && phase.startDate === today && todayMinTime > "04:00"
                  ? isVietnamese
                    ? `Từ ${todayMinTime} – 20:00 (sau ít nhất 30p)`
                    : `${todayMinTime} – 20:00`
                  : "04:00 – 20:00"
              }
            >
              <Input type="time" min={minTimeAllowed} max="20:00" step={900} value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
            <Field label={tr("Surface")} required>
              <Select
                value={surface}
                onChange={(e) => setSurface(e.target.value as TrackType)}
                options={(Object.keys(TRACK_LABEL) as TrackType[]).filter((x) => x !== "NONE").map((k) => ({ value: k, label: TRACK_LABEL[k] }))}
              />
            </Field>
          </div>
        </section>

        <section className={gen.section}>
          <h3 className={gen.sectionTitle}>{tr("Workout")}</h3>
          <div className={formLayout.columns}>
            <Field label={tr("Exercise type")} required>
              <Select
                value={type}
                onChange={(e) => setType(e.target.value as ExerciseType)}
                options={(Object.keys(EXERCISE_TYPE_LABEL) as ExerciseType[]).map((k) => ({ value: k, label: EXERCISE_TYPE_LABEL[k] }))}
              />
            </Field>
            <Field label={tr("Intensity")} required>
              <Select
                value={intensity}
                onChange={(e) => setIntensity(e.target.value as ExerciseIntensity)}
                options={(Object.keys(INTENSITY_LABEL) as ExerciseIntensity[]).map((k) => ({ value: k, label: INTENSITY_LABEL[k] }))}
              />
            </Field>
          </div>
          <div className={formLayout.columns}>
            <Field label={tr("Distance (m)")} required hint="100 – 5000 m">
              <Input type="number" min={100} max={5000} step={100} value={distance} onChange={(e) => setDistance(e.target.value)} />
            </Field>
            <Field label={tr("Repetitions")} required hint="1 – 10">
              <Input type="number" min={1} max={10} value={repetitions} onChange={(e) => setRepetitions(Math.min(10, Math.max(1, Math.round(Number(e.target.value)) || 1)))} />
            </Field>
          </div>
        </section>

        <section className={gen.section}>
          <h3 className={gen.sectionTitle}>{tr("Assignment")}</h3>
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "13px" }}>{tr("You run this workout yourself and ride as the jockey.")}</p>
        </section>

        <div className={gen.summary} aria-live="polite">
          <strong>{plannedCount}</strong>
          <span>
            {isVietnamese
              ? `buổi sẽ được tạo · ${time} · ${tr(EXERCISE_TYPE_LABEL[type])} ${distance} m`
              : tr("workouts will be created · {{time}} · {{type}} {{distance}} m", { time, type: tr(EXERCISE_TYPE_LABEL[type]), distance })}
          </span>
        </div>
      </div>
    </Modal>
  );
}

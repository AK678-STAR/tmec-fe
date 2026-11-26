import { Link } from "react-router-dom";
import { Badge } from "@/shared/components/ui/Badge";
import { useAppLanguage } from "@/shared/lib/language";
import type { AssignedHorse } from "../types/shiftRoster";
import type { DailyCareTask } from "../types/dailyTasks";
import styles from "../pages/GroomTodayShiftPage.module.css";
export function GroomHorseCard({
  horse,
  tasks,
  date,
  zoneId,
}: {
  horse: AssignedHorse;
  tasks: DailyCareTask[];
  date: string;
  zoneId: string;
}) {
  const { isVietnamese: vi } = useAppLanguage();
  const stall = tasks.find((t) => t.stall?.code)?.stall?.code;
  return (
    <article className={styles.horse}>
      <div className={styles.row}>
        <strong>
          {stall ? `${stall} · ` : ""}
          {horse.name}
        </strong>
        <span>{horse.horseCode}</span>
      </div>
      <div className={styles.row}>
        {horse.isMedicalLocked && (
          <Badge tone="danger">{vi ? "Khóa y tế" : "Medical lock"}</Badge>
        )}
        {tasks.some((t) => t.taskType === "MEDICATION") && (
          <Badge tone="warn">{vi ? "Có y lệnh thuốc" : "Medication"}</Badge>
        )}
        {tasks.some((t) => t.taskType === "FEEDING") && (
          <Badge tone="info">{vi ? "Khẩu phần" : "Feeding"}</Badge>
        )}
        <span>
          {tasks.filter((t) => t.isCompleted).length}/{tasks.length}{" "}
          {vi ? "hoàn tất" : "done"}
        </span>
      </div>
      <Link
        className={styles.touchLink}
        to={`/tasks?date=${date}&zoneId=${zoneId}&horseId=${horse.id}`}
      >
        {vi ? "Mở checklist chăm sóc" : "Open care checklist"}
      </Link>
    </article>
  );
}

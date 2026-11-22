import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/shared/lib/api";
import { useCurrentUser } from "@/shared/components/layout/AuthProvider";
import { PageHeader } from "@/shared/components/layout/PageHeader";
import { Card } from "@/shared/components/ui/Card";
import { Button } from "@/shared/components/ui/Button";
import { Alert } from "@/shared/components/ui/Alert";
import { Badge } from "@/shared/components/ui/Badge";
import { Modal } from "@/shared/components/ui/Modal";
import { messageFor } from "@/shared/lib/messages";
import { useAppLanguage } from "@/shared/lib/language";
import styles from "./ComplaintsPage.module.css";
interface Staff {
  id: string;
  fullName: string;
  role: string;
}
interface Complaint {
  id: string;
  code: string;
  subjectUserId: string;
  reporterId?: string;
  subject: Staff;
  reason?: string;
  status: "OPEN" | "UNDER_REVIEW" | "VIOLATION_CONFIRMED" | "DISMISSED";
  createdAt: string;
  reviewNote?: string;
  conclusion?: string;
  regulation?: string;
  measures?: string;
  responseDueAt?: string;
  evidenceJson?: unknown;
}
type ReviewAction = "review" | "confirm-violation" | "dismiss";
export default function ComplaintsPage() {
  const user = useCurrentUser();
  const { isVietnamese: vi } = useAppLanguage();
  const text = (a: string, b: string) => (vi ? a : b);
  const handler = user.role === "CLUB_MANAGER" || user.role === "VETERINARIAN";
  const reporter = ["GROOM", "HEAD_TRAINER", "VETERINARIAN"].includes(
    user.role,
  );
  const [items, setItems] = useState<Complaint[]>([]);
  const [subjects, setSubjects] = useState<Staff[]>([]);
  const [subject, setSubject] = useState("");
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [action, setAction] = useState<{
    item: Complaint;
    kind: ReviewAction;
  } | null>(null);
  const [note, setNote] = useState("");
  const [regulation, setRegulation] = useState("");
  const [measures, setMeasures] = useState("");
  const [due, setDue] = useState("");
  const labels = {
    OPEN: text("Chưa xác minh", "Unverified"),
    UNDER_REVIEW: text("Đang xác minh", "Under review"),
    VIOLATION_CONFIRMED: text("Đã xác nhận vi phạm", "Violation confirmed"),
    DISMISSED: text("Không xác nhận vi phạm", "Dismissed"),
  };
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setItems([]);
    api<{ items: Complaint[]; total: number }>(
      "GET",
      `/complaints?page=${page}&pageSize=20`,
    )
      .then((res) => {
        if (active) {
          setItems(res.items);
          setTotal(res.total);
        }
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
  }, [page, refresh]);
  useEffect(() => {
    if (!reporter) return;
    let active = true;
    api<Staff[]>("GET", "/complaints/subjects")
      .then((res) => {
        if (active) setSubjects(res);
      })
      .catch((e) => {
        if (active) setError(messageFor(e));
      });
    return () => {
      active = false;
    };
  }, [reporter]);
  async function create(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const evidenceUrls = evidence
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (
        evidenceUrls.length > 10 ||
        evidenceUrls.some((s) => {
          try {
            return !["http:", "https:"].includes(new URL(s).protocol);
          } catch {
            return true;
          }
        })
      )
        throw new Error(
          text(
            "Chỉ nhận tối đa 10 liên kết HTTP/HTTPS hợp lệ.",
            "Use at most 10 valid HTTP/HTTPS evidence links.",
          ),
        );
      await api("POST", "/complaints", {
        subjectUserId: subject,
        reason: reason.trim(),
        evidenceUrls,
      });
      setSubject("");
      setReason("");
      setEvidence("");
      setPage(1);
      setRefresh((n) => n + 1);
      setNotice(
        text(
          "Đã ghi nhận phản ánh, chưa có kết luận vi phạm.",
          "Report recorded. No violation has been concluded.",
        ),
      );
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  }
  async function submitAction(e: FormEvent) {
    e.preventDefault();
    if (!action || busy) return;
    setBusy(true);
    setError("");
    try {
      const payload =
        action.kind === "review"
          ? {
              reviewNote: note.trim(),
              responseDueAt: due ? new Date(due).toISOString() : undefined,
            }
          : action.kind === "dismiss"
            ? { conclusion: note.trim() }
            : {
                conclusion: note.trim(),
                regulation: regulation.trim(),
                measures: measures.trim(),
              };
      await api(
        "POST",
        `/complaints/${action.item.id}/${action.kind}`,
        payload,
      );
      setAction(null);
      setRefresh((n) => n + 1);
      setNotice(text("Đã lưu kết quả xử lý.", "Review saved."));
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  }
  function openAction(item: Complaint, kind: ReviewAction) {
    setError("");
    setNote("");
    setRegulation("");
    setMeasures("");
    setDue("");
    setAction({ item, kind });
  }
  return (
    <div className={styles.page}>
      <PageHeader
        title={text("Phản ánh nhân sự", "Staff complaints")}
        description={text(
          "Phản ánh là thông tin chưa xác minh. Chỉ người xử lý độc lập mới được kết luận vi phạm.",
          "Reports are unverified. Only an independent reviewer can conclude a violation.",
        )}
      />
      {error && <Alert tone="danger">{error}</Alert>}
      {notice && <Alert tone="info">{notice}</Alert>}
      {reporter && (
        <Card title={text("Gửi phản ánh", "File a report")}>
          <form className={styles.form} onSubmit={create}>
            <label>
              {text("Nhân sự được phản ánh", "Subject")}
              <select
                required
                value={subject}
                disabled={busy}
                onChange={(e) => setSubject(e.target.value)}
              >
                <option value="">{text("Chọn nhân sự", "Select staff")}</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName} · {s.role}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {text(
                "Sự việc, thời điểm và bối cảnh",
                "Reason, time and context",
              )}
              <textarea
                required
                minLength={10}
                maxLength={4000}
                value={reason}
                disabled={busy}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <label>
              {text(
                "Liên kết bằng chứng (mỗi dòng một liên kết, tối đa 10)",
                "Evidence links (one per line, up to 10)",
              )}
              <textarea
                value={evidence}
                disabled={busy}
                onChange={(e) => setEvidence(e.target.value)}
              />
            </label>
            <Button disabled={busy || !subjects.length} type="submit">
              {text("Gửi phản ánh", "Submit report")}
            </Button>
          </form>
        </Card>
      )}
      <Card
        title={text("Phản ánh bạn được phép xem", "Reports available to you")}
      >
        {loading ? (
          <p role="status">{text("Đang tải…", "Loading…")}</p>
        ) : !items.length ? (
          <p>{text("Chưa có phản ánh.", "No reports.")}</p>
        ) : (
          items.map((item) => {
            const independent =
              handler &&
              item.reporterId !== user.id &&
              item.subjectUserId !== user.id;
            return (
              <article key={item.id} className={styles.item}>
                <strong>
                  {item.code} · {item.subject.fullName}
                </strong>{" "}
                <Badge
                  tone={
                    item.status === "VIOLATION_CONFIRMED" ? "danger" : "neutral"
                  }
                >
                  {labels[item.status]}
                </Badge>
                <p>
                  {new Date(item.createdAt).toLocaleString(
                    vi ? "vi-VN" : "en-US",
                    { timeZone: "Asia/Ho_Chi_Minh" },
                  )}
                </p>
                {item.reason && <p className={styles.reason}>{item.reason}</p>}
                {Array.isArray(item.evidenceJson) && (
                  <ul>
                    {item.evidenceJson
                      .filter(
                        (url): url is string =>
                          typeof url === "string" && /^https?:\/\//i.test(url),
                      )
                      .map((url, index) => (
                        <li key={index}>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {text("Bằng chứng", "Evidence")} {index + 1}
                          </a>
                        </li>
                      ))}
                  </ul>
                )}
                {item.reviewNote && <p>{item.reviewNote}</p>}
                {item.responseDueAt && (
                  <p>
                    {text("Hạn phản hồi", "Response due")}:{" "}
                    {new Date(item.responseDueAt).toLocaleString()}
                  </p>
                )}
                {item.conclusion && <p>{item.conclusion}</p>}
                {item.regulation && <p>{item.regulation}</p>}
                {item.measures && <p>{item.measures}</p>}
                {independent && (
                  <div className={styles.actions}>
                    {item.status === "OPEN" && (
                      <Button
                        tone="secondary"
                        onClick={() => openAction(item, "review")}
                      >
                        {text("Yêu cầu giải trình", "Request review")}
                      </Button>
                    )}
                    {item.status === "UNDER_REVIEW" && (
                      <>
                        <Button
                          tone="danger"
                          onClick={() => openAction(item, "confirm-violation")}
                        >
                          {text("Xác nhận vi phạm", "Confirm violation")}
                        </Button>
                        <Button
                          tone="secondary"
                          onClick={() => openAction(item, "dismiss")}
                        >
                          {text("Không xác nhận", "Dismiss")}
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </article>
            );
          })
        )}
        <div className={styles.actions}>
          <Button
            tone="secondary"
            disabled={loading || page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            {text("Trước", "Previous")}
          </Button>
          <span>
            {page} / {Math.max(1, Math.ceil(total / 20))}
          </span>
          <Button
            tone="secondary"
            disabled={loading || page * 20 >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            {text("Tiếp", "Next")}
          </Button>
          <Button
            tone="secondary"
            disabled={loading}
            onClick={() => setRefresh((n) => n + 1)}
          >
            {text("Tải lại", "Refresh")}
          </Button>
        </div>
      </Card>
      {action && (
        <Modal
          title={
            action.kind === "review"
              ? text("Yêu cầu giải trình", "Request review")
              : action.kind === "dismiss"
                ? text("Kết luận không vi phạm", "Dismiss report")
                : text("Xác nhận vi phạm", "Confirm violation")
          }
          onClose={busy ? undefined : () => setAction(null)}
        >
          <form className={styles.form} onSubmit={submitAction}>
            <p>
              {action.item.code} · {action.item.subject.fullName}
            </p>
            {error && <Alert tone="danger">{error}</Alert>}
            <label>
              {text(
                "Nội dung xử lý / kết luận có căn cứ",
                "Review note / evidence based conclusion",
              )}
              <textarea
                required
                minLength={10}
                maxLength={4000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={busy}
              />
            </label>
            {action.kind === "review" && (
              <label>
                {text(
                  "Hạn phản hồi (tùy chọn)",
                  "Response deadline (optional)",
                )}
                <input
                  type="datetime-local"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                  disabled={busy}
                />
              </label>
            )}
            {action.kind === "confirm-violation" && (
              <>
                <label>
                  {text("Quy định bị vi phạm", "Regulation")}
                  <textarea
                    required
                    maxLength={2000}
                    value={regulation}
                    onChange={(e) => setRegulation(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <label>
                  {text("Biện pháp xử lý", "Measures")}
                  <textarea
                    required
                    maxLength={2000}
                    value={measures}
                    onChange={(e) => setMeasures(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <Alert tone="warn">
                  {text(
                    "Kết luận này sẽ thông báo cho người liên quan. Kiểm tra bằng chứng trước khi xác nhận.",
                    "This conclusion notifies the people involved. Check the evidence before confirming.",
                  )}
                </Alert>
              </>
            )}
            <Button
              type="submit"
              tone={action.kind === "confirm-violation" ? "danger" : "primary"}
              disabled={busy}
            >
              {text("Xác nhận lưu", "Save review")}
            </Button>
          </form>
        </Modal>
      )}
    </div>
  );
}

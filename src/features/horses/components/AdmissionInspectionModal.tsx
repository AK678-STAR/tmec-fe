import { useState, useId } from "react";
import { Modal } from "@/shared/components/ui/Modal";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/form/Input";
import { Checkbox } from "@/shared/components/form/Checkbox";
import { Textarea } from "@/shared/components/form/Textarea";
import { Icon } from "@/shared/components/ui/Icon";
import { useToast } from "@/shared/components/ui/Toast";
import { useCurrentUser } from "@/shared/components/layout/AuthProvider";
import { tr } from "@/shared/i18n/tr";
import {
  inspectAdmission,
  approveAdmission,
  rejectAdmission,
} from "../services/admissionService";
import type {
  HorseAdmissionRecord,
  InspectAdmissionDto,
} from "../types/admission.types";
import styles from "./AdmissionInspectionModal.module.css";
import { formatDateTime } from "@/shared/lib/format";

interface AdmissionInspectionModalProps {
  record: HorseAdmissionRecord;
  onClose: () => void;
  onSuccess: () => void;
}

export function AdmissionInspectionModal({
  record,
  onClose,
  onSuccess,
}: AdmissionInspectionModalProps) {
  const toast = useToast();
  const currentUser = useCurrentUser();
  const isManager = currentUser?.role === "CLUB_MANAGER";
  const isVet = currentUser?.role === "VETERINARIAN";

  // Stored record state updated whenever inspection is saved
  const [currentRecord, setCurrentRecord] = useState<HorseAdmissionRecord>(record);

  // Form states - Block 1: Microchip & Legal (Club Manager)
  const declaredMicrochip =
    currentRecord.declaredMicrochip || currentRecord.horse?.microchip || "";
  const [scannedMicrochip, setScannedMicrochip] = useState(
    currentRecord.scannedMicrochip || "",
  );
  const [legalVerified, setLegalVerified] = useState(
    Boolean(currentRecord.legalVerified),
  );
  const [legalDocumentsNote, setLegalDocumentsNote] = useState(
    currentRecord.legalDocumentsNote || "",
  );
  const [documentsUrl, setDocumentsUrl] = useState(currentRecord.documentsUrl || "");

  // Form states - Block 2: Veterinary Screen (Veterinarian)
  const [isHealthEligible, setIsHealthEligible] = useState<boolean | null>(
    currentRecord.isHealthEligible ?? null,
  );
  const [healthCheckNotes, setHealthCheckNotes] = useState(
    currentRecord.healthCheckNotes || "",
  );

  // Rejection sub-dialog state
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectError, setRejectError] = useState("");

  // Loading states
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  // For CLUB_MANAGER: vet conclusion is strictly read-only and displays the stored values
  const displayedHealthEligible = isManager
    ? (currentRecord.isHealthEligible ?? null)
    : isHealthEligible;
  const displayedHealthNotes = isManager
    ? (currentRecord.healthCheckNotes || "")
    : healthCheckNotes;

  // Microchip comparison logic
  const trimmedScanned = scannedMicrochip.trim().toUpperCase();
  const trimmedDeclared = declaredMicrochip.trim().toUpperCase();
  const isChipEmpty = trimmedScanned === "";
  const isChipMatched =
    !isChipEmpty && trimmedDeclared !== "" && trimmedScanned === trimmedDeclared;
  const isChipMismatch =
    !isChipEmpty && (!trimmedDeclared || trimmedScanned !== trimmedDeclared);

  // Eligible to approve only when 3 criteria are met from STORED record values (never local radio state of an out-of-scope field)
  const canApprove =
    Boolean(
      currentRecord.microchipVerified &&
      currentRecord.legalVerified &&
      currentRecord.isHealthEligible
    ) && isManager;

  const handleSaveInspection = async () => {
    try {
      setSaving(true);
      // Role-scoped payload: CLUB_MANAGER sends microchip & legal; VETERINARIAN sends health
      let payload: InspectAdmissionDto;
      if (isManager) {
        // Gửi chuỗi rỗng (không phải undefined) để BE XÓA giá trị cũ khi người dùng xóa ô
        // (BE: scannedMicrochip rỗng -> microchipVerified = false; note/url rỗng -> null).
        payload = {
          scannedMicrochip: trimmedScanned,
          legalVerified,
          legalDocumentsNote: legalDocumentsNote.trim(),
          documentsUrl: documentsUrl.trim(),
        };
      } else if (isVet) {
        payload = {
          isHealthEligible: isHealthEligible ?? undefined,
          healthCheckNotes: healthCheckNotes.trim(),
        };
      } else {
        payload = {};
      }

      const updated = await inspectAdmission(currentRecord.id, payload);
      setCurrentRecord(updated);
      toast.show(tr("Saved inspection results successfully"), "ok");
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : tr("Failed to save inspection results");
      toast.show(msg, "danger");
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!canApprove) return;
    try {
      setApproving(true);
      await approveAdmission(currentRecord.id);
      toast.show(
        tr("Congratulations: Horse {{name}} has officially joined the club!", {
          name: currentRecord.horse?.name || "",
        }),
        "ok",
      );
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : tr("Failed to approve admission");
      toast.show(msg, "danger");
    } finally {
      setApproving(false);
    }
  };

  const handleConfirmReject = async () => {
    const trimmed = rejectionReason.trim();
    if (trimmed.length < 10) {
      setRejectError(tr("Rejection reason must be at least 10 characters."));
      return;
    }
    if (trimmed.length > 500) {
      setRejectError(tr("Rejection reason cannot exceed 500 characters."));
      return;
    }
    try {
      setRejecting(true);
      setRejectError("");
      await rejectAdmission(currentRecord.id, {
        rejectionReason: trimmed,
      });
      toast.show(tr("Admission request rejected"), "warn");
      setShowRejectDialog(false);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : tr("Failed to reject admission request");
      setRejectError(msg);
      toast.show(msg, "danger");
    } finally {
      setRejecting(false);
    }
  };

  const scannedChipId = useId();
  const legalNotesId = useId();
  const docsUrlId = useId();
  const healthNotesId = useId();

  return (
    <>
      <Modal
        title={tr("Horse Admission Inspection — {{code}}", { code: record.admissionCode })}
        subtitle={tr("Verify ISO microchip, legal documents and quarantine health check prior to club admission")}
        width={680}
        onClose={onClose}
      >
        <div className={styles.container}>
          {/* Thông tin tóm tắt hồ sơ */}
          <div className={styles.summaryHeader}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>{tr("Horse Name")}</span>
              <span className={styles.summaryValue}>
                {record.horse?.name || tr("Unnamed")}
                {record.horse?.breed ? ` (${record.horse.breed})` : ""}
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>{tr("Owner")}</span>
              <span className={styles.summaryValue}>
                {record.owner?.fullName || tr("Unknown")}
                {record.owner?.email ? ` (${record.owner.email})` : ""}
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>{tr("Declared Microchip")}</span>
              <span className={styles.summaryValue}>
                {declaredMicrochip || tr("None")}
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>{tr("Appointment Date")}</span>
              <span className={styles.summaryValue}>
                {record.appointmentDate
                  ? formatDateTime(record.appointmentDate)
                  : tr("Not scheduled")}
              </span>
            </div>
          </div>

          {/* KHỐI 1: Vi mạch & Pháp lý */}
          <div className={styles.block}>
            <h3 className={styles.blockTitle}>
              <Icon name="shield" size={18} />
              {tr("Section 1: Microchip & Legal Verification")}
            </h3>
            {!isManager && (
              <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "10px" }}>
                ℹ️ {tr("Microchip & legal verification is managed by Club Manager. View only for Vet.")}
              </div>
            )}
            <div className={styles.fieldGroup}>
              <div>
                <label htmlFor={scannedChipId} className={styles.label}>
                  {tr("Scanned Microchip Code (Scanner Input)")}
                </label>
                <Input
                  id={scannedChipId}
                  value={scannedMicrochip}
                  onChange={(e) => setScannedMicrochip(e.target.value)}
                  placeholder={tr("Scan or enter 15-digit ISO 11784/11785 code...")}
                  autoComplete="off"
                  disabled={!isManager}
                  readOnly={!isManager}
                />
                {/* Live MATCH / MISMATCH banner */}
                {isChipEmpty && (
                  <div
                    className={`${styles.chipMatchBanner} ${styles.chipMatchNeutral}`}
                  >
                    <Icon name="info" size={16} />
                    <span>
                      {tr("Please scan or enter the actual microchip code to verify.")}
                    </span>
                  </div>
                )}
                {isChipMatched && (
                  <div
                    className={`${styles.chipMatchBanner} ${styles.chipMatchSuccess}`}
                  >
                    <Icon name="checkCircle" size={16} />
                    <span>{tr("✓ Microchip 100% matched ({{chip}})", { chip: trimmedScanned })}</span>
                  </div>
                )}
                {isChipMismatch && (
                  <div
                    className={`${styles.chipMatchBanner} ${styles.chipMatchError}`}
                  >
                    <Icon name="alert" size={16} />
                    <span>
                      {tr("✕ Scanned microchip ({{scanned}}) does not match declared microchip ({{declared}})! ", {
                        scanned: trimmedScanned,
                        declared: trimmedDeclared || tr("None"),
                      })}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <Checkbox
                  checked={legalVerified}
                  onChange={(checked) => isManager && setLegalVerified(checked)}
                  label={tr("Original legal documents verified (Birth cert, pedigree, transfer contract)")}
                  disabled={!isManager}
                />
              </div>

              <div>
                <label htmlFor={legalNotesId} className={styles.label}>
                  {tr("Legal documents note")}
                </label>
                <Textarea
                  id={legalNotesId}
                  value={legalDocumentsNote}
                  onChange={(e) => isManager && setLegalDocumentsNote(e.target.value)}
                  placeholder={tr("Note on origin, registration certificates, vaccination book...")}
                  rows={2}
                  disabled={!isManager}
                  readOnly={!isManager}
                />
              </div>

              <div>
                <label htmlFor={docsUrlId} className={styles.label}>
                  {tr("Scanned documents URL (optional)")}
                </label>
                <Input
                  id={docsUrlId}
                  value={documentsUrl}
                  onChange={(e) => isManager && setDocumentsUrl(e.target.value)}
                  placeholder="https://cloud.tmec.site/admissions/..."
                  disabled={!isManager}
                  readOnly={!isManager}
                />
              </div>
            </div>
          </div>

          {/* KHỐI 2: Sức khỏe thú y ban đầu */}
          <div className={styles.block}>
            <h3 className={styles.blockTitle}>
              <Icon name="stethoscope" size={18} />
              {tr("Section 2: Quarantine Health Screening")}
            </h3>
            {isManager && (
              <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "10px" }}>
                ℹ️ {tr("Health evaluation is conducted by Veterinarian. View only for Club Manager.")}
              </div>
            )}
            <div className={styles.fieldGroup}>
              <div>
                <span className={styles.label}>{tr("Clinical Screening Conclusion")}</span>
                <div className={styles.radioGroup}>
                  <label
                    className={`${styles.radioLabel} ${
                      displayedHealthEligible === true ? styles.radioActive : ""
                    } ${isManager ? styles.disabled : ""}`}
                  >
                    <input
                      type="radio"
                      name="healthEligibility"
                      checked={displayedHealthEligible === true}
                      onChange={() => !isManager && setIsHealthEligible(true)}
                      disabled={isManager}
                    />
                    <span>
                      <strong>{tr("Health eligible & fit")}</strong>{" "}
                      {tr("(No infectious symptoms, cleared for stable housing)")}
                    </span>
                  </label>
                  <label
                    className={`${styles.radioLabel} ${
                      displayedHealthEligible === false ? styles.radioActive : ""
                    } ${isManager ? styles.disabled : ""}`}
                  >
                    <input
                      type="radio"
                      name="healthEligibility"
                      checked={displayedHealthEligible === false}
                      onChange={() => !isManager && setIsHealthEligible(false)}
                      disabled={isManager}
                    />
                    <span>
                      <strong>{tr("Symptomatic / Quarantine required")}</strong>{" "}
                      {tr("(Fails quarantine standards, admission deferred)")}
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label htmlFor={healthNotesId} className={styles.label}>
                  {tr("Veterinarian Clinical Notes")}
                </label>
                <Textarea
                  id={healthNotesId}
                  value={displayedHealthNotes}
                  onChange={(e) => !isManager && setHealthCheckNotes(e.target.value)}
                  placeholder={
                    isManager
                      ? tr("(Veterinarian has not entered clinical notes yet)")
                      : tr("Note physical condition, musculature, eyes, lungs, skin, epidemiological signs...")
                  }
                  rows={3}
                  disabled={isManager}
                  readOnly={isManager}
                />
              </div>
            </div>
          </div>

          {/* Action buttons bar */}
          <div className={styles.actions}>
            <div>
              {isManager && (
                <Button
                  tone="danger"
                  onClick={() => setShowRejectDialog(true)}
                  disabled={saving || approving}
                >
                  <Icon name="ban" size={16} />
                  {tr("Reject Admission")}
                </Button>
              )}
            </div>

            <div className={styles.rightActions}>
              <Button
                tone="secondary"
                onClick={handleSaveInspection}
                disabled={saving || approving}
              >
                {saving ? tr("Saving...") : tr("Save inspection results")}
              </Button>

              {isManager && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                  <Button
                    tone="primary"
                    onClick={handleApprove}
                    disabled={!canApprove || saving || approving}
                    style={{
                      background: canApprove ? "#16a34a" : undefined,
                      borderColor: canApprove ? "#15803d" : undefined,
                    }}
                  >
                    <Icon name="check" size={16} />
                    {approving ? tr("Approving...") : tr("Approve Club Admission")}
                  </Button>
                  {!canApprove && (
                    <span className={styles.criteriaNotice}>
                      {tr("* Requires 3 verified criteria: Matched microchip, Legal approved, and Vet health passed.")}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* Mandatory reason rejection popup */}
      {showRejectDialog && (
        <Modal
          title={tr("Reject Admission Request")}
          subtitle={`${tr("Horse Name")}: ${record.horse?.name || ""} — ${record.admissionCode}`}
          tone="danger"
          width={480}
          onClose={() => !rejecting && setShowRejectDialog(false)}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <p style={{ margin: 0, fontSize: "14px", color: "var(--color-text)" }}>
              {tr("Explain why admission was denied (e.g. microchip mismatch, illness symptoms)...")}
            </p>

            <div>
              <Textarea
                value={rejectionReason}
                onChange={(e) => {
                  setRejectionReason(e.target.value);
                  if (rejectError) setRejectError("");
                }}
                placeholder={tr("Explain why admission was denied (e.g. microchip mismatch, illness symptoms)...")}
                rows={4}
                autoFocus
              />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px", fontSize: "12px", color: "var(--color-text-muted)" }}>
                <span>{rejectionReason.trim().length}/500 {tr("characters")}</span>
                {rejectError && <span style={{ color: "#dc2626" }}>{rejectError}</span>}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", paddingTop: "12px", borderTop: "1px solid var(--color-border-subtle, #e5e7eb)" }}>
              <Button
                tone="secondary"
                onClick={() => setShowRejectDialog(false)}
                disabled={rejecting}
              >
                {tr("Cancel")}
              </Button>
              <Button
                tone="danger"
                onClick={handleConfirmReject}
                disabled={rejecting || rejectionReason.trim().length < 10}
              >
                {rejecting ? tr("Rejecting...") : tr("Confirm Rejection")}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

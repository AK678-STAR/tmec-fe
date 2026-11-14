import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { cx } from "@/shared/lib/cx";
import { Icon } from "./Icon";
import styles from "./Modal.module.css";
import { tr, trNode } from "@/shared/i18n/tr";

interface ModalProps {
  title: string;
  subtitle?: string;
  tone?: "danger" | "warn";
  width?: number;
  foot?: ReactNode;
  // Không truyền onClose => hộp thoại KHÔNG có nút đóng, không đóng bằng Esc/nhấp nền
  // (dùng cho Session Expired: bắt buộc phải chọn một hướng).
  onClose?: () => void;
  children?: ReactNode;
  overlayClassName?: string;
  dialogClassName?: string;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let activeModalCount = 0;
let originalBodyOverflow = "";

// Hộp thoại có quản lý focus: đưa focus vào hộp khi mở, giữ Tab quay vòng trong hộp,
// Esc để đóng, và trả focus về chỗ cũ khi đóng.
export function Modal({ title, subtitle, tone, width = 480, foot, onClose, children, overlayClassName, dialogClassName }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // Giữ onClose mới nhất trong ref để effect bên dưới chỉ chạy một lần (không cướp focus mỗi lần render lại).
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const target = dialog?.querySelector<HTMLElement>("[data-autofocus]") ?? dialog;
    try {
      target?.focus();
    } catch {}

    if (activeModalCount === 0) {
      originalBodyOverflow = document.body.style.overflow || "";
      document.body.style.overflow = "hidden";
    }
    activeModalCount++;

    function onKeyDown(e: KeyboardEvent) {
      const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
      if (dialogs[dialogs.length - 1] !== dialog) return;
      if (e.key === "Escape" && closeRef.current) {
        e.stopPropagation();
        closeRef.current();
      }
      if (e.key !== "Tab" || !dialog) return;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === dialog)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      activeModalCount = Math.max(0, activeModalCount - 1);
      if (activeModalCount === 0) {
        document.body.style.overflow = originalBodyOverflow;
      }
      try {
        previous?.focus?.();
      } catch {}
    };
  }, []);

  return createPortal(
    <div className={cx(styles.overlay, overlayClassName)} onClick={() => closeRef.current?.()}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={trNode(title)}
        tabIndex={-1}
        className={cx(styles.dialog, dialogClassName)}
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.head}>
          {tone && (
            <span className={cx(styles.badge, styles[tone])}>
              <Icon name="alert" size={17} />
            </span>
          )}
          <div className={styles.headText}>
            <h2 className={styles.title}>{trNode(title)}</h2>
            {subtitle && <p className={styles.subtitle}>{trNode(subtitle)}</p>}
          </div>
          {onClose && (
            <button type="button" className={styles.close} onClick={onClose} aria-label={tr("Close")}>
              <Icon name="x" size={16} />
            </button>
          )}
        </header>
        {children != null && <div className={styles.body}>{children}</div>}
        {foot && <footer className={styles.foot}>{foot}</footer>}
      </div>
    </div>,
    document.body
  );
}

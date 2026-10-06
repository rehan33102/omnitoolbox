"use client";

import Modal from "./Modal";
import Button from "./Button";

/**
 * In-app destructive-action confirmation dialog.
 *
 * Replaces native `confirm()`, which is silently auto-dismissed in headless /
 * automated browsers and some WebViews — making the delete button appear dead
 * (click → nothing happens). This modal is real DOM: it always renders, always
 * works, and surfaces errors via toast from the caller's onConfirm.
 */
export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Delete",
  busy = false,
  busyLabel = "Deleting…",
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  busy?: boolean;
  busyLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6">{message}</p>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="danger" size="sm" onClick={onConfirm} disabled={busy}>
          {busy ? busyLabel : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

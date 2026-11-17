"use client";
import { useEffect, useRef, useId } from "react";
export function Modal({
  title,
  onClose,
  children,
  error,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  error?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <h2 id={id}>{title}</h2>
        <button
          type="button"
          className="icon"
          aria-label="Close dialog"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {children}
    </dialog>
  );
}

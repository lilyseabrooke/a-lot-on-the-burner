import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  eyebrow?: string;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}

/** Native <dialog>: gives focus trapping, Escape to close and a backdrop for free. */
export function Modal({ open, onClose, eyebrow, title, children, actions }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={titleId}
      // Escape fires "cancel". We close through React state instead, so a modal closing because
      // another one is opening never reports back as a user dismissal.
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-body">
        <button type="button" className="icon-button modal-close" onClick={onClose} aria-label="Close">
          <X size={18} aria-hidden />
        </button>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 id={titleId} className="modal-title">
          {title}
        </h2>
        <hr className="rule" />
        {children}
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </dialog>
  );
}

import { X } from 'lucide-react';
import { AnimatePresence, motion, useDragControls } from 'motion/react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { fx } from './fx';
import { spring } from './motion';
import { useIsWide } from './useMedia';

interface Props {
  open: boolean;
  onClose: () => void;
  eyebrow?: ReactNode;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}

/**
 * Bottom sheet on phones, centred card on wide screens. Built on a native <dialog> so focus
 * trapping and Escape still come for free; motion handles the slide and drag-to-dismiss.
 * The dialog stays open until the exit animation finishes.
 */
export function Sheet({ open, onClose, eyebrow, title, children, actions }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const drag = useDragControls();
  const wide = useIsWide();
  const wasOpen = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (open && !wasOpen.current) fx('sheetOpen');
    if (!open && wasOpen.current) fx('sheetClose');
    wasOpen.current = open;
  }, [open]);

  const hidden = wide ? { opacity: 0, y: 24, scale: 0.97 } : { y: '100%' };

  return (
    <dialog
      ref={ref}
      className="sheet-dialog"
      aria-labelledby={titleId}
      // Escape fires "cancel". Close through React state so the exit animation can play.
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <AnimatePresence onExitComplete={() => ref.current?.close()}>
        {open && (
          <motion.div
            key="backdrop"
            className="sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
        )}
        {open && (
          <motion.div
            key="panel"
            className="sheet"
            tabIndex={-1}
            autoFocus
            initial={hidden}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={hidden}
            transition={spring.gentle}
            drag={wide ? false : 'y'}
            dragListener={false}
            dragControls={drag}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.9 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 600) onClose();
            }}
          >
            <div className="sheet-grip" onPointerDown={(e) => drag.start(e)}>
              <span className="sheet-handle" />
            </div>
            <header className="sheet-head" onPointerDown={(e) => drag.start(e)}>
              <div>
                {eyebrow && <p className="eyebrow">{eyebrow}</p>}
                <h2 id={titleId} className="sheet-title">
                  {title}
                </h2>
              </div>
              <motion.button
                type="button"
                className="icon-button"
                onClick={onClose}
                aria-label="Close"
                whileTap={{ scale: 0.88 }}
                transition={spring.snappy}
              >
                <X size={20} aria-hidden />
              </motion.button>
            </header>
            <div className="sheet-content">{children}</div>
            {actions && <div className="sheet-actions">{actions}</div>}
          </motion.div>
        )}
      </AnimatePresence>
    </dialog>
  );
}

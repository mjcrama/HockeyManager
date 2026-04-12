import type { ReactNode, Ref } from 'react';
import { useScrollLock } from '../hooks/useScrollLock';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  modalRef?: Ref<HTMLDivElement>;
}

export function Modal({ title, onClose, children, wide, modalRef }: ModalProps) {
  useScrollLock(true);

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div
        className={`settings-modal${wide ? ' settings-modal--wide' : ''}`}
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings-modal__header">
          <span className="settings-modal__header-title">{title}</span>
          <button className="settings-modal__close-x" onClick={onClose}>✕</button>
        </div>
        <div className="settings-modal__body">
          {children}
        </div>
      </div>
    </div>
  );
}

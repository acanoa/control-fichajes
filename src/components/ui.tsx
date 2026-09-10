import { useEffect, useId, useRef } from 'react';
import type { ButtonHTMLAttributes, PropsWithChildren, ReactNode } from 'react';
import './ui.css';

type Variant = 'primary' | 'secondary' | 'danger' | 'success' | 'outline-primary' | 'outline-secondary' | 'outline-danger';
export function Button({ variant = 'primary', size, className = '', type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' }) {
  return <button {...props} type={type} className={`admin-button admin-button-${variant} ${size === 'sm' ? 'admin-button-small' : ''} ${className}`} />;
}
export function Badge({ variant = 'secondary', children }: PropsWithChildren<{ variant?: Variant }>) {
  return <span className={`admin-badge admin-button-${variant}`}>{children}</span>;
}
export function Modal({ open, onClose, title, footer, children }: PropsWithChildren<{ open: boolean; onClose: () => void; title: string; footer?: ReactNode }>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  return <dialog ref={dialog} aria-labelledby={titleId} onCancel={onClose} onClose={() => { if (open) onClose(); }} className="admin-dialog">
    <div className="admin-panel">
      <header className="flex justify-between items-center mb-4"><h2 id={titleId} className="text-lg font-bold">{title}</h2><button type="button" aria-label="Cerrar" onClick={onClose}>✕</button></header>
      {children}
      {footer && <footer className="flex justify-end gap-2 mt-5">{footer}</footer>}
    </div>
  </dialog>;
}

'use client';

import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}

/**
 * Generic glassmorphism modal wrapper using createPortal.
 * Replaces 5 duplicate modal implementations in admin.
 */
export function Modal({ open, onClose, children, maxWidth = 'max-w-md' }: ModalProps) {
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`w-full ${maxWidth} rounded-2xl p-7 border border-white/10 glass animate-in fade-in zoom-in duration-200`}
        style={{ background: '#0d1124' }}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

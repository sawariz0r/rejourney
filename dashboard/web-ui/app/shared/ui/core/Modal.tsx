import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  showCloseButton?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  panelClassName?: string;
  bodyClassName?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  showCloseButton = true,
  size = 'md',
  panelClassName = '',
  bodyClassName = '',
}) => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl'
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-3 backdrop-blur-[2px] animate-in fade-in duration-200 sm:p-4">
      <div className={`bg-white text-slate-900 border-2 border-black shadow-[8px_8px_0_0_#000000] ${sizeClasses[size]} w-full max-h-[calc(100dvh-1.5rem)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 sm:max-h-[90vh] ${panelClassName}`}>
        {(title || showCloseButton) && (
          <div className="border-b-2 border-black p-4 flex justify-between items-center bg-[#f8fafc]">
            <h2 className="text-lg font-black uppercase text-black">{title}</h2>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="border-2 border-transparent p-1 text-black transition-all hover:border-black hover:bg-[#fecaca] hover:shadow-neo-sm"
              >
                <X className="w-5 h-5" />
                <span className="sr-only">Close</span>
              </button>
            )}
          </div>
        )}
        <div className={`p-4 flex-1 overflow-y-auto sm:p-6 ${bodyClassName}`}>{children}</div>
        {footer && <div className="border-t-2 border-black p-4 flex flex-wrap justify-end gap-3 bg-[#f8fafc]">{footer}</div>}
      </div>
    </div>
  );
};

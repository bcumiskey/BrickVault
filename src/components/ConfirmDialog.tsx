import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onCancel}
      className="backdrop:bg-black/40 rounded-xl p-0 max-w-sm w-full shadow-xl"
    >
      <div className="p-6">
        {variant === 'danger' && (
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4 mx-auto">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
        )}
        <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">{title}</h3>
        <p className="text-sm text-gray-500 text-center">{message}</p>
      </div>
      <div className="flex border-t border-gray-200">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors border-r border-gray-200"
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            variant === 'danger'
              ? 'text-red-600 hover:bg-red-50'
              : 'text-indigo-600 hover:bg-indigo-50'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}

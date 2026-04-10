import { useEffect, useRef } from 'react';
import { X, ExternalLink } from 'lucide-react';

interface ImageModalProps {
  open: boolean;
  imageUrl: string | null;
  title: string;
  itemNum: string;
  year?: number;
  numParts?: number;
  externalUrl?: string;
  onClose: () => void;
}

export default function ImageModal({ open, imageUrl, title, itemNum, year, numParts, externalUrl, onClose }: ImageModalProps) {
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

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (open) {
      document.addEventListener('keydown', handleKey);
      return () => document.removeEventListener('keydown', handleKey);
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="backdrop:bg-black/60 bg-transparent p-0 max-w-3xl w-full"
      onClick={e => { if (e.target === dialogRef.current) onClose(); }}
    >
      <div className="bg-white rounded-xl overflow-hidden shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Image */}
        <div className="bg-gray-50 flex items-center justify-center p-8 min-h-[300px] max-h-[60vh]">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={title}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <div className="text-gray-300 text-lg">No image available</div>
          )}
        </div>

        {/* Info bar */}
        <div className="px-5 py-4 border-t border-gray-100">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-gray-400 font-mono mb-0.5">{itemNum}</p>
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              <div className="flex gap-3 mt-1 text-sm text-gray-500">
                {year && <span>{year}</span>}
                {numParts != null && <span>{numParts} pieces</span>}
              </div>
            </div>
            {externalUrl && (
              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 whitespace-nowrap mt-1"
              >
                Rebrickable <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </dialog>
  );
}

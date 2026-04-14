import { useRef } from "react";

interface Props {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}

export function PrintLayout({ title, children, onClose }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow || !contentRef.current) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          @page { margin: 15mm; size: A4; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px; color: #1a1a1a; line-height: 1.5; }
          .header { border-bottom: 2px solid #1a1a1a; padding-bottom: 10px; margin-bottom: 15px; }
          .header h1 { font-size: 18px; font-weight: 700; }
          .header .subtitle { font-size: 11px; color: #666; margin-top: 2px; }
          .section { margin-bottom: 12px; }
          .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #666; margin-bottom: 6px; border-bottom: 1px solid #ddd; padding-bottom: 3px; }
          .row { display: flex; gap: 8px; margin-bottom: 4px; }
          .label { font-weight: 600; min-width: 140px; color: #444; }
          .value { color: #1a1a1a; }
          table { width: 100%; border-collapse: collapse; margin: 8px 0; }
          th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; font-size: 11px; }
          th { background: #f5f5f5; font-weight: 600; }
          .footer { margin-top: 30px; border-top: 1px solid #ddd; padding-top: 10px; font-size: 10px; color: #999; display: flex; justify-content: space-between; }
          .signature-line { margin-top: 40px; display: flex; justify-content: space-between; gap: 40px; }
          .signature-block { flex: 1; text-align: center; }
          .signature-block .line { border-top: 1px solid #1a1a1a; margin-top: 40px; padding-top: 4px; font-size: 10px; color: #666; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; background: #e8e8e8; }
          .badge-active { background: #dcfce7; color: #166534; }
          .badge-completed { background: #dbeafe; color: #1e40af; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        ${contentRef.current.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Toolbar */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <p className="text-sm font-semibold text-gray-900">Предпросмотр печати</p>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">
              Печать / PDF
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-200 transition-colors">
              <svg className="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        </div>
        {/* Print content */}
        <div className="p-8 overflow-auto max-h-[80vh] bg-white" ref={contentRef}>
          {children}
        </div>
      </div>
    </div>
  );
}

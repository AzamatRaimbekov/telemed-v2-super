import { useState, useRef, useCallback } from "react";
import { Upload, File, X, Image, FileText } from "lucide-react";

interface FileDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;  // e.g. "image/*,.pdf"
  multiple?: boolean;
  maxSizeMB?: number;
  className?: string;
}

export function FileDropzone({
  onFilesSelected,
  accept = "*",
  multiple = true,
  maxSizeMB = 10,
  className = "",
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    setError(null);

    const newFiles = Array.from(fileList);
    const maxBytes = maxSizeMB * 1024 * 1024;

    const oversized = newFiles.find((f) => f.size > maxBytes);
    if (oversized) {
      setError(`Файл "${oversized.name}" превышает ${maxSizeMB}MB`);
      return;
    }

    const updated = multiple ? [...files, ...newFiles] : newFiles;
    setFiles(updated);
    onFilesSelected(updated);
  }, [files, multiple, maxSizeMB, onFilesSelected]);

  const removeFile = (index: number) => {
    const updated = files.filter((_, i) => i !== index);
    setFiles(updated);
    onFilesSelected(updated);
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith("image/")) return <Image size={16} className="text-blue-500" />;
    if (file.type === "application/pdf") return <FileText size={16} className="text-red-500" />;
    return <File size={16} className="text-[var(--color-text-tertiary)]" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={className}>
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
          isDragging
            ? "border-[var(--color-secondary)] bg-[var(--color-secondary)]/5"
            : "border-[var(--color-border)] hover:border-[var(--color-text-tertiary)] hover:bg-[var(--color-muted)]/50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
        <Upload size={32} className={`mx-auto mb-3 ${isDragging ? "text-[var(--color-secondary)]" : "text-[var(--color-text-tertiary)]"}`} />
        <p className="text-sm font-medium text-[var(--color-text-primary)]">
          Перетащите файлы сюда
        </p>
        <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
          или нажмите для выбора · максимум {maxSizeMB}MB
        </p>
      </div>

      {error && (
        <p className="text-xs text-destructive mt-2">{error}</p>
      )}

      {files.length > 0 && (
        <div className="mt-3 space-y-2">
          {files.map((file, i) => (
            <div key={`${file.name}-${i}`} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-[var(--color-muted)]/50">
              {getFileIcon(file)}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--color-text-primary)] truncate">{file.name}</p>
                <p className="text-[10px] text-[var(--color-text-tertiary)]">{formatSize(file.size)}</p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); removeFile(i); }} className="p-1 rounded-lg hover:bg-[var(--color-muted)] text-[var(--color-text-tertiary)]">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

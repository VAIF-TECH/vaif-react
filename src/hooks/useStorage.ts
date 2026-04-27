import { useState, useCallback, useRef, useEffect } from "react";
import { useVaifClient } from "../context/VaifContext";
import type {
  FileMetadata,
  UploadResult,
  UploadOptions,
} from "@vaiftech/client";

// ============ TYPES ============

export interface UseUploadOptions extends Partial<UploadOptions> {
  /** Max file size in bytes */
  maxSize?: number;

  /** Allowed mime types */
  allowedTypes?: string[];

  /** Generate unique key */
  uniqueKey?: boolean;

  /** Callback on upload start */
  onUploadStart?: (file: File) => void;

  /** Callback on upload progress */
  onProgress?: (progress: number, file: File) => void;

  /** Callback on upload success */
  onSuccess?: (result: UploadResult, file: File) => void;

  /** Callback on upload error */
  onError?: (error: Error, file: File) => void;
}

export interface UseUploadReturn {
  /** Upload a file */
  upload: (key: string, file: File) => Promise<UploadResult>;

  /** Upload multiple files */
  uploadMultiple: (files: Array<{ key: string; file: File }>) => Promise<UploadResult[]>;

  /** Current upload progress (0-100) */
  progress: number;

  /** Whether upload is in progress */
  isUploading: boolean;

  /** Error state */
  error: Error | null;

  /** Last upload result */
  result: UploadResult | null;

  /** All upload results */
  results: UploadResult[];

  /** Reset state */
  reset: () => void;
}

export interface UseDownloadOptions {
  /** Callback on download success */
  onSuccess?: (blob: Blob, filename: string) => void;

  /** Callback on download error */
  onError?: (error: Error) => void;
}

export interface UseDownloadReturn {
  /** Download a file */
  download: (key: string, filename?: string) => Promise<Blob>;

  /** Download and trigger browser download */
  downloadAndSave: (key: string, filename?: string) => Promise<void>;

  /** Whether download is in progress */
  isDownloading: boolean;

  /** Error state */
  error: Error | null;
}

export interface UseFileOptions {
  /** Expiry time in seconds for signed URL */
  expiresIn?: number;

  /** Enable/disable */
  enabled?: boolean;
}

export interface UseFileReturn {
  /** File URL (signed) */
  url: string | null;

  /** File metadata */
  metadata: FileMetadata | null;

  /** Loading state */
  isLoading: boolean;

  /** Error state */
  error: Error | null;

  /** Refresh URL and metadata */
  refresh: () => Promise<void>;

  /** Delete the file */
  deleteFile: () => Promise<void>;
}

export interface UseFilesOptions {
  /** Path prefix filter */
  prefix?: string;

  /** Max files to return */
  limit?: number;

  /** Enable/disable */
  enabled?: boolean;
}

export interface UseFilesReturn {
  /** List of files */
  files: FileMetadata[];

  /** Loading state */
  isLoading: boolean;

  /** Error state */
  error: Error | null;

  /** Refresh file list */
  refresh: () => Promise<void>;
}

export interface DropzoneOptions extends UseUploadOptions {
  /** Base path for uploads */
  basePath?: string;

  /** Multiple files allowed */
  multiple?: boolean;
}

export interface DropzoneState {
  /** Whether file is being dragged over */
  isDragOver: boolean;

  /** Files selected (before upload) */
  selectedFiles: File[];
}

export interface UseDropzoneReturn extends UseUploadReturn {
  /** Dropzone state */
  dropzone: DropzoneState;

  /** Get props for the drop zone element */
  getDropzoneProps: () => {
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
    onClick: () => void;
  };

  /** Get props for hidden file input */
  getInputProps: () => {
    type: "file";
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    multiple: boolean;
    accept: string;
    style: { display: "none" };
  };

  /** Open file picker */
  openFilePicker: () => void;

  /** Clear selected files */
  clearFiles: () => void;

  /** Remove a specific file */
  removeFile: (index: number) => void;
}

// ============ HOOKS ============

/**
 * File upload hook
 *
 * @example
 * ```tsx
 * function FileUploader() {
 *   const { upload, progress, isUploading, error } = useUpload({
 *     maxSize: 5 * 1024 * 1024, // 5MB
 *     allowedTypes: ['image/jpeg', 'image/png'],
 *     onSuccess: (result) => {
 *       toast.success(`Uploaded: ${result.key}`);
 *     },
 *   });
 *
 *   const handleChange = async (e: ChangeEvent<HTMLInputElement>) => {
 *     const file = e.target.files?.[0];
 *     if (file) {
 *       await upload(`uploads/${file.name}`, file);
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <input type="file" onChange={handleChange} disabled={isUploading} />
 *       {isUploading && <progress value={progress} max={100} />}
 *       {error && <p className="error">{error.message}</p>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useUpload(options?: UseUploadOptions): UseUploadReturn {
  const client = useVaifClient();
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [results, setResults] = useState<UploadResult[]>([]);

  const validateFile = useCallback(
    (file: File): void => {
      // Check file size
      if (options?.maxSize && file.size > options.maxSize) {
        throw new Error(
          `File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds maximum allowed (${Math.round(options.maxSize / 1024 / 1024)}MB)`
        );
      }

      // Check file type
      if (options?.allowedTypes && options.allowedTypes.length > 0) {
        if (!options.allowedTypes.includes(file.type)) {
          throw new Error(
            `File type "${file.type}" is not allowed. Allowed types: ${options.allowedTypes.join(", ")}`
          );
        }
      }
    },
    [options?.maxSize, options?.allowedTypes]
  );

  const upload = useCallback(
    async (key: string, file: File): Promise<UploadResult> => {
      setIsUploading(true);
      setError(null);
      setProgress(0);

      try {
        validateFile(file);
        options?.onUploadStart?.(file);

        // Use direct upload
        const uploadResult = await client.storage.upload(key, file, {
          contentType: file.type,
          metadata: options?.metadata,
          isPublic: options?.isPublic,
        });

        setProgress(100);
        setResult(uploadResult);
        setResults((prev) => [...prev, uploadResult]);
        options?.onSuccess?.(uploadResult, file);

        return uploadResult;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Upload failed");
        setError(error);
        options?.onError?.(error, file);
        throw error;
      } finally {
        setIsUploading(false);
      }
    },
    [client, options, validateFile]
  );

  const uploadMultiple = useCallback(
    async (files: Array<{ key: string; file: File }>): Promise<UploadResult[]> => {
      const uploadResults: UploadResult[] = [];

      for (const { key, file } of files) {
        const result = await upload(key, file);
        uploadResults.push(result);
      }

      return uploadResults;
    },
    [upload]
  );

  const reset = useCallback(() => {
    setProgress(0);
    setIsUploading(false);
    setError(null);
    setResult(null);
    setResults([]);
  }, []);

  return {
    upload,
    uploadMultiple,
    progress,
    isUploading,
    error,
    result,
    results,
    reset,
  };
}

/**
 * File download hook
 *
 * @example
 * ```tsx
 * function DownloadButton({ fileKey }: { fileKey: string }) {
 *   const { downloadAndSave, isDownloading } = useDownload();
 *
 *   return (
 *     <button
 *       onClick={() => downloadAndSave(fileKey)}
 *       disabled={isDownloading}
 *     >
 *       {isDownloading ? 'Downloading...' : 'Download'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useDownload(options?: UseDownloadOptions): UseDownloadReturn {
  const client = useVaifClient();
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const download = useCallback(
    async (key: string, filename?: string): Promise<Blob> => {
      setIsDownloading(true);
      setError(null);

      try {
        const blob = await client.storage.download(key);
        options?.onSuccess?.(blob, filename || key.split("/").pop() || "download");
        return blob;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Download failed");
        setError(error);
        options?.onError?.(error);
        throw error;
      } finally {
        setIsDownloading(false);
      }
    },
    [client, options]
  );

  const downloadAndSave = useCallback(
    async (key: string, filename?: string): Promise<void> => {
      const blob = await download(key, filename);
      const name = filename || key.split("/").pop() || "download";

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
    [download]
  );

  return {
    download,
    downloadAndSave,
    isDownloading,
    error,
  };
}

/**
 * Single file hook (URL, metadata, actions)
 *
 * @example
 * ```tsx
 * function FilePreview({ fileKey }: { fileKey: string }) {
 *   const { url, metadata, isLoading, deleteFile } = useFile(fileKey, {
 *     expiresIn: 3600
 *   });
 *
 *   if (isLoading) return <Skeleton />;
 *   if (!url) return <Empty />;
 *
 *   return (
 *     <div>
 *       <img src={url} alt={metadata?.name} />
 *       <button onClick={deleteFile}>Delete</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useFile(key: string | null, options?: UseFileOptions): UseFileReturn {
  const client = useVaifClient();
  const [url, setUrl] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<FileMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(!!key && options?.enabled !== false);
  const [error, setError] = useState<Error | null>(null);

  const enabled = !!key && options?.enabled !== false;

  const fetchFile = useCallback(async () => {
    if (!enabled || !key) return;

    setIsLoading(true);
    setError(null);

    try {
      // Get signed URL
      const signedUrl = await client.storage.createSignedUrl(key, options?.expiresIn);
      setUrl(signedUrl);

      // Get metadata
      const meta = await client.storage.getMetadata(key);
      setMetadata(meta);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load file"));
    } finally {
      setIsLoading(false);
    }
  }, [client, key, options?.expiresIn, enabled]);

  const deleteFile = useCallback(async () => {
    if (!key) return;

    await client.storage.delete(key);
    setUrl(null);
    setMetadata(null);
  }, [client, key]);

  // Initial fetch
  useEffect(() => {
    fetchFile();
  }, [fetchFile]);

  return {
    url,
    metadata,
    isLoading,
    error,
    refresh: fetchFile,
    deleteFile,
  };
}

/**
 * List files
 *
 * @example
 * ```tsx
 * function FileList({ folder }: { folder: string }) {
 *   const { files, isLoading, refresh } = useFiles({
 *     prefix: folder,
 *     limit: 20,
 *   });
 *
 *   return (
 *     <div>
 *       {files.map(file => (
 *         <FileItem key={file.key} file={file} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useFiles(options?: UseFilesOptions): UseFilesReturn {
  const client = useVaifClient();
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(options?.enabled !== false);
  const [error, setError] = useState<Error | null>(null);

  const enabled = options?.enabled !== false;

  const fetchFiles = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await client.storage.list({
        prefix: options?.prefix,
        limit: options?.limit,
      });
      setFiles(result.files);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to list files"));
    } finally {
      setIsLoading(false);
    }
  }, [client, options, enabled]);

  // Initial fetch
  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  return {
    files,
    isLoading,
    error,
    refresh: fetchFiles,
  };
}

/**
 * Drag and drop file upload hook
 *
 * @example
 * ```tsx
 * function DropZone() {
 *   const {
 *     dropzone,
 *     getDropzoneProps,
 *     getInputProps,
 *     isUploading,
 *     progress,
 *     results,
 *   } = useDropzone({
 *     basePath: 'uploads',
 *     multiple: true,
 *     maxSize: 10 * 1024 * 1024,
 *     allowedTypes: ['image/*'],
 *   });
 *
 *   return (
 *     <div
 *       {...getDropzoneProps()}
 *       className={`dropzone ${dropzone.isDragOver ? 'drag-over' : ''}`}
 *     >
 *       <input {...getInputProps()} />
 *       {isUploading ? (
 *         <progress value={progress} max={100} />
 *       ) : (
 *         <p>Drag files here or click to select</p>
 *       )}
 *       {results.length > 0 && (
 *         <ul>
 *           {results.map((r, i) => <li key={i}>{r.key}</li>)}
 *         </ul>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useDropzone(options?: DropzoneOptions): UseDropzoneReturn {
  const uploadHook = useUpload(options);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const generateKey = useCallback(
    (file: File): string => {
      const basePath = options?.basePath || "uploads";
      const uniqueId = Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
      const ext = file.name.split(".").pop() || "";
      return options?.uniqueKey
        ? `${basePath}/${uniqueId}.${ext}`
        : `${basePath}/${file.name}`;
    },
    [options?.basePath, options?.uniqueKey]
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      const filesToUpload = options?.multiple ? files : [files[0]];
      setSelectedFiles(filesToUpload);

      await uploadHook.uploadMultiple(
        filesToUpload.map((file) => ({ key: generateKey(file), file }))
      );
    },
    [options?.multiple, uploadHook, generateKey]
  );

  const handleInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      setSelectedFiles(files);
      await uploadHook.uploadMultiple(
        files.map((file) => ({ key: generateKey(file), file }))
      );
    },
    [uploadHook, generateKey]
  );

  const openFilePicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const clearFiles = useCallback(() => {
    setSelectedFiles([]);
    uploadHook.reset();
  }, [uploadHook]);

  const removeFile = useCallback((index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const getDropzoneProps = useCallback(
    () => ({
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
      onClick: openFilePicker,
    }),
    [handleDragOver, handleDragLeave, handleDrop, openFilePicker]
  );

  const getInputProps = useCallback(
    () => ({
      type: "file" as const,
      onChange: handleInputChange,
      multiple: options?.multiple ?? false,
      accept: options?.allowedTypes?.join(",") ?? "",
      style: { display: "none" as const },
      ref: (el: HTMLInputElement) => {
        inputRef.current = el;
      },
    }),
    [handleInputChange, options?.multiple, options?.allowedTypes]
  );

  return {
    ...uploadHook,
    dropzone: {
      isDragOver,
      selectedFiles,
    },
    getDropzoneProps,
    getInputProps: getInputProps as () => {
      type: "file";
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
      multiple: boolean;
      accept: string;
      style: { display: "none" };
    },
    openFilePicker,
    clearFiles,
    removeFile,
  };
}

/**
 * Get a public URL for a file
 *
 * @example
 * ```tsx
 * function Avatar({ fileKey }: { fileKey: string }) {
 *   const url = usePublicUrl(fileKey);
 *   return <img src={url} alt="Avatar" />;
 * }
 * ```
 */
export function usePublicUrl(key: string): string {
  const client = useVaifClient();
  return client.storage.getPublicUrl(key);
}

import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Upload, Trash2, FileText, Image as ImageIcon, FileCheck, ShieldCheck, File,
  X, ChevronLeft, ChevronRight, Loader2, CheckCircle2, AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import {
  documentService,
  DOCUMENT_CATEGORY_LABELS,
  type DocumentCategory,
  type PatientDocumentResponse,
} from '../services/documentService'

const CATEGORIES: DocumentCategory[] = ['XRay', 'Photo', 'Consent', 'Insurance', 'Other']

const CATEGORY_ICONS: Record<DocumentCategory, React.ReactNode> = {
  XRay: <ImageIcon size={14} />,
  Photo: <ImageIcon size={14} />,
  Consent: <FileCheck size={14} />,
  Insurance: <ShieldCheck size={14} />,
  Other: <File size={14} />,
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Builds date-based labels for a list of documents, e.g. 01-05-2026(1), 01-05-2026(2) */
function buildDateLabels(docs: PatientDocumentResponse[]): Map<string, string> {
  const byDate = new Map<string, string[]>()
  for (const d of docs) {
    const date = new Date(d.createdAt)
    const key = `${String(date.getDate()).padStart(2,'0')}-${String(date.getMonth()+1).padStart(2,'0')}-${date.getFullYear()}`
    if (!byDate.has(key)) byDate.set(key, [])
    byDate.get(key)!.push(d.id)
  }
  const labels = new Map<string, string>()
  byDate.forEach((ids, dateStr) => {
    ids.forEach((id, i) => labels.set(id, `${dateStr}(${i + 1})`))
  })
  return labels
}

function isImageType(contentType: string) {
  return contentType.startsWith('image/')
}

interface PendingFile {
  localId: string
  file: File
  state: 'pending' | 'uploading' | 'done' | 'error'
}

// ─── Lazy-loading image thumbnail ────────────────────────────────────────────

function DocImageThumb({
  patientId,
  doc,
  label,
  onClick,
}: {
  patientId: string
  doc: PatientDocumentResponse
  label: string
  onClick: () => void
}) {
  const { data: url, isLoading } = useQuery({
    queryKey: ['doc-url', patientId, doc.id],
    queryFn: () => documentService.getUrl(patientId, doc.id),
    staleTime: 10 * 60 * 1000,
  })

  return (
    <button
      onClick={onClick}
      className="group relative w-full aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:ring-2 hover:ring-indigo-500 focus:outline-none transition-all"
    >
      {isLoading ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 size={20} className="animate-spin text-gray-400" />
        </div>
      ) : url ? (
        <img src={url} alt={doc.fileName} className="w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400">
          <ImageIcon size={24} />
        </div>
      )}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent text-white text-xs px-2 py-1.5 truncate translate-y-full group-hover:translate-y-0 transition-transform">
        {label}
      </div>
    </button>
  )
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({
  patientId,
  images,
  labels,
  startIndex,
  onClose,
}: {
  patientId: string
  images: PatientDocumentResponse[]
  labels: Map<string, string>
  startIndex: number
  onClose: () => void
}) {
  const [idx, setIdx] = useState(startIndex)
  const current = images[idx]

  const { data: url, isLoading } = useQuery({
    queryKey: ['doc-url', patientId, current.id],
    queryFn: () => documentService.getUrl(patientId, current.id),
    staleTime: 10 * 60 * 1000,
  })

  const prev = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIdx(i => (i - 1 + images.length) % images.length)
  }
  const next = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIdx(i => (i + 1) % images.length)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') setIdx(i => (i - 1 + images.length) % images.length)
      if (e.key === 'ArrowRight') setIdx(i => (i + 1) % images.length)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [images.length, onClose])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
      >
        <X size={20} />
      </button>

      {/* Counter */}
      {images.length > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/70 text-sm select-none">
          {idx + 1} / {images.length}
        </div>
      )}

      {/* Caption */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <p className="text-white/80 text-sm">{labels.get(current.id) ?? current.fileName}</p>
        <p className="text-white/50 text-xs mt-0.5">
          {DOCUMENT_CATEGORY_LABELS[current.category]}
          {current.notes && ` · ${current.notes}`}
        </p>
      </div>

      {/* Prev */}
      {images.length > 1 && (
        <button
          onClick={prev}
          className="absolute left-4 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
      )}

      {/* Next */}
      {images.length > 1 && (
        <button
          onClick={next}
          className="absolute right-4 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
        >
          <ChevronRight size={24} />
        </button>
      )}

      {/* Image */}
      <div
        className="max-w-[88vw] max-h-[80vh] flex items-center justify-center"
        onClick={e => e.stopPropagation()}
      >
        {isLoading ? (
          <Loader2 size={32} className="animate-spin text-white/60" />
        ) : url ? (
          <img
            src={url}
            alt={current.fileName}
            className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
          />
        ) : (
          <p className="text-white/50 text-sm">Could not load image</p>
        )}
      </div>
    </div>
  )
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

interface Props {
  patientId: string
  canManage: boolean
}

export function PatientFilesTab({ patientId, canManage }: Props) {
  const { t } = useTranslation('patients')
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [category, setCategory] = useState<DocumentCategory>('Other')
  const [notes, setNotes] = useState('')
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<{ images: PatientDocumentResponse[]; index: number } | null>(null)

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['patient-documents', patientId],
    queryFn: () => documentService.list(patientId),
  })

  const imageDocuments = documents.filter(d => isImageType(d.contentType))
  const otherDocuments = documents.filter(d => !isImageType(d.contentType))
  const imageLabels = buildDateLabels(imageDocuments)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    const newItems: PendingFile[] = files.map(f => ({
      localId: `${f.name}-${f.lastModified}-${Math.random()}`,
      file: f,
      state: 'pending' as const,
    }))
    setPendingFiles(prev => [...prev, ...newItems])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removePending(localId: string) {
    setPendingFiles(prev => prev.filter(f => f.localId !== localId))
  }

  async function handleUpload() {
    const toUpload = pendingFiles.filter(f => f.state === 'pending' || f.state === 'error')
    if (toUpload.length === 0) return
    setUploading(true)
    let successCount = 0
    for (const pf of toUpload) {
      setPendingFiles(prev => prev.map(f => f.localId === pf.localId ? { ...f, state: 'uploading' } : f))
      try {
        await documentService.upload(patientId, pf.file, category, notes || undefined)
        setPendingFiles(prev => prev.map(f => f.localId === pf.localId ? { ...f, state: 'done' } : f))
        successCount++
      } catch {
        setPendingFiles(prev => prev.map(f => f.localId === pf.localId ? { ...f, state: 'error' } : f))
      }
    }
    qc.invalidateQueries({ queryKey: ['patient-documents', patientId] })
    if (successCount > 0) toast.success(t('toast.filesUploaded', { count: successCount }))
    const failCount = toUpload.length - successCount
    if (failCount > 0) toast.error(t('toast.filesUploadFailed', { count: failCount }))
    setPendingFiles(prev => prev.filter(f => f.state !== 'done'))
    if (failCount === 0) { setNotes(''); setCategory('Other') }
    setUploading(false)
  }

  const deleteMutation = useMutation({
    mutationFn: (doc: PatientDocumentResponse) => documentService.delete(patientId, doc.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient-documents', patientId] })
      toast.success(t('toast.fileDeleted'))
    },
    onError: () => toast.error(t('toast.deleteFailed')),
    onSettled: () => setDeletingId(null),
  })

  function handleDelete(doc: PatientDocumentResponse) {
    if (!window.confirm(t('confirm.deleteFile', { fileName: doc.fileName }))) return
    setDeletingId(doc.id)
    deleteMutation.mutate(doc)
  }

  async function handleOpenFile(doc: PatientDocumentResponse) {
    try {
      const url = await documentService.getUrl(patientId, doc.id)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      toast.error(t('toast.couldNotOpenFile'))
    }
  }

  const pendingCount = pendingFiles.filter(f => f.state === 'pending' || f.state === 'error').length

  return (
    <div className="space-y-4">
      {/* Upload panel */}
      {canManage && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('files.uploadTitle')}</h3>

          {/* File picker */}
          <div className="space-y-2">
            <label className="inline-flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-sm text-gray-500 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-500 dark:hover:border-indigo-500 dark:hover:text-indigo-400 transition-colors">
              <Upload size={15} />
              {t('files.chooseFiles')}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,application/pdf,.doc,.docx"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {t('files.supportedFormats')}
            </p>

            {/* Pending list */}
            {pendingFiles.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {pendingFiles.map(pf => (
                  <li
                    key={pf.localId}
                    className="flex items-center gap-2 text-sm bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-1.5"
                  >
                    <span className="shrink-0">
                      {pf.state === 'pending' && <File size={14} className="text-gray-400" />}
                      {pf.state === 'uploading' && <Loader2 size={14} className="animate-spin text-indigo-500" />}
                      {pf.state === 'done' && <CheckCircle2 size={14} className="text-green-500" />}
                      {pf.state === 'error' && <AlertCircle size={14} className="text-red-500" />}
                    </span>
                    <span className="flex-1 truncate text-gray-700 dark:text-gray-200">{pf.file.name}</span>
                    <span className="text-xs text-gray-400 shrink-0">{formatBytes(pf.file.size)}</span>
                    {(pf.state === 'pending' || pf.state === 'error') && (
                      <button
                        onClick={() => removePending(pf.localId)}
                        className="text-gray-300 hover:text-red-400 transition-colors shrink-0"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Category + Notes (only shown when files are pending) */}
          {pendingFiles.length > 0 && (
            <div className="flex gap-3">
              <div className="w-40 shrink-0">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('files.category')}</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value as DocumentCategory)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{DOCUMENT_CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('files.notesOptional')}</label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder={t('files.notesPlaceholder')}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Upload button */}
          {pendingCount > 0 && (
            <button
              disabled={uploading}
              onClick={handleUpload}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              {uploading ? t('files.uploading') : t('files.uploadButton', { count: pendingCount })}
            </button>
          )}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="py-12 flex justify-center">
          <Loader2 size={24} className="animate-spin text-gray-300 dark:text-gray-600" />
        </div>
      )}

      {/* Image grid */}
      {!isLoading && imageDocuments.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {t('files.imagesHeading')} <span className="text-gray-400 font-normal">({imageDocuments.length})</span>
            </h3>
          </div>
          <div className="p-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {imageDocuments.map((doc, i) => (
              <div key={doc.id} className="relative group">
                <DocImageThumb
                  patientId={patientId}
                  doc={doc}
                  label={imageLabels.get(doc.id) ?? doc.fileName}
                  onClick={() => setLightbox({ images: imageDocuments, index: i })}
                />
                {canManage && (
                  <button
                    onClick={() => handleDelete(doc)}
                    disabled={deletingId === doc.id}
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 bg-black/50 hover:bg-red-600 text-white rounded-full p-1 transition-all disabled:opacity-30"
                    title={t('files.deleteTooltip')}
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Other documents list */}
      {!isLoading && otherDocuments.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {t('files.documentsHeading')} <span className="text-gray-400 font-normal">({otherDocuments.length})</span>
            </h3>
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {otherDocuments.map(doc => (
              <li key={doc.id} className="px-5 py-3 flex items-center gap-3 group">
                <span className="text-gray-400 dark:text-gray-500 shrink-0">
                  {CATEGORY_ICONS[doc.category]}
                </span>
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => handleOpenFile(doc)}
                    className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline truncate block text-left"
                  >
                    {doc.fileName}
                  </button>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {DOCUMENT_CATEGORY_LABELS[doc.category]}
                    {doc.notes && <> · {doc.notes}</>}
                    {' · '}{formatBytes(doc.fileSizeBytes)}
                    {' · '}{new Date(doc.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {canManage && (
                  <button
                    onClick={() => handleDelete(doc)}
                    disabled={deletingId === doc.id}
                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 disabled:opacity-30 transition-opacity shrink-0"
                    title={t('files.deleteTooltip')}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && documents.length === 0 && (
        <div className="py-12 text-center">
          <FileText size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
          <p className="text-sm text-gray-400 dark:text-gray-500">{t('files.emptyState')}</p>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <Lightbox
          patientId={patientId}
          images={lightbox.images}
          labels={imageLabels}
          startIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  )
}


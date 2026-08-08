import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadsApi, getFileViewUrl, viewSecureFile } from '../../api/services';
import { formatError } from '../../api/client';
import toast from 'react-hot-toast';
import { HiOutlineCloudArrowUp, HiOutlineDocument, HiOutlineXMark, HiOutlineEye } from 'react-icons/hi2';

interface ReceiptUploadFieldProps {
  projectId?: string;      // optional — omit for standalone/non-project documents
  module: string;
  category?: string;
  value: { id: string; originalName: string } | null;
  onChange: (upload: { id: string; originalName: string } | null) => void;
  label?: string;
  requireProject?: boolean; // default true — Expenses/Truck Entries etc. still require a project first
}

const ReceiptUploadField: React.FC<ReceiptUploadFieldProps> = ({
  projectId, module, category, value, onChange, label = 'Receipt / Document', requireProject = true,
}) => {
  const [progress, setProgress] = useState<number | null>(null);
  const [opening, setOpening] = useState(false);
  const qc = useQueryClient();
  const blockedByMissingProject = requireProject && !projectId;

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      if (projectId) formData.append('projectId', projectId);
      formData.append('module', module);
      if (category) formData.append('category', category);
      formData.append('file', file);
      return uploadsApi.upload(formData, setProgress);
    },
    onSuccess: (res: any) => {
      const upload = res.data?.data || res.data;
      onChange({ id: upload.id, originalName: upload.originalName });
      qc.invalidateQueries({ queryKey: ['uploads'] });
      toast.success('File uploaded!');
      setProgress(null);
    },
    onError: (e: any) => {
      toast.error(formatError(e) || 'Upload failed');
      setProgress(null);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (blockedByMissingProject) {
      toast.error('Select a project first');
      return;
    }
    uploadMutation.mutate(file);
    e.target.value = '';
  };

  const handleView = async () => {
    if (!value) return;
    setOpening(true);
    try {
      await viewSecureFile(getFileViewUrl(value.id));
    } catch (e: any) {
      toast.error(formatError(e) || 'Failed to open file');
    } finally {
      setOpening(false);
    }
  };

  return (
    <div>
      <label className="label text-xs">{label}</label>

      {value ? (
        <div className="flex items-center gap-2 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5">
          <HiOutlineDocument className="w-5 h-5 text-primary-600 flex-shrink-0" />
          <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">{value.originalName}</span>
          <button type="button" onClick={handleView} disabled={opening} className="icon-button text-blue-600 flex-shrink-0" title="View">
            <HiOutlineEye className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => onChange(null)} className="icon-button text-red-500 flex-shrink-0" title="Remove">
            <HiOutlineXMark className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <label className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-3 cursor-pointer text-sm transition-colors ${
          uploadMutation.isPending ? 'border-primary-300 bg-primary-50 dark:bg-primary-900/10' : 'border-gray-200 dark:border-gray-700 hover:border-primary-300'
        }`}>
          <input type="file" className="hidden" onChange={handleFileSelect} disabled={uploadMutation.isPending || blockedByMissingProject} />
          <HiOutlineCloudArrowUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
          <span className="text-gray-500">
            {uploadMutation.isPending ? `Uploading... ${progress ?? 0}%` : blockedByMissingProject ? 'Select a project first' : 'Click to upload (any file type)'}
          </span>
        </label>
      )}
    </div>
  );
};

export default ReceiptUploadField;
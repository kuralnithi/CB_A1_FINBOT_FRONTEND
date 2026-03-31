'use client';

import { useState } from 'react';
import { VALID_COLLECTIONS } from '@/lib/constants';

interface FileUploaderProps {
  onUpload: (file: File, collection: string) => void;
  isUploading: boolean;
}

/**
 * Component for uploading and indexing documents.
 */
export function FileUploader({ onUpload, isUploading }: FileUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [collection, setCollection] = useState('general');

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (file) {
      onUpload(file, collection);
      setFile(null);
    }
  };

  return (
    <div className="glass rounded-xl p-6 mb-8 border border-white/5">
      <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
        📁 Upload Document
      </h3>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
            dragActive
              ? 'border-blue-500 bg-blue-500/10'
              : file
              ? 'border-green-500/50 bg-green-500/5'
              : 'border-dark-600 bg-dark-800/50'
          }`}
        >
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          {file ? (
            <p className="text-sm text-white font-medium">{file.name}</p>
          ) : (
            <p className="text-sm text-dark-200">Drag & drop or click to browse</p>
          )}
        </div>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-dark-300 mb-1.5 uppercase">
              Target Collection
            </label>
            <select
              value={collection}
              onChange={(e) => setCollection(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-dark-800 border border-dark-700 text-white text-sm focus:outline-none"
            >
              {VALID_COLLECTIONS.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={!file || isUploading}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all disabled:opacity-50"
          >
            {isUploading ? 'Uploading...' : 'Upload & Index'}
          </button>
        </div>
      </form>
    </div>
  );
}

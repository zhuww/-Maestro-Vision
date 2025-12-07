import React, { useCallback } from 'react';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFilesSelected, disabled }) => {
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    const files = (Array.from(e.dataTransfer.files) as File[]).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) onFilesSelected(files);
  }, [onFilesSelected, disabled]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled || !e.target.files) return;
    const files = (Array.from(e.target.files) as File[]).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) onFilesSelected(files);
  };

  return (
    <div 
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className={`border-2 border-dashed border-gray-700 rounded-xl p-8 text-center transition-colors
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary-500 hover:bg-gray-850 cursor-pointer'}
      `}
    >
      <input 
        type="file" 
        multiple 
        accept="image/*" 
        onChange={handleChange} 
        className="hidden" 
        id="file-upload"
        disabled={disabled}
      />
      <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <span className="text-gray-300 font-medium">Click to upload sheet music or drag & drop</span>
        <span className="text-gray-500 text-sm">Supports JPG, PNG</span>
      </label>
    </div>
  );
};

export default FileUpload;
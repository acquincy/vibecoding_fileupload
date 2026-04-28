/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useRef, useState } from 'react';
import { UploadCloud, FileText, X, Send, AlertCircle, CheckCircle2, Loader2, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const WEBHOOK_URL = import.meta.env.VITE_WEBHOOK_URL || 'http://localhost:5678/webhook-test/upload';
const ALLOWED_TYPES = ['.pdf', '.txt', '.doc', '.docx', '.csv', '.xls', '.xlsx'];

export default function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState(WEBHOOK_URL);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const showStatus = (message: string, type: 'success' | 'error') => {
    setStatus({ message, type });
    setTimeout(() => setStatus(null), 5000);
  };

  const processFiles = useCallback((newFiles: FileList | null) => {
    if (!newFiles) return;

    const fileArray = Array.from(newFiles);
    const validFiles: File[] = [];

    fileArray.forEach(file => {
      const extension = '.' + file.name.split('.').pop()?.toLowerCase();
      if (ALLOWED_TYPES.includes(extension)) {
        validFiles.push(file);
      } else {
        showStatus(`File type ${extension} not supported`, 'error');
      }
    });

    setFiles(prev => {
      const newValidFiles = validFiles.filter(
        validFile => !prev.some(existingFile => existingFile.name === validFile.name)
      );
      return [...prev, ...newValidFiles];
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
    // Reset input so the same file can be selected again if removed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [processFiles]);

  const removeFile = (indexToRemove: number) => {
    setFiles(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const clearFiles = () => setFiles([]);

  const handleUpload = async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    setStatus(null);

    const formData = new FormData();
    
    // Send total count
    formData.append('totalFiles', files.length.toString());
    
    // Append each file and its properties as distinct form fields 
    // so n8n can easily pick them up in the body schema
    files.forEach((file, index) => {
      // n8n extracts the primary binary field by default using the key 'data'
      const binaryKey = index === 0 ? 'data' : `data${index}`;
      formData.append(binaryKey, file, file.name);
      formData.append(`fileName_${index}`, file.name);
      formData.append(`fileSize_${index}`, file.size.toString());
      formData.append(`fileType_${index}`, file.type);
    });

    try {
      const response = await fetch(webhookUrl || WEBHOOK_URL, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        showStatus(`Successfully uploaded ${files.length} files!`, 'success');
        setFiles([]);
      } else {
        throw new Error('Server responded with an error');
      }
    } catch (error) {
      console.error('Upload error:', error);
      showStatus('Upload failed. Ensure your local webhook is running at ' + (webhookUrl || WEBHOOK_URL), 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl shadow-slate-200/60 p-8">
        
        {status && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
              status.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
            }`}
          >
            {status.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            <span className="text-sm font-medium">{status.message}</span>
          </motion.div>
        )}

        <div className="text-center mb-8 relative">
          <h1 className="text-2xl font-bold text-slate-800">Upload Documents</h1>
          <p className="text-slate-500 mt-2 text-sm">Upload PDF, TXT, DOC, CSV, or XLS files</p>
          
          <button 
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="absolute right-0 top-0 p-2 text-slate-400 hover:text-slate-600 transition-colors bg-slate-50 rounded-full hover:bg-slate-100"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        <AnimatePresence>
          {isSettingsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-6"
            >
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-left">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Webhook URL
                </label>
                <input
                  type="text"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://your-ngrok-url/webhook-test/upload"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                />
                <p className="mt-2 text-xs text-slate-500">
                  Since this app is hosted securely on HTTPS, you cannot directly connect to an HTTP localhost URL due to browser "Mixed Content" security restrictions. Use a tool like <a href="https://ngrok.com/" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">ngrok</a> to get an HTTPS URL for your local n8n instance.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center transition-all cursor-pointer group ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-indigo-400'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.txt,.doc,.docx,.csv,.xls,.xlsx"
            onChange={handleFileInput}
          />
          
          <div className={`p-4 rounded-full transition-transform mb-4 ${isDragging ? 'bg-indigo-200 text-indigo-700 scale-110' : 'bg-indigo-100 text-indigo-600 group-hover:scale-110'}`}>
            <UploadCloud className="w-8 h-8" />
          </div>
          
          <p className="text-slate-700 font-medium text-lg">Click to upload or drag and drop</p>
          <p className="text-slate-400 text-xs mt-1">Maximum file size 10MB</p>
        </div>

        <AnimatePresence>
          {files.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-8 overflow-hidden"
            >
              <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">Selected Files ({files.length})</h3>
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                <AnimatePresence>
                  {files.map((file, index) => (
                    <motion.div
                      key={`${file.name}-${index}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg shadow-sm"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="bg-slate-50 p-2 rounded border border-slate-100 shrink-0">
                          <FileText className="w-5 h-5 text-indigo-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
                          <p className="text-xs text-slate-400">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFile(index)}
                        disabled={isUploading}
                        className="text-slate-400 hover:text-red-500 transition-colors shrink-0 ml-2 disabled:opacity-50"
                        title="Remove file"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  onClick={clearFiles}
                  disabled={isUploading}
                  className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 rounded-lg font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Clear All
                </button>
                <button
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="flex-[2] px-4 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Upload to Server
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

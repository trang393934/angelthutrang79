import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, CheckCircle, XCircle, Loader2, Image as ImageIcon, Video, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

export default function TestR2Upload() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/functions/uploadToR2', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${await base44.auth.getToken()}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setResult(data);
      setFile(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const getFileIcon = (type) => {
    if (type?.startsWith('image/')) return <ImageIcon className="w-8 h-8" />;
    if (type?.startsWith('video/')) return <Video className="w-8 h-8" />;
    return <FileText className="w-8 h-8" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50 to-pink-50 p-6">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/90 backdrop-blur-xl border-2 border-purple-300 rounded-3xl p-8 shadow-2xl"
        >
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-purple-900 mb-2">Test R2 Upload</h1>
            <p className="text-purple-600">Upload file lên Cloudflare R2</p>
          </div>

          {/* Upload Area */}
          <div className="mb-6">
            <label
              htmlFor="file-upload"
              className="flex flex-col items-center justify-center w-full h-64 border-4 border-dashed border-purple-300 rounded-2xl cursor-pointer bg-purple-50 hover:bg-purple-100 transition-all"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-12 h-12 text-purple-400 mb-4" />
                <p className="mb-2 text-sm text-purple-700 font-semibold">
                  <span className="font-bold">Click để chọn file</span> hoặc kéo thả
                </p>
                <p className="text-xs text-purple-500">Hỗ trợ: Ảnh, Video, Document</p>
              </div>
              <input
                id="file-upload"
                type="file"
                className="hidden"
                onChange={handleFileChange}
                accept="image/*,video/*,application/pdf,.doc,.docx"
              />
            </label>
          </div>

          {/* Selected File */}
          {file && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gradient-to-r from-purple-100 to-pink-100 border-2 border-purple-300 rounded-2xl p-4 mb-6"
            >
              <div className="flex items-center gap-4">
                <div className="text-purple-600">
                  {getFileIcon(file.type)}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-slate-900">{file.name}</p>
                  <p className="text-sm text-purple-600">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl shadow-lg hover:shadow-xl"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          )}

          {/* Success Result */}
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-green-100 to-emerald-100 border-2 border-green-300 rounded-2xl p-6 mb-6"
            >
              <div className="flex items-start gap-4">
                <CheckCircle className="w-8 h-8 text-green-600 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-bold text-green-900 mb-2">Upload thành công! 🎉</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-semibold text-green-800">File:</span>{' '}
                      <span className="text-slate-900">{result.fileName}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-green-800">URL:</span>{' '}
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline break-all"
                      >
                        {result.url}
                      </a>
                    </div>
                  </div>
                  {result.type?.startsWith('image/') && (
                    <div className="mt-4">
                      <img
                        src={result.url}
                        alt="Uploaded"
                        className="max-w-full h-auto rounded-xl border-2 border-green-300"
                      />
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-red-100 to-rose-100 border-2 border-red-300 rounded-2xl p-6"
            >
              <div className="flex items-start gap-4">
                <XCircle className="w-8 h-8 text-red-600 flex-shrink-0" />
                <div>
                  <h3 className="font-bold text-red-900 mb-2">Upload thất bại</h3>
                  <p className="text-red-800">{error}</p>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
'use client';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { UploadCloud, CheckCircle, Loader2, LogOut, FileText, Trash2, AlertTriangle, Clock, Info } from 'lucide-react';
import api from '@/services/api';
import toast from 'react-hot-toast';

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function OnboardingPage() {
  const { user, logout, updateUser } = useAuth();
  const router = useRouter();
  const [documents, setDocuments] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Redirect active users
  if (user && user.verificationStatus === 'ACTIVE') {
    router.push('/dashboard');
    return null;
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      // Append new files to existing ones (or replace? Standard behavior is replace for an input[type=file] without some merge logic, but user says "select or drops files" - let's stick to replacing which is native to onChange, but since they might select multiple we just do Array.from)
      // Actually appending makes more sense if they want to build a list, but let's stick to Array.from(e.target.files) to replace, or append if better. We'll append to be safe with multiple selections, or just replace.
      // Wait, native behavior of <input type="file" multiple> onChange is that it gives ALL selected files in that selection event. Replacing is typical. We'll replace for simplicity, unless we do spread.
      // I'll do append to make it more useful.
      setDocuments(Array.from(e.target.files));
    }
  };

  const removeDocument = (index: number) => {
    setDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (documents.length === 0) {
      toast.error('Please select at least one document to upload.');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      documents.forEach((doc) => {
        formData.append('documents', doc);
      });

      const res = await api.post('/employees/upload-documents', formData);

      const newUrls = res.data?.urls || [];
      
      if (updateUser) {
        // When re-uploading (editing), REPLACE the old docs with new ones.
        // When uploading for the first time, just set the new docs.
        const existingDocs = isEditing ? [] : (Array.isArray(user?.documents) ? user.documents : []);
        updateUser({ 
          documents: [...existingDocs, ...newUrls], 
          verificationStatus: 'PENDING_VERIFICATION' 
        });
      }

      toast.success('Documents uploaded successfully!');
      setUploadSuccess(true);
      setIsEditing(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to upload documents');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-white/10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-brand-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-brand-primary" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Account Verification</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">
            Hi {user?.name}, please upload your NID or required documents to complete your onboarding process.
          </p>
        </div>

        {(user?.verificationStatus === 'PENDING_VERIFICATION' || uploadSuccess) && !isEditing ? (
          <ApplicationStatusView user={user} logout={logout} onEdit={() => setIsEditing(true)} onUpdateUser={updateUser} />
        ) : (
          <div className="space-y-6">
            {isEditing && (
              <button 
                onClick={() => setIsEditing(false)} 
                className="mb-4 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white flex items-center gap-1 font-medium transition-colors"
              >
                &larr; Back to Status View
              </button>
            )}
            {user?.verificationStatus === 'REJECTED' && (
              <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/50 text-red-600 dark:text-red-400 p-4 rounded-xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p className="text-sm font-medium">Your previous documents were rejected. Please re-upload valid documents.</p>
              </div>
            )}
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-6 text-center hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors relative">
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                accept=".pdf,.jpg,.jpeg,.png"
              />
              <UploadCloud className="w-10 h-10 text-slate-400 dark:text-slate-500 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Click to browse or drag and drop
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                PDF, JPG, PNG up to 10MB
              </p>
            </div>

            {documents.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-500 uppercase">Selected Files</h4>
                <ul className="space-y-2">
                  {documents.map((doc, idx) => (
                    <li key={idx} className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg border border-slate-100 dark:border-slate-600/50">
                      <FileText className="w-5 h-5 text-brand-primary" />
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium">{doc.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{formatSize(doc.size)}</p>
                      </div>
                      <button
                        onClick={() => removeDocument(idx)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-colors"
                        title="Remove file"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={isUploading || documents.length === 0}
              className="w-full flex items-center justify-center gap-2 bg-brand-primary text-white py-3 rounded-xl font-bold hover:bg-brand-primary/90 transition-all disabled:opacity-70 shadow-lg shadow-brand-primary/30"
            >
              {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Submit Documents'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ApplicationStatusView({ user, logout, onEdit, onUpdateUser }: { user: any, logout: () => void, onEdit: () => void, onUpdateUser?: (data: any) => void }) {
  const [deletingIdx, setDeletingIdx] = useState<number | null>(null);

  // Compute docs directly from user context to avoid stale state.
  // Deduplicate by clean filename (keep latest upload if duplicates exist).
  const rawUrls = Array.isArray(user?.documents) 
    ? user.documents.map((d: any) => typeof d === 'string' ? d : (d.url || '')).filter(Boolean)
    : [];
    
  const docs: string[] = [];
  const seenNames = new Set<string>();
  
  for (let i = rawUrls.length - 1; i >= 0; i--) {
    const rawUrl = rawUrls[i];
    const filenamePart = rawUrl.split('/').pop() || '';
    const cleanName = filenamePart.replace(/^\d+-/, '');
    
    if (!seenNames.has(cleanName)) {
      seenNames.add(cleanName);
      docs.unshift(rawUrl);
    }
  }

  // Build backend base URL: works in any environment without extra env config
  const BACKEND = process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL.replace('/api', '')
    : (typeof window !== 'undefined' ? window.location.origin : '');

  const handleDelete = async (rawUrl: string, idx: number) => {
    setDeletingIdx(idx);
    try {
      const res = await import('@/services/api').then(m => m.default.delete('/employees/upload-documents', { data: { docUrl: rawUrl } }));
      const updatedDocs = res.data?.documents ?? docs.filter((_, i) => i !== idx);
      if (onUpdateUser) onUpdateUser({ documents: updatedDocs });
      const { default: toast } = await import('react-hot-toast');
      toast.success('Document removed.');
    } catch {
      const { default: toast } = await import('react-hot-toast');
      toast.error('Failed to remove document.');
    } finally {
      setDeletingIdx(null);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-100 dark:border-white/10 flex flex-col items-center text-center">
      
      {/* Info Icon */}
      <div className="w-16 h-16 bg-orange-50 dark:bg-orange-500/10 text-orange-500 rounded-full flex items-center justify-center mb-6">
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>

      <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-3">Application Under Review</h2>
      
      <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-500 text-sm font-semibold rounded-full mb-6">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Pending Admin Approval
      </div>

      <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 leading-relaxed">
        Your documents have been submitted and are currently under review by the Admin. You will receive an email once your account is activated.
      </p>

      {/* Dynamic Document Viewer Section */}
      <div className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl p-4 mb-6 text-left">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Submitted Documents</h3>
        {docs.length > 0 ? (
          <ul className="space-y-2">
            {docs.map((rawUrl: string, idx: number) => {
              const filenamePart = rawUrl.split('/').pop() || '';
              const docName = filenamePart.replace(/^\d+-/, '') || `Document_${idx + 1}`;
              const docUrl = rawUrl.startsWith('http') ? rawUrl : `${BACKEND}${rawUrl}`;
              const isDeleting = deletingIdx === idx;
              return (
                <li key={idx} className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-2.5 rounded-lg shadow-sm">
                  <span className="text-sm text-slate-600 dark:text-slate-400 truncate flex-1 font-medium text-left">
                    {docName}
                  </span>
                  <a 
                    href={docUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-blue-600 dark:text-blue-400 text-sm font-semibold hover:text-blue-700 dark:hover:text-blue-300 hover:underline shrink-0"
                  >
                    View
                  </a>
                  <button
                    onClick={() => handleDelete(rawUrl, idx)}
                    disabled={isDeleting}
                    className="ml-2 flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-500/10 dark:hover:bg-red-500/20 rounded-md transition-colors disabled:opacity-50 shrink-0"
                    title="Remove this document"
                  >
                    {isDeleting ? (
                      <div className="w-3.5 h-3.5 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 p-2 rounded font-medium">No documents found. Please re-upload.</p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="w-full flex flex-col gap-3">
        <button 
          onClick={onEdit}
          className="w-full py-2.5 px-4 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-blue-700 dark:text-blue-400 text-sm font-semibold rounded-xl transition-colors"
        >
          Edit / Re-upload Documents
        </button>
        
        <button 
          onClick={() => logout()} 
          className="w-full py-2.5 px-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl transition-colors flex justify-center items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign Out
        </button>
      </div>

    </div>
  );
}

// Icon fallback for Shield since I might not have imported it correctly
function Shield(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    </svg>
  );
}


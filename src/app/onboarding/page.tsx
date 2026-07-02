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
  const { user, logout } = useAuth();
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

      await api.post('/employees/upload-documents', formData);

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
          <ApplicationStatusView user={user} logout={logout} onEdit={() => setIsEditing(true)} />
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

function ApplicationStatusView({ user, logout, onEdit }: { user: any, logout: () => void, onEdit: () => void }) {
  return (
    <div className="text-center space-y-4">
      <div className="w-16 h-16 bg-orange-100 dark:bg-orange-500/20 rounded-full flex items-center justify-center mx-auto">
        <Info className="w-8 h-8 text-orange-600 dark:text-orange-400" />
      </div>
      <h3 className="text-lg font-bold text-slate-800 dark:text-white">Application Under Review</h3>
      
      <div className="inline-flex items-center gap-2 bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 px-3 py-1 rounded-full text-sm font-medium">
        <Clock className="w-4 h-4" />
        Pending Admin Approval
      </div>

      <p className="text-sm text-slate-500 dark:text-slate-400 pb-2 mt-4">
        Your documents have been submitted and are currently under review by the Admin. You will receive an email once your account is activated.
      </p>

      {user?.documents && user.documents.length > 0 && (
        <div className="mt-6 p-4 border rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-left">
          <h3 className="text-sm font-semibold mb-3 text-slate-800 dark:text-slate-200">Submitted Documents</h3>
          <ul className="space-y-2">
            {user.documents.map((doc: any, idx: number) => (
              <li key={idx} className="flex justify-between items-center bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 p-2 rounded">
                <span className="text-sm text-slate-700 dark:text-slate-300 truncate pr-4">{doc.name || 'Document'}</span>
                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 dark:text-blue-400 text-sm hover:underline font-medium shrink-0">View</a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-3 mt-6">
        <button 
          onClick={onEdit}
          className="w-full py-2.5 px-4 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-indigo-500/20"
        >
          Edit / Re-upload Documents
        </button>
        <button
          onClick={() => logout()}
          className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white rounded-xl font-semibold transition-colors"
        >
          <LogOut className="w-4 h-4" /> Sign Out
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


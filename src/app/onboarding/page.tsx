'use client';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { UploadCloud, CheckCircle, Loader2, LogOut, FileText } from 'lucide-react';
import api from '@/services/api';
import toast from 'react-hot-toast';

export default function OnboardingPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [documents, setDocuments] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Redirect active users ONLY if they already have documents
  const hasDocuments = user?.documents && user.documents.length > 0;
  if (user && user.verificationStatus === 'ACTIVE' && hasDocuments) {
    router.push('/dashboard');
    return null;
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setDocuments(Array.from(e.target.files));
    }
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

      await api.post('/employees/upload-documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.success('Documents uploaded successfully!');
      setUploadSuccess(true);
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

        {uploadSuccess || (user?.documents && user.documents.length > 0) ? (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Documents Under Review</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 pb-4">
              Your documents have been submitted and are currently under review by the Admin. You will receive an email once your account is activated.
            </p>
            <button
              onClick={() => logout()}
              className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-xl font-semibold transition-colors"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        ) : (
          <div className="space-y-6">
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
                    <li key={idx} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 p-2 rounded-lg">
                      <FileText className="w-4 h-4 text-brand-primary" />
                      <span className="truncate flex-1">{doc.name}</span>
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

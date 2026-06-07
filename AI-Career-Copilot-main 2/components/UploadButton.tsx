'use client';

type UploadButtonProps = {
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
};

export default function UploadButton({ disabled = false, loading = false, onClick }: UploadButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="rounded-md bg-blue-600 px-5 py-2.5 text-white hover:bg-blue-700 disabled:opacity-50"
    >
      {loading ? 'Uploading...' : 'Upload Resume'}
    </button>
  );
}

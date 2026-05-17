export default function UploadEmptyState({
  onUpload,
  uploading,
}: {
  onUpload: () => void;
  uploading: boolean;
}) {
  return (
    <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
      {/* ambient cyan glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 size-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#00dae8] opacity-[0.12] blur-[180px]" />

      <div className="relative flex flex-col items-center">
        <h1 className="text-[28px] tracking-[-0.21px] text-[rgba(252,253,255,0.94)]">
          Upload your first song
        </h1>
        <p className="mt-2 max-w-[400px] text-[15px] leading-[24px] text-[rgba(241,247,254,0.71)]">
          Separate vocals and instruments, view chords, practice along, and
          organize your music in one place.
        </p>

        <div className="mt-7 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={onUpload}
            disabled={uploading}
            className="flex h-10 items-center gap-2 rounded-[8px] bg-[#edeef0] px-5 text-[14px] font-medium text-[#111113] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {uploading ? (
              <span className="size-4 animate-spin rounded-full border-2 border-[#111113]/30 border-t-[#111113]" />
            ) : (
              <svg
                className="h-[18px] w-[18px]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            )}
            {uploading ? "Uploading…" : "Upload song"}
          </button>
        </div>
      </div>
    </div>
  );
}

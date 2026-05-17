export default function Alert({
  error,
  success,
}: {
  error?: string;
  success?: string;
}) {
  if (!error && !success) return null;

  const isError = Boolean(error);

  return (
    <div
      role="alert"
      className={`rounded-[12px] border px-4 py-3 text-[14px] leading-[20px] ${
        isError
          ? "border-[rgba(255,90,90,0.3)] bg-[rgba(255,90,90,0.08)] text-[#ff8a8a]"
          : "border-[rgba(10,255,167,0.3)] bg-[rgba(10,255,167,0.08)] text-[#0affa7]"
      }`}
    >
      {error ?? success}
    </div>
  );
}

"use client";

import { useFormStatus } from "react-dom";

export default function SubmitButton({
  children,
}: {
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-10 w-full items-center justify-center rounded-[10px] bg-[#00dae8] text-[14px] font-medium text-[#001316] transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? (
        <span className="size-4 animate-spin rounded-full border-2 border-[#001316]/30 border-t-[#001316]" />
      ) : (
        children
      )}
    </button>
  );
}

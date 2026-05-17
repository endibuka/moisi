type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
};

export default function Field({ label, name, ...props }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={name}
        className="text-[13px] font-medium text-[#edeef0]"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        className="h-10 rounded-[10px] border border-[rgba(252,252,253,0.1)] bg-[rgba(252,252,253,0.05)] px-3.5 text-[14px] text-white placeholder:text-[rgba(252,252,253,0.3)] outline-none transition-colors focus:border-[#00dae8]"
        {...props}
      />
    </div>
  );
}

"use client";

type Props = {
  value: boolean;
  onChange: (next: boolean) => void;
  label: string;
};

export default function Switch({ value, onChange, label }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
      onClick={() => onChange(!value)}
      className="grid min-h-11 w-[52px] items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne-500"
    >
      <span
        className={`relative block h-8 w-[52px] rounded-full transition-colors duration-200 motion-reduce:transition-none ${
          value ? "bg-ink-900" : "bg-sand-300"
        }`}
      >
        <span
          className={`absolute top-1 size-6 rounded-full bg-sand-50 shadow-card transition-[left] duration-200 ease-sheet motion-reduce:transition-none ${
            value ? "left-[24px]" : "left-1"
          }`}
        />
      </span>
    </button>
  );
}

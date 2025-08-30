import React from "react";

type Props<T extends string> = {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
};

export default function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <div className="inline-flex rounded-md border border-gray-300 bg-white p-1 dark:border-gray-700 dark:bg-gray-800">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            type="button"
            key={opt.value}
            className={`min-w-20 rounded px-3 py-1.5 text-sm transition-colors ${
              active
                ? "bg-blue-600 text-white shadow"
                : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
            }`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}


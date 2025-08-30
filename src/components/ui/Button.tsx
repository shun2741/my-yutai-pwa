import React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost";
  size?: "md" | "sm";
};

export default function Button({ className = "", variant = "primary", size = "md", ...rest }: Props) {
  const base = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";
  const sizes = size === "sm" ? "h-9 px-3 text-sm" : "h-10 px-4";
  const variants = {
    primary: "bg-brand text-white hover:bg-blue-600 focus:ring-blue-500",
    outline: "border border-gray-300 text-gray-900 hover:bg-gray-50 focus:ring-gray-400 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800",
    ghost: "text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800",
  }[variant];
  return <button className={`${base} ${sizes} ${variants} ${className}`} {...rest} />;
}


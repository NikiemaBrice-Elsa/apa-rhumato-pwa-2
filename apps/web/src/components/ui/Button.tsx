import type { ButtonHTMLAttributes } from "react";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" }) {
  const base = "rounded-xl px-5 py-3 font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed w-full";
  const styles =
    variant === "primary"
      ? "bg-primary-700 text-white"
      : "border border-primary-300 text-primary-700 bg-white";
  return <button className={`${base} ${styles} ${className}`} {...props} />;
}

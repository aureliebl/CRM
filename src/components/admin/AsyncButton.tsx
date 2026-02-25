"use client";

import { MaterialSymbol } from "@/components/admin/MaterialSymbol";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type AsyncButtonVariant = "primary" | "secondary";

interface AsyncButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  children: ReactNode;
  isLoading?: boolean;
  isSuccess?: boolean;
  loadingLabel?: ReactNode;
  successLabel?: ReactNode;
  variant?: AsyncButtonVariant;
  minWidth?: string | number;
}

export function AsyncButton({
  children,
  isLoading = false,
  isSuccess = false,
  loadingLabel,
  successLabel,
  variant = "secondary",
  className,
  minWidth,
  disabled,
  style,
  ...buttonProps
}: AsyncButtonProps) {
  const isBusy = isLoading || isSuccess;
  const stateClass = isLoading
    ? "admin-btn-is-loading"
    : isSuccess
    ? "admin-btn-is-success"
    : "";

  const label = isLoading
    ? loadingLabel ?? children
    : isSuccess
    ? successLabel ?? children
    : children;

  return (
    <button
      {...buttonProps}
      disabled={disabled || isBusy}
      className={[
        "admin-btn",
        variant === "primary" ? "admin-btn-primary" : "admin-btn-secondary",
        stateClass,
        className || "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ minWidth, ...style }}
    >
      {isLoading && (
        <MaterialSymbol
          name="progress_activity"
          size={16}
          weight={500}
          opticalSize={20}
          className="admin-btn-spinner"
        />
      )}
      {isSuccess && (
        <MaterialSymbol
          name="check_circle"
          size={16}
          weight={500}
          opticalSize={20}
        />
      )}
      <span>{label}</span>
    </button>
  );
}

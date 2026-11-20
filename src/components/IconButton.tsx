import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./IconButton.module.css";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  icon: ReactNode;
  size?: "regular" | "compact";
  variant?: "primary" | "secondary";
}

export function IconButton({
  children,
  className,
  icon,
  size = "regular",
  type = "button",
  variant = "primary",
  ...props
}: IconButtonProps) {
  const classes = [
    styles.button,
    size === "compact" ? styles.compact : undefined,
    styles[variant],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    // eslint-disable-next-line react/button-has-type -- Native ButtonHTMLAttributes restricts type to button/submit/reset; the default above is button. Preserve callers’ native form semantics.
    <button type={type} className={classes} {...props}>
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
      <span>{children}</span>
    </button>
  );
}

"use client";

import type React from "react";
import { useId } from "react";
import { cx } from "@/ui/cx";
import styles from "./controls.module.css";

/**
 * The small set of controls the explorer needs. Kept deliberately thin: a
 * design system is worth building when a second surface needs it, and inventing
 * one now would be abstraction ahead of demand.
 *
 * Every control here is a native element. A `<select>` is keyboard-navigable,
 * screen-reader-announced and touch-friendly on every platform for free — a
 * hand-rolled listbox has to earn all three back, and usually does not.
 */

export interface SelectOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

export function Select({
  label,
  value,
  options,
  placeholder,
  onChange,
  disabled = false,
  hint,
}: {
  readonly label: string;
  readonly value: string | null;
  readonly options: readonly SelectOption[];
  readonly placeholder: string;
  readonly onChange: (value: string | null) => void;
  readonly disabled?: boolean;
  readonly hint?: string;
}): React.JSX.Element {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className={styles.select}
        value={value ?? ""}
        disabled={disabled}
        aria-describedby={hint === undefined ? undefined : hintId}
        onChange={(event) => {
          onChange(event.target.value === "" ? null : event.target.value);
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled ?? false}>
            {option.label}
          </option>
        ))}
      </select>
      {hint !== undefined && (
        <span className={styles.hint} id={hintId}>
          {hint}
        </span>
      )}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = "default",
  type = "button",
  disabled = false,
  title,
  ariaLabel,
  ariaExpanded,
  ariaControls,
}: {
  readonly children: React.ReactNode;
  readonly onClick?: () => void;
  readonly variant?: "default" | "quiet" | "accent";
  readonly type?: "button" | "submit";
  readonly disabled?: boolean;
  readonly title?: string;
  readonly ariaLabel?: string;
  readonly ariaExpanded?: boolean;
  readonly ariaControls?: string;
}): React.JSX.Element {
  const className = cx(
    styles.button,
    variant === "quiet" && styles.buttonQuiet,
    variant === "accent" && styles.buttonAccent,
  );
  return (
    <button
      type={type === "submit" ? "submit" : "button"}
      className={className}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
    >
      {children}
    </button>
  );
}

export function IconButton({
  glyph,
  label,
  onClick,
  disabled = false,
}: {
  readonly glyph: string;
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
}): React.JSX.Element {
  return (
    <button
      type="button"
      className={cx(styles.button, styles.iconButton)}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
    >
      <span aria-hidden="true">{glyph}</span>
    </button>
  );
}

export function ButtonStack({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return <div className={styles.stack}>{children}</div>;
}

export function Badge({
  glyph,
  label,
  background,
  foreground,
}: {
  readonly glyph: string;
  readonly label: string;
  readonly background: string;
  readonly foreground: string;
}): React.JSX.Element {
  return (
    <span className={styles.badge} style={{ background, color: foreground }}>
      {/* The glyph is decoration for sighted readers; the label already says it. */}
      <span aria-hidden="true">{glyph}</span>
      {label}
    </span>
  );
}

export function CheckRow({
  checked,
  onChange,
  children,
}: {
  readonly checked: boolean;
  readonly onChange: () => void;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <label className={styles.checkRow}>
      <input
        type="checkbox"
        checked={checked}
        onChange={() => {
          onChange();
        }}
      />
      <span>{children}</span>
    </label>
  );
}

export function Skeleton({
  height,
  width = "100%",
}: {
  readonly height: number;
  readonly width?: string;
}): React.JSX.Element {
  return <div className={styles.skeleton} style={{ height, width }} aria-hidden="true" />;
}

export const controlStyles = styles;

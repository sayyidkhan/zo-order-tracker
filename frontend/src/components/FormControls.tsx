import * as React from "react";
import { useRef } from "react";
import { AlertCircle } from "lucide-react";

export function PinInput({
  idPrefix,
  labelledBy,
  value,
  onChange,
  disabled,
  autoComplete = "one-time-code"
}: {
  idPrefix: string;
  labelledBy: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoComplete?: string;
}) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: 6 }, (_, index) => value[index] ?? "");

  function focusDigit(index: number) {
    inputsRef.current[index]?.focus();
  }

  function applyPin(nextValue: string) {
    onChange(nextValue.replace(/\D/g, "").slice(0, 6));
  }

  function setDigit(index: number, nextDigit: string) {
    const chars = Array.from({ length: 6 }, (_, digitIndex) => value[digitIndex] ?? "");
    chars[index] = nextDigit;
    applyPin(chars.join(""));
  }

  function handleInput(index: number, rawValue: string) {
    const digitsOnly = rawValue.replace(/\D/g, "");
    if (digitsOnly.length > 1) {
      applyPin(digitsOnly);
      focusDigit(Math.min(digitsOnly.length, 5));
      return;
    }

    setDigit(index, digitsOnly.slice(-1));
    if (digitsOnly && index < 5) {
      focusDigit(index + 1);
    }
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      if (digits[index]) {
        setDigit(index, "");
        return;
      }

      if (index > 0) {
        event.preventDefault();
        setDigit(index - 1, "");
        focusDigit(index - 1);
      }
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      focusDigit(index - 1);
      return;
    }

    if (event.key === "ArrowRight" && index < 5) {
      event.preventDefault();
      focusDigit(index + 1);
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    applyPin(pasted);
    focusDigit(Math.min(pasted.length, 5));
  }

  return (
    <div className="pin-input" role="group" aria-labelledby={labelledBy}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            inputsRef.current[index] = element;
          }}
          id={`${idPrefix}-${index}`}
          className={`pin-digit${digit ? " is-filled" : ""}`}
          type="password"
          inputMode="numeric"
          autoComplete={index === 0 ? autoComplete : "off"}
          maxLength={1}
          value={digit}
          disabled={disabled}
          aria-label={`PIN digit ${index + 1} of 6`}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onChange={(event) => handleInput(index, event.target.value)}
          onPaste={handlePaste}
          onFocus={(event) => event.currentTarget.select()}
        />
      ))}
    </div>
  );
}

export function RequiredFieldLabel({
  htmlFor,
  labelId,
  children
}: {
  htmlFor: string;
  labelId?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field-label" id={labelId ?? `${htmlFor}-label`} htmlFor={htmlFor}>
      {children}
      <span className="required-mark" aria-hidden="true">
        *
      </span>
      <span className="visually-hidden">required</span>
    </label>
  );
}

export function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="error-notice" role="alert">
      <AlertCircle size={18} />
      <span>{message}</span>
    </div>
  );
}

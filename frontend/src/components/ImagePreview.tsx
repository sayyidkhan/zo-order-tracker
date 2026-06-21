import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Package2, X } from "lucide-react";
import { useStateValue } from "../lib/domain";

export function PaymentProofImageModal({
  src,
  onClose,
  ariaLabel = "Full payment proof image",
  alt = "Full payment proof",
  variant = "proof"
}: {
  src: string;
  onClose: () => void;
  ariaLabel?: string;
  alt?: string;
  variant?: "proof" | "qr";
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div className="payment-proof-modal" role="dialog" aria-modal="true" aria-label={ariaLabel}>
      <button className="payment-proof-modal-backdrop" type="button" aria-label="Close preview" onClick={onClose} />
      <div className={`payment-proof-modal-content${variant === "qr" ? " is-qr-preview" : ""}`}>
        <button className="icon-button payment-proof-modal-close" type="button" aria-label="Close preview" onClick={onClose}>
          <X size={18} />
        </button>
        <img src={src} alt={alt} />
      </div>
    </div>,
    document.body
  );
}

export function ProductImageDisplay({
  imageUrl,
  name,
  className = "product-image"
}: {
  imageUrl?: string | null;
  name: string;
  className?: string;
}) {
  const safeImageUrl = (imageUrl ?? "").trim();
  const [isOpen, setIsOpen] = useStateValue(false);

  if (safeImageUrl) {
    return (
      <>
        <button
          className={`${className} product-image-button`}
          type="button"
          aria-label={`Open larger image for ${name}`}
          title="Open larger image"
          onClick={() => setIsOpen(true)}
        >
          <img src={safeImageUrl} alt={name} />
          <span className="product-image-zoom" aria-hidden="true">
            <Maximize2 size={13} />
          </span>
        </button>
        {isOpen ? (
          <PaymentProofImageModal
            src={safeImageUrl}
            onClose={() => setIsOpen(false)}
            ariaLabel={`Larger image for ${name}`}
            alt={name}
          />
        ) : null}
      </>
    );
  }

  return (
    <div className={className}>
      <span aria-hidden="true">
        <Package2 size={20} />
      </span>
    </div>
  );
}

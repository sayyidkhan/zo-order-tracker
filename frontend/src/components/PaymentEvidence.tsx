import { ExternalLink, FileText, Maximize2 } from "lucide-react";
import type { FulfillmentStatus, PaymentStatus } from "../types";
import { isPaymentProofImage, isPaymentProofPdf, useStateValue } from "../lib/domain";
import { PaymentProofImageModal } from "./ImagePreview";

export function StatusPill({ status }: { status: PaymentStatus }) {
  return <span className={`status-pill status-${status}`}>{status.replace("_", " ")}</span>;
}

export function FulfillmentPill({ status }: { status: FulfillmentStatus }) {
  const label = status === "active" ? "In progress" : "Completed";
  return <span className={`fulfillment-pill fulfillment-${status}`}>{label}</span>;
}

export function PaymentEvidenceDisplay({ evidence }: { evidence: string }) {
  const [isImageOpen, setIsImageOpen] = useStateValue(false);

  if (!evidence.trim()) {
    return <>—</>;
  }

  if (isPaymentProofImage(evidence)) {
    return (
      <>
      <button className="payment-proof-display payment-proof-display-button" type="button" onClick={() => setIsImageOpen(true)}>
        <img src={evidence} alt="Payment proof" className="payment-proof-thumbnail" />
        <span>Payment proof uploaded</span>
        <Maximize2 size={16} />
      </button>
      {isImageOpen ? <PaymentProofImageModal src={evidence} onClose={() => setIsImageOpen(false)} /> : null}
      </>
    );
  }

  if (isPaymentProofPdf(evidence)) {
    return (
      <a className="payment-proof-display payment-proof-display-link" href={evidence} target="_blank" rel="noreferrer">
        <FileText size={20} />
        <span>Payment proof PDF uploaded</span>
        <ExternalLink size={16} />
      </a>
    );
  }

  return <span>{evidence}</span>;
}

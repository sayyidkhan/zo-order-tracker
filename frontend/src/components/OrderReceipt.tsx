import { Download } from "lucide-react";
import type { ProcessedOrder } from "../types";
import { downloadOrderReceiptPdf } from "../lib/domain";

export function OrderPdfButton({ order, compact = false }: { order: ProcessedOrder; compact?: boolean }) {
  return (
    <button
      className={`secondary-button order-pdf-button${compact ? " is-compact" : ""}`}
      type="button"
      onClick={() => downloadOrderReceiptPdf(order)}
    >
      <Download size={compact ? 13 : 15} />
      {compact ? "PDF" : "Download PDF"}
    </button>
  );
}

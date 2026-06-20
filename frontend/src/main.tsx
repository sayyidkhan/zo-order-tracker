import * as React from "react";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider, useMutation } from "@tanstack/react-query";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Database,
  Loader2,
  MessageSquareText,
  Play,
  Sparkles,
  WalletCards
} from "lucide-react";
import "./styles.css";

type PaymentStatus = "paid" | "partial" | "unpaid" | "unknown";

type ProcessedOrder = {
  customer_name: string | null;
  customer_handle: string | null;
  source_channel: string;
  source_input: string;
  order_summary: string;
  payment_status: PaymentStatus;
  total_amount: number | null;
  currency: string;
  items: Array<{
    item_name: string;
    quantity: number;
    unit_price: number | null;
    notes: string | null;
  }>;
  evidence: string;
};

type ProcessResult = {
  workflow_id: string;
  workflow_version: number;
  matched_state: string;
  matched_rule: string | null;
  action_taken: string;
  status: "created" | "updated" | "needs_review" | "follow_up";
  message: string;
  explanation: string;
  trace: string[];
  order?: ProcessedOrder;
  payment_status?: PaymentStatus;
};

type WorkflowGeneration = {
  status: string;
  workflow: {
    id: string;
    name: string;
    version: number;
    states: Record<string, unknown>;
  };
  test_inputs: string[];
  rule_explanations: Array<{ rule_id: string; explanation: string }>;
};

const queryClient = new QueryClient();
const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

const sampleMessages = [
  "Hi I want 2 brownies for $12, paid by PayNow",
  "Can I get 3 cookie boxes tomorrow? pay later",
  "Customer sent receipt, paid already",
  "Is the shop open today?"
];

const initialOrders: ProcessedOrder[] = [
  {
    customer_name: "Maya Tan",
    customer_handle: "@maya_bakes",
    source_channel: "manual",
    source_input: "Maya wants 4 tart boxes, paid by PayNow",
    order_summary: "4 tart boxes",
    payment_status: "paid",
    total_amount: 32,
    currency: "SGD",
    items: [{ item_name: "tart boxes", quantity: 4, unit_price: 8, notes: null }],
    evidence: "paid by PayNow"
  },
  {
    customer_name: null,
    customer_handle: "@nurul",
    source_channel: "manual",
    source_input: "Can I reserve 2 brownies and pay later?",
    order_summary: "2 brownies",
    payment_status: "unpaid",
    total_amount: 12,
    currency: "SGD",
    items: [{ item_name: "brownies", quantity: 2, unit_price: 6, notes: null }],
    evidence: "pay later"
  }
];

function App() {
  return (
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <Workspace />
      </QueryClientProvider>
    </StrictMode>
  );
}

function Workspace() {
  const [rawInput, setRawInput] = useStateValue(sampleMessages[0]);
  const [businessDescription, setBusinessDescription] = useStateValue(
    "Home bakery selling brownies, cookies, and tart boxes in Singapore. Customers usually pay by PayNow or ask to pay later."
  );
  const [orders, setOrders] = useArrayState<ProcessedOrder>(initialOrders);
  const [lastResult, setLastResult] = useStateValue<ProcessResult | null>(null);
  const [generatedWorkflow, setGeneratedWorkflow] = useStateValue<WorkflowGeneration | null>(null);

  const processMutation = useMutation({
    mutationFn: async (sourceInput: string) => {
      const response = await fetch(`${apiBase}/orders/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_input: sourceInput, source_channel: "manual" })
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      return (await response.json()) as ProcessResult;
    },
    onSuccess: (result) => {
      setLastResult(result);
      if (result.order) {
        setOrders((current) => [result.order as ProcessedOrder, ...current]);
      }
    }
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${apiBase}/workflows/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_description: businessDescription,
          common_order_messages: sampleMessages.slice(0, 3),
          paid_phrases: ["paid", "paynow", "sent receipt", "transferred"],
          pay_later_phrases: ["pay later", "cash", "cod"],
          required_fields: ["order_summary", "payment_status"],
          workflow_id: "seller-generated-flow",
          workflow_name: "Seller Generated Flow",
          save: false
        })
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      return (await response.json()) as WorkflowGeneration;
    },
    onSuccess: setGeneratedWorkflow
  });

  const metrics = buildMetrics(orders);

  return (
    <main className="app-shell">
      <aside className="side-rail" aria-label="Workspace navigation">
        <div className="brand-mark" aria-hidden="true">
          zo
        </div>
        <button className="rail-button is-active" type="button" aria-label="Orders">
          <ClipboardList size={20} />
        </button>
        <button className="rail-button" type="button" aria-label="Workflow builder">
          <Bot size={20} />
        </button>
        <button className="rail-button" type="button" aria-label="Data home">
          <Database size={20} />
        </button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="section-label">zorder workspace</p>
            <h1>Order tracking for today</h1>
          </div>
          <div className="connection-pill">
            <span aria-hidden="true" />
            Express API: {apiBase.replace("http://", "")}
          </div>
        </header>

        <section className="metric-grid" aria-label="Order summary">
          <MetricCard icon={<WalletCards />} label="Paid" value={metrics.paid} tone="paid" />
          <MetricCard icon={<CircleDollarSign />} label="Unpaid" value={metrics.unpaid} tone="unpaid" />
          <MetricCard icon={<AlertCircle />} label="Review" value={metrics.review} tone="review" />
        </section>

        <div className="main-grid">
          <section className="panel process-panel" aria-labelledby="process-heading">
            <div className="panel-heading">
              <div>
                <p className="section-label">process message</p>
                <h2 id="process-heading">Messy order input</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                title="Use sample message"
                onClick={() => setRawInput(sampleMessages[(sampleMessages.indexOf(rawInput) + 1) % sampleMessages.length])}
              >
                <MessageSquareText size={18} />
              </button>
            </div>

            <label className="field-label" htmlFor="raw-order">
              Customer note
            </label>
            <textarea
              id="raw-order"
              value={rawInput}
              onChange={(event) => setRawInput(event.target.value)}
              placeholder="Paste a customer message, order note, or payment update"
            />

            <button
              className="primary-button"
              type="button"
              disabled={processMutation.isPending || !rawInput.trim()}
              onClick={() => processMutation.mutate(rawInput)}
            >
              {processMutation.isPending ? <Loader2 className="spin" size={18} /> : <Play size={18} />}
              Process order
            </button>

            {processMutation.error ? <ErrorNotice message={processMutation.error.message} /> : null}

            <ResultPreview result={lastResult} />
          </section>

          <section className="panel workflow-panel" aria-labelledby="workflow-heading">
            <div className="panel-heading">
              <div>
                <p className="section-label">setup assistant</p>
                <h2 id="workflow-heading">Generate decision tree</h2>
              </div>
              <Sparkles size={20} className="accent-icon" />
            </div>

            <label className="field-label" htmlFor="business-description">
              Business description
            </label>
            <textarea
              id="business-description"
              className="compact-textarea"
              value={businessDescription}
              onChange={(event) => setBusinessDescription(event.target.value)}
            />

            <button
              className="secondary-button"
              type="button"
              disabled={generateMutation.isPending || !businessDescription.trim()}
              onClick={() => generateMutation.mutate()}
            >
              {generateMutation.isPending ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
              Generate workflow JSON
            </button>

            {generateMutation.error ? (
              <ErrorNotice message={`${generateMutation.error.message} Add GPT-API-KEY in backend/.env to enable this.`} />
            ) : null}

            <div className="workflow-output">
              <div>
                <span className="muted-label">Active flow</span>
                <strong>{generatedWorkflow?.workflow.name ?? "Default Order Flow"}</strong>
              </div>
              <div>
                <span className="muted-label">States</span>
                <strong>{generatedWorkflow ? Object.keys(generatedWorkflow.workflow.states).length : 6}</strong>
              </div>
              <div>
                <span className="muted-label">Runtime</span>
                <strong>Deterministic</strong>
              </div>
            </div>
          </section>
        </div>

        <section className="orders-section" aria-labelledby="orders-heading">
          <div className="panel-heading">
            <div>
              <p className="section-label">dashboard</p>
              <h2 id="orders-heading">Tracked orders</h2>
            </div>
            <span className="count-pill">{orders.length} orders</span>
          </div>
          <OrderTable orders={orders} />
        </section>
      </section>
    </main>
  );
}

function MetricCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <div className="metric-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function ResultPreview({ result }: { result: ProcessResult | null }) {
  if (!result) {
    return (
      <div className="empty-preview">
        <Bot size={20} />
        <p>Processed orders will show their extracted fields and match reason here.</p>
      </div>
    );
  }

  return (
    <div className="result-preview">
      <div className="result-status">
        <CheckCircle2 size={18} />
        <strong>{result.message}</strong>
      </div>
      {result.order ? (
        <dl className="result-fields">
          <div>
            <dt>Order</dt>
            <dd>{result.order.order_summary}</dd>
          </div>
          <div>
            <dt>Payment</dt>
            <dd>
              <StatusPill status={result.order.payment_status} />
            </dd>
          </div>
          <div>
            <dt>Amount</dt>
            <dd>{formatAmount(result.order.total_amount, result.order.currency)}</dd>
          </div>
        </dl>
      ) : null}
      <p className="explanation">{result.explanation}</p>
    </div>
  );
}

function OrderTable({ orders }: { orders: ProcessedOrder[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th>Payment</th>
            <th>Amount</th>
            <th>Evidence</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order, index) => (
            <tr key={`${order.source_input}-${index}`}>
              <td>
                <strong>{order.order_summary}</strong>
                <span>{order.items[0]?.quantity ?? 1} item batch</span>
              </td>
              <td>{order.customer_name ?? order.customer_handle ?? "Manual entry"}</td>
              <td>
                <StatusPill status={order.payment_status} />
              </td>
              <td>{formatAmount(order.total_amount, order.currency)}</td>
              <td className="evidence-cell">{order.evidence}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({ status }: { status: PaymentStatus }) {
  return <span className={`status-pill status-${status}`}>{status.replace("_", " ")}</span>;
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="error-notice" role="alert">
      <AlertCircle size={18} />
      <span>{message}</span>
    </div>
  );
}

function buildMetrics(orders: ProcessedOrder[]) {
  return {
    paid: orders.filter((order) => order.payment_status === "paid").length,
    unpaid: orders.filter((order) => order.payment_status === "unpaid" || order.payment_status === "partial").length,
    review: orders.filter((order) => order.payment_status === "unknown").length
  };
}

async function readApiError(response: Response) {
  try {
    const payload = await response.json();
    return payload.error ?? "API request failed";
  } catch {
    return "API request failed";
  }
}

function formatAmount(value: number | null, currency: string) {
  if (value === null) {
    return "Not set";
  }

  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency
  }).format(value);
}

function useStateValue<T>(initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  return useState(initialValue);
}

function useArrayState<T>(initialValue: T[]): [T[], React.Dispatch<React.SetStateAction<T[]>>] {
  return useState(initialValue);
}

createRoot(document.getElementById("root")!).render(<App />);

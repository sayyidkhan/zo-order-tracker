import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { type UseMutationResult, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Cloud,
  Code2,
  Cpu,
  Database,
  Download,
  ExternalLink,
  FileText,
  FileJson,
  GitBranch,
  Globe2,
  KeyRound,
  Layers3,
  Loader2,
  LogOut,
  Maximize2,
  MessageSquareText,
  Package2,
  Pause,
  Pencil,
  Minus,
  Play,
  Plus,
  QrCode,
  Route,
  Save,
  Server,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Trash2,
  Upload,
  User,
  UserPlus,
  WalletCards,
  Workflow,
  X
} from "lucide-react";
import type {
  AdminTab,
  AuthCredential,
  CapturePeriodDays,
  InventorySubTab,
  InventoryProduct,
  InventoryProductDraft,
  ProcessResult,
  ProcessedOrder,
  ShopBranding,
  WorkflowCondition,
  WorkflowGenerateInput,
  WorkflowGeneration,
  WorkflowRule,
  WorkflowActionState,
  WorkflowDecisionState,
  WorkflowState,
  WorkflowBuilderTab,
  WorkflowSetupAnswers,
  WorkflowChatMessage
} from "../../types";
import { generatePayNowQrDataUrl } from "../../paynow-qr";
import { workflowBuildProgressSteps, sampleMessages, workflowSetupSteps, workflowChatStorageKey, apiBase } from "../../constants";
import { BrandMark } from "../../components/BrandMark";
import { ErrorNotice } from "../../components/FormControls";
import { ProductImageDisplay } from "../../components/ImagePreview";
import { FulfillmentPill, PaymentEvidenceDisplay, StatusPill } from "../../components/PaymentEvidence";
import { OrderPdfButton } from "../../components/OrderReceipt";
import {
  adminTabPath,
  authHeaders,
  buildAcceptedPaymentMethods,
  buildBrandingSavePayload,
  buildCapturePeriodSummary,
  buildInventorySummary,
  buildMetrics,
  buildSalesByDate,
  buildSalesByYear,
  buildWorkflowAssistantReply,
  buildWorkflowSetupContext,
  buildWorkflowSetupQuestion,
  completeOrder,
  createEmptyWorkflowSetupAnswers,
  createInitialWorkflowChatMessages,
  createInventoryDraft,
  createWorkflowChatId,
  deleteInventoryProduct,
  extractPayNowNumberFromQrText,
  fetchInventory,
  fileToDataUrl,
  formatAmount,
  formatCaptureDate,
  formatCaptureTime,
  formatChatTime,
  formatCompactAmount,
  formatCompactNumber,
  formatOrderId,
  formatPaynowNumber,
  formatWorkflowGenerateError,
  getCapturePeriodLabel,
  getCaptureYearKey,
  getInitialAdminTab,
  imageFileToDataUrl,
  inventoryProductFromDraft,
  isActiveOrder,
  isBrandingDraftReadyToSave,
  isCapturedThisYear,
  isCapturedToday,
  isPaidOrder,
  isStoredWorkflowGeneration,
  isWithinCapturePeriod,
  loadGeneratedWorkflowDraft,
  loadWorkflowChatHistory,
  normalizeInventoryProducts,
  parseInventoryUpload,
  productImageFileToDataUrl,
  publishWorkflow,
  readApiError,
  readQrTextFromImage,
  saveGeneratedWorkflowDraft,
  sumOrderQuantity,
  toValidDate,
  updateInventoryProduct,
  uploadInventory,
  useStateValue,
  capturePeriodOptions
} from "../../lib/domain";

export function AdminView({
  adminCredential,
  orders,
  metrics,
  shopBranding,
  onShopBrandingSaved
}: {
  adminCredential: AuthCredential;
  orders: ProcessedOrder[];
  metrics: ReturnType<typeof buildMetrics>;
  shopBranding: ShopBranding;
  onShopBrandingSaved: () => void;
}) {
  const [activeTab, setActiveTab] = useStateValue<AdminTab>(getInitialAdminTab());
  const tabs: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
    { id: "orders", label: "Orders", icon: <ClipboardList size={16} /> },
    { id: "rules", label: "Order Rules", icon: <Workflow size={16} /> },
    { id: "inventory", label: "Inventory", icon: <Package2 size={16} /> },
    { id: "branding", label: "Branding", icon: <Store size={16} /> }
  ];

  useEffect(() => {
    const handlePopState = () => setActiveTab(getInitialAdminTab());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [setActiveTab]);

  function selectTab(tab: AdminTab) {
    setActiveTab(tab);
    window.history.pushState({}, "", adminTabPath(tab));
  }

  return (
    <div className="admin-workspace">
      <div className="admin-tabs" role="tablist" aria-label="Admin workspace sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`admin-tab${activeTab === tab.id ? " is-active" : ""}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`admin-panel-${tab.id}`}
            id={`admin-tab-${tab.id}`}
            onClick={() => selectTab(tab.id)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div
        className="admin-tab-panel"
        id={`admin-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`admin-tab-${activeTab}`}
      >
        {activeTab === "orders" ? (
          <AdminOrdersPanel adminCredential={adminCredential} orders={orders} metrics={metrics} />
        ) : null}

        {activeTab === "rules" ? (
          <OrderRulesPanel shopBranding={shopBranding} />
        ) : null}

        {activeTab === "inventory" ? (
          <InventoryPanel adminCredential={adminCredential} orders={orders} metrics={metrics} />
        ) : null}

        {activeTab === "branding" ? (
          <ShopBrandingPanel
            adminCredential={adminCredential}
            shopBranding={shopBranding}
            onSaved={onShopBrandingSaved}
          />
        ) : null}
      </div>
    </div>
  );
}

function AdminOrdersPanel({
  adminCredential,
  orders,
  metrics
}: {
  adminCredential: AuthCredential;
  orders: ProcessedOrder[];
  metrics: ReturnType<typeof buildMetrics>;
}) {
  const queryClient = useQueryClient();
  const completeOrderMutation = useMutation({
    mutationFn: (orderId: string) => completeOrder(adminCredential, orderId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
    }
  });

  const trackedOrders = [...orders].sort(
    (first, second) =>
      (toValidDate(second.created_at)?.getTime() ?? 0) - (toValidDate(first.created_at)?.getTime() ?? 0)
  );

  return (
    <>
      <section className="metric-grid metric-grid--row" aria-label="Order tracking summary">
        <MetricCard icon={<AlertCircle size={18} />} label="Needs review" value={metrics.review} tone="review" />
        <MetricCard icon={<CircleDollarSign size={18} />} label="Outstanding" value={metrics.outstanding} tone="unpaid" />
        <MetricCard icon={<WalletCards size={18} />} label="Paid" value={metrics.paid} tone="paid" />
      </section>

      <section className="orders-section" aria-labelledby="admin-orders-heading">
        <div className="panel-heading">
          <div>
            <p className="section-label">order tracking</p>
            <h2 id="admin-orders-heading">All orders</h2>
          </div>
          <span className="count-pill">{orders.length} orders</span>
        </div>
        <p className="panel-copy orders-tracking-note">
          Payment status drives the counts above: paid means captured, outstanding means unpaid or partial, and needs
          review means unclear evidence. Post-order sales analytics live under Inventory.
        </p>
        <OrderTable
          orders={trackedOrders}
          showStatus
          emptyMessage="No orders tracked yet."
          completingOrderId={
            completeOrderMutation.isPending ? (completeOrderMutation.variables ?? null) : null
          }
          onCompleteOrder={(orderId) => completeOrderMutation.mutate(orderId)}
        />
      </section>
    </>
  );
}

function CapturePeriodToolbar({
  capturePeriod,
  onChange,
  headingId = "capture-period-heading"
}: {
  capturePeriod: CapturePeriodDays;
  onChange: (period: CapturePeriodDays) => void;
  headingId?: string;
}) {
  const periodLabel = getCapturePeriodLabel(capturePeriod);

  return (
    <section className="capture-analytics-panel" aria-labelledby={headingId}>
      <div className="panel-heading">
        <div>
          <p className="section-label">capture analytics</p>
          <h2 id={headingId}>Paid sales by period</h2>
        </div>
      </div>
      <div className="capture-period-filters" role="group" aria-label="Analytics period">
        {capturePeriodOptions.map((option) => (
          <button
            key={option.days}
            type="button"
            className={`capture-period-button${capturePeriod === option.days ? " is-active" : ""}`}
            aria-pressed={capturePeriod === option.days}
            title={option.label}
            onClick={() => onChange(option.days)}
          >
            {option.shortLabel}
          </button>
        ))}
      </div>
      <p className="panel-copy capture-period-note">Showing paid captures for the past {periodLabel}.</p>
    </section>
  );
}

function CapturePeriodMetrics({ summary }: { summary: ReturnType<typeof buildCapturePeriodSummary> }) {
  return (
    <section className="metric-grid metric-grid--row" aria-label="Capture summary">
      <MetricCard
        icon={<WalletCards size={18} />}
        label="Sales captures"
        value={formatCompactNumber(summary.count)}
        title={`${summary.count} captures`}
        tone="paid"
      />
      <MetricCard
        icon={<CircleDollarSign size={18} />}
        label="Paid sales"
        value={formatCompactAmount(summary.sales, "SGD")}
        title={formatAmount(summary.sales, "SGD")}
        tone="today"
      />
      <MetricCard
        icon={<Package2 size={18} />}
        label="Units sold"
        value={formatCompactNumber(summary.units)}
        title={`${summary.units} units`}
        tone="review"
      />
    </section>
  );
}

function OrderRulesPanel({ shopBranding }: { shopBranding: ShopBranding }) {
  const paymentMethods = buildAcceptedPaymentMethods(shopBranding);
  const orderFlowSteps = buildStaticOrderFlowSteps(paymentMethods);
  const [activeFlowStepIndex, setActiveFlowStepIndex] = useStateValue(0);
  const [isFlowPlaying, setIsFlowPlaying] = useStateValue(true);
  const activeFlowStep = orderFlowSteps[activeFlowStepIndex] ?? orderFlowSteps[0];

  useEffect(() => {
    if (!isFlowPlaying) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setActiveFlowStepIndex((current) => (current + 1) % orderFlowSteps.length);
    }, 3600);

    return () => window.clearInterval(timer);
  }, [isFlowPlaying, orderFlowSteps.length, setActiveFlowStepIndex]);

  function selectFlowStep(index: number) {
    setActiveFlowStepIndex(index);
    setIsFlowPlaying(false);
  }

  function moveFlowStep(direction: -1 | 1) {
    setActiveFlowStepIndex((current) => (current + direction + orderFlowSteps.length) % orderFlowSteps.length);
  }

  return (
    <section className="panel workflow-panel static-order-flow-panel" aria-labelledby="workflow-heading">
      <div className="panel-heading">
        <div>
          <p className="section-label">order rules</p>
          <h2 id="workflow-heading">Order flow</h2>
        </div>
        <Workflow size={20} className="accent-icon" />
      </div>

      <p className="panel-copy">
        Rules are now used to show the ordering path, not to build a custom workflow. Inventory, branding, payment
        settings, and checkout are the source of truth.
      </p>

      <div className="static-order-flow-simulator">
        <ol className="static-order-flow-list" aria-label="Current customer order flow">
          {orderFlowSteps.map((step, index) => {
            const isActive = index === activeFlowStepIndex;
            const isDone = index < activeFlowStepIndex;

            return (
              <li key={step.title}>
                <button
                  className={[
                    "static-order-flow-step",
                    isActive ? "is-active" : "",
                    isDone ? "is-done" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  type="button"
                  aria-current={isActive ? "step" : undefined}
                  onClick={() => selectFlowStep(index)}
                >
                  <span className="static-order-flow-index">{index + 1}</span>
                  <div>
                    <span className="static-order-flow-state">
                      {isActive ? "Now showing" : isDone ? "Replicated" : "Next"}
                    </span>
                    <strong>{step.title}</strong>
                    <p>{step.detail}</p>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="static-order-flow-stage">
          <div className="static-order-flow-stage-header">
            <div>
              <span className="muted-label">Customer side</span>
              <strong>{activeFlowStep.previewTitle}</strong>
            </div>
            <span>
              Step {activeFlowStepIndex + 1} / {orderFlowSteps.length}
            </span>
          </div>

          <StaticOrderFlowCustomerScreen
            paymentMethods={paymentMethods}
            shopBranding={shopBranding}
            step={activeFlowStep}
          />

          <div className="static-order-flow-controls" aria-label="Order flow playback controls">
            <button
              className="secondary-button"
              type="button"
              title="Previous step"
              onClick={() => {
                setIsFlowPlaying(false);
                moveFlowStep(-1);
              }}
            >
              <ArrowLeft size={16} />
              Previous
            </button>
            <button
              className="secondary-button"
              type="button"
              title={isFlowPlaying ? "Pause path" : "Play path"}
              onClick={() => setIsFlowPlaying((current) => !current)}
            >
              {isFlowPlaying ? <Pause size={16} /> : <Play size={16} />}
              {isFlowPlaying ? "Pause" : "Play"}
            </button>
            <button
              className="primary-button"
              type="button"
              title="Next step"
              onClick={() => {
                setIsFlowPlaying(false);
                moveFlowStep(1);
              }}
            >
              Next
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

type StaticOrderFlowStepId = "channel" | "items" | "total" | "confirmation" | "payment" | "operations";
type StaticOrderFlowStep = {
  id: StaticOrderFlowStepId;
  title: string;
  detail: string;
  previewTitle: string;
  previewStatus: string;
};

function buildStaticOrderFlowSteps(paymentMethods: string[]): StaticOrderFlowStep[] {
  const paymentMethodLabel = paymentMethods.join(" or ");

  return [
    {
      id: "channel",
      title: "Customer chooses an order channel",
      detail: "They can use the direct menu or the guided order chatbot. Both paths use the same published inventory.",
      previewTitle: "Order channel selection",
      previewStatus: "Menu and chatbot available"
    },
    {
      id: "items",
      title: "Products and quantities are selected",
      detail: "The menu and chatbot read from Inventory, so the shop does not need to describe products again.",
      previewTitle: "Published inventory is used",
      previewStatus: "Customer is building cart"
    },
    {
      id: "total",
      title: "Subtotal and total are shown",
      detail: "The customer reviews item quantities, subtotal, and total before moving to payment.",
      previewTitle: "Checkout total review",
      previewStatus: "Total is visible before payment"
    },
    {
      id: "confirmation",
      title: "Customer acknowledges the total",
      detail: "The chatbot requires an explicit confirmation before showing payment instructions.",
      previewTitle: "Explicit total confirmation",
      previewStatus: "Waiting for customer confirmation"
    },
    {
      id: "payment",
      title: "Payment proof is uploaded",
      detail: `The customer pays by ${paymentMethodLabel} and uploads a receipt before the order can be placed.`,
      previewTitle: "Payment and proof upload",
      previewStatus: "Receipt is required"
    },
    {
      id: "operations",
      title: "Order lands in operations",
      detail: "The completed order appears in My orders for the customer and Orders for the admin.",
      previewTitle: "Order is created for ops",
      previewStatus: "Customer and admin can track it"
    }
  ];
}

function StaticOrderFlowCustomerScreen({
  paymentMethods,
  shopBranding,
  step
}: {
  paymentMethods: string[];
  shopBranding: ShopBranding;
  step: StaticOrderFlowStep;
}) {
  const shopName = shopBranding.business_name || "Customer storefront";
  const paymentInstruction = shopBranding.payment_instructions || "Pay using the saved shop payment settings, then upload proof.";
  const paymentMethodLabel = paymentMethods.join(" or ");
  const payNowLabel = shopBranding.paynow_number || "PayNow number from Branding";
  const bankLabel =
    [shopBranding.bank_name, shopBranding.bank_account_name, shopBranding.bank_account_number].filter(Boolean).join(" / ") ||
    "Bank transfer details from Branding";

  let screenContent: React.ReactNode;

  if (step.id === "channel") {
    screenContent = (
      <div className="static-customer-choice-grid">
        <div className="static-customer-choice is-recommended">
          <Bot size={20} />
          <div>
            <strong>Guided order chatbot</strong>
            <span>Prompts the customer through the same published menu.</span>
          </div>
          <b>Recommended</b>
        </div>
        <div className="static-customer-choice">
          <ShoppingBag size={20} />
          <div>
            <strong>Direct menu</strong>
            <span>Lets the customer browse inventory and add items manually.</span>
          </div>
        </div>
      </div>
    );
  } else if (step.id === "items") {
    screenContent = (
      <div className="static-customer-menu-preview">
        <div className="static-customer-product is-selected">
          <div>
            <span>Inventory item</span>
            <strong>Egg tarts</strong>
          </div>
          <div className="static-customer-stepper">
            <Minus size={14} />
            <b>2</b>
            <Plus size={14} />
          </div>
        </div>
        <div className="static-customer-product is-selected">
          <div>
            <span>Inventory item</span>
            <strong>Bandung</strong>
          </div>
          <div className="static-customer-stepper">
            <Minus size={14} />
            <b>1</b>
            <Plus size={14} />
          </div>
        </div>
      </div>
    );
  } else if (step.id === "total") {
    screenContent = (
      <div className="static-customer-summary">
        <span>Order summary</span>
        <div>
          <strong>Egg tarts x 2</strong>
          <b>{formatAmount(7.2, "SGD")}</b>
        </div>
        <div>
          <strong>Bandung x 1</strong>
          <b>{formatAmount(2.8, "SGD")}</b>
        </div>
        <div className="is-total">
          <strong>Total</strong>
          <b>{formatAmount(10, "SGD")}</b>
        </div>
      </div>
    );
  } else if (step.id === "confirmation") {
    screenContent = (
      <div className="static-customer-chat-preview">
        <div className="order-chat-message is-assistant">
          <div className="order-chat-avatar">
            <Bot size={16} />
          </div>
          <div className="order-chat-bubble">
            <strong>Confirm your order total</strong>
            <p>Your total is {formatAmount(10, "SGD")}. Payment instructions appear after confirmation.</p>
          </div>
        </div>
        <div className="order-chat-message is-user">
          <div className="order-chat-bubble">
            <strong>Customer</strong>
            <p>Confirm {formatAmount(10, "SGD")}</p>
          </div>
        </div>
      </div>
    );
  } else if (step.id === "payment") {
    screenContent = (
      <div className="static-customer-payment-preview">
        <div className="static-customer-payment-card">
          <span>Payment method</span>
          <strong>{paymentMethodLabel}</strong>
          <p>{paymentInstruction}</p>
        </div>
        <div className="static-customer-payment-grid">
          <div>
            <span>PayNow</span>
            <strong>{payNowLabel}</strong>
          </div>
          <div>
            <span>Bank transfer</span>
            <strong>{bankLabel}</strong>
          </div>
        </div>
        <div className="static-customer-upload">
          <Upload size={18} />
          <span>Upload payment screenshot or receipt</span>
        </div>
      </div>
    );
  } else {
    screenContent = (
      <div className="static-customer-ops-preview">
        <div className="workflow-fulfilled-badge">
          <CheckCircle2 size={20} />
          <span>Order placed</span>
        </div>
        <div className="static-customer-summary">
          <span>Visible in both workspaces</span>
          <div>
            <strong>My orders</strong>
            <b>Customer tracking</b>
          </div>
          <div>
            <strong>Admin orders</strong>
            <b>Operations queue</b>
          </div>
        </div>
      </div>
    );
  }

  return (
    <article className="static-customer-screen" aria-live="polite">
      <div className="static-customer-screen-bar">
        <span>{shopName}</span>
        <strong>{step.previewStatus}</strong>
      </div>
      <div className="static-customer-screen-body">{screenContent}</div>
    </article>
  );
}

function LegacyOrderRulesPanel({
  adminCredential,
  businessDescription,
  setBusinessDescription,
  generateMutation,
  generatedWorkflow,
  shopBranding,
  onWorkflowDraftCleared
}: {
  adminCredential: AuthCredential;
  businessDescription: string;
  setBusinessDescription: React.Dispatch<React.SetStateAction<string>>;
  generateMutation: UseMutationResult<WorkflowGeneration, Error, WorkflowGenerateInput>;
  generatedWorkflow: WorkflowGeneration | null;
  shopBranding: ShopBranding;
  onWorkflowDraftCleared: () => void;
}) {
  const [builderPrompt, setBuilderPrompt] = useStateValue("");
  const [setupAnswers, setSetupAnswers] = useStateValue<WorkflowSetupAnswers>(createEmptyWorkflowSetupAnswers());
  const [setupStepIndex, setSetupStepIndex] = useStateValue(generatedWorkflow ? workflowSetupSteps.length : 0);
  const [activeBuilderTab, setActiveBuilderTab] = useStateValue<WorkflowBuilderTab>("rules");
  const [publishNotice, setPublishNotice] = useStateValue<string | null>(null);
  const [chatMessages, setChatMessages] = useState<WorkflowChatMessage[]>(loadWorkflowChatHistory);
  const [buildElapsedSeconds, setBuildElapsedSeconds] = useState(0);
  const [isRefiningBuild, setIsRefiningBuild] = useState(false);
  const chatLogRef = useRef<HTMLDivElement>(null);
  const currentSetupStep = workflowSetupSteps[Math.min(setupStepIndex, workflowSetupSteps.length - 1)];
  const isSetupComplete = setupStepIndex >= workflowSetupSteps.length;
  const isFinalSetupStep = setupStepIndex === workflowSetupSteps.length - 1;

  const publishMutation = useMutation({
    mutationFn: (workflow: WorkflowGeneration["workflow"]) => publishWorkflow(adminCredential, workflow),
    onSuccess: () => setPublishNotice("Workflow published for customer order processing.")
  });

  useEffect(() => {
    localStorage.setItem(workflowChatStorageKey, JSON.stringify(chatMessages));
  }, [chatMessages]);

  useEffect(() => {
    chatLogRef.current?.scrollTo({
      top: chatLogRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [chatMessages, generateMutation.isPending]);

  useEffect(() => {
    if (!generateMutation.isPending) {
      setBuildElapsedSeconds(0);
      return undefined;
    }

    const startedAt = Date.now();
    setBuildElapsedSeconds(0);
    const timer = window.setInterval(() => {
      setBuildElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);

    return () => window.clearInterval(timer);
  }, [generateMutation.isPending]);

  async function submitBuilderPrompt() {
    const prompt = builderPrompt.trim();
    const step = currentSetupStep;

    if (!prompt || generateMutation.isPending || isSetupComplete) {
      return;
    }

    const nextAnswers = { ...setupAnswers, [step.id]: prompt };
    const nextStepIndex = setupStepIndex + 1;
    setBuilderPrompt("");
    setChatMessages((current) => [
      ...current,
      {
        id: createWorkflowChatId("user"),
        role: "user",
        content: `${step.title}\n${prompt}`,
        createdAt: new Date().toISOString()
      }
    ]);
    setSetupAnswers(nextAnswers);

    if (nextStepIndex < workflowSetupSteps.length) {
      setSetupStepIndex(nextStepIndex);
      setChatMessages((current) => [
        ...current,
        {
          id: createWorkflowChatId("assistant-step"),
          role: "assistant",
          content: buildWorkflowSetupQuestion(nextStepIndex),
          createdAt: new Date().toISOString()
        }
      ]);
      return;
    }

    const currentWorkflow = generatedWorkflow?.workflow ?? null;
    const isRefiningWorkflow = Boolean(currentWorkflow);
    const nextBusinessDescription = buildWorkflowSetupContext(nextAnswers);
    setSetupStepIndex(workflowSetupSteps.length);
    setBusinessDescription(nextBusinessDescription);
    setIsRefiningBuild(isRefiningWorkflow);

    try {
      const result = await generateMutation.mutateAsync({
        businessDescription: nextBusinessDescription,
        changeRequest: "Build the deterministic paid-order workflow from these collected setup answers.",
        existingWorkflow: currentWorkflow
      });

      setChatMessages((current) => [
        ...current,
        {
          id: createWorkflowChatId("assistant"),
          role: "assistant",
          content: buildWorkflowAssistantReply(result, Boolean(currentWorkflow)),
          createdAt: new Date().toISOString(),
          status: "ok"
        }
      ]);
    } catch (error) {
      const messageText = error instanceof Error ? formatWorkflowGenerateError(error) : "Workflow generation failed.";
      setSetupStepIndex(workflowSetupSteps.length - 1);
      setChatMessages((current) => [
        ...current,
        {
          id: createWorkflowChatId("assistant-error"),
          role: "assistant",
          content: messageText,
          createdAt: new Date().toISOString(),
          status: "error"
        }
      ]);
    }
  }

  function resetWorkflowSetup() {
    setBuilderPrompt("");
    setSetupAnswers(createEmptyWorkflowSetupAnswers());
    setSetupStepIndex(0);
    setPublishNotice(null);
    setChatMessages(createInitialWorkflowChatMessages());
    onWorkflowDraftCleared();
  }

  function handleBuilderPromptKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitBuilderPrompt();
    }
  }

  return (
    <section className="panel workflow-panel" aria-labelledby="workflow-heading">
      <div className="panel-heading">
        <div>
          <p className="section-label">order rules</p>
          <h2 id="workflow-heading">Build order workflows</h2>
        </div>
        <Workflow size={20} className="accent-icon" />
      </div>

      <p className="panel-copy">
        Create and test the deterministic rules that classify messy notes into paid captures, review, or payment-evidence follow-up.
      </p>

      <div className="workflow-builder-tabs" role="tablist" aria-label="Workflow builder sections">
        <button
          className={`workflow-builder-tab${activeBuilderTab === "rules" ? " is-active" : ""}`}
          type="button"
          role="tab"
          aria-selected={activeBuilderTab === "rules"}
          aria-controls="workflow-builder-rules"
          id="workflow-builder-tab-rules"
          onClick={() => setActiveBuilderTab("rules")}
        >
          <MessageSquareText size={16} />
          <span>
            <strong>Order Rules</strong>
            <small>Step builder</small>
          </span>
        </button>
        <button
          className={`workflow-builder-tab${activeBuilderTab === "draft" ? " is-active" : ""}`}
          type="button"
          role="tab"
          aria-selected={activeBuilderTab === "draft"}
          aria-controls="workflow-builder-draft"
          id="workflow-builder-tab-draft"
          disabled={!generatedWorkflow}
          onClick={() => {
            if (generatedWorkflow) {
              setActiveBuilderTab("draft");
            }
          }}
        >
          <FileJson size={16} />
          <span>
            <strong>Live Draft</strong>
            <small>{generatedWorkflow ? `${countWorkflowRules(generatedWorkflow.workflow.states)} rules` : "No draft yet"}</small>
          </span>
        </button>
        <button
          className={`workflow-builder-tab${activeBuilderTab === "test" ? " is-active" : ""}`}
          type="button"
          role="tab"
          aria-selected={activeBuilderTab === "test"}
          aria-controls="workflow-builder-test"
          id="workflow-builder-tab-test"
          disabled={!generatedWorkflow}
          onClick={() => {
            if (generatedWorkflow) {
              setActiveBuilderTab("test");
            }
          }}
        >
          <Play size={16} />
          <span>
            <strong>Test Flow</strong>
            <small>{generatedWorkflow ? "Traverse tree" : "No draft yet"}</small>
          </span>
        </button>
      </div>

      {activeBuilderTab === "rules" ? (
        <div
          className="workflow-builder-tab-panel"
          id="workflow-builder-rules"
          role="tabpanel"
          aria-labelledby="workflow-builder-tab-rules"
        >
          <div className="workflow-chat-log" ref={chatLogRef} aria-live="polite">
            {chatMessages.map((message) => (
              <article
                className={`workflow-chat-message is-${message.role}${message.status ? ` is-${message.status}` : ""}`}
                key={message.id}
              >
                <div className="workflow-chat-avatar" aria-hidden="true">
                  {message.role === "assistant" ? <Bot size={16} /> : <User size={16} />}
                </div>
                <div className="workflow-chat-bubble">
                  <div className="workflow-chat-meta">
                    <strong>{message.role === "assistant" ? "Builder" : "You"}</strong>
                    <span>{formatChatTime(message.createdAt)}</span>
                  </div>
                  <p>{message.content}</p>
                </div>
              </article>
            ))}

            {generateMutation.isPending ? (
              <article className="workflow-chat-message is-assistant">
                <div className="workflow-chat-avatar" aria-hidden="true">
                  <Bot size={16} />
                </div>
                <div className="workflow-chat-bubble">
                  <div className="workflow-chat-meta">
                    <strong>Builder</strong>
                    <span>Working</span>
                  </div>
                  <WorkflowBuildProgress
                    elapsedSeconds={buildElapsedSeconds}
                    isRefiningWorkflow={isRefiningBuild}
                  />
                </div>
              </article>
            ) : null}
          </div>

          <div className="workflow-composer">
            <label className="field-label" htmlFor="workflow-builder-prompt">
              {isSetupComplete ? "Setup complete" : currentSetupStep.title}
            </label>
            <div className="workflow-starter-bubbles" aria-label="Starter prompts">
              {currentSetupStep.suggestions.map((prompt) => (
                <button
                  className="workflow-starter-bubble"
                  key={prompt}
                  type="button"
                  disabled={isSetupComplete || generateMutation.isPending}
                  onClick={() => setBuilderPrompt(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
            <textarea
              id="workflow-builder-prompt"
              className="compact-textarea workflow-composer-textarea"
              value={builderPrompt}
              onChange={(event) => setBuilderPrompt(event.target.value)}
              onKeyDown={handleBuilderPromptKeyDown}
              disabled={isSetupComplete || generateMutation.isPending}
              placeholder={
                isSetupComplete
                  ? "Start over to rebuild the deterministic rule flow."
                  : currentSetupStep.placeholder
              }
            />
            <div className="workflow-composer-actions">
              <button
                className="secondary-button workflow-clear-button"
                type="button"
                onClick={resetWorkflowSetup}
              >
                Start over
              </button>
              <button
                className="primary-button workflow-send-button"
                type="button"
                disabled={generateMutation.isPending || isSetupComplete || !builderPrompt.trim()}
                onClick={() => void submitBuilderPrompt()}
              >
                {generateMutation.isPending ? <Loader2 className="spin" size={18} /> : <ArrowRight size={18} />}
                {generateMutation.isPending ? "Building" : isFinalSetupStep ? "Build rule draft" : "Next step"}
              </button>
            </div>
          </div>
        </div>
      ) : activeBuilderTab === "draft" ? (
        <div
          className="workflow-builder-tab-panel"
          id="workflow-builder-draft"
          role="tabpanel"
          aria-labelledby="workflow-builder-tab-draft"
        >
          <WorkflowSummary generatedWorkflow={generatedWorkflow} />
          <DecisionTreePreview generatedWorkflow={generatedWorkflow} />
          {generatedWorkflow ? (
            <button
              className="secondary-button workflow-publish-button"
              type="button"
              disabled={publishMutation.isPending}
              onClick={() => publishMutation.mutate(generatedWorkflow.workflow)}
            >
              {publishMutation.isPending ? <Loader2 className="spin" size={18} /> : <Save size={16} />}
              Publish workflow for customer orders
            </button>
          ) : null}
          {publishNotice ? <p className="panel-copy">{publishNotice}</p> : null}
          {publishMutation.error ? <ErrorNotice message={publishMutation.error.message} /> : null}
        </div>
      ) : (
        <div
          className="workflow-builder-tab-panel"
          id="workflow-builder-test"
          role="tabpanel"
          aria-labelledby="workflow-builder-tab-test"
        >
          <WorkflowTestPanel
            businessDescription={businessDescription}
            generatedWorkflow={generatedWorkflow}
            shopBranding={shopBranding}
          />
        </div>
      )}
    </section>
  );
}

function WorkflowBuildProgress({
  elapsedSeconds,
  isRefiningWorkflow
}: {
  elapsedSeconds: number;
  isRefiningWorkflow: boolean;
}) {
  const activeStepIndex = Math.min(Math.floor(elapsedSeconds / 3), workflowBuildProgressSteps.length - 1);
  const progressValue = Math.min(92, 14 + activeStepIndex * 22 + (elapsedSeconds % 3) * 5);
  const activeStep = workflowBuildProgressSteps[activeStepIndex];
  const modeLabel = isRefiningWorkflow ? "Updating workflow" : "Building workflow";

  return (
    <div
      className="workflow-build-progress"
      role="status"
      aria-label={`${modeLabel}: ${activeStep.title}`}
      aria-live="polite"
    >
      <div className="workflow-build-progress-header">
        <span className="workflow-build-spinner" aria-hidden="true">
          <Loader2 className="spin" size={18} />
        </span>
        <div>
          <strong>{modeLabel}</strong>
          <p>{activeStep.detail}</p>
        </div>
        <span className="workflow-build-progress-time">{elapsedSeconds < 1 ? "Starting" : `${elapsedSeconds}s`}</span>
      </div>
      <div
        className="workflow-build-progress-track"
        aria-label={`Estimated progress ${progressValue}%`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={progressValue}
        role="progressbar"
      >
        <span style={{ width: `${progressValue}%` }} />
      </div>
      <ol className="workflow-build-steps">
        {workflowBuildProgressSteps.map((step, index) => {
          const isDone = index < activeStepIndex;
          const isActive = index === activeStepIndex;

          return (
            <li className={isDone ? "is-done" : isActive ? "is-active" : ""} key={step.title}>
              <span className="workflow-build-step-marker" aria-hidden="true">
                {isDone ? <CheckCircle2 size={14} /> : index + 1}
              </span>
              <span>
                <strong>{step.title}</strong>
                <small>{step.detail}</small>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function WorkflowTestPanel({
  businessDescription,
  generatedWorkflow,
  shopBranding
}: {
  businessDescription: string;
  generatedWorkflow: WorkflowGeneration | null;
  shopBranding: ShopBranding;
}) {
  const products = inferOrderFlowProducts(businessDescription, generatedWorkflow);
  const categories = buildOrderFlowCategories(products);
  const [step, setStep] = useStateValue<CustomerOrderBotStep>("category");
  const [selectedCategoryId, setSelectedCategoryId] = useStateValue("");
  const [quantities, setQuantities] = useStateValue<Record<string, number>>({});
  const [uploadedProofName, setUploadedProofName] = useStateValue("");

  useEffect(() => {
    setStep("category");
    setSelectedCategoryId("");
    setQuantities({});
    setUploadedProofName("");
  }, [
    businessDescription,
    generatedWorkflow?.workflow.id,
    generatedWorkflow?.workflow.version,
    setQuantities,
    setSelectedCategoryId,
    setStep,
    setUploadedProofName
  ]);

  if (!generatedWorkflow) {
    return (
      <div className="workflow-test-empty">
        <Play size={18} />
        <p>Build a live rule draft first, then preview the deterministic customer order path here.</p>
      </div>
    );
  }

  const selectedCategory = categories.find((category) => category.id === selectedCategoryId) ?? categories[0];
  const selectedProducts = selectedCategory?.products ?? products;
  const selectedLines = selectedProducts
    .map((product) => ({ product, quantity: quantities[product.name] ?? 0 }))
    .filter((line) => line.quantity > 0);
  const totalUnits = selectedLines.reduce((total, line) => total + line.quantity, 0);
  const hasPaymentDetails = Boolean(
    shopBranding.payment_instructions ||
      shopBranding.paynow_number ||
      shopBranding.paynow_qr_image ||
      shopBranding.bank_name ||
      shopBranding.bank_account_number
  );

  function chooseCategory(categoryId: string) {
    setSelectedCategoryId(categoryId);
    setQuantities({});
    setUploadedProofName("");
    setStep("quantity");
  }

  function updateQuantity(productName: string, nextQuantity: number) {
    setQuantities((current) => ({
      ...current,
      [productName]: Math.max(0, Math.min(99, nextQuantity))
    }));
  }

  function restartCustomerPath() {
    setStep("category");
    setSelectedCategoryId("");
    setQuantities({});
    setUploadedProofName("");
  }

  function goBack() {
    if (step === "quantity") {
      setStep("category");
      return;
    }

    if (step === "payment") {
      setStep("quantity");
      return;
    }

    if (step === "fulfilled") {
      setStep("payment");
      setUploadedProofName("");
    }
  }

  function handlePaymentProofChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];

    if (!file) {
      return;
    }

    setUploadedProofName(file.name);
    setStep("fulfilled");
  }

  return (
    <div className="workflow-test-panel">
      <section className="workflow-traversal workflow-customer-bot" aria-labelledby="workflow-customer-heading">
        <div className="workflow-test-heading">
          <div>
            <span className="muted-label">Customer decision tree</span>
            <strong id="workflow-customer-heading">{generatedWorkflow.workflow.name}</strong>
          </div>
          <span>Deterministic only</span>
        </div>

        <div className="workflow-customer-path" aria-label="Customer order progress">
          {customerOrderBotSteps.map((botStep) => (
            <span
              className={[
                "workflow-customer-path-step",
                getCustomerPathStepState(step, botStep.id) === "done" ? "is-done" : "",
                getCustomerPathStepState(step, botStep.id) === "active" ? "is-active" : ""
              ]
                .filter(Boolean)
                .join(" ")}
              key={botStep.id}
            >
              {botStep.label}
            </span>
          ))}
        </div>

        <article className="workflow-customer-screen">
          <div className="workflow-customer-question">
            <span className="workflow-traversal-node-icon" aria-hidden="true">
              {step === "fulfilled" ? <CheckCircle2 size={18} /> : <GitBranch size={18} />}
            </span>
            <div>
              <span>{step === "fulfilled" ? "Order fulfilled" : "Current question"}</span>
              <strong>{formatCustomerOrderPrompt(step, selectedCategory?.label)}</strong>
              <p>{formatCustomerOrderHelp(step)}</p>
            </div>
          </div>

          {step === "category" ? (
            <div className="workflow-customer-options" aria-label="Product category choices">
              {categories.map((category) => (
                <button
                  className="workflow-customer-option"
                  key={category.id}
                  type="button"
                  onClick={() => chooseCategory(category.id)}
                >
                  <span>{category.label}</span>
                  <small>{category.products.map((product) => product.name).join(", ")}</small>
                  <b>
                    Choose this
                    <ArrowRight size={14} />
                  </b>
                </button>
              ))}
            </div>
          ) : null}

          {step === "quantity" ? (
            <>
              <div className="workflow-quantity-grid" aria-label="Quantity choices">
                {selectedProducts.map((product) => {
                  const quantity = quantities[product.name] ?? 0;

                  return (
                    <div className="workflow-quantity-card" key={product.name}>
                      <div>
                        <span>{formatOrderFlowProductGroup(product.group)}</span>
                        <strong>{product.name}</strong>
                      </div>
                      <div className="workflow-quantity-controls">
                        <button
                          aria-label={`Decrease ${product.name}`}
                          type="button"
                          disabled={quantity <= 0}
                          onClick={() => updateQuantity(product.name, quantity - 1)}
                        >
                          <Minus size={15} />
                        </button>
                        <span>{quantity}</span>
                        <button
                          aria-label={`Increase ${product.name}`}
                          type="button"
                          onClick={() => updateQuantity(product.name, quantity + 1)}
                        >
                          <Plus size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="workflow-customer-actions">
                <button className="secondary-button" type="button" onClick={goBack}>
                  Back
                </button>
                <button className="primary-button" type="button" disabled={!totalUnits} onClick={() => setStep("payment")}>
                  Continue to payment
                </button>
              </div>
            </>
          ) : null}

          {step === "payment" ? (
            <div className="workflow-payment-step">
              <OrderFlowSummary selectedLines={selectedLines} />

              <div className="workflow-payment-details">
                <div>
                  <span>Payment instructions</span>
                  <strong>{shopBranding.payment_instructions || "Pay by PayNow or bank transfer, then upload proof."}</strong>
                </div>

                {shopBranding.paynow_number ? (
                  <div>
                    <span>PayNow</span>
                    <strong>{shopBranding.paynow_number}</strong>
                  </div>
                ) : null}

                {shopBranding.paynow_qr_image ? (
                  <img alt="PayNow QR" src={shopBranding.paynow_qr_image} />
                ) : null}

                {shopBranding.bank_name || shopBranding.bank_account_number ? (
                  <div>
                    <span>Bank transfer</span>
                    <strong>
                      {[shopBranding.bank_name, shopBranding.bank_account_name, shopBranding.bank_account_number]
                        .filter(Boolean)
                        .join(" / ")}
                    </strong>
                  </div>
                ) : null}

                {!hasPaymentDetails ? (
                  <p className="workflow-payment-missing">Add payment details in Shop Branding before publishing this flow.</p>
                ) : null}
              </div>

              <label className="workflow-proof-upload">
                <Upload size={20} />
                <span>Upload payment screenshot</span>
                <small>The preview fulfils the order only after proof is attached.</small>
                <input accept="image/*,.pdf" type="file" onChange={handlePaymentProofChange} />
              </label>

              <div className="workflow-customer-actions">
                <button className="secondary-button" type="button" onClick={goBack}>
                  Back
                </button>
                <button className="secondary-button" type="button" onClick={restartCustomerPath}>
                  Restart
                </button>
              </div>
            </div>
          ) : null}

          {step === "fulfilled" ? (
            <div className="workflow-fulfilled-step">
              <div className="workflow-fulfilled-badge">
                <CheckCircle2 size={20} />
                <span>Order fulfilled</span>
              </div>
              <OrderFlowSummary selectedLines={selectedLines} />
              <p>Payment proof attached: {uploadedProofName}</p>
              <div className="workflow-customer-actions">
                <button className="secondary-button" type="button" onClick={goBack}>
                  Change proof
                </button>
                <button className="primary-button" type="button" onClick={restartCustomerPath}>
                  Start another order
                </button>
              </div>
            </div>
          ) : null}
        </article>
      </section>
    </div>
  );
}

function OrderFlowSummary({
  selectedLines
}: {
  selectedLines: Array<{ product: OrderFlowProduct; quantity: number }>;
}) {
  return (
    <div className="workflow-order-summary">
      <span>Order summary</span>
      {selectedLines.length ? (
        <ul>
          {selectedLines.map((line) => (
            <li key={line.product.name}>
              <strong>{line.product.name}</strong>
              <span>x {line.quantity}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p>No items selected yet.</p>
      )}
    </div>
  );
}

type CustomerOrderBotStep = "category" | "quantity" | "payment" | "fulfilled";
type CustomerPathStepState = "todo" | "active" | "done";
type OrderFlowProductGroup = "drinks" | "desserts" | "items";
type OrderFlowProduct = {
  group: OrderFlowProductGroup;
  name: string;
};
type OrderFlowCategory = {
  id: string;
  label: string;
  products: OrderFlowProduct[];
};

const customerOrderBotSteps: Array<{ id: CustomerOrderBotStep; label: string }> = [
  { id: "category", label: "Choose items" },
  { id: "quantity", label: "Quantity" },
  { id: "payment", label: "Payment proof" },
  { id: "fulfilled", label: "Fulfilled" }
];

function getCustomerPathStepState(currentStep: CustomerOrderBotStep, targetStep: CustomerOrderBotStep): CustomerPathStepState {
  const currentIndex = customerOrderBotSteps.findIndex((step) => step.id === currentStep);
  const targetIndex = customerOrderBotSteps.findIndex((step) => step.id === targetStep);

  if (currentStep === "fulfilled" && targetIndex <= currentIndex) {
    return "done";
  }

  if (targetIndex < currentIndex) {
    return "done";
  }

  if (targetIndex === currentIndex) {
    return "active";
  }

  return "todo";
}

function formatCustomerOrderPrompt(step: CustomerOrderBotStep, categoryLabel?: string) {
  if (step === "category") {
    return "What would you like to buy today?";
  }

  if (step === "quantity") {
    return `How many ${categoryLabel?.toLowerCase() ?? "items"} would you like?`;
  }

  if (step === "payment") {
    return "Please pay, then upload your payment screenshot.";
  }

  return "Payment proof received.";
}

function formatCustomerOrderHelp(step: CustomerOrderBotStep) {
  if (step === "category") {
    return "Pick one option to continue.";
  }

  if (step === "quantity") {
    return "Use the quantity controls before payment is shown.";
  }

  if (step === "payment") {
    return "Upload a screenshot or receipt after payment.";
  }

  return "The order is complete in this preview.";
}

function inferOrderFlowProducts(businessDescription: string, generatedWorkflow: WorkflowGeneration | null): OrderFlowProduct[] {
  const sellerSegment =
    businessDescription.match(/seller sells:\s*([^.\n]+)/i)?.[1] ??
    businessDescription.match(/selling\s+([^.\n]+)/i)?.[1] ??
    businessDescription;
  const explicitProducts = sellerSegment
    .split(/,|\band\b|&|\+|\//i)
    .map(normalizeOrderFlowProductName)
    .filter((product) => product && !/customer|payment|paynow|bank|capture|order/i.test(product));
  const searchText = `${businessDescription} ${(generatedWorkflow?.test_inputs ?? []).join(" ")}`.toLowerCase();
  const knownProducts = [
    "egg tarts",
    "egg tart",
    "bandung",
    "lemonade",
    "lemons",
    "cakes",
    "cake",
    "brownies",
    "brownie",
    "cookies",
    "cookie",
    "kopi",
    "teh",
    "kaya toast"
  ].filter((product) => searchText.includes(product));
  const productNames = dedupeOrderFlowProductNames([...explicitProducts, ...knownProducts].map(normalizeOrderFlowProductName));
  const fallbackProducts = ["egg tarts", "bandung", "lemonade"];

  return (productNames.length ? productNames : fallbackProducts).map((name) => ({
    group: classifyOrderFlowProduct(name),
    name
  }));
}

function buildOrderFlowCategories(products: OrderFlowProduct[]): OrderFlowCategory[] {
  const drinks = products.filter((product) => product.group === "drinks");
  const desserts = products.filter((product) => product.group === "desserts");
  const items = products.filter((product) => product.group === "items");
  const categories: OrderFlowCategory[] = [];

  if (drinks.length) {
    categories.push({ id: "drinks", label: "Drinks", products: drinks });
  }

  if (desserts.length) {
    categories.push({ id: "desserts", label: "Desserts", products: desserts });
  }

  if (drinks.length && desserts.length) {
    categories.push({ id: "both", label: "Drinks and desserts", products: [...desserts, ...drinks] });
  }

  if (items.length) {
    categories.push({ id: "items", label: "Other items", products: items });
  }

  if (!categories.length || categories.length === 1) {
    return [{ id: "all", label: "All items", products }];
  }

  return categories;
}

function normalizeOrderFlowProductName(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/^(?:seller sells:|selling)\s+/i, "")
    .replace(/^\d+\s+/, "")
    .replace(/[.?!:;]+$/g, "")
    .replace(/\s+/g, " ");

  if (!normalized) {
    return "";
  }

  const aliases: Record<string, string> = {
    brownie: "brownies",
    cake: "cakes",
    cookie: "cookies",
    "egg tart": "egg tarts",
    lemonades: "lemonade",
    lemons: "lemonade"
  };

  return aliases[normalized] ?? normalized;
}

function dedupeOrderFlowProductNames(products: string[]) {
  const seen = new Set<string>();

  return products.filter((product) => {
    if (!product || seen.has(product)) {
      return false;
    }

    seen.add(product);
    return true;
  });
}

function classifyOrderFlowProduct(productName: string): OrderFlowProductGroup {
  if (/(bandung|lemonade|drink|kopi|teh|coffee|tea|juice|milk|latte|soda)/i.test(productName)) {
    return "drinks";
  }

  if (/(tart|cake|brownie|cookie|dessert|pastry|toast|bread|kueh|muffin|pudding)/i.test(productName)) {
    return "desserts";
  }

  return "items";
}

function formatOrderFlowProductGroup(group: OrderFlowProductGroup) {
  if (group === "drinks") {
    return "Drink";
  }

  if (group === "desserts") {
    return "Dessert";
  }

  return "Item";
}

function ShopBrandingPanel({
  adminCredential,
  shopBranding,
  onSaved
}: {
  adminCredential: AuthCredential;
  shopBranding: ShopBranding;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useStateValue<ShopBranding>(shopBranding);
  const [savedNotice, setSavedNotice] = useStateValue<string | null>(null);
  const [qrNotice, setQrNotice] = useStateValue<string | null>(null);
  const [isGeneratingQr, setIsGeneratingQr] = useStateValue(false);

  useEffect(() => {
    setDraft(shopBranding);
    setQrNotice(null);
  }, [shopBranding, setDraft, setQrNotice]);

  const saveMutation = useMutation({
    mutationFn: async (config: ShopBranding) => {
      const response = await fetch(`${apiBase}/config/shop`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders("admin", adminCredential)
        },
        body: JSON.stringify(config)
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      return (await response.json()) as ShopBranding;
    },
    onSuccess: (saved) => {
      setDraft(saved);
    }
  });

  const hasPayNowDetails = Boolean(draft.paynow_number.trim() || draft.paynow_qr_image.trim());
  const hasBankTransferDetails = Boolean(
    draft.bank_name.trim() && draft.bank_account_name.trim() && draft.bank_account_number.trim()
  );

  async function persistBrandingDraft(nextDraft: ShopBranding, savedMessage = "Customer storefront and payment details saved.") {
    if (!isBrandingDraftReadyToSave(nextDraft)) {
      throw new Error("Complete all storefront fields before saving.");
    }

    const saved = await saveMutation.mutateAsync(buildBrandingSavePayload(nextDraft));
    setDraft(saved);
    setSavedNotice(savedMessage);
    onSaved();
    return saved;
  }

  async function handlePaynowQrUpload(file: File | null) {
    setQrNotice(null);
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setQrNotice("Upload an image file for the PayNow QR.");
      return;
    }

    const imageData = await imageFileToDataUrl(file);
    const qrText = await readQrTextFromImage(file);
    const extractedPaynowNumber = qrText ? extractPayNowNumberFromQrText(qrText) : null;

    const nextDraft: ShopBranding = {
      ...draft,
      paynow_qr_image: imageData,
      paynow_number: extractedPaynowNumber ?? draft.paynow_number
    };

    setDraft(nextDraft);

    try {
      await persistBrandingDraft(nextDraft, "PayNow QR uploaded and saved.");
      setQrNotice(
        extractedPaynowNumber
          ? `PayNow number ${formatPaynowNumber(extractedPaynowNumber)} detected from QR and saved.`
          : "PayNow QR uploaded and saved."
      );
    } catch (cause) {
      setQrNotice(
        extractedPaynowNumber
          ? `PayNow number ${formatPaynowNumber(extractedPaynowNumber)} detected from QR. Complete all storefront fields, then save.`
          : "PayNow QR uploaded. Complete all storefront fields, then save."
      );
    }
  }

  async function handleGeneratePaynowQr() {
    setQrNotice(null);
    const paynowNumber = draft.paynow_number.trim();

    if (!paynowNumber) {
      setQrNotice("Enter a PayNow number first, then generate the QR.");
      return;
    }

    setIsGeneratingQr(true);

    try {
      const imageData = await generatePayNowQrDataUrl(paynowNumber, draft.business_name);

      if (!imageData) {
        setQrNotice("Could not generate QR. Use a valid Singapore mobile number (8 digits, starts with 6, 8, or 9).");
        return;
      }

      const nextDraft: ShopBranding = { ...draft, paynow_qr_image: imageData };
      setDraft(nextDraft);

      try {
        await persistBrandingDraft(nextDraft, "PayNow QR saved.");
        setQrNotice(`PayNow QR generated and saved for ${formatPaynowNumber(paynowNumber)}.`);
      } catch {
        setQrNotice(
          `PayNow QR generated for ${formatPaynowNumber(paynowNumber)}. Complete all storefront fields, then click Save storefront settings.`
        );
      }
    } catch {
      setQrNotice("Could not generate the PayNow QR. Try again.");
    } finally {
      setIsGeneratingQr(false);
    }
  }

  return (
    <section className="panel info-panel shop-branding-panel" aria-labelledby="shop-branding-heading">
      <div className="panel-heading">
        <div>
          <p className="section-label">white label</p>
          <h2 id="shop-branding-heading">User login branding</h2>
        </div>
        <Store size={20} className="accent-icon" />
      </div>

      <p className="panel-copy">
        These settings appear on the customer storefront at <code>/user</code>. Customers sign in after choosing
        Order now from the home page.
      </p>

      <div className="branding-preview">
        <BrandMark businessName={draft.business_name || "Business"} markLetter={draft.mark_letter || "B"} />
        <p className="branding-preview-tagline">{draft.tagline || "Your tagline"}</p>
        <p className="branding-preview-description">{draft.description || "Your description"}</p>
      </div>

      <div className="branding-form">
        <div className="branding-form-row">
          <div className="field-group">
            <label className="field-label" htmlFor="shop-business-name">
              Business name
            </label>
            <input
              id="shop-business-name"
              className="input-field branding-input"
              type="text"
              value={draft.business_name}
              onChange={(event) => setDraft((current) => ({ ...current, business_name: event.target.value }))}
            />
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="shop-mark-letter">
              Mark letter
            </label>
            <input
              id="shop-mark-letter"
              className="input-field branding-input branding-mark-input"
              type="text"
              maxLength={2}
              value={draft.mark_letter}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  mark_letter: event.target.value.replace(/\s/g, "").slice(0, 2)
                }))
              }
            />
          </div>
        </div>

        <div className="field-group">
          <label className="field-label" htmlFor="shop-tagline">
            Tagline
          </label>
          <input
            id="shop-tagline"
            className="input-field branding-input"
            type="text"
            value={draft.tagline}
            onChange={(event) => setDraft((current) => ({ ...current, tagline: event.target.value }))}
          />
        </div>

        <div className="field-group">
          <label className="field-label" htmlFor="shop-description">
            Description
          </label>
          <textarea
            id="shop-description"
            className="compact-textarea branding-textarea"
            value={draft.description}
            onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
          />
        </div>

        <div className="field-group">
          <label className="field-label" htmlFor="shop-footer-note">
            Footer note
          </label>
          <input
            id="shop-footer-note"
            className="input-field branding-input"
            type="text"
            value={draft.footer_note}
            onChange={(event) => setDraft((current) => ({ ...current, footer_note: event.target.value }))}
            placeholder="Example: Open Tue–Sun, 10am–6pm · WhatsApp 9123 4567"
          />
        </div>

        <div className="field-group">
          <label className="field-label" htmlFor="shop-payment-instructions">
            Payment instructions
          </label>
          <textarea
            id="shop-payment-instructions"
            className="compact-textarea branding-textarea"
            value={draft.payment_instructions}
            onChange={(event) =>
              setDraft((current) => ({ ...current, payment_instructions: event.target.value }))
            }
          />
        </div>

        <div className="branding-payment-grid">
          <section className="branding-payment-card" aria-labelledby="shop-paynow-heading">
            <div className="branding-payment-card-head">
              <div>
                <p className="section-label">PayNow</p>
                <h3 id="shop-paynow-heading">PayNow details</h3>
              </div>
              <WalletCards size={18} className="accent-icon" />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="shop-paynow-number">
                PayNow number
              </label>
              <input
                id="shop-paynow-number"
                className="input-field branding-input"
                type="text"
                value={draft.paynow_number}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, paynow_number: event.target.value }))
                }
                placeholder="Example: 9123 4567"
              />
            </div>

            <div className="field-group">
              <span className="field-label">PayNow QR</span>
              {draft.paynow_qr_image ? (
                <div className="paynow-qr-preview">
                  <img src={draft.paynow_qr_image} alt="Uploaded PayNow QR code" />
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="Remove PayNow QR"
                    disabled={saveMutation.isPending}
                    onClick={() => {
                      void (async () => {
                        const nextDraft: ShopBranding = { ...draft, paynow_qr_image: "" };
                        setDraft(nextDraft);
                        setQrNotice(null);

                        try {
                          await persistBrandingDraft(nextDraft, "PayNow QR removed.");
                          setQrNotice("PayNow QR removed.");
                        } catch {
                          setQrNotice("PayNow QR removed from preview. Complete all storefront fields, then save.");
                        }
                      })();
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : null}
              <div className="qr-action-buttons">
                <button
                  className="secondary-button qr-upload-button"
                  type="button"
                  disabled={isGeneratingQr || saveMutation.isPending}
                  onClick={() => {
                    void handleGeneratePaynowQr();
                  }}
                >
                  {isGeneratingQr ? <Loader2 className="spin" size={16} /> : <QrCode size={16} />}
                  Generate QR
                </button>
                <label className="secondary-button qr-upload-button" htmlFor="shop-paynow-qr">
                  <Upload size={16} />
                  Upload QR
                </label>
                <input
                  id="shop-paynow-qr"
                  className="visually-hidden"
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    void handlePaynowQrUpload(event.target.files?.[0] ?? null);
                    event.target.value = "";
                  }}
                />
              </div>
              {qrNotice ? <p className="branding-helper-text">{qrNotice}</p> : null}
            </div>
          </section>

          <section className="branding-payment-card" aria-labelledby="shop-bank-heading">
            <div className="branding-payment-card-head">
              <div>
                <p className="section-label">Bank transfer</p>
                <h3 id="shop-bank-heading">Bank details</h3>
              </div>
              <CircleDollarSign size={18} className="accent-icon" />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="shop-bank-name">
                Bank name
              </label>
              <input
                id="shop-bank-name"
                className="input-field branding-input"
                type="text"
                value={draft.bank_name}
                onChange={(event) => setDraft((current) => ({ ...current, bank_name: event.target.value }))}
                placeholder="Example: DBS Bank"
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="shop-bank-account-name">
                Account name
              </label>
              <input
                id="shop-bank-account-name"
                className="input-field branding-input"
                type="text"
                value={draft.bank_account_name}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, bank_account_name: event.target.value }))
                }
                placeholder="Example: Zorder Dessert Stall"
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="shop-bank-account-number">
                Account number
              </label>
              <input
                id="shop-bank-account-number"
                className="input-field branding-input"
                type="text"
                value={draft.bank_account_number}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, bank_account_number: event.target.value }))
                }
                placeholder="Example: 001-234567-8"
              />
            </div>
          </section>
        </div>

        <button
          className="primary-button branding-save"
          type="button"
          disabled={
            saveMutation.isPending ||
            !draft.business_name.trim() ||
            !draft.mark_letter.trim() ||
            !draft.tagline.trim() ||
            !draft.description.trim() ||
            !draft.payment_instructions.trim() ||
            !hasPayNowDetails ||
            !hasBankTransferDetails
          }
          onClick={() => {
            setSavedNotice(null);
            void persistBrandingDraft(draft).catch(() => {
              // saveMutation.error surfaces in the panel footer
            });
          }}
        >
          {saveMutation.isPending ? <Loader2 className="spin" size={18} /> : <Store size={18} />}
          Save storefront settings
        </button>
      </div>

      {saveMutation.error ? <ErrorNotice message={saveMutation.error.message} /> : null}
      {savedNotice ? <p className="branding-saved-notice">{savedNotice}</p> : null}
    </section>
  );
}

function InventoryPanel({
  adminCredential,
  orders,
  metrics
}: {
  adminCredential: AuthCredential;
  orders: ProcessedOrder[];
  metrics: ReturnType<typeof buildMetrics>;
}) {
  const queryClient = useQueryClient();
  const inventoryQuery = useQuery({
    queryKey: ["inventory", adminCredential.username],
    queryFn: () => fetchInventory(adminCredential)
  });
  const [activeSubTab, setActiveSubTab] = useStateValue<InventorySubTab>("analytics");
  const [capturePeriod, setCapturePeriod] = useStateValue<CapturePeriodDays>(1);
  const [newProductDraft, setNewProductDraft] = useStateValue<InventoryProductDraft>(createInventoryDraft());
  const [editingProductId, setEditingProductId] = useStateValue<string | null>(null);
  const [editProductDraft, setEditProductDraft] = useStateValue<InventoryProductDraft>(createInventoryDraft());
  const [draftError, setDraftError] = useStateValue<string | null>(null);
  const uploadMutation = useMutation({
    mutationFn: (products: InventoryProduct[]) => uploadInventory(adminCredential, products),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
    }
  });
  const addMutation = useMutation({
    mutationFn: (product: InventoryProduct) => uploadInventory(adminCredential, [product]),
    onSuccess: () => {
      setNewProductDraft(createInventoryDraft());
      setDraftError(null);
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
    }
  });
  const updateMutation = useMutation({
    mutationFn: ({ productId, product }: { productId: string; product: InventoryProduct }) =>
      updateInventoryProduct(adminCredential, productId, product),
    onSuccess: () => {
      setEditingProductId(null);
      setEditProductDraft(createInventoryDraft());
      setDraftError(null);
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
    }
  });
  const deleteMutation = useMutation({
    mutationFn: (productId: string) => deleteInventoryProduct(adminCredential, productId),
    onSuccess: () => {
      setDraftError(null);
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
    }
  });
  const products = inventoryQuery.data?.products ?? [];
  const inventoryOrders = inventoryQuery.data?.orders ?? orders;
  const paidSalesOrders = inventoryOrders.filter(isPaidOrder);
  const periodSummary = buildCapturePeriodSummary(paidSalesOrders, capturePeriod);
  const periodLabel = getCapturePeriodLabel(capturePeriod);
  const periodPaidOrders = periodSummary.orders;
  const salesByYear = buildSalesByYear(periodPaidOrders);
  const [selectedYear, setSelectedYear] = useStateValue<string | null>(null);

  useEffect(() => {
    setSelectedYear(null);
  }, [capturePeriod, setSelectedYear]);

  const scopedPaidOrders = selectedYear
    ? periodPaidOrders.filter((order) => getCaptureYearKey(order.created_at) === selectedYear)
    : periodPaidOrders;
  const inventory = buildInventorySummary(scopedPaidOrders);
  const salesByDate = buildSalesByDate(scopedPaidOrders);
  const subtabs: Array<{ id: InventorySubTab; label: string; description: string; icon: React.ReactNode }> = [
    {
      id: "analytics",
      label: "Post Order Analytics",
      description: `${formatCompactAmount(periodSummary.sales, "SGD")} · ${periodLabel}`,
      icon: <CircleDollarSign size={16} />
    },
    {
      id: "sales",
      label: "Sales Captures",
      description: `${periodSummary.count} paid · ${periodLabel}`,
      icon: <ClipboardList size={16} />
    },
    {
      id: "inventory",
      label: "Products",
      description: `${products.length} in catalog`,
      icon: <Database size={16} />
    }
  ];

  async function handleInventoryUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const productsToUpload = parseInventoryUpload(await file.text(), file.name);
      uploadMutation.mutate(productsToUpload);
    } catch (cause) {
      uploadMutation.reset();
      window.alert(cause instanceof Error ? cause.message : "Could not read inventory file");
    } finally {
      event.target.value = "";
    }
  }

  function updateNewProductDraft(field: keyof InventoryProductDraft, value: string | boolean) {
    setNewProductDraft((current) => ({
      ...current,
      [field]: value
    }));
  }

  function updateEditProductDraft(field: keyof InventoryProductDraft, value: string | boolean) {
    setEditProductDraft((current) => ({
      ...current,
      [field]: value
    }));
  }

  async function updateNewProductImage(file: File | null) {
    if (!file) {
      return;
    }

    try {
      updateNewProductDraft("image_url", await productImageFileToDataUrl(file));
      setDraftError(null);
    } catch (cause) {
      setDraftError(cause instanceof Error ? cause.message : "Could not read product image");
    }
  }

  async function updateEditProductImage(file: File | null) {
    if (!file) {
      return;
    }

    try {
      updateEditProductDraft("image_url", await productImageFileToDataUrl(file));
      setDraftError(null);
    } catch (cause) {
      setDraftError(cause instanceof Error ? cause.message : "Could not read product image");
    }
  }

  function addProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      addMutation.mutate(inventoryProductFromDraft(newProductDraft));
    } catch (cause) {
      setDraftError(cause instanceof Error ? cause.message : "Could not add product");
    }
  }

  function startProductEdit(product: InventoryProduct) {
    if (!product.id) {
      return;
    }

    setEditingProductId(product.id);
    setEditProductDraft(createInventoryDraft(product));
    setDraftError(null);
  }

  function saveProductEdit(productId: string) {
    try {
      updateMutation.mutate({
        productId,
        product: inventoryProductFromDraft(editProductDraft)
      });
    } catch (cause) {
      setDraftError(cause instanceof Error ? cause.message : "Could not update product");
    }
  }

  function removeProduct(product: InventoryProduct) {
    if (!product.id) {
      return;
    }

    const shouldDelete = window.confirm(`Remove ${product.name} from inventory? Historical orders stay unchanged.`);
    if (shouldDelete) {
      deleteMutation.mutate(product.id);
    }
  }

  return (
    <div className="inventory-workspace">
      <div className="inventory-subtabs" role="tablist" aria-label="Inventory workspace sections">
        {subtabs.map((tab) => (
          <button
            key={tab.id}
            className={`inventory-subtab${activeSubTab === tab.id ? " is-active" : ""}`}
            type="button"
            role="tab"
            aria-selected={activeSubTab === tab.id}
            aria-controls={`inventory-panel-${tab.id}`}
            id={`inventory-tab-${tab.id}`}
            onClick={() => setActiveSubTab(tab.id)}
          >
            {tab.icon}
            <span>
              <strong>{tab.label}</strong>
              <small>{tab.description}</small>
            </span>
          </button>
        ))}
      </div>

      {activeSubTab === "analytics" || activeSubTab === "sales" ? (
        <div className="inventory-capture-stack">
          <CapturePeriodToolbar
            capturePeriod={capturePeriod}
            onChange={setCapturePeriod}
            headingId="inventory-capture-period-heading"
          />
          <CapturePeriodMetrics summary={periodSummary} />
        </div>
      ) : null}

      {activeSubTab === "inventory" ? (
        <section
          className="panel info-panel inventory-master-panel"
          aria-labelledby="inventory-products-heading"
          id="inventory-panel-inventory"
          role="tabpanel"
        >
        <div className="panel-heading">
          <div>
            <p className="section-label">product master</p>
            <h2 id="inventory-products-heading">Inventory table</h2>
          </div>
        </div>
        <p className="panel-copy">
          Keep products in SQLite. Add items one-by-one, edit rows directly, remove products, or bulk import with CSV
          and JSON when you need a reset.
        </p>

        <form className="inventory-add-row" onSubmit={addProduct}>
          <input
            className="input-field inventory-input"
            type="text"
            value={newProductDraft.name}
            onChange={(event) => updateNewProductDraft("name", event.target.value)}
            placeholder="Product name"
            aria-label="New product name"
          />
          <input
            className="input-field inventory-input"
            type="text"
            value={newProductDraft.category}
            onChange={(event) => updateNewProductDraft("category", event.target.value)}
            placeholder="Category"
            aria-label="New product category"
          />
          <input
            className="input-field inventory-input"
            type="number"
            min="0"
            step="0.01"
            value={newProductDraft.unit_price}
            onChange={(event) => updateNewProductDraft("unit_price", event.target.value)}
            placeholder="Price"
            aria-label="New product unit price"
          />
          <div className="inventory-image-field">
            <ProductImageDisplay
              imageUrl={newProductDraft.image_url}
              name={newProductDraft.name || "New product"}
              className="inventory-image-preview"
            />
            <div className="inventory-image-controls">
              <label className="secondary-button inventory-image-upload-button" htmlFor="new-product-image">
                <Upload size={15} />
                {newProductDraft.image_url ? "Change photo" : "Add photo"}
              </label>
              <input
                id="new-product-image"
                className="visually-hidden"
                type="file"
                accept="image/*"
                onChange={(event) => {
                  void updateNewProductImage(event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
              />
              {newProductDraft.image_url ? (
                <button className="text-link" type="button" onClick={() => updateNewProductDraft("image_url", "")}>
                  Remove photo
                </button>
              ) : null}
            </div>
          </div>
          <button
            className="secondary-button inventory-add-button"
            type="submit"
            disabled={addMutation.isPending || !newProductDraft.name.trim()}
          >
            {addMutation.isPending ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
            Add
          </button>
        </form>

        <div className="inventory-table-wrap">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Photo</th>
                <th>Category</th>
                <th>Price</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.length ? (
                products.map((product) => {
                  const isEditing = editingProductId === product.id;
                  const isUpdating = updateMutation.variables?.productId === product.id && updateMutation.isPending;
                  const isDeleting = deleteMutation.variables === product.id && deleteMutation.isPending;

                  return (
                    <tr key={product.id ?? product.name}>
                      <td data-label="Product">
                        {isEditing ? (
                          <input
                            className="input-field inventory-input"
                            type="text"
                            value={editProductDraft.name}
                            onChange={(event) => updateEditProductDraft("name", event.target.value)}
                            aria-label={`Product name for ${product.name}`}
                          />
                        ) : (
                          <strong>{product.name}</strong>
                        )}
                      </td>
                      <td data-label="Photo">
                        {isEditing ? (
                          <div className="inventory-image-field is-table-field">
                            <ProductImageDisplay
                              imageUrl={editProductDraft.image_url}
                              name={editProductDraft.name || product.name}
                              className="inventory-image-preview"
                            />
                            <div className="inventory-image-controls">
                              <label
                                className="secondary-button inventory-image-upload-button"
                                htmlFor={`edit-product-image-${product.id}`}
                              >
                                <Upload size={15} />
                                {editProductDraft.image_url ? "Change" : "Upload"}
                              </label>
                              <input
                                id={`edit-product-image-${product.id}`}
                                className="visually-hidden"
                                type="file"
                                accept="image/*"
                                onChange={(event) => {
                                  void updateEditProductImage(event.target.files?.[0] ?? null);
                                  event.target.value = "";
                                }}
                              />
                              {editProductDraft.image_url ? (
                                <button className="text-link" type="button" onClick={() => updateEditProductDraft("image_url", "")}>
                                  Remove
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ) : (
                          <ProductImageDisplay
                            imageUrl={product.image_url}
                            name={product.name}
                            className="inventory-image-preview is-readonly"
                          />
                        )}
                      </td>
                      <td data-label="Category">
                        {isEditing ? (
                          <input
                            className="input-field inventory-input"
                            type="text"
                            value={editProductDraft.category}
                            onChange={(event) => updateEditProductDraft("category", event.target.value)}
                            aria-label={`Category for ${product.name}`}
                          />
                        ) : (
                          product.category
                        )}
                      </td>
                      <td data-label="Price">
                        {isEditing ? (
                          <input
                            className="input-field inventory-input"
                            type="number"
                            min="0"
                            step="0.01"
                            value={editProductDraft.unit_price}
                            onChange={(event) => updateEditProductDraft("unit_price", event.target.value)}
                            aria-label={`Unit price for ${product.name}`}
                          />
                        ) : (
                          formatAmount(product.unit_price, "SGD")
                        )}
                      </td>
                      <td data-label="Status">
                        {isEditing ? (
                          <label className="inventory-checkbox">
                            <input
                              type="checkbox"
                              checked={editProductDraft.is_active}
                              onChange={(event) => updateEditProductDraft("is_active", event.target.checked)}
                            />
                            Active
                          </label>
                        ) : (
                          <span className={`inventory-status${product.is_active ? " is-active" : " is-inactive"}`}>
                            {product.is_active ? "Active" : "Inactive"}
                          </span>
                        )}
                      </td>
                      <td data-label="Actions">
                        <div className="inventory-actions">
                          {isEditing ? (
                            <>
                              <button
                                className="inventory-row-action save-action"
                                type="button"
                                title="Save product"
                                disabled={isUpdating}
                                onClick={() => product.id && saveProductEdit(product.id)}
                              >
                                {isUpdating ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
                                Save
                              </button>
                              <button
                                className="inventory-row-action cancel-action"
                                type="button"
                                title="Cancel edit"
                                onClick={() => {
                                  setEditingProductId(null);
                                  setDraftError(null);
                                }}
                              >
                                <X size={16} />
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                className="icon-button"
                                type="button"
                                title="Edit product"
                                onClick={() => startProductEdit(product)}
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                className="icon-button danger-icon-button"
                                type="button"
                                title="Remove product"
                                disabled={isDeleting}
                                onClick={() => removeProduct(product)}
                              >
                                {isDeleting ? <Loader2 className="spin" size={16} /> : <Trash2 size={16} />}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6}>{inventoryQuery.isLoading ? "Loading inventory..." : "No inventory products yet."}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <label className="file-upload inventory-bulk-upload">
          <FileJson size={18} />
          <span>{uploadMutation.isPending ? "Uploading inventory..." : "Bulk upload CSV or JSON"}</span>
          <input
            type="file"
            accept=".csv,.json,text/csv,application/json"
            disabled={uploadMutation.isPending}
            onChange={handleInventoryUpload}
          />
        </label>
        {draftError ? <ErrorNotice message={draftError} /> : null}
        {uploadMutation.error ? <ErrorNotice message={uploadMutation.error.message} /> : null}
        {addMutation.error ? <ErrorNotice message={addMutation.error.message} /> : null}
        {updateMutation.error ? <ErrorNotice message={updateMutation.error.message} /> : null}
        {deleteMutation.error ? <ErrorNotice message={deleteMutation.error.message} /> : null}
        {uploadMutation.isSuccess ? <p className="branding-saved-notice">Inventory uploaded to SQLite.</p> : null}
      </section>
      ) : null}

      {activeSubTab === "sales" ? (
        <section
          className="orders-section inventory-sales-captures"
          aria-labelledby="inventory-sales-captures-heading"
          id="inventory-panel-sales"
          role="tabpanel"
        >
          <div className="panel-heading">
            <div>
              <p className="section-label">sales captures</p>
              <h2 id="inventory-sales-captures-heading">Captured order sales</h2>
            </div>
            <span className="count-pill">
              {periodSummary.count} in {periodLabel}
            </span>
          </div>
          <OrderTable
            orders={periodSummary.orders}
            emptyMessage={`No paid sales captured in the past ${periodLabel}.`}
          />
        </section>
      ) : null}

      {activeSubTab === "analytics" ? (
        <div
          className="data-grid inventory-analytics-grid"
          id="inventory-panel-analytics"
          role="tabpanel"
          aria-labelledby="inventory-tab-analytics"
        >
          <section className="panel info-panel" aria-labelledby="sales-by-year-heading">
            <div className="panel-heading">
              <div>
                <p className="section-label">capture years</p>
                <h2 id="sales-by-year-heading">Sales by year</h2>
              </div>
            </div>
            <ul className="info-list sales-date-list sales-year-list">
              {salesByYear.length ? (
                salesByYear.map((year) => (
                  <li key={year.yearKey}>
                    <button
                      className={`sales-year-button${selectedYear === year.yearKey ? " is-active" : ""}`}
                      type="button"
                      onClick={() =>
                        setSelectedYear((current) => (current === year.yearKey ? null : year.yearKey))
                      }
                      aria-pressed={selectedYear === year.yearKey}
                    >
                      <span>
                        <strong>{year.label}</strong>
                        <small>
                          {year.orderCount} paid {year.orderCount === 1 ? "order" : "orders"} · {year.unitsSold} units
                        </small>
                      </span>
                      <b>{formatAmount(year.sales, "SGD")}</b>
                    </button>
                  </li>
                ))
              ) : (
                <li>No paid sales captured yet.</li>
              )}
            </ul>
            {selectedYear ? (
              <p className="panel-copy sales-year-filter-note">
                Showing {selectedYear} within the past {periodLabel}. Tap the year again to clear.
              </p>
            ) : null}
          </section>

          <section className="panel info-panel" aria-labelledby="sales-by-date-heading">
            <div className="panel-heading">
              <div>
                <p className="section-label">capture dates</p>
                <h2 id="sales-by-date-heading">Sales by date</h2>
              </div>
            </div>
            <ul className="info-list sales-date-list">
              {salesByDate.length ? (
                salesByDate.map((day) => (
                  <li key={day.dateKey}>
                    <span>
                      <strong>{day.label}</strong>
                      <small>
                        {day.orderCount} paid {day.orderCount === 1 ? "order" : "orders"} · {day.unitsSold} units
                      </small>
                    </span>
                    <b>{formatAmount(day.sales, "SGD")}</b>
                  </li>
                ))
              ) : (
                <li>No paid sales captured yet.</li>
              )}
            </ul>
          </section>

          <section className="panel info-panel" aria-labelledby="inventory-sales-heading">
        <div className="panel-heading">
          <div>
            <p className="section-label">product mix</p>
            <h2 id="inventory-sales-heading">Top selling items</h2>
          </div>
        </div>
        <ul className="info-list inventory-list">
          {inventory.topProducts.length ? (
            inventory.topProducts.map((product) => (
              <li key={product.name}>
                <strong>{product.name}</strong>
                <span>
                  {product.quantity} units across {product.orderCount} orders
                </span>
              </li>
            ))
          ) : (
            <li>No product sales yet.</li>
          )}
        </ul>
      </section>

          <section className="panel info-panel" aria-labelledby="inventory-status-heading">
        <div className="panel-heading">
          <div>
            <p className="section-label">payment collection</p>
            <h2 id="inventory-status-heading">PayNow and bank transfer only</h2>
          </div>
        </div>
        <ul className="info-list">
          <li>Only paid orders are counted as sales captures.</li>
          <li>Accepted payment evidence: PayNow receipt or bank transfer.</li>
          <li>{scopedPaidOrders.length} paid captures in the past {periodLabel}.</li>
        </ul>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function QuickReviewPanel({ orders, metrics }: { orders: ProcessedOrder[]; metrics: ReturnType<typeof buildMetrics> }) {
  return (
    <section className="panel info-panel" aria-labelledby="review-heading">
      <div className="panel-heading">
        <div>
          <p className="section-label">follow up</p>
          <h2 id="review-heading">Evidence follow-up</h2>
        </div>
        <CircleDollarSign size={20} className="accent-icon" />
      </div>
      <ul className="info-list">
        <li>Missing PayNow or bank-transfer proof stays out of sales captures.</li>
        <li>{metrics.review} input needs manual review.</li>
        <li>Latest paid capture: {orders.find(isPaidOrder)?.order_summary ?? "No paid captures yet"}.</li>
      </ul>
    </section>
  );
}

function WorkflowSummary({ generatedWorkflow }: { generatedWorkflow: WorkflowGeneration | null }) {
  const workflow = generatedWorkflow?.workflow;
  return (
    <div className="workflow-output">
      <div>
        <span className="muted-label">Draft flow</span>
        <strong>{workflow?.name ?? "Default Order Flow"}</strong>
      </div>
      <div>
        <span className="muted-label">States</span>
        <strong>{workflow ? Object.keys(workflow.states).length : 8}</strong>
      </div>
      <div>
        <span className="muted-label">Decision nodes</span>
        <strong>{workflow ? countDecisionStates(workflow.states) : 3}</strong>
      </div>
      <div>
        <span className="muted-label">Rules</span>
        <strong>{workflow ? countWorkflowRules(workflow.states) : 5}</strong>
      </div>
      <div>
        <span className="muted-label">Builder</span>
        <strong>{formatGenerationMode(generatedWorkflow?.generation_mode)}</strong>
      </div>
      <div>
        <span className="muted-label">Runtime</span>
        <strong>Deterministic</strong>
      </div>
    </div>
  );
}

function DecisionTreePreview({ generatedWorkflow }: { generatedWorkflow: WorkflowGeneration | null }) {
  if (!generatedWorkflow) {
    return (
      <div className="decision-tree-empty">
        <GitBranch size={18} />
        <p>Generate workflow JSON to preview the decision tree branches here.</p>
      </div>
    );
  }

  const workflow = generatedWorkflow.workflow;
  const stateEntries = Object.entries(workflow.states);
  const explanations = new Map(generatedWorkflow.rule_explanations.map((item) => [item.rule_id, item.explanation]));
  const reachableStateIds = collectReachableWorkflowStateIds(workflow);
  const detachedStateEntries = stateEntries.filter(([stateId]) => !reachableStateIds.has(stateId));

  return (
    <div className="decision-tree-preview" aria-label="Generated decision tree preview">
      <div className="decision-tree-heading">
        <span className="muted-label">Decision tree</span>
        <strong>Start: {workflow.start}</strong>
      </div>

      <WorkflowDiagram workflow={workflow} explanations={explanations} />

      {detachedStateEntries.length ? (
        <div className="workflow-detached-states">
          <span className="muted-label">Detached states</span>
          <div>
            {detachedStateEntries.map(([stateId, state]) => (
              <WorkflowDiagramNode isDetached isStart={false} key={stateId} state={state} stateId={stateId} />
            ))}
          </div>
        </div>
      ) : null}

    </div>
  );
}

function WorkflowDiagram({
  workflow,
  explanations
}: {
  workflow: WorkflowGeneration["workflow"];
  explanations: Map<string, string>;
}) {
  const diagram = buildWorkflowDiagramLayout(workflow, explanations);

  return (
    <div className="workflow-tree" aria-label="Top to bottom workflow tree">
      <div className="workflow-diagram" style={{ height: diagram.height, width: diagram.width }}>
        <svg
          aria-hidden="true"
          className="workflow-diagram-lines"
          height={diagram.height}
          viewBox={`0 0 ${diagram.width} ${diagram.height}`}
          width={diagram.width}
        >
          <defs>
            <marker
              id="workflow-arrow"
              markerHeight="8"
              markerWidth="8"
              orient="auto"
              refX="7"
              refY="4"
              viewBox="0 0 8 8"
            >
              <path d="M0,0 L8,4 L0,8 Z" />
            </marker>
          </defs>
          {diagram.edges.map((edge) => (
            <path
              className={`workflow-diagram-line is-${edge.type}`}
              d={edge.path}
              key={edge.id}
              markerEnd="url(#workflow-arrow)"
            />
          ))}
        </svg>

        {diagram.edges.map((edge) => (
          <span
            className={`workflow-diagram-edge-label is-${edge.type}`}
            key={`${edge.id}-label`}
            style={{ left: edge.labelX, top: edge.labelY }}
            title={`${edge.label}: ${edge.description}. Routes to ${edge.to}`}
          >
            {edge.displayLabel}
          </span>
        ))}

        {diagram.nodes.map((node) => (
          <WorkflowDiagramNode
            isMissing={node.isMissing}
            isStart={node.isStart}
            key={node.key}
            state={node.state}
            stateId={node.stateId}
            style={{
              height: node.height,
              left: node.x,
              top: node.y,
              width: node.width
            }}
          />
        ))}
      </div>
    </div>
  );
}

function WorkflowDiagramNode({
  stateId,
  state,
  isStart,
  isMissing = false,
  isDetached = false,
  style
}: {
  stateId: string;
  state?: WorkflowState;
  isStart: boolean;
  isMissing?: boolean;
  isDetached?: boolean;
  style?: React.CSSProperties;
}) {
  const decisionState = state && isDecisionState(state) ? state : null;
  const actionState = state && !isDecisionState(state) ? state : null;
  const branchCount = decisionState ? decisionState.rules.length + 1 : 0;

  return (
    <article
      className={`workflow-diagram-node is-${state?.type ?? "missing"}${isStart ? " is-start" : ""}${
        isMissing ? " is-missing" : ""
      }${isDetached ? " is-detached" : ""}`}
      style={style}
    >
      <div className="workflow-diagram-node-header">
        <span className="workflow-diagram-node-icon">
          {isMissing ? (
            <AlertCircle size={15} />
          ) : decisionState ? (
            <GitBranch size={15} />
          ) : (
            <CheckCircle2 size={15} />
          )}
        </span>
        <div>
          <span>{isMissing ? "Missing" : isStart ? "Root decision" : state?.type}</span>
          <strong>{stateId}</strong>
        </div>
      </div>
      <p>
        {isMissing
          ? "Referenced but not defined"
          : decisionState
            ? `${branchCount} outgoing ${branchCount === 1 ? "branch" : "branches"}`
            : actionState
              ? formatActionDetails(actionState)
              : ""}
      </p>
    </article>
  );
}

type WorkflowTreeEdge = {
  id: string;
  type: "rule" | "else";
  label: string;
  description: string;
  explanation?: string;
  to: string;
};

type WorkflowDiagramTreeNode = {
  key: string;
  stateId: string;
  state?: WorkflowState;
  incomingEdge?: WorkflowTreeEdge;
  children: WorkflowDiagramTreeNode[];
  depth: number;
  height: number;
  isMissing: boolean;
  isStart: boolean;
  subtreeWidth: number;
  width: number;
  x: number;
  y: number;
};

function buildWorkflowDiagramLayout(
  workflow: WorkflowGeneration["workflow"],
  explanations: Map<string, string>
) {
  const nodeWidth = 226;
  const nodeHeight = 98;
  const columnGap = 42;
  const rowGap = 94;
  const paddingX = 36;
  const paddingY = 18;
  const maxDepth = 9;

  function buildNode(
    stateId: string,
    depth: number,
    path: string[],
    incomingEdge?: WorkflowTreeEdge
  ): WorkflowDiagramTreeNode {
    const state = workflow.states[stateId];
    const isCycle = path.includes(stateId);
    const key = `${path.join(">") || "root"}>${incomingEdge?.id ?? "start"}>${stateId}`;
    const node: WorkflowDiagramTreeNode = {
      key,
      stateId,
      state,
      incomingEdge,
      children: [],
      depth,
      height: nodeHeight,
      isMissing: !state,
      isStart: depth === 0,
      subtreeWidth: nodeWidth,
      width: nodeWidth,
      x: 0,
      y: 0
    };

    if (state && isDecisionState(state) && !isCycle && depth < maxDepth) {
      node.children = getWorkflowTreeEdges(state, explanations).map((edge) =>
        buildNode(edge.to, depth + 1, [...path, stateId], edge)
      );
    }

    return node;
  }

  function measureNode(node: WorkflowDiagramTreeNode): number {
    if (!node.children.length) {
      node.subtreeWidth = nodeWidth;
      return node.subtreeWidth;
    }

    const childrenWidth =
      node.children.reduce((total, child) => total + measureNode(child), 0) +
      Math.max(0, node.children.length - 1) * columnGap;
    node.subtreeWidth = Math.max(nodeWidth, childrenWidth);
    return node.subtreeWidth;
  }

  function placeNode(node: WorkflowDiagramTreeNode, left: number) {
    node.x = Math.round(left + node.subtreeWidth / 2 - nodeWidth / 2);
    node.y = Math.round(paddingY + node.depth * (nodeHeight + rowGap));

    if (!node.children.length) {
      return;
    }

    const childrenWidth =
      node.children.reduce((total, child) => total + child.subtreeWidth, 0) +
      Math.max(0, node.children.length - 1) * columnGap;
    let childLeft = left + Math.max(0, (node.subtreeWidth - childrenWidth) / 2);

    node.children.forEach((child) => {
      placeNode(child, childLeft);
      childLeft += child.subtreeWidth + columnGap;
    });
  }

  function flattenNode(node: WorkflowDiagramTreeNode, nodes: WorkflowDiagramTreeNode[]) {
    nodes.push(node);
    node.children.forEach((child) => flattenNode(child, nodes));
  }

  const root = buildNode(workflow.start, 0, []);
  measureNode(root);
  placeNode(root, paddingX);

  const nodes: WorkflowDiagramTreeNode[] = [];
  flattenNode(root, nodes);

  const edges = nodes.flatMap((node) =>
    node.children.map((child) => {
      const edge = child.incomingEdge as WorkflowTreeEdge;
      const fromX = node.x + nodeWidth / 2;
      const fromY = node.y + nodeHeight;
      const toX = child.x + nodeWidth / 2;
      const toY = child.y;
      const midY = fromY + Math.min(46, Math.max(30, (toY - fromY) * 0.42));

      return {
        id: `${node.key}-${edge.id}-${child.key}`,
        type: edge.type,
        label: edge.label,
        displayLabel: formatCompactWorkflowEdgeLabel(edge),
        description: edge.description,
        to: edge.to,
        labelX: Math.round(toX),
        labelY: Math.round(midY),
        path: `M ${fromX} ${fromY} V ${midY} H ${toX} V ${toY - 8}`
      };
    })
  );
  const width = Math.max(720, Math.ceil(root.subtreeWidth + paddingX * 2));
  const deepestLevel = nodes.reduce((deepest, node) => Math.max(deepest, node.depth), 0);
  const height = paddingY * 2 + (deepestLevel + 1) * nodeHeight + deepestLevel * rowGap;

  return { edges, height, nodes, width };
}

function formatCompactWorkflowEdgeLabel(edge: WorkflowTreeEdge) {
  if (edge.type === "else") {
    return "else";
  }

  const label = formatWorkflowToken(edge.label);
  return label.length > 24 ? `${label.slice(0, 21).trim()}...` : label;
}

function MetricCard({
  icon,
  label,
  value,
  title,
  tone
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  title?: string;
  tone: string;
}) {
  return (
    <article className={`metric-card tone-${tone}`} title={title}>
      <div className="metric-icon">{icon}</div>
      <div className="metric-copy">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function isDecisionState(state: WorkflowState): state is WorkflowDecisionState {
  return state.type === "decision";
}

function formatActionDetails(state: WorkflowActionState) {
  if (state.action === "create_order") {
    return `Create ${state.payment_status ?? "paid"} sales capture`;
  }

  if (state.action === "update_payment_status") {
    return `Update payment evidence to ${state.payment_status ?? "paid"}`;
  }

  if (state.action === "ask_follow_up") {
    return `Ask for ${(state.required_fields ?? ["missing detail"]).join(", ")}`;
  }

  return state.message ?? "Route to review";
}

function getWorkflowTreeEdges(state: WorkflowState, explanations: Map<string, string>): WorkflowTreeEdge[] {
  if (!isDecisionState(state)) {
    return [];
  }

  return [
    ...state.rules.map((rule) => ({
      id: rule.id,
      type: "rule" as const,
      label: rule.id,
      description: describeWorkflowCondition(rule.if),
      explanation: explanations.get(rule.id),
      to: rule.then
    })),
    {
      id: "else",
      type: "else" as const,
      label: "else",
      description: "No rule matched",
      explanation: undefined,
      to: state.else
    }
  ];
}

function collectReachableWorkflowStateIds(workflow: WorkflowGeneration["workflow"]) {
  const reachable = new Set<string>();
  const queue = [workflow.start];

  while (queue.length) {
    const stateId = queue.shift() as string;

    if (reachable.has(stateId)) {
      continue;
    }

    reachable.add(stateId);
    const state = workflow.states[stateId];

    if (state && isDecisionState(state)) {
      queue.push(...state.rules.map((rule) => rule.then), state.else);
    }
  }

  return reachable;
}

function countDecisionStates(states: Record<string, WorkflowState>) {
  return Object.values(states).filter(isDecisionState).length;
}

function countWorkflowRules(states: Record<string, WorkflowState>) {
  return Object.values(states).reduce((total, state) => total + (isDecisionState(state) ? state.rules.length : 0), 0);
}

function formatGenerationMode(mode?: WorkflowGeneration["generation_mode"]) {
  if (mode === "openai") {
    return "Rule draft";
  }

  if (mode === "local_template") {
    return "Deterministic";
  }

  if (mode === "local_refine") {
    return "Deterministic edit";
  }

  return "Deterministic";
}

function formatWorkflowRunStatus(status: ProcessResult["status"]) {
  if (status === "created") {
    return "Paid order captured";
  }

  if (status === "updated") {
    return "Payment status updated";
  }

  if (status === "follow_up") {
    return "Follow-up needed";
  }

  return "Needs review";
}

function formatWorkflowToken(value: string) {
  return value.replace(/_/g, " ");
}

function describeWorkflowCondition(condition: WorkflowCondition) {
  const parts: string[] = [];

  if (condition.containsAny?.length) {
    parts.push(`any: ${condition.containsAny.join(", ")}`);
  }

  if (condition.containsAll?.length) {
    parts.push(`all: ${condition.containsAll.join(", ")}`);
  }

  if (condition.matchesRegex) {
    parts.push(`regex: ${condition.matchesRegex}`);
  }

  if (typeof condition.amountDetected === "boolean") {
    parts.push(condition.amountDetected ? "amount detected" : "no amount detected");
  }

  return parts.join(" + ") || "always";
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

function OrderTable({
  orders,
  emptyMessage = "No orders yet.",
  showStatus = false,
  completingOrderId = null,
  onCompleteOrder
}: {
  orders: ProcessedOrder[];
  emptyMessage?: string;
  showStatus?: boolean;
  completingOrderId?: string | null;
  onCompleteOrder?: (orderId: string) => void;
}) {
  const columnCount = showStatus ? (onCompleteOrder ? 8 : 7) : 6;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Captured</th>
            <th>Order</th>
            <th>Customer</th>
            <th>Amount</th>
            {showStatus ? <th>Status</th> : null}
            {onCompleteOrder ? <th>Fulfillment</th> : null}
            <th>Payment evidence</th>
          </tr>
        </thead>
        <tbody>
          {orders.length ? (
            orders.map((order, index) => (
              <tr key={order.id ?? `${order.source_input}-${index}`}>
                <td data-label="Order ID">
                  <code className="order-id-code">{formatOrderId(order)}</code>
                </td>
                <td data-label="Captured">
                  <strong>{formatCaptureDate(order.created_at)}</strong>
                  <span>{formatCaptureTime(order.created_at)}</span>
                </td>
                <td data-label="Order">
                  <strong>{order.order_summary}</strong>
                  <span>{sumOrderQuantity(order)} item batch</span>
                  <OrderPdfButton order={order} compact />
                </td>
                <td data-label="Customer">{order.customer_name ?? order.customer_handle ?? "Manual entry"}</td>
                <td data-label="Amount">{formatAmount(order.total_amount, order.currency)}</td>
                {showStatus ? (
                  <td data-label="Status">
                    <StatusPill status={order.payment_status} />
                  </td>
                ) : null}
                {onCompleteOrder ? (
                  <td data-label="Fulfillment">
                    {isActiveOrder(order) && order.id ? (
                      <button
                        className="secondary-button order-complete-button"
                        type="button"
                        disabled={completingOrderId === order.id}
                        onClick={() => onCompleteOrder(order.id!)}
                      >
                        {completingOrderId === order.id ? (
                          <Loader2 className="spin" size={14} />
                        ) : (
                          <CheckCircle2 size={14} />
                        )}
                        Mark complete
                      </button>
                    ) : (
                      <FulfillmentPill status="completed" />
                    )}
                  </td>
                ) : null}
                <td data-label="Payment evidence" className="evidence-cell">
                  <PaymentEvidenceDisplay evidence={order.evidence} />
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columnCount}>{emptyMessage}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

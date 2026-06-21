import * as React from "react";
import { StrictMode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider, type UseMutationResult, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  FileJson,
  GitBranch,
  Globe2,
  KeyRound,
  Layers3,
  Loader2,
  LogOut,
  MessageSquareText,
  Package2,
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
import { generatePayNowQrDataUrl } from "./paynow-qr";
import "./styles.css";

type PaymentStatus = "paid" | "partial" | "unpaid" | "unknown";
type FulfillmentStatus = "active" | "completed";
type CustomerOrdersTab = "current" | "history";

type ProcessedOrder = {
  id?: string;
  customer_name: string | null;
  customer_handle: string | null;
  source_channel: string;
  source_input: string;
  order_summary: string;
  payment_status: PaymentStatus;
  fulfillment_status?: FulfillmentStatus;
  total_amount: number | null;
  currency: string;
  items: Array<{
    item_name: string;
    quantity: number;
    unit_price: number | null;
    notes: string | null;
  }>;
  evidence: string;
  created_at: string;
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
  required_fields?: string[];
};

type WorkflowCondition = {
  containsAny?: string[];
  containsAll?: string[];
  matchesRegex?: string;
  amountDetected?: boolean;
};
type WorkflowRule = {
  id: string;
  if: WorkflowCondition;
  then: string;
};
type WorkflowDecisionState = {
  type: "decision";
  rules: WorkflowRule[];
  else: string;
};
type WorkflowActionState = {
  type: "action";
  action: "create_order" | "update_payment_status" | "needs_review" | "ask_follow_up";
  payment_status?: PaymentStatus;
  message?: string;
  required_fields?: string[];
};
type WorkflowState = WorkflowDecisionState | WorkflowActionState;

type WorkflowGeneration = {
  generation_mode?: "local_template" | "local_refine" | "openai";
  status: string;
  workflow: {
    id: string;
    name: string;
    version: number;
    start: string;
    states: Record<string, WorkflowState>;
  };
  test_inputs: string[];
  rule_explanations: Array<{ rule_id: string; explanation: string }>;
};
type WorkflowGenerateInput = {
  businessDescription?: string;
  changeRequest?: string;
  existingWorkflow?: WorkflowGeneration["workflow"] | null;
};
type WorkflowSetupStepId = "products";
type WorkflowSetupAnswers = Record<WorkflowSetupStepId, string>;
type WorkflowChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  createdAt: string;
  status?: "ok" | "error";
};

type AuthRole = "user" | "admin";
type AppRoute = "intro" | "login" | AuthRole | "tech-stack";
type AuthMode = "sign-in" | "sign-up";
type AdminTab = "orders" | "rules" | "inventory" | "branding";
type WorkflowBuilderTab = "rules" | "draft" | "test";
type CapturePeriodDays = 1 | 3 | 7 | 30 | 90 | 365;
type InventorySubTab = "inventory" | "sales" | "analytics";
type UserTab = "menu" | "my-orders" | "profile";
type OrderFlowTab = "menu" | "checkout";
type UserProfile = {
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  contact: string;
  display_name: string;
  can_change_password: boolean;
  is_demo_account?: boolean;
};
type AuthCredential = {
  username: string;
  pin: string;
};
type AuthState = Record<AuthRole, AuthCredential | null>;
type ShopBranding = {
  business_name: string;
  mark_letter: string;
  tagline: string;
  description: string;
  payment_instructions: string;
  paynow_number: string;
  paynow_qr_image: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  footer_note: string;
};
type CustomerMenuSnapshot = {
  products: InventoryProduct[];
  payment_methods: string[];
};
type PlaceOrderResult = {
  order_id: string;
  order: ProcessedOrder;
  workflow: {
    status: string;
    message: string;
    explanation: string;
  };
};
type CartLine = {
  product: InventoryProduct;
  quantity: number;
};
type InventoryProduct = {
  id?: string;
  name: string;
  category: string;
  unit_price: number | null;
  is_active: boolean;
  updated_at?: string;
};
type InventoryProductInput = {
  name?: unknown;
  category?: unknown;
  unit_price?: unknown;
  is_active?: unknown;
};
type InventoryProductDraft = {
  name: string;
  category: string;
  unit_price: string;
  is_active: boolean;
};
type InventorySnapshot = {
  products: InventoryProduct[];
  orders: ProcessedOrder[];
};
type AuthAccess = {
  role: AuthRole;
  credential: AuthCredential;
};
type TechStackStatus = "Live" | "Target" | "Later";
type TechStackItem = {
  icon: React.ReactNode;
  label: string;
  choice: string;
  detail: string;
  status: TechStackStatus;
};
type TechStackSection = {
  title: string;
  description: string;
  items: TechStackItem[];
};

const queryClient = new QueryClient();
const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

const sampleMessages = [
  "Hi I want 12 egg tarts and 2 bandung, paid by PayNow",
  "Can I reserve 6 egg tarts and 1 lemonade tomorrow? bank transfer done",
  "Customer sent PayNow receipt for 2 lemonades and 4 egg tarts",
  "Is the shop open today?"
];

const workflowChatStorageKey = "zorder:workflow-builder:chat:v4";
const workflowDraftStorageKey = "zorder:workflow-builder:draft:v1";
const workflowSetupSteps: Array<{
  id: WorkflowSetupStepId;
  title: string;
  question: string;
  placeholder: string;
  suggestions: string[];
}> = [
  {
    id: "products",
    title: "Products",
    question: "What does the seller sell? List only the products or categories that can appear in customer messages.",
    placeholder: "Example: egg tarts, bandung, lemonade",
    suggestions: [
      "egg tarts, bandung, lemonade",
      "cakes, brownies, cookies",
      "kopi, teh, kaya toast"
    ]
  }
];
const workflowBuildProgressSteps = [
  {
    title: "Reading business context",
    detail: "Products plus the fixed paid-with-proof capture rule."
  },
  {
    title: "Drafting decision states",
    detail: "Payment evidence, order content, and follow-up branches."
  },
  {
    title: "Checking deterministic paths",
    detail: "Validating state links, actions, and missing-payment routing."
  },
  {
    title: "Preparing live draft",
    detail: "Summarizing rules, branch paths, and the workflow preview."
  }
];

const routeHeadings: Record<AuthRole, string> = {
  user: "What would you like to order today?",
  admin: "Business operations admin"
};

const defaultShopBranding: ShopBranding = {
  business_name: "zorder",
  mark_letter: "Z",
  tagline: "What would you like to order today?",
  description: "Browse the menu, place your order, and pay by PayNow or bank transfer.",
  payment_instructions:
    "Pay by PayNow or bank transfer. After paying, paste your reference number or receipt note when you place the order.",
  paynow_number: "9123 4567",
  paynow_qr_image: "",
  bank_name: "DBS Bank",
  bank_account_name: "Zorder Dessert Stall",
  bank_account_number: "001-234567-8",
  footer_note: ""
};

const techStackHighlights = [
  "Web-first MVP before Telegram automation.",
  "Deterministic JSON workflows for daily order processing.",
  "AI is setup assistance only, not the runtime engine.",
  "Zo is the demo host, data home, and future automation runtime."
];

const techArchitectureSteps = [
  "Vite React web app",
  "URL routes",
  "TanStack Query",
  "API server",
  "Zod validation",
  "JSON workflow runner",
  "SQLite + workflow files"
];

const techSourceDocs = ["docs/tech-stack.md", "docs/ZO_INFRA.md", "docs/USER_JOURNEY.md", "docs/workflow-schema.md"];

const techStackSections: TechStackSection[] = [
  {
    title: "MVP Code Path",
    description: "What the current prototype depends on while keeping the docs' target architecture visible.",
    items: [
      {
        icon: <Code2 size={20} />,
        label: "Frontend",
        choice: "Vite + React + TypeScript",
        detail: "Fast SPA for the owner dashboard, admin workspace, intro, and public stack notes.",
        status: "Live"
      },
      {
        icon: <Route size={20} />,
        label: "Routing",
        choice: "Pathname routes, TanStack Router target",
        detail: "Docs choose TanStack Router for type-safe routing; the MVP currently uses a small URL router.",
        status: "Target"
      },
      {
        icon: <GitBranch size={20} />,
        label: "Server state",
        choice: "TanStack Query",
        detail: "Order processing and workflow generation run as mutations with loading and error states.",
        status: "Live"
      },
      {
        icon: <Server size={20} />,
        label: "API runtime",
        choice: "Express now, Hono target",
        detail: "The backend exposes auth, workflow, agent, and order APIs; docs keep Hono as the lightweight target.",
        status: "Live"
      }
    ]
  },
  {
    title: "Deterministic Operations",
    description: "The product promise is a cheap, predictable order system instead of a generic AI chatbot.",
    items: [
      {
        icon: <FileJson size={20} />,
        label: "Workflow engine",
        choice: "Deterministic JSON decision tree",
        detail: "Rules match messy order text, return a trace, and explain why an input matched.",
        status: "Live"
      },
      {
        icon: <ShieldCheck size={20} />,
        label: "Validation and auth",
        choice: "Zod + role PIN credentials",
        detail: "MVP guards /user and /admin with demo credentials and validates API payloads.",
        status: "Live"
      },
      {
        icon: <Database size={20} />,
        label: "Data",
        choice: "SQLite now, Drizzle target",
        detail: "Orders and uploaded inventory are stored locally in SQLite, with Postgres reserved for scale.",
        status: "Live"
      },
      {
        icon: <Bot size={20} />,
        label: "AI assistance",
        choice: "Setup-only workflow generator",
        detail: "AI can draft workflow JSON from seller notes, but daily processing stays deterministic.",
        status: "Live"
      }
    ]
  },
  {
    title: "Zo And Expansion Path",
    description: "The architecture notes position Zo as part of the product story, not only a deployment checkbox.",
    items: [
      {
        icon: <Cloud size={20} />,
        label: "Hosting",
        choice: "Zo Computer first",
        detail: "Use Zo as the public demo host and the always-on place for the app runtime.",
        status: "Target"
      },
      {
        icon: <Layers3 size={20} />,
        label: "Owner data home",
        choice: "Zo workspace files + SQLite",
        detail: "Orders, workflow JSON, and demo data should live in the owner's Zo environment.",
        status: "Target"
      },
      {
        icon: <Globe2 size={20} />,
        label: "Telegram",
        choice: "Future webhook input",
        detail: "Telegram should become another source channel that reuses the same workflow runner.",
        status: "Later"
      },
      {
        icon: <Cpu size={20} />,
        label: "Future data",
        choice: "Postgres after MVP",
        detail: "Move beyond SQLite only when multi-user persistence or production hosting requires it.",
        status: "Later"
      }
    ]
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
  const [activeRoute, setActiveRoute] = useStateValue<AppRoute>(getInitialRoute());
  const [loginMode, setLoginMode] = useStateValue<AuthMode>(getAuthModeFromUrl());
  const [auth, setAuth] = useState<AuthState>(loadAuthState);
  const [businessDescription, setBusinessDescription] = useStateValue(
    "Small Singapore dessert stall selling egg tarts and sweet drinks. Drinks are usually bandung or lemonade. Customers pay only by PayNow or bank transfer."
  );
  const [generatedWorkflow, setGeneratedWorkflow] = useState<WorkflowGeneration | null>(loadGeneratedWorkflowDraft);
  const queryClient = useQueryClient();
  const orderAccess = getOrderAccess(auth);
  const ordersQuery = useQuery({
    queryKey: ["orders", orderAccess?.role, orderAccess?.credential.username],
    enabled: Boolean(orderAccess),
    queryFn: () => fetchOrders(orderAccess as AuthAccess)
  });
  const orders = ordersQuery.data ?? [];

  const generateMutation = useMutation({
    mutationFn: async ({
      businessDescription: requestedBusinessDescription,
      changeRequest = "",
      existingWorkflow = null
    }: WorkflowGenerateInput = {}) => {
      const credential = auth.admin;
      if (!credential) {
        throw new Error("Sign in to the admin workspace first.");
      }

      const requestBody = {
        business_description: requestedBusinessDescription ?? businessDescription,
        change_request: changeRequest,
        common_order_messages: sampleMessages.slice(0, 3),
        ...(existingWorkflow ? { existing_workflow: existingWorkflow } : {}),
        paid_phrases: [
          "payment proof uploaded",
          "payment screenshot uploaded",
          "uploaded screenshot",
          "receipt uploaded",
          "paynow receipt",
          "bank transfer receipt",
          "paid"
        ],
        pay_later_phrases: [],
        required_fields: ["payment_evidence"],
        workflow_id: "seller-rule-flow",
        workflow_name: "Seller Rule Flow",
        save: false
      };

      const response = await fetch(`${apiBase}/workflows/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders("admin", credential)
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      return (await response.json()) as WorkflowGeneration;
    },
    onSuccess: setGeneratedWorkflow
  });

  useEffect(() => {
    saveGeneratedWorkflowDraft(generatedWorkflow);
  }, [generatedWorkflow]);

  const metrics = buildMetrics(orders);
  const shopConfigQuery = useQuery({
    queryKey: ["shop-config"],
    queryFn: fetchShopConfig
  });
  const shopBranding = shopConfigQuery.data ?? defaultShopBranding;
  const profileQuery = useQuery({
    queryKey: ["user-profile", auth.user?.username],
    enabled: activeRoute === "user" && Boolean(auth.user),
    queryFn: () => fetchUserProfile(auth.user as AuthCredential)
  });
  const customerDisplayName =
    profileQuery.data?.display_name ||
    formatUsernameLabel(auth.user?.username ?? "there");

  useEffect(() => {
    const handlePopState = () => {
      setActiveRoute(getInitialRoute());
      setLoginMode(getAuthModeFromUrl());
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [setActiveRoute, setLoginMode]);

  useLayoutEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith("/user/login")) {
      window.history.replaceState({}, "", "/login");
      setActiveRoute("login");
      return;
    }

    if (activeRoute === "login") {
      if (auth.user) {
        window.history.replaceState({}, "", "/user");
        setActiveRoute("user");
      } else if (auth.admin) {
        window.history.replaceState({}, "", "/admin");
        setActiveRoute("admin");
      }
      return;
    }

    if (activeRoute === "admin" && !auth.admin) {
      window.history.replaceState({}, "", "/login");
      setActiveRoute("login");
    }
  }, [activeRoute, auth.admin, auth.user, setActiveRoute]);

  function navigateToRoute(route: AppRoute) {
    window.history.pushState({}, "", routePath(route));
    setActiveRoute(route);
  }

  function navigateToLogin(mode: AuthMode = "sign-in") {
    setLoginMode(mode);
    window.history.pushState({}, "", mode === "sign-up" ? "/login?mode=sign-up" : "/login");
    setActiveRoute("login");
  }

  function authenticate(role: AuthRole, credential: AuthCredential) {
    localStorage.setItem(authStorageKey(role), JSON.stringify(credential));
    setAuth((current) => ({ ...current, [role]: credential }));
    navigateToRoute(role);
  }

  function signOut(role: AuthRole) {
    localStorage.removeItem(authStorageKey(role));
    setAuth((current) => ({ ...current, [role]: null }));
    navigateToRoute(role === "user" ? "user" : "login");
  }

  if (activeRoute === "intro") {
    return (
      <main className="app-shell is-signed-out">
        <section className="workspace is-signed-out is-docs-page">
          <PublicPageTopbar onNavigate={navigateToRoute} activeRoute="intro" showBack />
          <IntroView onNavigate={navigateToRoute} />
        </section>
      </main>
    );
  }

  if (activeRoute === "tech-stack") {
    return (
      <main className="app-shell is-authenticated is-docs-route">
        <section className="workspace is-authenticated tech-stack-workspace">
          <PublicPageTopbar onNavigate={navigateToRoute} activeRoute="tech-stack" showBack />
          <TechStackView onNavigate={navigateToRoute} />
        </section>
      </main>
    );
  }

  if (activeRoute === "login") {
    return (
      <main className="app-shell is-signed-out">
        <section className="workspace is-signed-out is-login-page">
          <LoginPage
            shopBranding={shopBranding}
            initialMode={loginMode}
            onAuthenticated={authenticate}
            onBack={() => navigateToRoute("user")}
          />
        </section>
      </main>
    );
  }

  if (activeRoute === "user" && !auth.user) {
    return (
      <main className="app-shell is-signed-out">
        <section className="workspace is-signed-out is-user-landing">
          <PublicPageTopbar onNavigate={navigateToRoute} />
          <UserShopLanding
            shopBranding={shopBranding}
            onSignIn={() => navigateToLogin("sign-in")}
            onSignUp={() => navigateToLogin("sign-up")}
          />
        </section>
      </main>
    );
  }

  if (activeRoute === "admin" && !auth.admin) {
    return null;
  }

  const activeHeading = routeHeadings[activeRoute as AuthRole];

  return (
    <main className="app-shell is-authenticated">
      <section className="workspace is-authenticated">
        <header className="topbar">
          <div>
            <p className="section-label">
              {activeRoute === "user" ? shopBranding.business_name : "zorder"} workspace
            </p>
            {activeRoute === "user" ? (
              <>
                <h1 className="customer-welcome-title">Welcome back, {customerDisplayName}</h1>
                <p className="customer-welcome-subtitle">{shopBranding.tagline}</p>
              </>
            ) : (
              <h1>{activeHeading}</h1>
            )}
          </div>
          <div className="topbar-actions">
            <button className="logout-button" type="button" onClick={() => signOut(activeRoute)}>
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </header>

        {activeRoute === "user" ? (
          <UserView
            shopBranding={shopBranding}
            userCredential={auth.user!}
            userProfile={profileQuery.data ?? null}
            orders={orders}
            onUserCredentialChange={(credential) =>
              setAuth((current) => ({ ...current, user: credential }))
            }
          />
        ) : null}

        {activeRoute === "admin" ? (
          <AdminView
            adminCredential={auth.admin!}
            businessDescription={businessDescription}
            setBusinessDescription={setBusinessDescription}
            generateMutation={generateMutation}
            generatedWorkflow={generatedWorkflow}
            orders={orders}
            metrics={metrics}
            shopBranding={shopBranding}
            onShopBrandingSaved={() => queryClient.invalidateQueries({ queryKey: ["shop-config"] })}
            onWorkflowDraftCleared={() => setGeneratedWorkflow(null)}
          />
        ) : null}
      </section>
    </main>
  );
}

function IntroView({ onNavigate }: { onNavigate: (route: AppRoute) => void }) {
  return (
    <div className="intro-page">
      <header className="intro-hero">
        <BrandMark businessName="zorder" markLetter="Z" onHomeClick={() => onNavigate("user")} />
        <p className="section-label">order tracking for home businesses</p>
        <h1 className="intro-headline">Turn messy customer notes into trackable orders.</h1>
        <p className="intro-lead">
          Home business owners juggle production, replies, and payment checks. zorder gives you one calm workspace to
          classify paid order notes, track sales captures by date, and see what needs review.
        </p>
        <div className="intro-actions">
          <button className="primary-button" type="button" onClick={() => onNavigate("user")}>
            <ClipboardList size={18} />
            Open user dashboard
            <ArrowRight size={16} />
          </button>
          <button className="secondary-button" type="button" onClick={() => onNavigate("admin")}>
            <Sparkles size={18} />
            Open admin dashboard
            <ArrowRight size={16} />
          </button>
        </div>
      </header>

      <div className="intro-grid">
        <section className="intro-card intro-problem" aria-labelledby="intro-problem-heading">
          <p className="section-label">the problem</p>
          <h2 id="intro-problem-heading">Orders arrive as messy messages</h2>
          <p>
            Customers send orders through chat, DMs, and informal notes. Details are mixed with small talk, payment
            proof is easy to miss, and follow-up lives in your head or scattered notes.
          </p>
          <ul className="intro-list">
            <li>Hard to tell paid captures from unclear notes at a glance</li>
            <li>Manual sorting slows down production and replies</li>
            <li>Full CRM tools add admin work you do not need</li>
          </ul>
        </section>

        <section className="intro-card intro-solution" aria-labelledby="intro-solution-heading">
          <p className="section-label">the solution</p>
          <h2 id="intro-solution-heading">One lightweight tracker for daily orders</h2>
          <p>
            Paste or enter a customer note, run it through your shop&apos;s rules, review the extracted order, and
            capture paid sales on a simple dashboard. Rules are deterministic JSON — same input, same result every
            time.
          </p>
          <ul className="intro-list">
            <li>Extract order summary, amount, and payment evidence</li>
            <li>Show why a rule matched before saving anything</li>
            <li>Route missing payment evidence into follow-up instead of sales</li>
          </ul>
        </section>
      </div>

      <section className="intro-steps" aria-labelledby="intro-steps-heading">
        <p className="section-label">how it works</p>
        <h2 id="intro-steps-heading">Three steps, no CRM overhead</h2>
        <ol className="intro-step-list">
          <li>
            <strong>Set up rules</strong>
            <span>Describe your shop and define how messy notes should be classified.</span>
          </li>
          <li>
            <strong>Process orders</strong>
            <span>Paste customer messages and confirm the structured preview.</span>
          </li>
          <li>
            <strong>Capture paid sales</strong>
            <span>See paid orders, capture dates, and review-needed inputs in one place.</span>
          </li>
        </ol>
      </section>

      <footer className="intro-footer">
        <p>
          AI can help draft workflow rules during setup. Daily order processing stays deterministic.{" "}
          <button className="text-link" type="button" onClick={() => onNavigate("tech-stack")}>
            View the tech stack
          </button>
        </p>
      </footer>
    </div>
  );
}

function TechStackView({ onNavigate }: { onNavigate: (route: AppRoute) => void }) {
  return (
    <div className="tech-stack-page">
      <header className="tech-hero">
        <div className="tech-hero-copy">
          <BrandMark businessName="zorder" markLetter="Z" onHomeClick={() => onNavigate("user")} />
          <p className="section-label">technical architecture</p>
          <h1 className="intro-headline">zorder tech stack</h1>
          <p className="intro-lead">
            A fast hackathon MVP for home businesses: enter messy order notes, classify them with deterministic JSON
            workflows, and persist orders and inventory in SQLite while keeping the path open for Zo hosting and later
            Telegram automation.
          </p>
          <div className="tech-actions">
            <button className="primary-button" type="button" onClick={() => onNavigate("user")}>
              <ClipboardList size={18} />
              Open user app
              <ArrowRight size={16} />
            </button>
            <button className="secondary-button" type="button" onClick={() => onNavigate("admin")}>
              <Sparkles size={18} />
              Open admin app
            </button>
          </div>
        </div>

        <aside className="tech-principles" aria-label="Architecture principles">
          {techStackHighlights.map((highlight) => (
            <div className="tech-principle" key={highlight}>
              <CheckCircle2 size={16} />
              <span>{highlight}</span>
            </div>
          ))}
        </aside>
      </header>

      <section className="tech-architecture" aria-labelledby="tech-architecture-heading">
        <div className="panel-heading">
          <div>
            <p className="section-label">runtime shape</p>
            <h2 id="tech-architecture-heading">MVP architecture flow</h2>
          </div>
          <Workflow size={20} className="accent-icon" />
        </div>
        <div className="arch-flow" aria-label="MVP architecture flow">
          {techArchitectureSteps.map((step, index) => (
            <React.Fragment key={step}>
              <span>{step}</span>
              {index < techArchitectureSteps.length - 1 ? <small aria-hidden="true">-&gt;</small> : null}
            </React.Fragment>
          ))}
        </div>
      </section>

      {techStackSections.map((section) => {
        const headingId = `${section.title.toLowerCase().replaceAll(" ", "-")}-heading`;

        return (
          <section className="stack-section" aria-labelledby={headingId} key={section.title}>
            <div className="stack-section-heading">
              <p className="section-label">stack decision</p>
              <h2 id={headingId}>{section.title}</h2>
              <p>{section.description}</p>
            </div>
            <div className="stack-grid">
              {section.items.map((item) => (
                <article className={`stack-card status-${item.status.toLowerCase()}`} key={`${section.title}-${item.label}`}>
                  <div className="stack-card-top">
                    <div className="stack-icon">{item.icon}</div>
                    <span>{item.status}</span>
                  </div>
                  <h3>{item.label}</h3>
                  <strong>{item.choice}</strong>
                  <p>{item.detail}</p>
                </article>
              ))}
            </div>
          </section>
        );
      })}

      <section className="tech-source-band" aria-labelledby="tech-source-heading">
        <div>
          <p className="section-label">source notes</p>
          <h2 id="tech-source-heading">Pulled from docs, with code reality called out</h2>
          <p>
            The page follows the product, journey, workflow, and Zo infra notes. Where the repo has not caught up yet,
            the card is marked Target or Later instead of implying it is already shipped.
          </p>
        </div>
        <div className="source-docs" aria-label="Referenced docs">
          {techSourceDocs.map((doc) => (
            <code key={doc}>{doc}</code>
          ))}
        </div>
      </section>
    </div>
  );
}

function BrandMark({
  businessName,
  markLetter,
  onHomeClick
}: {
  businessName: string;
  markLetter: string;
  onHomeClick?: () => void;
}) {
  const content = (
    <>
      <span className="brand-glyph" aria-hidden="true">
        {markLetter.charAt(0).toUpperCase()}
      </span>
      <span className="brand-name">{businessName}</span>
    </>
  );

  if (onHomeClick) {
    return (
      <button className="auth-brand brand-mark-button" type="button" onClick={onHomeClick}>
        {content}
      </button>
    );
  }

  return <div className="auth-brand">{content}</div>;
}

function PublicSiteNav({
  onNavigate,
  activeRoute
}: {
  onNavigate: (route: AppRoute) => void;
  activeRoute?: AppRoute;
}) {
  return (
    <nav className="public-site-nav" aria-label="Site">
      <button
        className={`public-site-nav-link${activeRoute === "intro" ? " is-active" : ""}`}
        type="button"
        aria-current={activeRoute === "intro" ? "page" : undefined}
        onClick={() => onNavigate("intro")}
      >
        Intro
      </button>
      <button
        className={`public-site-nav-link${activeRoute === "tech-stack" ? " is-active" : ""}`}
        type="button"
        aria-current={activeRoute === "tech-stack" ? "page" : undefined}
        onClick={() => onNavigate("tech-stack")}
      >
        Tech stack
      </button>
    </nav>
  );
}

function PublicPageTopbar({
  onNavigate,
  activeRoute,
  showBack = false
}: {
  onNavigate: (route: AppRoute) => void;
  activeRoute?: AppRoute;
  showBack?: boolean;
}) {
  return (
    <div className="public-page-topbar">
      <div className="public-page-topbar-start">
        {showBack ? <PublicPageBack onNavigate={onNavigate} /> : null}
      </div>
      <PublicSiteNav onNavigate={onNavigate} activeRoute={activeRoute} />
    </div>
  );
}

function PublicPageBack({ onNavigate }: { onNavigate: (route: AppRoute) => void }) {
  return (
    <button className="auth-back-button public-page-back" type="button" onClick={() => onNavigate("user")}>
      <ArrowLeft size={16} />
      Back
    </button>
  );
}

function UserShopLanding({
  shopBranding,
  onSignIn,
  onSignUp
}: {
  shopBranding: ShopBranding;
  onSignIn: () => void;
  onSignUp: () => void;
}) {
  const menuPreviewQuery = useQuery({
    queryKey: ["menu-preview"],
    queryFn: fetchMenuPreview
  });
  const previewProducts = menuPreviewQuery.data ?? [];
  const paymentMethods = buildAcceptedPaymentMethods(shopBranding);
  const footerNote = shopBranding.footer_note.trim();

  return (
    <div className="user-shop-landing">
      <div className="user-shop-landing-inner">
        <BrandMark businessName={shopBranding.business_name} markLetter={shopBranding.mark_letter} />
        <h1 className="user-shop-headline">{shopBranding.tagline}</h1>
        <p className="user-shop-lead">{shopBranding.description}</p>

        {paymentMethods.length ? (
          <div className="payment-method-chips" aria-label="Accepted payment methods">
            {paymentMethods.map((method) => (
              <span className="payment-method-chip" key={method}>
                {method}
              </span>
            ))}
          </div>
        ) : null}

        <button className="primary-button user-shop-enter" type="button" onClick={onSignIn}>
          Order now
          <ArrowRight size={18} />
        </button>

        <p className="user-shop-signup-prompt">
          New here?{" "}
          <button className="text-link" type="button" onClick={onSignUp}>
            Create account
          </button>
        </p>

        <section className="user-shop-how-it-works" aria-labelledby="user-shop-steps-heading">
          <p className="section-label">how it works</p>
          <h2 id="user-shop-steps-heading" className="visually-hidden">
            How ordering works
          </h2>
          <ol className="user-shop-steps">
            <li className="user-shop-step">
              <span className="user-shop-step-icon" aria-hidden="true">
                <KeyRound size={18} />
              </span>
              <div>
                <strong>Sign in</strong>
                <span>Create an account or enter with your PIN.</span>
              </div>
            </li>
            <li className="user-shop-step">
              <span className="user-shop-step-icon" aria-hidden="true">
                <ShoppingBag size={18} />
              </span>
              <div>
                <strong>Browse menu</strong>
                <span>Pick items from the shop menu.</span>
              </div>
            </li>
            <li className="user-shop-step">
              <span className="user-shop-step-icon" aria-hidden="true">
                <CircleDollarSign size={18} />
              </span>
              <div>
                <strong>Pay &amp; order</strong>
                <span>Pay by PayNow or bank transfer, then place your order.</span>
              </div>
            </li>
          </ol>
        </section>

        {previewProducts.length ? (
          <section className="user-shop-menu-teaser" aria-labelledby="user-shop-menu-heading">
            <p className="section-label">on the menu</p>
            <h2 id="user-shop-menu-heading">Popular items</h2>
            <ul className="user-shop-menu-grid">
              {previewProducts.map((product) => (
                <li className="user-shop-menu-item" key={product.id ?? product.name}>
                  <span className="user-shop-menu-name">{product.name}</span>
                  <span className="user-shop-menu-meta">
                    {product.category}
                    {product.unit_price != null ? ` · ${formatAmount(product.unit_price, "SGD")}` : ""}
                  </span>
                </li>
              ))}
            </ul>
            <p className="user-shop-menu-note">Sign in to browse the full menu and place an order.</p>
          </section>
        ) : null}

        {footerNote ? (
          <footer className="user-shop-footer">
            <p>{footerNote}</p>
          </footer>
        ) : null}
      </div>
    </div>
  );
}

function LoginPage({
  shopBranding,
  initialMode,
  onAuthenticated,
  onBack
}: {
  shopBranding: ShopBranding;
  initialMode: AuthMode;
  onAuthenticated: (role: AuthRole, credential: AuthCredential) => void;
  onBack: () => void;
}) {
  return (
    <div className="login-page">
      <BrandMark
        businessName={shopBranding.business_name}
        markLetter={shopBranding.mark_letter}
        onHomeClick={onBack}
      />
      <button className="auth-back-button" type="button" onClick={onBack}>
        <ArrowLeft size={16} />
        Back
      </button>
      <LoginView initialMode={initialMode} onAuthenticated={onAuthenticated} onBack={onBack} />
    </div>
  );
}

function LoginView({
  initialMode,
  onAuthenticated,
  onBack
}: {
  initialMode: AuthMode;
  onAuthenticated: (role: AuthRole, credential: AuthCredential) => void;
  onBack: () => void;
}) {
  const [mode, setMode] = useStateValue<AuthMode>(initialMode);
  const [username, setUsername] = useStateValue("");
  const [pin, setPin] = useStateValue("");
  const [confirmPin, setConfirmPin] = useStateValue("");
  const [error, setError] = useStateValue<string | null>(null);
  const [isPending, setIsPending] = useStateValue(false);
  const isSignUp = mode === "sign-up";
  const isPinReady = /^\d{6}$/.test(pin);
  const isConfirmPinReady = !isSignUp || /^\d{6}$/.test(confirmPin);

  useEffect(() => {
    setMode(initialMode);
    setError(null);
    setPin("");
    setConfirmPin("");
  }, [initialMode, setMode, setError, setPin, setConfirmPin]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsPending(true);
    const trimmedUsername = username.trim();

    try {
      if (isSignUp && pin !== confirmPin) {
        throw new Error("PINs do not match");
      }

      const response = await fetch(`${apiBase}${isSignUp ? "/auth/signup" : "/auth/login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmedUsername, pin })
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const payload = (await response.json()) as {
        authenticated: boolean;
        role: AuthRole;
        user?: { username: string };
      };
      onAuthenticated(payload.role, { username: payload.user?.username ?? trimmedUsername, pin });
      setPin("");
      setConfirmPin("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign in");
    } finally {
      setIsPending(false);
    }
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError(null);
    setPin("");
    setConfirmPin("");
  }

  return (
    <section className="auth-panel auth-panel--login" aria-labelledby="auth-heading">
      <div className="auth-panel-header">
        <div className="auth-icon">
          {isSignUp ? <UserPlus size={22} /> : <KeyRound size={22} />}
        </div>
        <div>
          <p className="section-label">{isSignUp ? "user signup" : "secure access"}</p>
          <h2 id="auth-heading">{isSignUp ? "Create user account" : "Sign in"}</h2>
        </div>
      </div>

      <p className="auth-copy">
        {isSignUp
          ? "Signup creates regular user access only. Business and admin access still need to be added manually."
          : "Enter your username and 6-digit PIN. You will be routed to the right workspace."}
      </p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="field-group">
          <label className="field-label" htmlFor="login-username">
            Username
          </label>
          <div className="input-shell">
            <User size={18} className="input-icon" aria-hidden="true" />
            <input
              id="login-username"
              className="input-field"
              type="text"
              value={username}
              autoComplete="username"
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Username"
              disabled={isPending}
            />
          </div>
        </div>

        <div className="field-group">
          <label className="field-label" id="login-pin-label" htmlFor="login-pin-0">
            6-digit PIN
          </label>
          <PinInput
            idPrefix="login-pin"
            labelledBy="login-pin-label"
            value={pin}
            disabled={isPending}
            onChange={setPin}
          />
        </div>

        {isSignUp ? (
          <div className="field-group">
            <label className="field-label" id="signup-confirm-pin-label" htmlFor="signup-confirm-pin-0">
              Confirm PIN
            </label>
            <PinInput
              idPrefix="signup-confirm-pin"
              labelledBy="signup-confirm-pin-label"
              value={confirmPin}
              disabled={isPending}
              onChange={setConfirmPin}
            />
          </div>
        ) : null}

        <button
          className="primary-button auth-submit"
          type="submit"
          disabled={isPending || !username.trim() || !isPinReady || !isConfirmPinReady}
        >
          {isPending ? <Loader2 className="spin" size={18} /> : isSignUp ? <UserPlus size={18} /> : <KeyRound size={18} />}
          {isSignUp ? "Create account" : "Sign in"}
        </button>
      </form>

      {error ? <ErrorNotice message={error} /> : null}

      <div className="auth-footer-actions">
        <p className="auth-footer-link">
          {isSignUp ? "Already have an account?" : "New here?"}{" "}
          <button className="text-link" type="button" onClick={() => switchMode(isSignUp ? "sign-in" : "sign-up")}>
            {isSignUp ? "Sign in" : "Create user account"}
          </button>
        </p>
        <button className="text-link auth-secondary-link" type="button" onClick={onBack}>
          Back to home page
        </button>
      </div>
    </section>
  );
}

function PinInput({
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

function UserView({
  shopBranding,
  userCredential,
  userProfile,
  orders,
  onUserCredentialChange
}: {
  shopBranding: ShopBranding;
  userCredential: AuthCredential;
  userProfile: UserProfile | null;
  orders: ProcessedOrder[];
  onUserCredentialChange: (credential: AuthCredential) => void;
}) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useStateValue<UserTab>("menu");
  const [orderFlowTab, setOrderFlowTab] = useStateValue<OrderFlowTab>("menu");
  const [ordersSubTab, setOrdersSubTab] = useStateValue<CustomerOrdersTab>("current");
  const [cart, setCart] = useStateValue<CartLine[]>([]);
  const [notes, setNotes] = useStateValue("");
  const [paymentProofImage, setPaymentProofImage] = useStateValue("");
  const [paymentProofNotice, setPaymentProofNotice] = useStateValue<string | null>(null);
  const [placedNotice, setPlacedNotice] = useStateValue<string | null>(null);

  const menuQuery = useQuery({
    queryKey: ["menu", userCredential.username],
    queryFn: () => fetchCustomerMenu(userCredential)
  });

  const placeOrderMutation = useMutation({
    mutationFn: () =>
      placeCustomerOrder(userCredential, {
        items: cart.map((line) => ({
          product_id: line.product.id!,
          quantity: line.quantity
        })),
        payment_evidence: paymentProofImage,
        notes
      }),
    onSuccess: (result) => {
      setCart([]);
      setNotes("");
      setPaymentProofImage("");
      setPaymentProofNotice(null);
      setPlacedNotice(result.workflow.message);
      setOrdersSubTab("current");
      setActiveTab("my-orders");
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
    }
  });

  const products = menuQuery.data?.products ?? [];
  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const cartTotal = cart.reduce((sum, line) => {
    if (line.product.unit_price === null) {
      return sum;
    }

    return sum + line.product.unit_price * line.quantity;
  }, 0);
  const hasPartialPricing = cart.some((line) => line.product.unit_price === null);
  const productsByCategory = groupMenuProducts(products);
  const currentOrders = orders.filter(isActiveOrder);
  const historyOrders = orders.filter(isCompletedOrder);
  const acceptedPaymentMethods = menuQuery.data?.payment_methods ?? buildAcceptedPaymentMethods(shopBranding);
  const hasPayNowDetails = Boolean(shopBranding.paynow_number.trim() || shopBranding.paynow_qr_image.trim());
  const hasBankTransferDetails = Boolean(
    shopBranding.bank_name.trim() ||
      shopBranding.bank_account_name.trim() ||
      shopBranding.bank_account_number.trim()
  );

  const tabs: Array<{ id: UserTab; label: string; meta: string; icon: React.ReactNode }> = [
    {
      id: "menu",
      label: "Menu",
      meta: cartCount ? `${cartCount} in cart` : `${products.length} items`,
      icon: <ShoppingBag size={16} />
    },
    {
      id: "my-orders",
      label: "My orders",
      meta: currentOrders.length ? `${currentOrders.length} active` : `${orders.length} total`,
      icon: <ClipboardList size={16} />
    },
    {
      id: "profile",
      label: "Profile",
      meta: userProfile?.first_name ? "Saved" : "Setup",
      icon: <User size={16} />
    }
  ];

  async function handlePaymentProofUpload(file: File | null) {
    setPaymentProofNotice(null);

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setPaymentProofNotice("Upload an image file for your payment proof.");
      return;
    }

    const imageData = await imageFileToDataUrl(file);
    setPaymentProofImage(imageData);
    setPaymentProofNotice("Payment proof uploaded. You can place your order after checking the details.");
  }

  function updateCartQuantity(product: InventoryProduct, nextQuantity: number) {
    setCart((current) => {
      if (nextQuantity <= 0) {
        return current.filter((line) => line.product.id !== product.id);
      }

      const existing = current.find((line) => line.product.id === product.id);
      if (existing) {
        return current.map((line) =>
          line.product.id === product.id ? { ...line, quantity: nextQuantity } : line
        );
      }

      return [...current, { product, quantity: nextQuantity }];
    });
  }

  function getCartQuantity(productId?: string) {
    return cart.find((line) => line.product.id === productId)?.quantity ?? 0;
  }

  return (
    <div className="user-workspace customer-workspace">
      <div className="journey-tabs" role="tablist" aria-label="Customer order sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`journey-tab${activeTab === tab.id ? " is-active" : ""}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`user-panel-${tab.id}`}
            id={`user-tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            <span className="journey-tab-copy">
              <span className="journey-tab-label">{tab.label}</span>
              <span className="journey-tab-meta">{tab.meta}</span>
            </span>
          </button>
        ))}
      </div>

      <div
        className="journey-tab-panel"
        id={`user-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`user-tab-${activeTab}`}
      >
        {activeTab === "menu" ? (
          <>
            <div className="customer-order-flow-tabs" role="tablist" aria-label="Menu and checkout">
              <button
                className={`customer-order-flow-tab${orderFlowTab === "menu" ? " is-active" : ""}`}
                type="button"
                role="tab"
                aria-selected={orderFlowTab === "menu"}
                aria-controls="customer-order-flow-menu"
                id="customer-order-flow-tab-menu"
                onClick={() => setOrderFlowTab("menu")}
              >
                <ShoppingBag size={16} />
                <span>
                  Menu
                  <small>{products.length} items</small>
                </span>
              </button>
              <button
                className={`customer-order-flow-tab${orderFlowTab === "checkout" ? " is-active" : ""}`}
                type="button"
                role="tab"
                aria-selected={orderFlowTab === "checkout"}
                aria-controls="customer-order-flow-checkout"
                id="customer-order-flow-tab-checkout"
                onClick={() => setOrderFlowTab("checkout")}
              >
                <WalletCards size={16} />
                <span>
                  Checkout
                  <small>{cartCount ? `${cartCount} in cart · ${formatAmount(cartTotal, "SGD")}` : "Empty"}</small>
                </span>
              </button>
            </div>

            {orderFlowTab === "menu" ? (
          <section
            className="customer-order-menu panel"
            aria-labelledby="customer-menu-heading"
            id="customer-order-flow-menu"
            role="tabpanel"
          >
            <div className="panel-heading">
              <div>
                <p className="section-label">menu</p>
                <h2 id="customer-menu-heading">Choose what to order</h2>
              </div>
              {cartCount ? (
                <button className="secondary-button" type="button" onClick={() => setOrderFlowTab("checkout")}>
                  Checkout ({cartCount})
                  <ArrowRight size={16} />
                </button>
              ) : null}
            </div>

            {menuQuery.isLoading ? (
              <p className="panel-copy">Loading menu…</p>
            ) : menuQuery.error ? (
              <ErrorNotice message={menuQuery.error.message} />
            ) : products.length ? (
              <div className="customer-menu-groups">
                {productsByCategory.map(([category, categoryProducts]) => (
                  <section className="customer-menu-group" key={category} aria-label={category}>
                    <h3 className="customer-menu-category">{category}</h3>
                    <div className="customer-menu-grid">
                      {categoryProducts.map((product) => {
                        const quantity = getCartQuantity(product.id);
                        return (
                          <article
                            className={`customer-menu-card${quantity ? " is-selected" : ""}`}
                            key={product.id}
                          >
                            <div className="customer-menu-card-copy">
                              <strong>{product.name}</strong>
                              <span>{formatAmount(product.unit_price, "SGD")} each</span>
                            </div>
                            <div className="customer-menu-stepper">
                              <button
                                className="icon-button"
                                type="button"
                                aria-label={`Remove one ${product.name}`}
                                disabled={quantity === 0}
                                onClick={() => updateCartQuantity(product, quantity - 1)}
                              >
                                <Minus size={16} />
                              </button>
                              <span aria-live="polite">{quantity}</span>
                              <button
                                className="icon-button"
                                type="button"
                                aria-label={`Add one ${product.name}`}
                                onClick={() => updateCartQuantity(product, quantity + 1)}
                              >
                                <Plus size={16} />
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="empty-preview">
                <Package2 size={20} />
                <p>The shop has not published a menu yet. Check back soon.</p>
              </div>
            )}

            {cartCount ? (
              <div className="customer-menu-footer">
                <CartTotalsSummary
                  cartCount={cartCount}
                  cartTotal={cartTotal}
                  hasPartialPricing={hasPartialPricing}
                />
                <button className="primary-button" type="button" onClick={() => setOrderFlowTab("checkout")}>
                  Continue to checkout
                  <ArrowRight size={16} />
                </button>
              </div>
            ) : null}
          </section>
            ) : null}

            {orderFlowTab === "checkout" ? (
          <section
            className="customer-order-cart panel customer-checkout-panel"
            aria-labelledby="customer-cart-heading"
            id="customer-order-flow-checkout"
            role="tabpanel"
          >
            <div className="panel-heading">
              <div>
                <p className="section-label">checkout</p>
                <h2 id="customer-cart-heading">Review and place your order</h2>
              </div>
              {cartCount ? <span className="count-pill">{cartCount} items</span> : null}
            </div>

            {cart.length ? (
              <>
                <ul className="customer-cart-list">
                  {cart.map((line) => (
                    <li key={line.product.id}>
                      <div className="customer-cart-line-copy">
                        <strong>{line.product.name}</strong>
                        <small className="customer-product-category">{line.product.category}</small>
                      </div>
                      <div className="customer-cart-line-actions">
                        <div className="customer-menu-stepper customer-menu-stepper--compact">
                          <button
                            className="icon-button"
                            type="button"
                            aria-label={`Remove one ${line.product.name}`}
                            onClick={() => updateCartQuantity(line.product, line.quantity - 1)}
                          >
                            <Minus size={14} />
                          </button>
                          <span>{line.quantity}</span>
                          <button
                            className="icon-button"
                            type="button"
                            aria-label={`Add one ${line.product.name}`}
                            onClick={() => updateCartQuantity(line.product, line.quantity + 1)}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <b>
                          {line.product.unit_price === null
                            ? "—"
                            : formatAmount(line.product.unit_price * line.quantity, "SGD")}
                        </b>
                      </div>
                    </li>
                  ))}
                </ul>

                <CartTotalsSummary
                  cartCount={cartCount}
                  cartTotal={cartTotal}
                  hasPartialPricing={hasPartialPricing}
                />

                <label className="field-label" htmlFor="order-notes">
                  Pickup or delivery notes (optional)
                </label>
                <textarea
                  id="order-notes"
                  className="compact-textarea"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Example: Pick up at 6pm"
                />

                <div className="customer-payment-card">
                  <p className="section-label">how to pay</p>
                  <p className="panel-copy">{shopBranding.payment_instructions}</p>
                  <div className="customer-payment-options">
                    {hasPayNowDetails ? (
                      <div className="customer-payment-option">
                        <div>
                          <strong>PayNow</strong>
                          {shopBranding.paynow_number.trim() ? (
                            <span>{formatPaynowNumber(shopBranding.paynow_number)}</span>
                          ) : (
                            <span>Use the QR code below</span>
                          )}
                        </div>
                        {shopBranding.paynow_qr_image ? (
                          <img
                            className="customer-payment-qr"
                            src={shopBranding.paynow_qr_image}
                            alt="PayNow QR code"
                          />
                        ) : (
                          <span className="customer-payment-qr-unavailable">QR not available</span>
                        )}
                      </div>
                    ) : null}
                    {hasBankTransferDetails ? (
                      <div className="customer-payment-option">
                        <div>
                          <strong>Bank transfer</strong>
                          {shopBranding.bank_name.trim() ? <span>{shopBranding.bank_name}</span> : null}
                          {shopBranding.bank_account_name.trim() ? (
                            <span>{shopBranding.bank_account_name}</span>
                          ) : null}
                          {shopBranding.bank_account_number.trim() ? (
                            <span>{shopBranding.bank_account_number}</span>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <p className="customer-payment-methods">
                    Accepted: {acceptedPaymentMethods.join(" · ")}
                  </p>
                </div>

                <p className="customer-payment-warning" role="note">
                  You must make payment first before placing your order. All payments are non-refundable — please
                  check your order before paying.
                </p>

                <label className="field-label" htmlFor="payment-proof">
                  Payment proof
                </label>
                <p className="branding-helper-text customer-payment-proof-copy">
                  Upload a screenshot or photo of your PayNow or bank transfer receipt.
                </p>
                {paymentProofImage ? (
                  <div className="payment-proof-preview">
                    <img src={paymentProofImage} alt="Uploaded payment proof" />
                    <button
                      className="icon-button"
                      type="button"
                      aria-label="Remove payment proof"
                      onClick={() => {
                        setPaymentProofImage("");
                        setPaymentProofNotice("Payment proof removed.");
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : null}
                <label className="secondary-button payment-proof-upload-button" htmlFor="payment-proof">
                  <Upload size={16} />
                  Upload payment proof
                </label>
                <input
                  id="payment-proof"
                  className="visually-hidden"
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    void handlePaymentProofUpload(event.target.files?.[0] ?? null);
                    event.target.value = "";
                  }}
                />
                {paymentProofNotice ? <p className="branding-helper-text">{paymentProofNotice}</p> : null}

                <button
                  className="primary-button"
                  type="button"
                  disabled={placeOrderMutation.isPending || !paymentProofImage}
                  onClick={() => {
                    setPlacedNotice(null);
                    placeOrderMutation.mutate();
                  }}
                >
                  {placeOrderMutation.isPending ? <Loader2 className="spin" size={18} /> : <CheckCircle2 size={18} />}
                  Place order · {formatAmount(cartTotal, "SGD")}
                </button>

                {placeOrderMutation.error ? <ErrorNotice message={placeOrderMutation.error.message} /> : null}
              </>
            ) : (
              <div className="customer-cart-empty">
                <ShoppingBag size={22} />
                <p>Your cart is empty. Add items from the menu first.</p>
                <button className="secondary-button" type="button" onClick={() => setOrderFlowTab("menu")}>
                  Browse menu
                </button>
              </div>
            )}
          </section>
            ) : null}
          </>
        ) : null}

        {activeTab === "my-orders" ? (
          <CustomerOrdersPanel
            ordersSubTab={ordersSubTab}
            onOrdersSubTabChange={setOrdersSubTab}
            currentOrders={currentOrders}
            historyOrders={historyOrders}
            placedNotice={placedNotice}
            onStartOrdering={() => {
              setOrderFlowTab("menu");
              setActiveTab("menu");
            }}
          />
        ) : null}

        {activeTab === "profile" ? (
          <CustomerProfilePanel
            userCredential={userCredential}
            userProfile={userProfile}
            onUserCredentialChange={onUserCredentialChange}
          />
        ) : null}
      </div>
    </div>
  );
}

function CustomerOrdersPanel({
  ordersSubTab,
  onOrdersSubTabChange,
  currentOrders,
  historyOrders,
  placedNotice,
  onStartOrdering
}: {
  ordersSubTab: CustomerOrdersTab;
  onOrdersSubTabChange: (tab: CustomerOrdersTab) => void;
  currentOrders: ProcessedOrder[];
  historyOrders: ProcessedOrder[];
  placedNotice: string | null;
  onStartOrdering: () => void;
}) {
  const visibleOrders = ordersSubTab === "current" ? currentOrders : historyOrders;
  const heading = ordersSubTab === "current" ? "Current orders" : "Order history";
  const emptyMessage =
    ordersSubTab === "current"
      ? "You have no active orders right now."
      : "Completed orders will appear here once the shop marks them done.";

  return (
    <section className="orders-section customer-orders-panel" aria-labelledby="customer-orders-heading">
      <div className="panel-heading">
        <div>
          <p className="section-label">my orders</p>
          <h2 id="customer-orders-heading">Track your orders</h2>
        </div>
        <span className="count-pill">
          {currentOrders.length} active · {historyOrders.length} history
        </span>
      </div>

      <div className="customer-orders-tabs" role="tablist" aria-label="Order views">
        <button
          type="button"
          className={`customer-orders-tab${ordersSubTab === "current" ? " is-active" : ""}`}
          role="tab"
          aria-selected={ordersSubTab === "current"}
          aria-controls="customer-orders-panel-current"
          id="customer-orders-tab-current"
          onClick={() => onOrdersSubTabChange("current")}
        >
          Current
          <span className="customer-orders-tab-count">{currentOrders.length}</span>
        </button>
        <button
          type="button"
          className={`customer-orders-tab${ordersSubTab === "history" ? " is-active" : ""}`}
          role="tab"
          aria-selected={ordersSubTab === "history"}
          aria-controls="customer-orders-panel-history"
          id="customer-orders-tab-history"
          onClick={() => onOrdersSubTabChange("history")}
        >
          History
          <span className="customer-orders-tab-count">{historyOrders.length}</span>
        </button>
      </div>

      <div
        className="customer-orders-tab-panel"
        id={`customer-orders-panel-${ordersSubTab}`}
        role="tabpanel"
        aria-labelledby={`customer-orders-tab-${ordersSubTab}`}
      >
        <div className="customer-orders-panel-heading">
          <h3>{heading}</h3>
          <span className="count-pill">{visibleOrders.length} orders</span>
        </div>

        {placedNotice && ordersSubTab === "current" ? (
          <p className="customer-success-note">{placedNotice}</p>
        ) : null}

        {visibleOrders.length ? (
          <div className="customer-order-cards">
            {visibleOrders.map((order) => (
              <CustomerOrderCard key={order.id ?? `${order.created_at}-${order.order_summary}`} order={order} />
            ))}
          </div>
        ) : (
          <div className="empty-preview">
            <ClipboardList size={20} />
            <p>
              {ordersSubTab === "current" && !currentOrders.length && !historyOrders.length
                ? "You have not placed an order yet."
                : emptyMessage}
            </p>
            {ordersSubTab === "current" ? (
              <button className="secondary-button" type="button" onClick={onStartOrdering}>
                Start ordering
              </button>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

function CustomerOrderCard({ order }: { order: ProcessedOrder }) {
  return (
    <article className="customer-order-card">
      <div className="customer-order-card-head">
        <strong>{order.order_summary}</strong>
        <div className="customer-order-card-badges">
          {isActiveOrder(order) ? <FulfillmentPill status="active" /> : null}
          <StatusPill status={order.payment_status} />
        </div>
      </div>
      <p>{formatAmount(order.total_amount, order.currency)}</p>
      <p className="customer-order-meta">
        Placed {formatCaptureDate(order.created_at)} · {formatCaptureTime(order.created_at)}
      </p>
      {order.evidence ? (
        <div className="customer-order-evidence">
          <PaymentEvidenceDisplay evidence={order.evidence} />
        </div>
      ) : null}
    </article>
  );
}

function CartTotalsSummary({
  cartCount,
  cartTotal,
  hasPartialPricing
}: {
  cartCount: number;
  cartTotal: number;
  hasPartialPricing: boolean;
}) {
  const itemLabel = cartCount === 1 ? "item" : "items";

  return (
    <div className="customer-cart-totals" aria-label="Order totals">
      <div className="customer-cart-totals-row">
        <span>
          Subtotal ({cartCount} {itemLabel})
        </span>
        <strong>{cartTotal > 0 ? formatAmount(cartTotal, "SGD") : "—"}</strong>
      </div>
      <div className="customer-cart-totals-row is-total">
        <span>Total</span>
        <strong>{cartTotal > 0 ? formatAmount(cartTotal, "SGD") : "Ask shop for total"}</strong>
      </div>
      {hasPartialPricing ? (
        <p className="customer-cart-totals-note">Some items may need a price quote from the shop.</p>
      ) : null}
    </div>
  );
}

function CustomerProfilePanel({
  userCredential,
  userProfile,
  onUserCredentialChange
}: {
  userCredential: AuthCredential;
  userProfile: UserProfile | null;
  onUserCredentialChange: (credential: AuthCredential) => void;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useStateValue({
    first_name: "",
    last_name: "",
    email: inferEmailFromUsername(userCredential.username),
    contact: ""
  });
  const [currentPin, setCurrentPin] = useStateValue("");
  const [newPin, setNewPin] = useStateValue("");
  const [confirmPin, setConfirmPin] = useStateValue("");
  const [savedNotice, setSavedNotice] = useStateValue<string | null>(null);
  const [passwordNotice, setPasswordNotice] = useStateValue<string | null>(null);

  useEffect(() => {
    if (userProfile) {
      setDraft({
        first_name: userProfile.first_name,
        last_name: userProfile.last_name,
        email: userProfile.email || inferEmailFromUsername(userCredential.username),
        contact: userProfile.contact
      });
    }
  }, [userCredential.username, userProfile, setDraft]);

  const saveProfileMutation = useMutation({
    mutationFn: () => saveUserProfile(userCredential, draft),
    onSuccess: () => {
      setSavedNotice("Profile saved.");
      void queryClient.invalidateQueries({ queryKey: ["user-profile"] });
    }
  });

  const changePasswordMutation = useMutation({
    mutationFn: ({ currentPin, newPin }: { currentPin: string; newPin: string }) =>
      changeUserPassword(userCredential, currentPin, newPin),
    onSuccess: (_result, variables) => {
      setPasswordNotice("Password updated.");
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      const nextCredential = { username: userCredential.username, pin: variables.newPin };
      localStorage.setItem(authStorageKey("user"), JSON.stringify(nextCredential));
      onUserCredentialChange(nextCredential);
    }
  });

  const canChangePassword = userProfile?.can_change_password ?? false;
  const isDemoAccount = userProfile?.is_demo_account ?? !canChangePassword;
  const passwordMismatch = newPin.length > 0 && confirmPin.length > 0 && newPin !== confirmPin;

  return (
    <section className="panel customer-profile-panel" aria-labelledby="customer-profile-heading">
      <div className="panel-heading">
        <div>
          <p className="section-label">profile</p>
          <h2 id="customer-profile-heading">Your account</h2>
        </div>
        <User size={20} className="accent-icon" />
      </div>

      <form
        className="profile-form"
        onSubmit={(event) => {
          event.preventDefault();
          setSavedNotice(null);
          saveProfileMutation.mutate();
        }}
      >
        <div className="profile-form-row">
          <div className="field-group">
            <RequiredFieldLabel htmlFor="profile-first-name">First name</RequiredFieldLabel>
            <input
              id="profile-first-name"
              className="input-field profile-input"
              type="text"
              autoComplete="given-name"
              required
              value={draft.first_name}
              onChange={(event) => setDraft((current) => ({ ...current, first_name: event.target.value }))}
            />
          </div>
          <div className="field-group">
            <RequiredFieldLabel htmlFor="profile-last-name">Last name</RequiredFieldLabel>
            <input
              id="profile-last-name"
              className="input-field profile-input"
              type="text"
              autoComplete="family-name"
              required
              value={draft.last_name}
              onChange={(event) => setDraft((current) => ({ ...current, last_name: event.target.value }))}
            />
          </div>
        </div>

        <div className="field-group">
          <RequiredFieldLabel htmlFor="profile-email">Email</RequiredFieldLabel>
          <input
            id="profile-email"
            className="input-field profile-input"
            type="email"
            autoComplete="email"
            required
            value={draft.email}
            onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
          />
        </div>

        <div className="field-group">
          <RequiredFieldLabel htmlFor="profile-contact">Contact details</RequiredFieldLabel>
          <input
            id="profile-contact"
            className="input-field profile-input"
            type="text"
            placeholder="Phone or WhatsApp"
            autoComplete="tel"
            required
            value={draft.contact}
            onChange={(event) => setDraft((current) => ({ ...current, contact: event.target.value }))}
          />
        </div>

        <button
          className="primary-button profile-save-button"
          type="submit"
          disabled={saveProfileMutation.isPending}
        >
          {saveProfileMutation.isPending ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
          Save profile
        </button>

        {savedNotice ? <p className="panel-copy">{savedNotice}</p> : null}
        {saveProfileMutation.error ? <ErrorNotice message={saveProfileMutation.error.message} /> : null}
      </form>

      <div className="customer-profile-divider" />

      <div className="customer-password-section">
        <div className="customer-password-heading">
          <p className="section-label">security</p>
          <h3>{canChangePassword ? "Change password" : "Demo password"}</h3>
        </div>
        {canChangePassword ? (
          <form
            className="password-form"
            onSubmit={(event) => {
              event.preventDefault();
              setPasswordNotice(null);
              changePasswordMutation.mutate({ currentPin, newPin });
            }}
          >
            <RequiredFieldLabel htmlFor="profile-current-0" labelId="profile-current-pin">
              Current password
            </RequiredFieldLabel>
            <PinInput
              idPrefix="profile-current"
              labelledBy="profile-current-pin"
              value={currentPin}
              onChange={setCurrentPin}
              autoComplete="current-password"
            />

            <RequiredFieldLabel htmlFor="profile-new-0" labelId="profile-new-pin">
              New password
            </RequiredFieldLabel>
            <PinInput
              idPrefix="profile-new"
              labelledBy="profile-new-pin"
              value={newPin}
              onChange={setNewPin}
              autoComplete="new-password"
            />

            <RequiredFieldLabel htmlFor="profile-confirm-0" labelId="profile-confirm-pin">
              Confirm new password
            </RequiredFieldLabel>
            <PinInput
              idPrefix="profile-confirm"
              labelledBy="profile-confirm-pin"
              value={confirmPin}
              onChange={setConfirmPin}
              autoComplete="new-password"
            />

            {passwordMismatch ? <p className="panel-copy">New password and confirmation must match.</p> : null}

            <button
              className="secondary-button profile-password-button"
              type="submit"
              disabled={
                changePasswordMutation.isPending ||
                !/^\d{6}$/.test(currentPin) ||
                !/^\d{6}$/.test(newPin) ||
                newPin !== confirmPin
              }
            >
              {changePasswordMutation.isPending ? <Loader2 className="spin" size={18} /> : <KeyRound size={18} />}
              Update password
            </button>
          </form>
        ) : (
          <p className="panel-copy">
            {isDemoAccount
              ? "This demo account uses a fixed server-configured password. Sign in with a regular user account to change your password."
              : "Password changes are not available for this account."}
          </p>
        )}

        {passwordNotice ? <p className="panel-copy">{passwordNotice}</p> : null}
        {changePasswordMutation.error ? <ErrorNotice message={changePasswordMutation.error.message} /> : null}
      </div>
    </section>
  );
}

function RequiredFieldLabel({
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

function AdminView({
  adminCredential,
  businessDescription,
  setBusinessDescription,
  generateMutation,
  generatedWorkflow,
  orders,
  metrics,
  shopBranding,
  onShopBrandingSaved,
  onWorkflowDraftCleared
}: {
  adminCredential: AuthCredential;
  businessDescription: string;
  setBusinessDescription: React.Dispatch<React.SetStateAction<string>>;
  generateMutation: UseMutationResult<WorkflowGeneration, Error, WorkflowGenerateInput>;
  generatedWorkflow: WorkflowGeneration | null;
  orders: ProcessedOrder[];
  metrics: ReturnType<typeof buildMetrics>;
  shopBranding: ShopBranding;
  onShopBrandingSaved: () => void;
  onWorkflowDraftCleared: () => void;
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
          <OrderRulesPanel
            adminCredential={adminCredential}
            businessDescription={businessDescription}
            setBusinessDescription={setBusinessDescription}
            generateMutation={generateMutation}
            generatedWorkflow={generatedWorkflow}
            shopBranding={shopBranding}
            onWorkflowDraftCleared={onWorkflowDraftCleared}
          />
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

function OrderRulesPanel({
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
      setSavedNotice("Customer storefront and payment details saved.");
      onSaved();
    }
  });

  const hasPayNowDetails = Boolean(draft.paynow_number.trim() || draft.paynow_qr_image.trim());
  const hasBankTransferDetails = Boolean(
    draft.bank_name.trim() && draft.bank_account_name.trim() && draft.bank_account_number.trim()
  );

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

    setDraft((current) => ({
      ...current,
      paynow_qr_image: imageData,
      paynow_number: extractedPaynowNumber ?? current.paynow_number
    }));
    setQrNotice(
      extractedPaynowNumber
        ? `PayNow number ${formatPaynowNumber(extractedPaynowNumber)} detected from QR.`
        : "QR uploaded. Enter the PayNow number manually if it was not detected."
    );
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

      setDraft((current) => ({ ...current, paynow_qr_image: imageData }));
      setQrNotice(`PayNow QR generated for ${formatPaynowNumber(paynowNumber)}.`);
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
                    onClick={() => {
                      setDraft((current) => ({ ...current, paynow_qr_image: "" }));
                      setQrNotice("PayNow QR removed.");
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
                  disabled={isGeneratingQr}
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
            saveMutation.mutate({
              business_name: draft.business_name.trim(),
              mark_letter: draft.mark_letter.trim(),
              tagline: draft.tagline.trim(),
              description: draft.description.trim(),
              payment_instructions: draft.payment_instructions.trim(),
              paynow_number: draft.paynow_number.trim(),
              paynow_qr_image: draft.paynow_qr_image,
              bank_name: draft.bank_name.trim(),
              bank_account_name: draft.bank_account_name.trim(),
              bank_account_number: draft.bank_account_number.trim(),
              footer_note: draft.footer_note.trim()
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
                  <td colSpan={5}>{inventoryQuery.isLoading ? "Loading inventory..." : "No inventory products yet."}</td>
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
  const columnCount = showStatus ? (onCompleteOrder ? 7 : 6) : 5;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
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
              <tr key={`${order.source_input}-${index}`}>
                <td data-label="Captured">
                  <strong>{formatCaptureDate(order.created_at)}</strong>
                  <span>{formatCaptureTime(order.created_at)}</span>
                </td>
                <td data-label="Order">
                  <strong>{order.order_summary}</strong>
                  <span>{sumOrderQuantity(order)} item batch</span>
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

function StatusPill({ status }: { status: PaymentStatus }) {
  return <span className={`status-pill status-${status}`}>{status.replace("_", " ")}</span>;
}

function FulfillmentPill({ status }: { status: FulfillmentStatus }) {
  const label = status === "active" ? "In progress" : "Completed";
  return <span className={`fulfillment-pill fulfillment-${status}`}>{label}</span>;
}

function isActiveOrder(order: ProcessedOrder) {
  return (order.fulfillment_status ?? "active") === "active";
}

function isCompletedOrder(order: ProcessedOrder) {
  return order.fulfillment_status === "completed";
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="error-notice" role="alert">
      <AlertCircle size={18} />
      <span>{message}</span>
    </div>
  );
}

const captureTimeZone = "Asia/Singapore";
const captureDateFormatter = new Intl.DateTimeFormat("en-SG", {
  dateStyle: "medium",
  timeZone: captureTimeZone
});
const captureTimeFormatter = new Intl.DateTimeFormat("en-SG", {
  timeStyle: "short",
  timeZone: captureTimeZone
});
const captureDateKeyFormatter = new Intl.DateTimeFormat("en-SG", {
  day: "2-digit",
  month: "2-digit",
  timeZone: captureTimeZone,
  year: "numeric"
});

function isPaidOrder(order: ProcessedOrder) {
  return order.payment_status === "paid";
}

function buildMetrics(orders: ProcessedOrder[]) {
  const paidOrders = orders.filter(isPaidOrder);

  return {
    paid: paidOrders.length,
    today: paidOrders.filter((order) => isCapturedToday(order.created_at)).length,
    review: orders.filter((order) => order.payment_status === "unknown").length,
    outstanding: orders.filter(
      (order) => order.payment_status === "unpaid" || order.payment_status === "partial"
    ).length
  };
}

function isCapturedToday(value: string) {
  return getCaptureDateKey(value) === getCaptureDateKey(new Date());
}

function isCapturedThisYear(value: string) {
  return getCaptureYearKey(value) === getCaptureYearKey(new Date());
}

function isWithinLastDays(value: string, days: number) {
  return isWithinCapturePeriod(value, days);
}

const capturePeriodOptions: Array<{ days: CapturePeriodDays; label: string; shortLabel: string }> = [
  { days: 1, label: "1 day", shortLabel: "1 day" },
  { days: 3, label: "3 days", shortLabel: "3 days" },
  { days: 7, label: "7 days", shortLabel: "7 days" },
  { days: 30, label: "1 month", shortLabel: "1 mth" },
  { days: 90, label: "90 days", shortLabel: "90D" },
  { days: 365, label: "1 year", shortLabel: "1 yr" }
];

function getCapturePeriodLabel(days: CapturePeriodDays) {
  return capturePeriodOptions.find((option) => option.days === days)?.label ?? `${days} days`;
}

function isWithinCapturePeriod(value: string | Date, days: number) {
  const date = toValidDate(value);
  if (!date) {
    return false;
  }

  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - Math.max(days - 1, 0));
  start.setHours(0, 0, 0, 0);

  return date >= start && date <= end;
}

function buildCapturePeriodSummary(orders: ProcessedOrder[], days: CapturePeriodDays) {
  const scopedOrders = orders.filter(
    (order) => isPaidOrder(order) && isWithinCapturePeriod(order.created_at, days)
  );
  let sales = 0;
  let units = 0;

  for (const order of scopedOrders) {
    sales += order.total_amount ?? 0;
    units += sumOrderQuantity(order);
  }

  return {
    count: scopedOrders.length,
    sales,
    units,
    orders: scopedOrders.sort(
      (first, second) =>
        (toValidDate(second.created_at)?.getTime() ?? 0) - (toValidDate(first.created_at)?.getTime() ?? 0)
    )
  };
}

function buildSalesByDate(orders: ProcessedOrder[]) {
  const buckets = new Map<
    string,
    { dateKey: string; label: string; orderCount: number; sales: number; timestamp: number; unitsSold: number }
  >();

  for (const order of orders) {
    const date = toValidDate(order.created_at);
    const dateKey = getCaptureDateKey(order.created_at);
    const current = buckets.get(dateKey) ?? {
      dateKey,
      label: formatCaptureDate(order.created_at),
      orderCount: 0,
      sales: 0,
      timestamp: date?.getTime() ?? 0,
      unitsSold: 0
    };

    current.orderCount += 1;
    current.sales += order.total_amount ?? 0;
    current.unitsSold += sumOrderQuantity(order);
    buckets.set(dateKey, current);
  }

  return Array.from(buckets.values()).sort((first, second) => second.timestamp - first.timestamp);
}

function buildSalesByYear(orders: ProcessedOrder[]) {
  const buckets = new Map<
    string,
    { yearKey: string; label: string; orderCount: number; sales: number; unitsSold: number }
  >();

  for (const order of orders) {
    const yearKey = getCaptureYearKey(order.created_at);
    const current = buckets.get(yearKey) ?? {
      yearKey,
      label: yearKey,
      orderCount: 0,
      sales: 0,
      unitsSold: 0
    };

    current.orderCount += 1;
    current.sales += order.total_amount ?? 0;
    current.unitsSold += sumOrderQuantity(order);
    buckets.set(yearKey, current);
  }

  return Array.from(buckets.values()).sort((first, second) => Number(second.yearKey) - Number(first.yearKey));
}

function buildInventorySummary(orders: ProcessedOrder[]) {
  const products = new Map<string, { name: string; quantity: number; orderCount: number }>();
  let paidSales = 0;
  let unitsSold = 0;

  for (const order of orders) {
    if (order.total_amount !== null && order.payment_status === "paid") {
      paidSales += order.total_amount;
    }

    for (const item of order.items) {
      unitsSold += item.quantity;
      const existing = products.get(item.item_name) ?? {
        name: item.item_name,
        quantity: 0,
        orderCount: 0
      };

      existing.quantity += item.quantity;
      existing.orderCount += 1;
      products.set(item.item_name, existing);
    }
  }

  return {
    paidSales,
    unitsSold,
    topProducts: Array.from(products.values())
      .sort((first, second) => second.quantity - first.quantity)
      .slice(0, 5)
  };
}

function sumOrderQuantity(order: ProcessedOrder) {
  return order.items.reduce((total, item) => total + item.quantity, 0);
}

function createInventoryDraft(product?: InventoryProduct): InventoryProductDraft {
  return {
    name: product?.name ?? "",
    category: product?.category ?? "",
    unit_price: product?.unit_price === null || product?.unit_price === undefined ? "" : String(product.unit_price),
    is_active: product?.is_active ?? true
  };
}

function inventoryProductFromDraft(draft: InventoryProductDraft): InventoryProduct {
  return normalizeInventoryProducts([
    {
      name: draft.name,
      category: draft.category,
      unit_price: draft.unit_price,
      is_active: draft.is_active
    }
  ])[0];
}

function parseInventoryUpload(rawText: string, fileName: string): InventoryProduct[] {
  const text = rawText.trim();
  if (!text) {
    throw new Error("Inventory file is empty");
  }

  if (fileName.endsWith(".json") || text.startsWith("[") || text.startsWith("{")) {
    const payload = JSON.parse(text) as InventoryProductInput[] | { products?: InventoryProductInput[] };
    const products = Array.isArray(payload) ? payload : payload.products;
    if (!Array.isArray(products)) {
      throw new Error("JSON inventory must be an array or { products: [...] }");
    }

    return normalizeInventoryProducts(products);
  }

  const rows = parseCsvRows(text);
  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((header) => header.trim().toLowerCase());
  const products = dataRows
    .filter((row) => row.some((cell) => cell.trim()))
    .map((row) => {
      const record = Object.fromEntries(headers.map((header, index) => [header, row[index]?.trim() ?? ""]));

      return {
        name: record.name,
        category: record.category || "inventory",
        unit_price: record.unit_price || null,
        is_active: record.is_active || true
      };
    });

  return normalizeInventoryProducts(products);
}

function normalizeInventoryProducts(products: InventoryProductInput[]): InventoryProduct[] {
  const normalized = products.map((product) => ({
    name: String(product.name ?? "").trim(),
    category: String(product.category ?? "").trim() || "inventory",
    unit_price: product.unit_price === null || product.unit_price === undefined || product.unit_price === "" ? null : Number(product.unit_price),
    is_active: normalizeInventoryActive(product.is_active)
  }));

  if (!normalized.length || normalized.some((product) => !product.name)) {
    throw new Error("Inventory upload needs at least one product with a name");
  }

  if (normalized.some((product) => product.unit_price !== null && Number.isNaN(product.unit_price))) {
    throw new Error("Inventory unit_price values must be numbers");
  }

  return normalized;
}

function normalizeInventoryActive(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return !["false", "0", "no", "inactive"].includes(value.trim().toLowerCase());
  }

  return true;
}

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let currentCell = "";
  let currentRow: string[] = [];
  let isQuoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"' && isQuoted && nextChar === '"') {
      currentCell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      isQuoted = !isQuoted;
      continue;
    }

    if (char === "," && !isQuoted) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !isQuoted) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentCell = "";
      currentRow = [];
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell);
  rows.push(currentRow);

  return rows;
}

async function readApiError(response: Response) {
  try {
    const payload = await response.json();
    if (Array.isArray(payload.issues) && payload.issues.length > 0) {
      const issueMessages = payload.issues
        .map((issue: { message?: string }) => issue.message)
        .filter(Boolean)
        .join(", ");

      if (issueMessages) {
        return issueMessages;
      }
    }

    return payload.error ?? "API request failed";
  } catch {
    return "API request failed";
  }
}

function formatWorkflowGenerateError(error: Error) {
  if (/gpt-api-key|openai api key|api key/i.test(error.message)) {
    return `${error.message} Disable WORKFLOW_BUILDER_MODE=openai or configure the API key for explicit OpenAI workflow drafting.`;
  }

  return error.message;
}

function createEmptyWorkflowSetupAnswers(): WorkflowSetupAnswers {
  return {
    products: ""
  };
}

function createInitialWorkflowChatMessages(): WorkflowChatMessage[] {
  return [
    {
      id: "workflow-builder-welcome",
      role: "assistant",
      content: buildWorkflowSetupQuestion(0),
      createdAt: new Date().toISOString()
    }
  ];
}

function buildWorkflowSetupQuestion(stepIndex: number) {
  const step = workflowSetupSteps[stepIndex];
  return `${step.title}\n${step.question}`;
}

function buildWorkflowSetupContext(answers: WorkflowSetupAnswers) {
  return [
    `Seller sells: ${answers.products}.`,
    "Accepted payment evidence is fixed by the platform: the customer must pay and upload a screenshot or receipt of the completed payment.",
    "Sales capture rule is fixed by the platform: capture or fulfill the order only when order content and uploaded payment proof are both present.",
    "If order content is present but uploaded payment proof is missing, ask for payment proof. Do not let merchants configure this policy.",
    "Build only explicit deterministic keyword, regex, amount, and branch rules."
  ].join(" ");
}

function loadGeneratedWorkflowDraft() {
  const stored = localStorage.getItem(workflowDraftStorageKey);
  if (!stored) {
    return null;
  }

  try {
    const parsed = JSON.parse(stored) as unknown;
    if (isStoredWorkflowGeneration(parsed)) {
      return parsed;
    }
  } catch {
    localStorage.removeItem(workflowDraftStorageKey);
  }

  localStorage.removeItem(workflowDraftStorageKey);
  return null;
}

function saveGeneratedWorkflowDraft(generatedWorkflow: WorkflowGeneration | null) {
  if (!generatedWorkflow) {
    localStorage.removeItem(workflowDraftStorageKey);
    return;
  }

  localStorage.setItem(workflowDraftStorageKey, JSON.stringify(generatedWorkflow));
}

function isStoredWorkflowGeneration(value: unknown): value is WorkflowGeneration {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<WorkflowGeneration>;
  const workflow = candidate.workflow;

  return Boolean(
    workflow &&
      typeof workflow === "object" &&
      typeof workflow.id === "string" &&
      typeof workflow.name === "string" &&
      typeof workflow.version === "number" &&
      typeof workflow.start === "string" &&
      workflow.states &&
      typeof workflow.states === "object" &&
      Array.isArray(candidate.test_inputs) &&
      Array.isArray(candidate.rule_explanations)
  );
}

function loadWorkflowChatHistory() {
  const stored = localStorage.getItem(workflowChatStorageKey);
  if (!stored) {
    return createInitialWorkflowChatMessages();
  }

  try {
    const parsed = JSON.parse(stored) as WorkflowChatMessage[];
    if (
      Array.isArray(parsed) &&
      parsed.every(
        (message) =>
          (message.role === "assistant" || message.role === "user") &&
          typeof message.content === "string" &&
          typeof message.createdAt === "string" &&
          typeof message.id === "string"
      )
    ) {
      return parsed;
    }
  } catch {
    localStorage.removeItem(workflowChatStorageKey);
  }

  return createInitialWorkflowChatMessages();
}

function createWorkflowChatId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildWorkflowAssistantReply(result: WorkflowGeneration, hadExistingWorkflow: boolean) {
  const workflow = result.workflow;
  const action = hadExistingWorkflow ? "Rebuilt" : "Built";
  const decisionCount = countDecisionStates(workflow.states);
  const ruleCount = countWorkflowRules(workflow.states);

  return `${action} ${workflow.name} v${workflow.version} from the product list and fixed platform payment policy. It has ${decisionCount} decision nodes and ${ruleCount} deterministic rules, starting at ${workflow.start}. Missing uploaded payment proof routes to follow-up, so sales captures stay paid-only.`;
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

function PaymentEvidenceDisplay({ evidence }: { evidence: string }) {
  if (!evidence.trim()) {
    return <>—</>;
  }

  if (isPaymentProofImage(evidence)) {
    return (
      <div className="payment-proof-display">
        <img src={evidence} alt="Payment proof" className="payment-proof-thumbnail" />
        <span>Payment proof uploaded</span>
      </div>
    );
  }

  return <span>{evidence}</span>;
}

function isPaymentProofImage(value: string) {
  return value.trim().startsWith("data:image/");
}

function formatPaynowNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  const localDigits = digits.startsWith("65") && digits.length === 10 ? digits.slice(2) : digits;

  if (localDigits.length === 8) {
    return `${localDigits.slice(0, 4)} ${localDigits.slice(4)}`;
  }

  return value.trim();
}

function buildAcceptedPaymentMethods(shopBranding: ShopBranding) {
  const methods: string[] = [];

  if (shopBranding.paynow_number.trim() || shopBranding.paynow_qr_image.trim()) {
    methods.push("PayNow");
  }

  if (
    shopBranding.bank_name.trim() ||
    shopBranding.bank_account_name.trim() ||
    shopBranding.bank_account_number.trim()
  ) {
    methods.push("Bank transfer");
  }

  return methods.length ? methods : ["PayNow", "Bank transfer"];
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

async function imageFileToDataUrl(file: File) {
  if (!("createImageBitmap" in window)) {
    return fileToDataUrl(file);
  }

  try {
    const bitmap = await createImageBitmap(file);
    const maxSize = 420;
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    if (!context) {
      bitmap.close();
      return fileToDataUrl(file);
    }

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return canvas.toDataURL("image/png");
  } catch {
    return fileToDataUrl(file);
  }
}

type BarcodeDetectionResult = {
  rawValue?: string;
};

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => {
  detect(image: ImageBitmapSource): Promise<BarcodeDetectionResult[]>;
};

async function readQrTextFromImage(file: File) {
  const barcodeWindow = window as unknown as {
    BarcodeDetector?: BarcodeDetectorConstructor;
  };

  if (!barcodeWindow.BarcodeDetector || !("createImageBitmap" in window)) {
    return null;
  }

  const detector = new barcodeWindow.BarcodeDetector({ formats: ["qr_code"] });
  const bitmap = await createImageBitmap(file);

  try {
    const detected = await detector.detect(bitmap);
    return detected[0]?.rawValue ?? null;
  } catch {
    return null;
  } finally {
    bitmap.close();
  }
}

function extractPayNowNumberFromQrText(value: string) {
  const match = value.match(/(?:\+?65[\s-]?)?[689]\d{3}[\s-]?\d{4}/);

  if (!match) {
    return null;
  }

  return formatPaynowNumber(match[0]);
}

function formatCompactNumber(value: number) {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (absolute >= 1_000_000) {
    return `${sign}${trimCompactDecimal(absolute / 1_000_000)}M`;
  }

  if (absolute >= 1_000) {
    return `${sign}${trimCompactDecimal(absolute / 1_000)}K`;
  }

  return new Intl.NumberFormat("en-SG").format(value);
}

function formatCompactAmount(value: number | null, currency: string) {
  if (value === null) {
    return "Not set";
  }

  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const prefix = currency === "SGD" ? "$" : `${currency} `;

  if (absolute >= 1_000_000) {
    return `${sign}${prefix}${trimCompactDecimal(absolute / 1_000_000)}M`;
  }

  if (absolute >= 1_000) {
    return `${sign}${prefix}${trimCompactDecimal(absolute / 1_000)}K`;
  }

  return formatAmount(value, currency);
}

function trimCompactDecimal(value: number) {
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace(/\.0$/, "");
}

function formatCaptureDate(value: string) {
  const date = toValidDate(value);
  return date ? captureDateFormatter.format(date) : "No date";
}

function formatCaptureTime(value: string) {
  const date = toValidDate(value);
  return date ? captureTimeFormatter.format(date) : "No time";
}

function formatChatTime(value: string) {
  const date = toValidDate(value);
  return date ? captureTimeFormatter.format(date) : "";
}

function getCaptureDateKey(value: string | Date) {
  const date = toValidDate(value);
  if (!date) {
    return "unknown-date";
  }

  const parts = captureDateKeyFormatter.formatToParts(date);
  const partValue = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${partValue("year")}-${partValue("month")}-${partValue("day")}`;
}

function getCaptureYearKey(value: string | Date) {
  const date = toValidDate(value);
  if (!date) {
    return "unknown-year";
  }

  const parts = captureDateKeyFormatter.formatToParts(date);
  return parts.find((part) => part.type === "year")?.value ?? "unknown-year";
}

function toValidDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function useStateValue<T>(initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  return useState(initialValue);
}

function getAuthModeFromUrl(): AuthMode {
  return new URLSearchParams(window.location.search).get("mode") === "sign-up" ? "sign-up" : "sign-in";
}

function getInitialRoute(): AppRoute {
  const path = window.location.pathname;
  if (path.startsWith("/user/login") || path.startsWith("/login")) {
    return "login";
  }
  if (path.startsWith("/intro")) {
    return "intro";
  }
  if (path.startsWith("/tech-stack")) {
    return "tech-stack";
  }
  if (path.startsWith("/admin")) {
    return "admin";
  }
  return "user";
}

function routePath(route: AppRoute) {
  if (route === "intro") {
    return "/intro";
  }
  if (route === "login") {
    return "/login";
  }
  if (route === "tech-stack") {
    return "/tech-stack";
  }
  return route === "admin" ? "/admin" : "/user";
}

function getInitialAdminTab(): AdminTab {
  const tab = new URLSearchParams(window.location.search).get("tab");
  if (tab === "workflow" || tab === "runtime") {
    return "rules";
  }
  if (tab === "data") {
    return "orders";
  }

  return isAdminTab(tab) ? tab : "orders";
}

function isAdminTab(value: string | null): value is AdminTab {
  return value === "orders" || value === "rules" || value === "inventory" || value === "branding";
}

function adminTabPath(tab: AdminTab) {
  return `/admin?tab=${tab}`;
}

function authStorageKey(role: AuthRole) {
  return `zorder:${role}:auth`;
}

function loadAuthState(): AuthState {
  return {
    user: readAuthCredential("user"),
    admin: readAuthCredential("admin")
  };
}

function readAuthCredential(role: AuthRole): AuthCredential | null {
  const stored = localStorage.getItem(authStorageKey(role));
  if (!stored) {
    return null;
  }

  try {
    const credential = JSON.parse(stored) as Partial<AuthCredential>;
    if (typeof credential.username === "string" && /^\d{6}$/.test(credential.pin ?? "")) {
      return {
        username: credential.username,
        pin: credential.pin as string
      };
    }
  } catch {
    localStorage.removeItem(authStorageKey(role));
  }

  return null;
}

function authHeaders(role: AuthRole, credential: AuthCredential) {
  return {
    "x-zorder-role": role,
    "x-zorder-username": credential.username,
    "x-zorder-pin": credential.pin
  };
}

function getOrderAccess(auth: AuthState): AuthAccess | null {
  if (auth.user) {
    return {
      role: "user",
      credential: auth.user
    };
  }

  if (auth.admin) {
    return {
      role: "admin",
      credential: auth.admin
    };
  }

  return null;
}

async function fetchOrders(access: AuthAccess): Promise<ProcessedOrder[]> {
  const response = await fetch(`${apiBase}/orders`, {
    headers: authHeaders(access.role, access.credential)
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  const payload = (await response.json()) as { orders: ProcessedOrder[] };
  return payload.orders;
}

async function completeOrder(adminCredential: AuthCredential, orderId: string): Promise<ProcessedOrder> {
  const response = await fetch(`${apiBase}/orders/${orderId}/complete`, {
    method: "PATCH",
    headers: authHeaders("admin", adminCredential)
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  const payload = (await response.json()) as { order: ProcessedOrder };
  return payload.order;
}

async function fetchInventory(adminCredential: AuthCredential): Promise<InventorySnapshot> {
  const response = await fetch(`${apiBase}/inventory`, {
    headers: authHeaders("admin", adminCredential)
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as InventorySnapshot;
}

async function uploadInventory(adminCredential: AuthCredential, products: InventoryProduct[]) {
  const response = await fetch(`${apiBase}/inventory/upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders("admin", adminCredential)
    },
    body: JSON.stringify({ products })
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as { imported: number; products: InventoryProduct[] };
}

async function updateInventoryProduct(
  adminCredential: AuthCredential,
  productId: string,
  product: InventoryProduct
) {
  const response = await fetch(`${apiBase}/inventory/products/${encodeURIComponent(productId)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders("admin", adminCredential)
    },
    body: JSON.stringify(product)
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as { product: InventoryProduct };
}

async function deleteInventoryProduct(adminCredential: AuthCredential, productId: string) {
  const response = await fetch(`${apiBase}/inventory/products/${encodeURIComponent(productId)}`, {
    method: "DELETE",
    headers: authHeaders("admin", adminCredential)
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
}

async function fetchMenuPreview(): Promise<InventoryProduct[]> {
  try {
    const response = await fetch(`${apiBase}/menu/preview`);
    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as { products?: InventoryProduct[] };
    return payload.products ?? [];
  } catch {
    return [];
  }
}

async function fetchShopConfig(): Promise<ShopBranding> {
  try {
    const response = await fetch(`${apiBase}/config/shop`);
    if (!response.ok) {
      throw new Error("Could not load shop branding");
    }

    const payload = (await response.json()) as Partial<ShopBranding>;
    return {
      ...defaultShopBranding,
      ...payload,
      payment_instructions: payload.payment_instructions ?? defaultShopBranding.payment_instructions
    };
  } catch {
    return defaultShopBranding;
  }
}

async function fetchUserProfile(credential: AuthCredential): Promise<UserProfile> {
  const response = await fetch(`${apiBase}/auth/profile`, {
    headers: authHeaders("user", credential)
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as UserProfile;
}

async function saveUserProfile(
  credential: AuthCredential,
  profile: Pick<UserProfile, "first_name" | "last_name" | "email" | "contact">
): Promise<UserProfile> {
  const response = await fetch(`${apiBase}/auth/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders("user", credential)
    },
    body: JSON.stringify(profile)
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as UserProfile;
}

async function changeUserPassword(credential: AuthCredential, currentPin: string, newPin: string) {
  const response = await fetch(`${apiBase}/auth/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders("user", credential)
    },
    body: JSON.stringify({ current_pin: currentPin, new_pin: newPin })
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
}

function formatUsernameLabel(username: string) {
  if (!username.trim()) {
    return "there";
  }

  return username.charAt(0).toUpperCase() + username.slice(1);
}

function inferEmailFromUsername(username: string) {
  const trimmedUsername = username.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedUsername) ? trimmedUsername : "";
}

async function fetchCustomerMenu(credential: AuthCredential): Promise<CustomerMenuSnapshot> {
  const response = await fetch(`${apiBase}/menu`, {
    headers: authHeaders("user", credential)
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as CustomerMenuSnapshot;
}

async function placeCustomerOrder(
  credential: AuthCredential,
  payload: {
    items: Array<{ product_id: string; quantity: number }>;
    payment_evidence: string;
    notes: string;
  }
): Promise<PlaceOrderResult> {
  const response = await fetch(`${apiBase}/orders/place`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders("user", credential)
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as PlaceOrderResult;
}

async function publishWorkflow(credential: AuthCredential, workflow: WorkflowGeneration["workflow"]) {
  const response = await fetch(`${apiBase}/workflows/publish`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders("admin", credential)
    },
    body: JSON.stringify({ workflow })
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
}

function groupMenuProducts(products: InventoryProduct[]) {
  const grouped = new Map<string, InventoryProduct[]>();

  for (const product of products) {
    const category = product.category.trim() || "Menu";
    grouped.set(category, [...(grouped.get(category) ?? []), product]);
  }

  return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right));
}

createRoot(document.getElementById("root")!).render(<App />);

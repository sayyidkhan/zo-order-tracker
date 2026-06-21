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
import type { AuthRole, ShopBranding, TechStackSection, WorkflowSetupStepId } from "./types";

export const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export const sampleMessages = [
  "Hi I want 12 egg tarts and 2 bandung, paid by PayNow",
  "Can I reserve 6 egg tarts and 1 lemonade tomorrow? bank transfer done",
  "Customer sent PayNow receipt for 2 lemonades and 4 egg tarts",
  "Is the shop open today?"
];

export const workflowChatStorageKey = "zorder:workflow-builder:chat:v4";
export const workflowDraftStorageKey = "zorder:workflow-builder:draft:v1";
export const workflowSetupSteps: Array<{
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
export const workflowBuildProgressSteps = [
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

export const routeHeadings: Record<AuthRole, string> = {
  user: "What would you like to order today?",
  admin: "Business operations admin"
};

export const defaultShopBranding: ShopBranding = {
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

export const techStackHighlights = [
  "Web-first MVP before Telegram automation.",
  "Deterministic JSON workflows for daily order processing.",
  "AI is setup assistance only, not the runtime engine.",
  "Zo is the demo host, data home, and future automation runtime."
];

export const techArchitectureSteps = [
  "Vite React web app",
  "URL routes",
  "TanStack Query",
  "API server",
  "Zod validation",
  "JSON workflow runner",
  "SQLite + workflow files"
];

export const techSourceDocs = ["docs/tech-stack.md", "docs/ZO_INFRA.md", "docs/USER_JOURNEY.md", "docs/workflow-schema.md"];
export const maxPaymentProofPayloadLength = 1_450_000;
export const maxProductImagePayloadLength = 850_000;

export const techStackSections: TechStackSection[] = [
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

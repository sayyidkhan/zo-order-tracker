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

const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.trim();
export const apiBase = configuredApiBase ? configuredApiBase.replace(/\/$/, "") : "";

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
  "Structured customer checkout is the primary order path.",
  "SQLite stores products, orders, order items, and shop config.",
  "Workflow JSON stays deterministic; OpenAI drafting is optional.",
  "Zo serves the built frontend and proxies the Express API."
];

export const techArchitectureSteps = [
  "Vite React web app",
  "Pathname routes",
  "TanStack Query",
  "Express API",
  "Zod validation",
  "SQLite data store",
  "JSON workflows"
];

export const techSourceDocs = [
  "docs/SPEC.md",
  "docs/TECH_STACK.md",
  "docs/ZO_INFRA.md",
  "docs/USER_JOURNEY.md",
  "docs/WORKFLOW_SCHEMA.md"
];
export const maxPaymentProofPayloadLength = 1_450_000;
export const maxProductImagePayloadLength = 850_000;

export const techStackSections: TechStackSection[] = [
  {
    title: "MVP Code Path",
    description: "What the current app actually runs today.",
    items: [
      {
        icon: <Code2 size={20} />,
        label: "Frontend",
        choice: "Vite + React + TypeScript",
        detail: "SPA for the storefront, customer workspace, admin workspace, intro, and public notes.",
        status: "Live"
      },
      {
        icon: <Route size={20} />,
        label: "Routing",
        choice: "Lightweight pathname routing",
        detail: "A small local route helper maps URLs such as /user, /admin, /intro, and /tech-stack.",
        status: "Live"
      },
      {
        icon: <GitBranch size={20} />,
        label: "Server state",
        choice: "TanStack Query",
        detail: "Shop config, orders, inventory, profiles, menus, and workflow calls use query/mutation state.",
        status: "Live"
      },
      {
        icon: <Server size={20} />,
        label: "API runtime",
        choice: "Express",
        detail: "The backend exposes auth, shop config, menu, orders, inventory, workflow, and agent endpoints.",
        status: "Live"
      }
    ]
  },
  {
    title: "Operations Data Path",
    description: "How orders, products, payment proof, and workflow rules stay inspectable.",
    items: [
      {
        icon: <FileJson size={20} />,
        label: "Workflow engine",
        choice: "Deterministic JSON decision tree",
        detail: "Rules match raw order text, return a trace, and explain why an input matched.",
        status: "Live"
      },
      {
        icon: <ShieldCheck size={20} />,
        label: "Validation and auth",
        choice: "Zod + role PIN credentials",
        detail: "MVP guards customer and admin APIs with username/PIN credentials and validates payloads.",
        status: "Live"
      },
      {
        icon: <Database size={20} />,
        label: "Data",
        choice: "Node sqlite + JSON files",
        detail: "SQLite stores products, orders, order items, and shop config; JSON stores users and workflows.",
        status: "Live"
      },
      {
        icon: <Bot size={20} />,
        label: "AI assistance",
        choice: "Local generator by default",
        detail: "OpenAI can draft workflow JSON only when explicitly enabled for setup.",
        status: "Live"
      }
    ]
  },
  {
    title: "Zo Deployment Path",
    description: "How the current app is packaged and where it can scale later.",
    items: [
      {
        icon: <Cloud size={20} />,
        label: "Hosting",
        choice: "Zo HTTP service",
        detail: "The service runs deploy-server.js, serves frontend/dist, and proxies API routes to Express.",
        status: "Live"
      },
      {
        icon: <Layers3 size={20} />,
        label: "App package",
        choice: "One repo, two app folders",
        detail: "frontend/ and backend/ stay together so deployment can build and run one service.",
        status: "Live"
      },
      {
        icon: <Database size={20} />,
        label: "Demo data",
        choice: "SQLite in backend/data",
        detail: "Local demo data is easy to seed, inspect, back up, and explain during the hackathon.",
        status: "Live"
      },
      {
        icon: <Cpu size={20} />,
        label: "Future scale",
        choice: "Production DB and workers later",
        detail: "Move beyond SQLite only when tenant separation, exports, or background jobs require it.",
        status: "Later"
      }
    ]
  }
];

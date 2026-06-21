import type * as React from "react";

export type PaymentStatus = "paid" | "partial" | "unpaid" | "unknown";
export type FulfillmentStatus = "active" | "completed";
export type CustomerOrdersTab = "current" | "history";

export type ProcessedOrder = {
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

export type ProcessResult = {
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

export type WorkflowCondition = {
  containsAny?: string[];
  containsAll?: string[];
  matchesRegex?: string;
  amountDetected?: boolean;
};
export type WorkflowRule = {
  id: string;
  if: WorkflowCondition;
  then: string;
};
export type WorkflowDecisionState = {
  type: "decision";
  rules: WorkflowRule[];
  else: string;
};
export type WorkflowActionState = {
  type: "action";
  action: "create_order" | "update_payment_status" | "needs_review" | "ask_follow_up";
  payment_status?: PaymentStatus;
  message?: string;
  required_fields?: string[];
};
export type WorkflowState = WorkflowDecisionState | WorkflowActionState;

export type WorkflowGeneration = {
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
export type WorkflowGenerateInput = {
  businessDescription?: string;
  changeRequest?: string;
  existingWorkflow?: WorkflowGeneration["workflow"] | null;
};
export type WorkflowSetupStepId = "products";
export type WorkflowSetupAnswers = Record<WorkflowSetupStepId, string>;
export type WorkflowChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  createdAt: string;
  status?: "ok" | "error";
};

export type AuthRole = "user" | "admin";
export type AppRoute = "intro" | "login" | AuthRole | "tech-stack" | "why-zo-computer";
export type AuthMode = "sign-in" | "sign-up";
export type AdminTab = "orders" | "rules" | "inventory" | "branding";
export type WorkflowBuilderTab = "rules" | "draft" | "test";
export type CapturePeriodDays = 1 | 3 | 7 | 30 | 90 | 365;
export type InventorySubTab = "inventory" | "sales" | "analytics";
export type UserTab = "menu" | "my-orders" | "profile";
export type OrderFlowTab = "choice" | "menu" | "chatbot" | "checkout";
export type ChatOrderStep = "choose" | "review" | "payment" | "complete";
export type UserProfile = {
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  contact: string;
  display_name: string;
  can_change_password: boolean;
  is_demo_account?: boolean;
};
export type AuthCredential = {
  username: string;
  pin: string;
};
export type AuthState = Record<AuthRole, AuthCredential | null>;
export type ShopBranding = {
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
export type CustomerMenuSnapshot = {
  products: InventoryProduct[];
  payment_methods: string[];
};
export type PlaceOrderResult = {
  order_id: string;
  order: ProcessedOrder;
  workflow: {
    status: string;
    message: string;
    explanation: string;
  };
};
export type CartLine = {
  product: InventoryProduct;
  quantity: number;
};
export type InventoryProduct = {
  id?: string;
  name: string;
  category: string;
  unit_price: number | null;
  image_url: string;
  is_active: boolean;
  updated_at?: string;
};
export type InventoryProductInput = {
  name?: unknown;
  category?: unknown;
  unit_price?: unknown;
  image_url?: unknown;
  is_active?: unknown;
};
export type InventoryProductDraft = {
  name: string;
  category: string;
  unit_price: string;
  image_url: string;
  is_active: boolean;
};
export type InventorySnapshot = {
  products: InventoryProduct[];
  orders: ProcessedOrder[];
};
export type AuthAccess = {
  role: AuthRole;
  credential: AuthCredential;
};
export type TechStackStatus = "Live" | "Target" | "Later";
export type TechStackItem = {
  icon: React.ReactNode;
  label: string;
  choice: string;
  detail: string;
  status: TechStackStatus;
};
export type TechStackSection = {
  title: string;
  description: string;
  items: TechStackItem[];
};

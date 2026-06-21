import * as React from "react";
import { useEffect } from "react";
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
  AuthCredential,
  CartLine,
  ChatOrderStep,
  CustomerOrdersTab,
  InventoryProduct,
  OrderFlowTab,
  PlaceOrderResult,
  ProcessedOrder,
  ShopBranding,
  UserProfile,
  UserTab
} from "../../types";
import { ErrorNotice, PinInput, RequiredFieldLabel } from "../../components/FormControls";
import { PaymentProofImageModal, ProductImageDisplay } from "../../components/ImagePreview";
import { FulfillmentPill, PaymentEvidenceDisplay, StatusPill } from "../../components/PaymentEvidence";
import { OrderPdfButton } from "../../components/OrderReceipt";
import {
  authStorageKey,
  buildAcceptedPaymentMethods,
  changeUserPassword,
  fetchCustomerMenu,
  formatAmount,
  formatCaptureDate,
  formatCaptureTime,
  formatChatTime,
  formatOrderId,
  formatPaynowNumber,
  formatUsernameLabel,
  getOrderCustomerLabel,
  groupMenuProducts,
  inferEmailFromUsername,
  isActiveOrder,
  isCompletedOrder,
  isPaymentProofImage,
  isPaymentProofPdf,
  paymentProofFileToDataUrl,
  placeCustomerOrder,
  saveUserProfile,
  useStateValue
} from "../../lib/domain";

export function UserView({
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
  const [orderFlowTab, setOrderFlowTab] = useStateValue<OrderFlowTab>("choice");
  const [chatStep, setChatStep] = useStateValue<ChatOrderStep>("choose");
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
      const shouldStayInChat = orderFlowTab === "chatbot";
      setCart([]);
      setNotes("");
      setPaymentProofImage("");
      setPaymentProofNotice(null);
      setPlacedNotice(result.workflow.message);
      setOrdersSubTab("current");
      if (shouldStayInChat) {
        setChatStep("complete");
      } else {
        setActiveTab("my-orders");
      }
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

  useEffect(() => {
    if (!cartCount && chatStep !== "choose" && chatStep !== "complete") {
      setChatStep("choose");
    }
  }, [cartCount, chatStep, setChatStep]);

  const tabs: Array<{ id: UserTab; label: string; meta?: string; icon: React.ReactNode }> = [
    {
      id: "menu",
      label: "Menu",
      meta: cartCount ? `${cartCount} in cart` : undefined,
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

    try {
      const proofData = await paymentProofFileToDataUrl(file);
      setPaymentProofImage(proofData);
      setPaymentProofNotice(
        isPaymentProofPdf(proofData)
          ? "Payment proof PDF uploaded. You can place your order after checking the details."
          : "Payment proof image uploaded. You can place your order after checking the details."
      );
    } catch (cause) {
      setPaymentProofNotice(cause instanceof Error ? cause.message : "Could not read payment proof.");
    }
  }

  function updateCartQuantity(product: InventoryProduct, nextQuantity: number) {
    if (orderFlowTab === "chatbot" && chatStep === "complete" && nextQuantity > 0) {
      setChatStep("choose");
    }

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

  function selectUserTab(tab: UserTab) {
    setActiveTab(tab);
    if (tab === "menu") {
      setOrderFlowTab("choice");
    }
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
            onClick={() => selectUserTab(tab.id)}
          >
            {tab.icon}
            <span className="journey-tab-copy">
              <span className="journey-tab-label">{tab.label}</span>
              {tab.meta ? <span className="journey-tab-meta">{tab.meta}</span> : null}
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
            {orderFlowTab === "choice" ? (
              <OrderMethodChoicePanel
                cartCount={cartCount}
                onUseMenu={() => setOrderFlowTab("menu")}
                onUseChatbot={() => setOrderFlowTab("chatbot")}
              />
            ) : null}

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
              <div className="customer-flow-actions">
                <button className="text-link" type="button" onClick={() => setOrderFlowTab("choice")}>
                  Change order method
                </button>
              {cartCount ? (
                <button className="secondary-button" type="button" onClick={() => setOrderFlowTab("checkout")}>
                  Checkout ({cartCount})
                  <ArrowRight size={16} />
                </button>
              ) : null}
              </div>
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
                            <ProductImageDisplay
                              imageUrl={product.image_url}
                              name={product.name}
                              className="customer-menu-card-image"
                            />
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

            {orderFlowTab === "chatbot" ? (
              <OrderChatbotPanel
                shopBranding={shopBranding}
                products={products}
                productsByCategory={productsByCategory}
                cart={cart}
                cartCount={cartCount}
                cartTotal={cartTotal}
                hasPartialPricing={hasPartialPricing}
                chatStep={chatStep}
                notes={notes}
                paymentProofImage={paymentProofImage}
                paymentProofNotice={paymentProofNotice}
                acceptedPaymentMethods={acceptedPaymentMethods}
                hasPayNowDetails={hasPayNowDetails}
                hasBankTransferDetails={hasBankTransferDetails}
                placeOrderMutation={placeOrderMutation}
                onSubmitOrder={() => {
                  setPlacedNotice(null);
                  placeOrderMutation.mutate();
                }}
                onChatStepChange={setChatStep}
                onNotesChange={setNotes}
                onPaymentProofUpload={handlePaymentProofUpload}
                onPaymentProofRemove={() => {
                  setPaymentProofImage("");
                  setPaymentProofNotice("Payment proof removed.");
                }}
                onProductQuantityChange={updateCartQuantity}
                getCartQuantity={getCartQuantity}
                onViewOrders={() => {
                  setOrdersSubTab("current");
                  setActiveTab("my-orders");
                }}
                onChangeOrderMethod={() => setOrderFlowTab("choice")}
                onBrowseMenu={() => setOrderFlowTab("menu")}
              />
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
              <div className="customer-flow-actions">
                <button className="text-link" type="button" onClick={() => setOrderFlowTab("choice")}>
                  Change order method
                </button>
                {cartCount ? <span className="count-pill">{cartCount} items</span> : null}
              </div>
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
                          <PaymentQrPreview src={shopBranding.paynow_qr_image} />
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
                  Upload a screenshot, photo, or PDF of your PayNow or bank transfer receipt.
                </p>
                {paymentProofImage ? (
                  <PaymentProofDraftPreview
                    evidence={paymentProofImage}
                    onRemove={() => {
                      setPaymentProofImage("");
                      setPaymentProofNotice("Payment proof removed.");
                    }}
                  />
                ) : null}
                <label className="secondary-button payment-proof-upload-button" htmlFor="payment-proof">
                  <Upload size={16} />
                  Upload payment proof
                </label>
                <input
                  id="payment-proof"
                  className="visually-hidden"
                  type="file"
                  accept="image/*,application/pdf,.pdf"
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
              setOrderFlowTab("choice");
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

function OrderMethodChoicePanel({
  cartCount,
  onUseMenu,
  onUseChatbot
}: {
  cartCount: number;
  onUseMenu: () => void;
  onUseChatbot: () => void;
}) {
  return (
    <section className="panel order-method-choice-panel" aria-labelledby="order-method-heading">
      <div className="order-method-heading">
        <p className="section-label">order preference</p>
        <h2 id="order-method-heading">How would you prefer to order?</h2>
        <p>We recommend the menu for the smoothest session. Use the chatbot if you want step-by-step guidance.</p>
      </div>

      <div className="order-method-actions">
        <button className="order-method-card is-recommended" type="button" onClick={onUseMenu}>
          <span className="order-method-icon" aria-hidden="true">
            <ShoppingBag size={24} />
          </span>
          <span className="order-method-copy">
            <strong>Use Menu</strong>
            <small>Recommended</small>
          </span>
          <span className="order-method-badge">Smoothest</span>
        </button>

        <button className="order-method-card" type="button" onClick={onUseChatbot}>
          <span className="order-method-icon" aria-hidden="true">
            <Bot size={24} />
          </span>
          <span className="order-method-copy">
            <strong>Use Chatbot</strong>
            <small>{cartCount ? `${cartCount} selected · guided steps` : "Guided steps"}</small>
          </span>
          <ArrowRight size={20} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

function OrderChatbotPanel({
  shopBranding,
  products,
  productsByCategory,
  cart,
  cartCount,
  cartTotal,
  hasPartialPricing,
  chatStep,
  notes,
  paymentProofImage,
  paymentProofNotice,
  acceptedPaymentMethods,
  hasPayNowDetails,
  hasBankTransferDetails,
  placeOrderMutation,
  onSubmitOrder,
  onChatStepChange,
  onNotesChange,
  onPaymentProofUpload,
  onPaymentProofRemove,
  onProductQuantityChange,
  getCartQuantity,
  onViewOrders,
  onChangeOrderMethod,
  onBrowseMenu
}: {
  shopBranding: ShopBranding;
  products: InventoryProduct[];
  productsByCategory: Array<[string, InventoryProduct[]]>;
  cart: CartLine[];
  cartCount: number;
  cartTotal: number;
  hasPartialPricing: boolean;
  chatStep: ChatOrderStep;
  notes: string;
  paymentProofImage: string;
  paymentProofNotice: string | null;
  acceptedPaymentMethods: string[];
  hasPayNowDetails: boolean;
  hasBankTransferDetails: boolean;
  placeOrderMutation: UseMutationResult<PlaceOrderResult, Error, void>;
  onSubmitOrder: () => void;
  onChatStepChange: React.Dispatch<React.SetStateAction<ChatOrderStep>>;
  onNotesChange: React.Dispatch<React.SetStateAction<string>>;
  onPaymentProofUpload: (file: File | null) => Promise<void>;
  onPaymentProofRemove: () => void;
  onProductQuantityChange: (product: InventoryProduct, nextQuantity: number) => void;
  getCartQuantity: (productId?: string) => number;
  onViewOrders: () => void;
  onChangeOrderMethod: () => void;
  onBrowseMenu: () => void;
}) {
  const orderSteps: Array<{ id: ChatOrderStep; label: string }> = [
    { id: "choose", label: "Choose" },
    { id: "review", label: "Review" },
    { id: "payment", label: "Pay" },
    { id: "complete", label: "Complete" }
  ];
  const currentStepIndex = Math.max(0, orderSteps.findIndex((step) => step.id === chatStep));
  const canSubmitOrder = cartCount > 0 && Boolean(paymentProofImage) && !placeOrderMutation.isPending;

  return (
    <section
      className="customer-order-chatbot panel"
      aria-labelledby="customer-chatbot-heading"
      id="customer-order-flow-chatbot"
      role="tabpanel"
    >
      <div className="panel-heading">
        <div>
          <p className="section-label">order chatbot</p>
          <h2 id="customer-chatbot-heading">Guided ordering</h2>
        </div>
        <div className="customer-flow-actions">
          <button className="text-link" type="button" onClick={onChangeOrderMethod}>
            Change order method
          </button>
          {cartCount ? <span className="count-pill">{cartCount} selected</span> : null}
        </div>
      </div>

      <div className="order-chatbot-steps" aria-label="Chatbot order progress">
        {orderSteps.map((step, index) => (
          <span
            className={[
              "order-chatbot-step",
              index < currentStepIndex ? "is-done" : "",
              index === currentStepIndex ? "is-active" : ""
            ]
              .filter(Boolean)
              .join(" ")}
            key={step.id}
          >
            {step.label}
          </span>
        ))}
      </div>

      <div className="order-chatbot-log" aria-live="polite">
        <article className="order-chat-message is-bot">
          <div className="order-chat-avatar" aria-hidden="true">
            <Bot size={16} />
          </div>
          <div className="order-chat-bubble">
            <strong>Welcome to {shopBranding.business_name}</strong>
            <p>{shopBranding.description}</p>
          </div>
        </article>

        {chatStep !== "complete" ? (
          <article className="order-chat-message is-bot">
            <div className="order-chat-avatar" aria-hidden="true">
              <Bot size={16} />
            </div>
            <div className="order-chat-bubble">
              <strong>What would you like to eat?</strong>
              <p>Tap the products below and set the quantity.</p>
            </div>
          </article>
        ) : null}

        {chatStep === "choose" ? (
          <>
            {products.length ? (
              <div className="chatbot-product-picker">
                {productsByCategory.map(([category, categoryProducts]) => (
                  <section className="chatbot-product-group" key={category} aria-label={category}>
                    <h3>{category}</h3>
                    <div className="customer-menu-grid">
                      {categoryProducts.map((product) => {
                        const quantity = getCartQuantity(product.id);
                        return (
                          <article
                            className={`customer-menu-card${quantity ? " is-selected" : ""}`}
                            key={product.id}
                          >
                            <ProductImageDisplay
                              imageUrl={product.image_url}
                              name={product.name}
                              className="customer-menu-card-image"
                            />
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
                                onClick={() => onProductQuantityChange(product, quantity - 1)}
                              >
                                <Minus size={16} />
                              </button>
                              <span aria-live="polite">{quantity}</span>
                              <button
                                className="icon-button"
                                type="button"
                                aria-label={`Add one ${product.name}`}
                                onClick={() => onProductQuantityChange(product, quantity + 1)}
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
              <div className="chatbot-action-card">
                <CartTotalsSummary
                  cartCount={cartCount}
                  cartTotal={cartTotal}
                  hasPartialPricing={hasPartialPricing}
                />
                <button className="primary-button" type="button" onClick={() => onChatStepChange("review")}>
                  Review total
                  <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              <button className="secondary-button chatbot-browse-button" type="button" onClick={onBrowseMenu}>
                Browse full menu
              </button>
            )}
          </>
        ) : null}

        {chatStep === "review" ? (
          <>
            <article className="order-chat-message is-user">
              <div className="order-chat-bubble">
                <strong>Selected order</strong>
                <p>{formatCartOrderSummary(cart)}</p>
              </div>
            </article>
            <article className="order-chat-message is-bot">
              <div className="order-chat-avatar" aria-hidden="true">
                <Bot size={16} />
              </div>
              <div className="order-chat-bubble">
                <strong>Please acknowledge the total</strong>
                <p>Check the subtotal and total before payment.</p>
              </div>
            </article>
            <div className="chatbot-action-card">
              <CartTotalsSummary
                cartCount={cartCount}
                cartTotal={cartTotal}
                hasPartialPricing={hasPartialPricing}
              />
              <div className="chatbot-action-row">
                <button className="secondary-button" type="button" onClick={() => onChatStepChange("choose")}>
                  Change items
                </button>
                <button
                  className="primary-button"
                  type="button"
                  disabled={!cartCount}
                  onClick={() => onChatStepChange("payment")}
                >
                  I acknowledge total
                  <CheckCircle2 size={16} />
                </button>
              </div>
            </div>
          </>
        ) : null}

        {chatStep === "payment" ? (
          <>
            <article className="order-chat-message is-user">
              <div className="order-chat-bubble">
                <strong>Total acknowledged</strong>
                <p>I am ready to pay {formatAmount(cartTotal, "SGD")}.</p>
              </div>
            </article>
            <article className="order-chat-message is-bot">
              <div className="order-chat-avatar" aria-hidden="true">
                <Bot size={16} />
              </div>
              <div className="order-chat-bubble">
                <strong>Make payment and upload proof</strong>
                <p>Payment proof is required before the order is completed.</p>
              </div>
            </article>

            <div className="chatbot-action-card">
              <div className="customer-payment-card chatbot-payment-card">
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
                        <PaymentQrPreview src={shopBranding.paynow_qr_image} />
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
                <p className="customer-payment-methods">Accepted: {acceptedPaymentMethods.join(" · ")}</p>
              </div>

              <p className="customer-payment-warning" role="note">
                You must make payment first before placing your order. All payments are non-refundable - please
                check your order before paying.
              </p>

              <label className="field-label" htmlFor="chatbot-order-notes">
                Pickup or delivery notes (optional)
              </label>
              <textarea
                id="chatbot-order-notes"
                className="compact-textarea"
                value={notes}
                onChange={(event) => onNotesChange(event.target.value)}
                placeholder="Example: Pick up at 6pm"
              />

              <label className="field-label" htmlFor="chatbot-payment-proof">
                Payment proof
              </label>
              <p className="branding-helper-text customer-payment-proof-copy">
                Upload a screenshot, photo, or PDF of your PayNow or bank transfer receipt.
              </p>
              {paymentProofImage ? (
                <PaymentProofDraftPreview evidence={paymentProofImage} onRemove={onPaymentProofRemove} />
              ) : null}
              <label className="secondary-button payment-proof-upload-button" htmlFor="chatbot-payment-proof">
                <Upload size={16} />
                Upload payment proof
              </label>
              <input
                id="chatbot-payment-proof"
                className="visually-hidden"
                type="file"
                accept="image/*,application/pdf,.pdf"
                onChange={(event) => {
                  void onPaymentProofUpload(event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
              />
              {paymentProofNotice ? <p className="branding-helper-text">{paymentProofNotice}</p> : null}

              <button
                className="primary-button"
                type="button"
                disabled={!canSubmitOrder}
                onClick={onSubmitOrder}
              >
                {placeOrderMutation.isPending ? <Loader2 className="spin" size={18} /> : <CheckCircle2 size={18} />}
                Complete order · {formatAmount(cartTotal, "SGD")}
              </button>

              {placeOrderMutation.error ? <ErrorNotice message={placeOrderMutation.error.message} /> : null}
            </div>
          </>
        ) : null}

        {chatStep === "complete" ? (
          <>
            <article className="order-chat-message is-bot">
              <div className="order-chat-avatar" aria-hidden="true">
                <Bot size={16} />
              </div>
              <div className="order-chat-bubble">
                <strong>Order complete</strong>
                <p>Payment proof uploaded successfully. You can track this order in My orders.</p>
              </div>
            </article>
            <div className="chatbot-action-card chatbot-complete-card">
              <button className="primary-button" type="button" onClick={onViewOrders}>
                View my orders
                <ArrowRight size={16} />
              </button>
              <button className="secondary-button" type="button" onClick={() => onChatStepChange("choose")}>
                Start another order
              </button>
            </div>
          </>
        ) : null}
      </div>
    </section>
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
        <div className="customer-order-card-title">
          <strong>{order.order_summary}</strong>
          <span className="order-id-chip">ID {formatOrderId(order)}</span>
        </div>
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
      <div className="customer-order-actions">
        <OrderPdfButton order={order} />
      </div>
    </article>
  );
}

function PaymentQrPreview({ src }: { src: string }) {
  const [isOpen, setIsOpen] = useStateValue(false);

  return (
    <div className="customer-payment-qr-preview">
      <button
        className="customer-payment-qr-button"
        type="button"
        aria-label="Open larger PayNow QR code"
        onClick={() => setIsOpen(true)}
      >
        <img className="customer-payment-qr" src={src} alt="PayNow QR code" />
        <span className="customer-payment-qr-helper">Click QR to enlarge</span>
      </button>
      {isOpen ? (
        <PaymentProofImageModal
          src={src}
          onClose={() => setIsOpen(false)}
          ariaLabel="Larger PayNow QR code"
          alt="Larger PayNow QR code"
          variant="qr"
        />
      ) : null}
    </div>
  );
}

function PaymentProofDraftPreview({
  evidence,
  onRemove
}: {
  evidence: string;
  onRemove: () => void;
}) {
  const [isImageOpen, setIsImageOpen] = useStateValue(false);

  return (
    <div className="payment-proof-preview">
      {isPaymentProofImage(evidence) ? (
        <button
          className="payment-proof-preview-action"
          type="button"
          onClick={() => setIsImageOpen(true)}
        >
          <img src={evidence} alt="Uploaded payment proof" />
          <span>Open uploaded image</span>
          <Maximize2 size={16} />
        </button>
      ) : isPaymentProofPdf(evidence) ? (
        <a
          className="payment-proof-preview-action payment-proof-preview-pdf"
          href={evidence}
          target="_blank"
          rel="noreferrer"
        >
          <FileText size={22} />
          <span>Open uploaded PDF</span>
          <ExternalLink size={16} />
        </a>
      ) : (
        <span>{evidence}</span>
      )}
      <button className="icon-button" type="button" aria-label="Remove payment proof" onClick={onRemove}>
        <X size={16} />
      </button>
      {isImageOpen ? <PaymentProofImageModal src={evidence} onClose={() => setIsImageOpen(false)} /> : null}
    </div>
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

function formatCartOrderSummary(cart: CartLine[]) {
  if (!cart.length) {
    return "No items selected yet.";
  }

  return cart.map((line) => `${line.quantity} x ${line.product.name}`).join(", ");
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

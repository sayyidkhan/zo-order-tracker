import * as React from "react";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
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
import type { AppRoute, AuthCredential, AuthMode, AuthRole, InventoryProduct, ShopBranding } from "../../types";
import {
  apiBase,
  techArchitectureSteps,
  techSourceDocs,
  techStackHighlights,
  techStackSections
} from "../../constants";
import { BrandMark } from "../../components/BrandMark";
import { ErrorNotice, PinInput } from "../../components/FormControls";
import { ProductImageDisplay } from "../../components/ImagePreview";
import {
  buildAcceptedPaymentMethods,
  fetchDemoLoginCredentials,
  fetchMenuPreview,
  formatAmount,
  readApiError,
  useStateValue
} from "../../lib/domain";

export function IntroView({ onNavigate }: { onNavigate: (route: AppRoute) => void }) {
  return (
    <div className="intro-page">
      <header className="intro-hero">
        <BrandMark businessName="zorder" markLetter="Z" onHomeClick={() => onNavigate("user")} />
        <p className="section-label">order tracking for home businesses</p>
        <h1 className="intro-headline">Put messy orders and manual payment tracking in one place.</h1>
        <p className="intro-lead">
          Home business owners juggle orders, production, and payment proof. zorder gives you one calm workspace to
          publish products, collect payment evidence, and see what needs review.
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
          <h2 id="intro-problem-heading">Orders and payments get hard to track</h2>
          <p>
            Small sellers can take orders quickly, but the tracking becomes messy once payment proof, fulfillment
            status, and customer follow-up live in different places.
          </p>
          <ul className="intro-list">
            <li>Orders are easy to miss when the list lives in notes or memory</li>
            <li>Payment tracking stays manual after PayNow or bank transfer</li>
            <li>Full CRM tools add admin work you do not need</li>
          </ul>
        </section>

        <section className="intro-card intro-solution" aria-labelledby="intro-solution-heading">
          <p className="section-label">the solution</p>
          <h2 id="intro-solution-heading">One lightweight tracker for daily orders</h2>
          <p>
            Publish a simple menu, collect payment proof, and keep every order visible from one admin dashboard. The
            workflow stays practical for owner-operated shops that do not need a full commerce stack yet.
          </p>
          <ul className="intro-list">
            <li>Show products, prices, and payment instructions clearly</li>
            <li>Capture payment evidence before an order is created</li>
            <li>Track active and completed orders from the merchant view</li>
          </ul>
        </section>
      </div>

      <section className="intro-steps" aria-labelledby="intro-steps-heading">
        <p className="section-label">how it works</p>
        <h2 id="intro-steps-heading">Three steps, no CRM overhead</h2>
        <ol className="intro-step-list">
          <li>
            <strong>Set up rules</strong>
            <span>Configure your shop, products, and payment instructions.</span>
          </li>
          <li>
            <strong>Process orders</strong>
            <span>Let customers choose products, upload payment proof, and place orders.</span>
          </li>
          <li>
            <strong>Capture paid sales</strong>
            <span>See paid orders, capture dates, and review-needed inputs in one place.</span>
          </li>
        </ol>
      </section>

      <footer className="intro-footer">
        <p>
          Chat intake can be added later for customers who still prefer messaging. Today, zorder focuses on the tracker:
          orders, payment proof, and merchant review.{" "}
          <button className="text-link" type="button" onClick={() => onNavigate("tech-stack")}>
            View the tech stack
          </button>
        </p>
      </footer>
    </div>
  );
}

export function TechStackView({ onNavigate }: { onNavigate: (route: AppRoute) => void }) {
  return (
    <div className="tech-stack-page">
      <header className="tech-hero">
        <div className="tech-hero-copy">
          <BrandMark businessName="zorder" markLetter="Z" onHomeClick={() => onNavigate("user")} />
          <p className="section-label">technical architecture</p>
          <h1 className="intro-headline">zorder tech stack</h1>
          <p className="intro-lead">
            A fast hackathon MVP for home businesses: publish products, capture payment proof, track orders in SQLite,
            and keep the path open for future chat/message-channel intake after the core workflow is stable.
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

export function WhyZoComputerView({ onNavigate }: { onNavigate: (route: AppRoute) => void }) {
  const zoPricingUrl = "https://www.zo.computer/pricing";
  const zoHostingUrl = "https://www.zo.computer/app/hosting";

  const infraCards = [
    {
      title: "Frontend",
      copy: "The customer storefront and admin workspace ship from the same place.",
      icon: <Layers3 size={18} />
    },
    {
      title: "Backend",
      copy: "API routes, workflow logic, and order processing run beside the app.",
      icon: <Server size={18} />
    },
    {
      title: "Database",
      copy: "SQLite keeps the MVP local-first and inspectable while the system is still small.",
      icon: <Database size={18} />
    },
    {
      title: "Hosting and URL",
      copy: "The deploy target, hosting surface, and reachable URL are covered together.",
      icon: <Globe2 size={18} />
    },
    {
      title: "Operator help",
      copy:
        "You can talk to Zo to clarify errors, inspect what changed, and fix common app issues even when the app is down.",
      icon: <Bot size={18} />
    }
  ];

  const setupSteps = [
    "Start from an empty workspace.",
    "Add the frontend, backend, and SQLite file.",
    "Seed demo users, inventory, and shop config.",
    "Deploy the site and iterate from the same environment."
  ];

  const scaleRows = [
    {
      users: "0",
      tier: "Free",
      monthly: "$0",
      perThousand: "$0",
      bar: 2,
      perThousandBar: 2,
      note: "Demo, build, and validate while sleep mode is acceptable."
    },
    {
      users: "100",
      tier: "Free",
      monthly: "$0",
      perThousand: "$0",
      bar: 2,
      perThousandBar: 2,
      note: "Serve early customers while sleep mode and one service are acceptable."
    },
    {
      users: "1K",
      tier: "Basic",
      monthly: "$18",
      perThousand: "$18",
      bar: 9,
      perThousandBar: 10,
      note: "Move to always-on once order flow reliability starts to matter."
    },
    {
      users: "10K",
      tier: "Pro",
      monthly: "$64",
      perThousand: "$6.40",
      bar: 32,
      perThousandBar: 4,
      note: "Upgrade when backend work, traffic, or service count grows."
    },
    {
      users: "100K",
      tier: "Ultra + scale review",
      monthly: "$200+",
      perThousand: "$2+",
      bar: 100,
      perThousandBar: 2,
      note: "Start capacity review before assuming the public tier can carry more traffic."
    }
  ];

  const tierRows = [
    {
      tier: "Free",
      price: "$0/mo",
      fit: "Build from zero and serve first pilot customers.",
      source: "1 service, sleep mode, limited CPU and memory, 100GB disk."
    },
    {
      tier: "Basic",
      price: "$18/mo",
      fit: "Live MVP and first real users.",
      source: "Always on, 5 services, 3 custom domains, 4 cores, 32GB RAM."
    },
    {
      tier: "Pro",
      price: "$64/mo",
      fit: "Growing product with heavier backend work.",
      source: "Always on, 10 services, 5 custom domains, 16 cores, 128GB RAM."
    },
    {
      tier: "Ultra",
      price: "$200/mo",
      fit: "High-volume testing before scale architecture review.",
      source: "Always on, 50 services, 10 custom domains, 64 cores, 512GB RAM."
    },
    {
      tier: "Scale review",
      price: "Custom",
      fit: "Above 100K DAU, contact Zo Computer for this level of service.",
      source: "Large-scale architecture depends on traffic shape, concurrency, data, and ops needs."
    }
  ];

  return (
    <div className="why-zo-page">
      <header className="why-zo-hero">
        <div className="why-zo-hero-copy">
          <BrandMark businessName="zorder" markLetter="Z" onHomeClick={() => onNavigate("user")} />
          <h1>Why deploy on Zo Computer?</h1>
          <p>
            Start from 0, then scale cost as your userbase increases. Zo Computer keeps the application in one
            place: frontend, backend, database, hosting, and URL.
          </p>
          <div className="why-zo-value-strip" aria-label="Main Zo Computer deployment benefit">
            <span>Start from 0</span>
            <strong>Scale cost with real usage</strong>
            <small>No heavy infra commitment before demand exists.</small>
          </div>
          <div className="why-zo-value-strip" aria-label="Main Zo Computer operator benefit">
            <span>Best part</span>
            <strong>Talk to Zo when things break</strong>
            <small>Clarify issues and fix the app even when it is down. No developer is required for common fixes.</small>
          </div>
          <div className="why-zo-actions">
            <button className="primary-button" type="button" onClick={() => onNavigate("user")}>
              <Cloud size={18} />
              Open zorder
              <ArrowRight size={16} />
            </button>
            <button className="secondary-button" type="button" onClick={() => onNavigate("tech-stack")}>
              <Workflow size={18} />
              View tech stack
            </button>
          </div>
        </div>

        <aside className="why-zo-control-plane" aria-label="Zo Computer deployment summary">
          <div className="why-zo-control-top">
            <span>Zo Computer</span>
            <strong>one workspace</strong>
          </div>
          <div className="why-zo-control-grid">
            <span>FE</span>
            <span>BE</span>
            <span>DB</span>
            <span>URL</span>
          </div>
          <p>Start from zero, keep the moving parts together, then increase spend only when the userbase grows.</p>
        </aside>
      </header>

      <section className="why-zo-section" aria-labelledby="why-zo-infra-heading">
        <div className="why-zo-section-heading">
          <h2 id="why-zo-infra-heading">Infra in one place</h2>
          <p>
            For a small product like zorder, fewer deployment surfaces means faster iteration and fewer operational
            questions during demo, testing, and early customer use.
          </p>
        </div>
        <div className="why-zo-infra-grid">
          {infraCards.map((card) => (
            <article className="why-zo-card" key={card.title}>
              <div className="why-zo-card-icon">{card.icon}</div>
              <h3>{card.title}</h3>
              <p>{card.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="why-zo-scale-section" aria-labelledby="why-zo-scale-heading">
        <div className="why-zo-section-heading">
          <p className="section-label">cost path</p>
          <h2 id="why-zo-scale-heading">Approximate infra cost from 0 to 100K DAU</h2>
          <p>
            This is a planning estimate using Zo&apos;s public plan prices. DAU means daily active users for a lightweight
            order app, not total registered users or guaranteed concurrent capacity. Free can already serve first
            customers; upgrade when uptime, service count, traffic, or reliability expectations increase.
          </p>
          <p>
            Above 100K DAU, contact the Zo Computer team for this level of service. Do not assume the public tiers
            can safely carry that traffic without a dedicated scale plan. AI usage, backups, payment fees, bandwidth,
            storage growth, and external services are not included.
          </p>
        </div>

        <div className="why-zo-scale-grid">
          <article className="why-zo-chart-card" aria-labelledby="why-zo-monthly-chart-heading">
            <div className="why-zo-chart-heading">
              <h3 id="why-zo-monthly-chart-heading">Monthly Zo plan floor</h3>
              <span>platform only</span>
            </div>
            <div className="why-zo-scale-chart" aria-label="Approximate monthly Zo plan cost by user count">
              {scaleRows.map((row) => (
                <div className="why-zo-scale-row" key={`monthly-${row.users}`}>
                  <span className="why-zo-scale-users">{row.users}</span>
                  <div className="why-zo-scale-track">
                    <span style={{ width: `${row.bar}%` }} />
                  </div>
                  <strong>{row.monthly}</strong>
                  <em>{row.tier}</em>
                </div>
              ))}
            </div>
          </article>

          <article className="why-zo-chart-card" aria-labelledby="why-zo-efficiency-chart-heading">
            <div className="why-zo-chart-heading">
              <h3 id="why-zo-efficiency-chart-heading">Effective cost per 1K DAU</h3>
              <span>daily active users</span>
            </div>
            <div className="why-zo-scale-chart" aria-label="Approximate effective platform cost per thousand daily active users">
              {scaleRows.map((row) => (
                <div className="why-zo-scale-row" key={`per-thousand-${row.users}`}>
                  <span className="why-zo-scale-users">{row.users}</span>
                  <div className="why-zo-scale-track is-efficiency">
                    <span style={{ width: `${Math.max(row.perThousandBar, 2)}%` }} />
                  </div>
                  <strong>{row.perThousand}</strong>
                  <em>{row.tier}</em>
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className="why-zo-tier-table" aria-label="Recommended Zo tier by scale">
          {tierRows.map((row) => (
            <article className="why-zo-tier-row" key={row.tier}>
              <div>
                <span>{row.tier}</span>
                <strong>{row.price}</strong>
              </div>
              <p>{row.fit}</p>
              <small>{row.source}</small>
            </article>
          ))}
        </div>

        <div className="why-zo-scale-gate" aria-label="Recommendation above 100K daily active users">
          <strong>100K+ DAU scale gate</strong>
          <p>
            Keep Zo as the fast starting point, but do not treat public pricing as the whole answer for this level
            of service. Contact Zo Computer before planning traffic above 100K DAU, and compare whether a hyperscaler
            architecture is needed for traffic, database, media, backups, observability, and operational control.
          </p>
        </div>

        <div className="why-zo-scale-notes">
          {scaleRows.map((row) => (
            <span key={`note-${row.users}`}>
              <strong>{row.users}</strong> {row.note}
            </span>
          ))}
        </div>

        <div className="why-zo-source-links" aria-label="Zo website references">
          <a href={zoPricingUrl} target="_blank" rel="noreferrer">
            Zo pricing
            <ExternalLink size={14} />
          </a>
          <a href={zoHostingUrl} target="_blank" rel="noreferrer">
            Zo hosting
            <ExternalLink size={14} />
          </a>
        </div>
      </section>

      <section className="why-zo-section" aria-labelledby="why-zo-talk-heading">
        <div className="why-zo-scale-gate" aria-label="Zo operator support">
          <strong id="why-zo-talk-heading">The best operator advantage: you can talk to Zo</strong>
          <p>
            If the app is confusing, stale, or even down, the merchant does not have to start by finding a developer.
            They can ask Zo what is happening, clarify the issue, inspect the repo and deployment path, and get guided
            fixes from the same workspace that runs the app.
          </p>
        </div>
      </section>

      <section className="why-zo-split" aria-labelledby="why-zo-start-heading">
        <div className="why-zo-start-panel">
          <h2 id="why-zo-start-heading">You can start from zero</h2>
          <p>
            Setup should feel direct: create the workspace, put the app there, seed the local data, and get a working
            URL. You should not need serious infrastructure spend just to prove the product works.
          </p>
          <ol className="why-zo-setup-list">
            {setupSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>

        <div className="why-zo-data-panel">
          <ShieldCheck size={24} />
          <h2>You own your data</h2>
          <p>
            Orders, products, workflow files, and configuration can stay with the application instead of being scattered
            across third-party services. That is a stronger operator position for a small seller.
          </p>
          <strong>Still do backups.</strong>
          <span>Ownership is useful only if recovery is planned.</span>
        </div>
      </section>

      <section className="why-zo-footer-band" aria-labelledby="why-zo-operator-heading">
        <div>
          <h2 id="why-zo-operator-heading">The operator reason</h2>
          <p>
            Zo Computer reduces the number of things you need to coordinate before you can learn from real usage.
            Ship first, keep control of the data, and ask Zo for clarification or recovery help when something breaks.
            Cost and complexity should grow only after users create demand.
          </p>
        </div>
        <button className="secondary-button" type="button" onClick={() => onNavigate("intro")}>
          <Sparkles size={18} />
          Back to intro
        </button>
      </section>
    </div>
  );
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
      <button
        className={`public-site-nav-link${activeRoute === "why-zo-computer" ? " is-active" : ""}`}
        type="button"
        aria-current={activeRoute === "why-zo-computer" ? "page" : undefined}
        onClick={() => onNavigate("why-zo-computer")}
      >
        Why Zo
      </button>
    </nav>
  );
}

export function PublicPageTopbar({
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

export function UserShopLanding({
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
                  <ProductImageDisplay
                    imageUrl={product.image_url}
                    name={product.name}
                    className="user-shop-menu-image"
                  />
                  <span className="user-shop-menu-copy">
                    <span className="user-shop-menu-name">{product.name}</span>
                    <span className="user-shop-menu-meta">
                      {product.category}
                      {product.unit_price != null ? ` · ${formatAmount(product.unit_price, "SGD")}` : ""}
                    </span>
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

export function LoginPage({
  shopBranding,
  initialMode,
  onAuthenticated,
  onBack,
  loginTarget
}: {
  shopBranding: ShopBranding;
  initialMode: AuthMode;
  onAuthenticated: (role: AuthRole, credential: AuthCredential) => void;
  onBack: () => void;
  loginTarget: AuthRole | null;
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
      <LoginView initialMode={initialMode} loginTarget={loginTarget} onAuthenticated={onAuthenticated} onBack={onBack} />
    </div>
  );
}

function LoginView({
  initialMode,
  loginTarget,
  onAuthenticated,
  onBack
}: {
  initialMode: AuthMode;
  loginTarget: AuthRole | null;
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
  const demoCredentialsQuery = useQuery({
    queryKey: ["demo-login-credentials"],
    queryFn: fetchDemoLoginCredentials,
    staleTime: 5 * 60 * 1000
  });
  const demoLoginCredentials = demoCredentialsQuery.data ?? [];
  const demoCredential = loginTarget
    ? demoLoginCredentials.find((credential) => {
        const normalizedRole = credential.role.toLowerCase();
        return loginTarget === "user" ? normalizedRole === "customer" : normalizedRole === "admin";
      }) ?? null
    : null;

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

  function applyDemoCredential(credential: AuthCredential) {
    setUsername(credential.username);
    setPin(credential.pin);
    setConfirmPin("");
    setError(null);
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

      {!isSignUp && demoCredential ? (
        <button
          className="demo-credential-inline"
          type="button"
          aria-label="Demo credentials"
          onClick={() => applyDemoCredential(demoCredential)}
          disabled={isPending}
        >
          Demo {loginTarget} login: <strong>{demoCredential.username}</strong> / <strong>{demoCredential.pin}</strong>
        </button>
      ) : null}

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

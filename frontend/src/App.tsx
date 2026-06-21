import { StrictMode, useEffect, useLayoutEffect, useState } from "react";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import type { AppRoute, AuthAccess, AuthCredential, AuthMode, AuthRole, AuthState } from "./types";
import { defaultShopBranding, routeHeadings } from "./constants";
import { AdminView } from "./features/admin/AdminView";
import { LoginPage, PublicPageTopbar, IntroView, TechStackView, UserShopLanding, WhyZoComputerView } from "./features/public/PublicViews";
import { UserView } from "./features/user/UserView";
import {
  authStorageKey,
  buildMetrics,
  fetchOrders,
  fetchShopConfig,
  fetchUserProfile,
  formatUsernameLabel,
  getAuthModeFromUrl,
  getInitialRoute,
  getOrderAccess,
  loadAuthState,
  routePath,
  useStateValue
} from "./lib/domain";

const queryClient = new QueryClient();

export default function App() {
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
  const [loginTarget, setLoginTarget] = useState<"user" | "admin" | null>(() => {
    const role = new URLSearchParams(window.location.search).get("role");
    return role === "admin" || role === "user" ? role : null;
  });
  const [auth, setAuth] = useState<AuthState>(loadAuthState);
  const queryClient = useQueryClient();
  const orderAccess = getOrderAccess(auth);
  const ordersQuery = useQuery({
    queryKey: ["orders", orderAccess?.role, orderAccess?.credential.username],
    enabled: Boolean(orderAccess),
    queryFn: () => fetchOrders(orderAccess as AuthAccess)
  });
  const orders = ordersQuery.data ?? [];

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
      const role = new URLSearchParams(window.location.search).get("role");
      setLoginTarget(role === "admin" || role === "user" ? role : null);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [setActiveRoute, setLoginMode, setLoginTarget]);

  useLayoutEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith("/user/login")) {
      window.history.replaceState({}, "", "/login?role=user");
      setActiveRoute("login");
      setLoginTarget("user");
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
      window.history.replaceState({}, "", "/login?role=admin");
      setActiveRoute("login");
      setLoginTarget("admin");
    }
  }, [activeRoute, auth.admin, auth.user, setActiveRoute, setLoginTarget]);

  function navigateToRoute(route: AppRoute) {
    window.history.pushState({}, "", routePath(route));
    setActiveRoute(route);
  }

  function navigateToLogin(mode: AuthMode = "sign-in", target: "user" | "admin" | null = null) {
    setLoginMode(mode);
    setLoginTarget(target);
    const params = new URLSearchParams();
    if (mode === "sign-up") params.set("mode", "sign-up");
    if (target) params.set("role", target);
    const query = params.toString();
    window.history.pushState({}, "", query ? `/login?${query}` : "/login");
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

  if (activeRoute === "why-zo-computer") {
    return (
      <main className="app-shell is-authenticated is-docs-route">
        <section className="workspace is-authenticated why-zo-workspace">
          <PublicPageTopbar onNavigate={navigateToRoute} activeRoute="why-zo-computer" showBack />
          <WhyZoComputerView onNavigate={navigateToRoute} />
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
            loginTarget={loginTarget}
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
            onSignIn={() => navigateToLogin("sign-in", "user")}
            onSignUp={() => navigateToLogin("sign-up", "user")}
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
            orders={orders}
            metrics={metrics}
            shopBranding={shopBranding}
            onShopBrandingSaved={() => queryClient.invalidateQueries({ queryKey: ["shop-config"] })}
          />
        ) : null}
      </section>
    </main>
  );
}

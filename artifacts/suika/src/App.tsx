import React, { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useGetMe } from "@workspace/api-client-react";
import { Globe, TreeDeciduous, Play, Heart, BarChart2, House } from "lucide-react";
import { useTranslation } from "./lib/i18n";

const AuthCard    = React.lazy(() => import("./components/AuthScreen").then((m) => ({ default: m.AuthCard })));
const EarthTab    = React.lazy(() => import("./components/EarthTab").then((m) => ({ default: m.EarthTab })));
const LocalTab    = React.lazy(() => import("./components/LocalTab").then((m) => ({ default: m.LocalTab })));
const ActionTab   = React.lazy(() => import("./components/ActionTab").then((m) => ({ default: m.ActionTab })));
const HealthTab   = React.lazy(() => import("./components/HealthTab").then((m) => ({ default: m.HealthTab })));
const InsightsTab = React.lazy(() => import("./components/InsightsTab").then((m) => ({ default: m.InsightsTab })));

function TabFallback() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 30_000,
    },
  },
});

type ViewState = "loading" | "guest" | "home" | "tab";
type TabId = "earth" | "local" | "action" | "health" | "insights";

const PUBLIC_TABS: TabId[] = ["earth", "local"];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}

const QUOTES = [
  "The world is made of stories, not atoms.",
  "Rest is not idleness — it is the work of recovery.",
  "Your nervous system is wise. Let it lead.",
  "Healing is not linear, and that is okay.",
  "Breathe in possibility. Breathe out resistance.",
];

function MainApp() {
  const [view, setView] = useState<ViewState>("loading");
  const [activeTab, setActiveTab] = useState<TabId>("earth");
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  const { t } = useTranslation();

  const { data: user, isError, isLoading, refetch } = useGetMe();

  const isLoggedIn = !!user && !isError;

  useEffect(() => {
    if (isLoading) {
      setView("loading");
    } else if (!isLoggedIn) {
      // Keep current tab view if on a public tab, otherwise go to guest
      setView((prev) => (prev === "tab" && PUBLIC_TABS.includes(activeTab)) ? "tab" : "guest");
    } else {
      setView((prev) => prev === "guest" ? "home" : prev === "loading" ? "home" : prev);
    }
  }, [isLoading, isLoggedIn]);

  const goTab = (tab: TabId) => {
    if (!isLoggedIn && !PUBLIC_TABS.includes(tab)) return;
    setActiveTab(tab);
    setView("tab");
  };

  if (view === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
          <span className="text-xs text-muted-foreground tracking-widest">SUIKA</span>
        </div>
      </div>
    );
  }

  // ── Guest layout ──────────────────────────────────────────────────────────
  if (view === "guest") {
    return (
      <div className="min-h-screen flex flex-col bg-black text-white pb-20">
        <div className="flex-1 overflow-y-auto animate-in fade-in flex items-start justify-center pt-12 px-4">
          <React.Suspense fallback={<TabFallback />}>
            <AuthCard onSuccess={() => { refetch(); setView("home"); }} />
          </React.Suspense>
        </div>
        <GuestNav activeTab={activeTab} view={view} onTab={goTab} t={t} />
      </div>
    );
  }

  // ── Tab on public tabs while guest ────────────────────────────────────────
  if (view === "tab" && !isLoggedIn) {
    return (
      <div className="min-h-screen flex flex-col bg-black text-white pb-20">
        <div className="flex-1 overflow-y-auto animate-in fade-in">
          <React.Suspense fallback={<TabFallback />}>
            {activeTab === "earth" ? <EarthTab /> : <LocalTab />}
          </React.Suspense>
        </div>
        <GuestNav activeTab={activeTab} view={view} onTab={goTab} t={t} />
      </div>
    );
  }

  // ── Logged-in layout ──────────────────────────────────────────────────────
  const renderTab = () => {
    switch (activeTab) {
      case "earth":    return <EarthTab />;
      case "local":    return <LocalTab />;
      case "action":   return <ActionTab />;
      case "health":   return <HealthTab />;
      case "insights": return <InsightsTab />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-black text-white pb-20">
      {view === "home" ? (
        <div className="flex-1 flex flex-col px-6 pt-16 pb-6 animate-in fade-in">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground tracking-widest uppercase mb-2">
              {getGreeting()}
            </p>
            <h2 className="text-3xl font-serif mb-1">
              {user?.username ?? ""}
            </h2>
            <p className="text-muted-foreground text-sm italic mt-4 max-w-sm leading-relaxed">
              "{quote}"
            </p>
          </div>

          <div className="mt-auto">
            <p className="text-xs text-muted-foreground mb-4 text-center">Explore</p>
            <div className="grid grid-cols-3 gap-3">
              <HomeCard icon={<Globe size={20} />} label="Earth" onClick={() => goTab("earth")} />
              <HomeCard icon={<TreeDeciduous size={20} />} label="Local" onClick={() => goTab("local")} />
              <HomeCard icon={<Play size={20} />} label="Action" onClick={() => goTab("action")} />
              <HomeCard icon={<Heart size={20} />} label="Health" onClick={() => goTab("health")} />
              <HomeCard icon={<BarChart2 size={20} />} label="Insights" onClick={() => goTab("insights")} />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto animate-in fade-in">
          <React.Suspense fallback={<TabFallback />}>
            {renderTab()}
          </React.Suspense>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-black/80 backdrop-blur-xl border-t border-border/30 flex items-center justify-around px-2 z-50">
        <NavButton
          icon={<House size={20} />}
          label={t("nav.home")}
          active={view === "home"}
          onClick={() => setView("home")}
        />
        <NavButton
          icon={<Globe size={20} />}
          label={t("nav.earth")}
          active={view === "tab" && activeTab === "earth"}
          onClick={() => goTab("earth")}
        />
        <NavButton
          icon={<TreeDeciduous size={20} />}
          label={t("nav.local")}
          active={view === "tab" && activeTab === "local"}
          onClick={() => goTab("local")}
        />
        <NavButton
          icon={<Play size={20} />}
          label={t("nav.action")}
          active={view === "tab" && activeTab === "action"}
          onClick={() => goTab("action")}
        />
        <NavButton
          icon={<Heart size={20} />}
          label={t("nav.health")}
          active={view === "tab" && activeTab === "health"}
          onClick={() => goTab("health")}
        />
        <NavButton
          icon={<BarChart2 size={20} />}
          label={t("nav.insights")}
          active={view === "tab" && activeTab === "insights"}
          onClick={() => goTab("insights")}
        />
      </nav>
    </div>
  );
}

// ── Guest bottom nav (Earth + Local only, matching their logged-in positions) ─
function GuestNav({
  activeTab,
  view,
  onTab,
  t,
}: {
  activeTab: TabId;
  view: ViewState;
  onTab: (tab: TabId) => void;
  t: (k: string) => string;
}) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 h-20 bg-black/80 backdrop-blur-xl border-t border-border/30 flex items-center justify-around px-2 z-50">
      {/* Spacer matching Home position */}
      <div className="w-14" />
      <NavButton
        icon={<Globe size={20} />}
        label={t("nav.earth")}
        active={view === "tab" && activeTab === "earth"}
        onClick={() => onTab("earth")}
      />
      <NavButton
        icon={<TreeDeciduous size={20} />}
        label={t("nav.local")}
        active={view === "tab" && activeTab === "local"}
        onClick={() => onTab("local")}
      />
      {/* Spacers matching Action / Health / Insights positions */}
      <div className="w-14" />
      <div className="w-14" />
      <div className="w-14" />
    </nav>
  );
}

function NavButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-2 py-1 rounded-xl transition-colors ${
        active ? "text-primary" : "text-muted-foreground hover:text-white"
      }`}
    >
      {icon}
      <span className="text-[10px]">{label}</span>
    </button>
  );
}

function HomeCard({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="bg-card border border-border/40 rounded-2xl p-4 flex flex-col items-center gap-2 hover:bg-secondary/50 hover:border-primary/30 transition-all active:scale-95"
    >
      <div className="text-primary">{icon}</div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </button>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MainApp />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

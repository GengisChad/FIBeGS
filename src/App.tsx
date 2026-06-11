import { useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { UserRolesProvider } from "@/hooks/useUserRoles";
import { NotificationsProvider } from "@/hooks/useNotifications";
import { ThemeProvider } from "@/hooks/useTheme";
import { usePresenceHeartbeat } from "@/hooks/usePresenceHeartbeat";
import { useCapacitorDeepLinks } from "@/hooks/useCapacitorAuth";
import { useNativePush } from "@/hooks/useNativePush";
import { useSwAuthSync } from "@/hooks/useSwAuthSync";
import { Capacitor } from "@capacitor/core";

// Eagerly loaded (always needed)
import Index from "./pages/Index";
import Auth from "./pages/Auth";

// Lazy loaded pages
const Decks = lazy(() => import("./pages/Decks"));
const Rankings = lazy(() => import("./pages/Rankings"));
const Tournaments = lazy(() => import("./pages/Tournaments"));
const TournamentDetail = lazy(() => import("./pages/TournamentDetail"));
const GestisciTorneo = lazy(() => import("./pages/GestisciTorneo"));
const EventDetail = lazy(() => import("./pages/EventDetail"));
const Forum = lazy(() => import("./pages/Forum"));
const ForumPostDetail = lazy(() => import("./pages/ForumPostDetail"));
const Profile = lazy(() => import("./pages/Profile"));
const Rules = lazy(() => import("./pages/Rules"));
const RefereeTest = lazy(() => import("./pages/RefereeTest"));
const HeadJudgeTest = lazy(() => import("./pages/HeadJudgeTest"));
const ClubLeaderTest = lazy(() => import("./pages/ClubLeaderTest"));
const JudgeCourse = lazy(() => import("./pages/JudgeCourse"));
const Clubs = lazy(() => import("./pages/Clubs"));
const ClubDetail = lazy(() => import("./pages/ClubDetail"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminIcons = lazy(() => import("./pages/AdminIcons"));
const Market = lazy(() => import("./pages/Market"));
const Collection = lazy(() => import("./pages/Collection"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));
const Install = lazy(() => import("./pages/Install"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Tickets = lazy(() => import("./pages/Tickets"));
const ChampionshipDetail = lazy(() => import("./pages/ChampionshipDetail"));
const Media = lazy(() => import("./pages/Media"));
const FlyerEditor = lazy(() => import("./pages/FlyerEditor"));
const Faq = lazy(() => import("./pages/Faq"));
const Achievements = lazy(() => import("./pages/Achievements"));
const Elo = lazy(() => import("./pages/Elo"));
const StreamingDashboard = lazy(() => import("./pages/StreamingDashboard"));
const StreamingVARBridge = lazy(() => import("./pages/StreamingVARBridge"));
const StreamingOverlay = lazy(() => import("./pages/StreamingOverlay"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const CookiePolicy = lazy(() => import("./pages/CookiePolicy"));
const RegionalReferentPage = lazy(() => import("./pages/RegionalReferent"));
const OAuthCallback = lazy(() => import("./pages/OAuthCallback"));
const ExternalAccountCallback = lazy(() => import("./pages/ExternalAccountCallback"));
const EmbeddedChat = lazy(() => import("./pages/EmbeddedChat"));
const BetaRpg = lazy(() => import("./pages/BetaRpg"));

import { FloatingDonateButton } from "@/components/FloatingDonateButton";
import { FeedbackButton } from "@/components/FeedbackButton";
import { ScrollToTop } from "@/components/ScrollToTop";
import { ProfileCompletionDialog } from "@/components/ProfileCompletionDialog";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { FloatingNotificationBell } from "@/components/FloatingNotificationBell";
import { InstallAppPrompt } from "@/components/InstallAppPrompt";
import { UpdateAvailableBanner } from "@/components/UpdateAvailableBanner";
import { PushNotificationPrompt } from "@/components/PushNotificationPrompt";
import PasskeySetupGate from "@/components/auth/PasskeySetupGate";
import { GlobalModerationContextMenu } from "@/components/moderation/GlobalModerationContextMenu";
import { NativePullToRefresh } from "@/components/NativePullToRefresh";
const RealtimeChatPopup = lazy(() => import("@/components/chat/RealtimeChatPopup"));
const RightSidebar = lazy(() => import("@/components/layout/RightSidebar"));
const BottomChatDock = lazy(() => import("@/components/chat/BottomChatDock"));
const MobileSideDrawers = lazy(() => import("@/components/home/MobileSideDrawers"));
const DesktopLeftSidebar = lazy(() => import("@/components/home/MobileSideDrawers").then((m) => ({ default: m.DesktopLeftSidebar })));
import { ChatDockProvider } from "@/stores/chatDockStore";
import { SidebarStateProvider, useSidebarState } from "@/contexts/SidebarStateContext";
const Team = lazy(() => import("./pages/Team"));
const CreateTeamPage = lazy(() => import("./pages/CreateTeam"));
const FindTeamPage = lazy(() => import("./pages/FindTeam"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 5 * 60 * 1000, // free memory of unused queries quickly
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
      structuralSharing: true,
    },
  },
});

const PresenceTracker = () => {
  const { user } = useAuth();
  usePresenceHeartbeat(user?.id);
  useSwAuthSync();
  return null;
};

const NativeDeepLinkHandler = () => {
  useCapacitorDeepLinks();
  useNativePush();
  return null;
};


const NativeImmersiveMode = () => {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    import("@capacitor/status-bar")
      .then(({ StatusBar }) => {
        StatusBar.hide().catch(() => {});
        StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
      })
      .catch(() => {});
  }, []);

  return null;
};

// Minimal fallback for lazy pages
const PageFallback = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const RecoveryLinkRedirector = () => {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === "/reset-password") return;

    try {
      const search = new URLSearchParams(location.search);
      const hash = new URLSearchParams(
        (typeof window !== "undefined" ? window.location.hash : "").replace(/^#/, "")
      );

      const type = search.get("type") || hash.get("type");
      const hasRecoveryParam =
        type === "recovery" ||
        !!search.get("token_hash") ||
        !!hash.get("token_hash") ||
        (!!search.get("code") && type === "recovery") ||
        (!!hash.get("access_token") && type === "recovery");

      if (hasRecoveryParam) {
        // Preserve original search + hash so ResetPassword can consume them
        const target =
          "/reset-password" +
          (location.search || "") +
          (typeof window !== "undefined" ? window.location.hash : "");
        window.location.replace(target);
      }
    } catch {
      /* noop */
    }
  }, [location.pathname, location.search]);

  return null;
};

const AppShell = () => {
  const location = useLocation();
  const isFlyerEditorRoute = /^\/clubs\/[^/]+\/flyer$/.test(location.pathname);
  const isChatEmbedRoute = location.pathname === "/chat-embed";
  const isBare = isFlyerEditorRoute || isChatEmbedRoute;
  const { collapsed } = useSidebarState();
  const rightPad = isBare ? "" : (collapsed ? "" : "ibnf-has-right-sidebar");
  // DesktopLeftSidebar is rendered unconditionally and is CSS-gated to >=1200px
  // (.ibnf-left-profile-sidebar) in BOTH auth states, so reserve its gutter
  // whenever the shell isn't bare — not only when logged in (fixes offline overlap).
  const leftPad = isBare ? "" : "ibnf-has-left-sidebar";

  return (
    <>
      <RecoveryLinkRedirector />
      <NativePullToRefresh />
      {!isBare && <FeedbackButton />}
      {!isBare && <FloatingNotificationBell />}
      {!isChatEmbedRoute && <ProfileCompletionDialog />}
      <ScrollToTop />
      {!isBare && <MobileBottomNav />}

      <div className={`ibnf-app-content-shell ${isBare ? "pb-0" : "pb-[72px]"} md:pb-0 overflow-x-hidden ${leftPad} ${rightPad}`}>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/decks" element={<Decks />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/rankings" element={<Rankings />} />
            <Route path="/elo" element={<Elo />} />
            <Route path="/tournaments" element={<Tournaments />} />
            <Route path="/tournaments/:id" element={<TournamentDetail />} />
            <Route path="/torneo/gestisci" element={<GestisciTorneo />} />
            <Route path="/torneo/gestisci/:id" element={<GestisciTorneo />} />
            <Route path="/events/:id" element={<EventDetail />} />
            <Route path="/clubs" element={<Clubs />} />
            <Route path="/clubs/:id" element={<ClubDetail />} />
            <Route path="/forum" element={<Forum />} />
            <Route path="/forum/:id" element={<ForumPostDetail />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/rules" element={<Rules />} />
            <Route path="/test-arbitri" element={<RefereeTest />} />
            <Route path="/test-head-judge" element={<HeadJudgeTest />} />
            <Route path="/test-club-leader" element={<ClubLeaderTest />} />
            <Route path="/corso-judges/:id" element={<JudgeCourse />} />
            <Route path="/market" element={<Market />} />
            <Route path="/collezione" element={<Collection />} />
            <Route path="/collezione/:username" element={<Collection />} />
            <Route path="/profilo/:username" element={<PublicProfile />} />
            <Route path="/profilo/child/:childId" element={<PublicProfile />} />
            <Route path="/installa" element={<Install />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/notifiche" element={<Notifications />} />
            <Route path="/tickets" element={<Tickets />} />
            <Route path="/campionati/:slug" element={<ChampionshipDetail />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/icons" element={<AdminIcons />} />
            <Route path="/media" element={<Media />} />
            <Route path="/clubs/:clubId/flyer" element={<FlyerEditor />} />
            <Route path="/faq" element={<Faq />} />
            <Route path="/achievements" element={<Achievements />} />
            <Route path="/tournaments/:id/streaming" element={<StreamingDashboard />} />
            <Route path="/tournaments/:id/var-bridge" element={<StreamingVARBridge />} />
            <Route path="/tournaments/:id/overlay" element={<StreamingOverlay />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/termini" element={<TermsOfService />} />
           <Route path="/cookie" element={<CookiePolicy />} />
           <Route path="/referente-regionale" element={<RegionalReferentPage />} />
           <Route path="/~oauth" element={<OAuthCallback />} />
           <Route path="/challonge-callback" element={<ExternalAccountCallback platform="challonge" />} />
           <Route path="/challengermode-callback" element={<ExternalAccountCallback platform="challengermode" />} />
           <Route path="/chat-embed" element={<EmbeddedChat />} />
           <Route path="/squadra" element={<Team />} />
           <Route path="/squadra/crea" element={<CreateTeamPage />} />
           <Route path="/squadra/cerca" element={<FindTeamPage />} />
           <Route path="/beta/rpg" element={<BetaRpg />} />
           <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </div>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <UserRolesProvider>
          <NotificationsProvider>
            <TooltipProvider>
              <PresenceTracker />
              <NativeDeepLinkHandler />
              
              <NativeImmersiveMode />
              <Toaster />
              <Sonner />
              <FloatingDonateButton />
              <InstallAppPrompt />
              <PushNotificationPrompt />
              <PasskeySetupGate />
              <UpdateAvailableBanner />
              
              <BrowserRouter>
                <SidebarStateProvider>
                  <ChatDockProvider>
                    <AppShell />
                    <GlobalModerationContextMenu />
                    <Suspense fallback={null}><RealtimeChatPopup /></Suspense>
                    <Suspense fallback={null}><RightSidebar /></Suspense>
                    <Suspense fallback={null}><DesktopLeftSidebar /></Suspense>
                    <Suspense fallback={null}><BottomChatDock /></Suspense>
                    <Suspense fallback={null}><MobileSideDrawers /></Suspense>
                  </ChatDockProvider>
                </SidebarStateProvider>
              </BrowserRouter>
            </TooltipProvider>
          </NotificationsProvider>
        </UserRolesProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

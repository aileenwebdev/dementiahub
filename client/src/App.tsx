import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import AssistantPage from "./pages/AssistantPage";
import AdminConversationsPage from "./pages/AdminConversationsPage";
import AdminIntegrationPage from "./pages/AdminIntegrationPage";
import ChatConversationDetailsPage from "./pages/ChatConversationDetailsPage";
import DementiaAdminPortalPage from "./pages/DementiaAdminPortalPage";
import DemoDryRunPage from "./pages/DemoDryRunPage";
import Home from "./pages/Home";
import CallPage from "./pages/CallPage";
import CallHistoryPage from "./pages/CallHistoryPage";
import CallDetailsPage from "./pages/CallDetailsPage";
import ManagementPortalPage from "./pages/ManagementPortalPage";
import ProfilePage from "./pages/ProfilePage";
import StaffPortalPage from "./pages/StaffPortalPage";
import LiveCallPage from "./pages/LiveCallPage";
import LoginPage from "./pages/LoginPage";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/login"} component={LoginPage} />
      <Route path={"/"} component={Home} />
      <Route path={"/assistant"} component={AssistantPage} />
      <Route path={"/admin"} component={AdminConversationsPage} />
      <Route path={"/admin/conversations"} component={AdminConversationsPage} />
      <Route path={"/admin/integration"} component={AdminIntegrationPage} />
      <Route path={"/demo/dry-run"} component={DemoDryRunPage} />
      <Route path={"/portal/staff"} component={StaffPortalPage} />
      <Route path={"/portal/management"} component={ManagementPortalPage} />
      <Route path={"/portal/dementia-admin"} component={DementiaAdminPortalPage} />
      <Route path={"/call"} component={CallPage} />
      <Route path={"/call/:sessionId"} component={CallDetailsPage} />
      <Route path={"/call/:sessionId/live"} component={LiveCallPage} />
      <Route path={"/history"} component={CallHistoryPage} />
      <Route path={"/history/chat/:conversationId"} component={ChatConversationDetailsPage} />
      <Route path={"/profile"} component={ProfilePage} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

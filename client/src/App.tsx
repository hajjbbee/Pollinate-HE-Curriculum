import { lazy, Suspense } from "react";
import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useMobile } from "@/hooks/useMobile";
import { SidebarProvider, Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger } from "@/components/ui/sidebar";
import { Home, BookOpen, MapPin, Settings as SettingsIcon, Sparkles, LogOut, Shield, GraduationCap } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

import Landing from "@/pages/landing";
import Onboarding from "@/pages/onboarding";
import Today from "@/pages/today";
import ThisWeek from "@/pages/this-week";
import ResourcesPage from "@/pages/resources";
import ProgressPage from "@/pages/progress";
import Privacy from "@/pages/privacy";
import Pricing from "@/pages/pricing";
import NotFound from "@/pages/not-found";
import { BottomNav } from "@/components/BottomNav";
import { FloatingHelpButton } from "@/components/FloatingHelpButton";

const Dashboard = lazy(() => import("@/pages/dashboard"));
const Journal = lazy(() => import("@/pages/journal"));
const Opportunities = lazy(() => import("@/pages/opportunities"));
const FamilySettings = lazy(() => import("@/pages/family-settings"));
const TranscriptPage = lazy(() => import("@/pages/transcript"));

function PageLoader() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="space-y-3 rounded-lg border p-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-10 w-full mt-4" />
          </div>
        ))}
      </div>
    </div>
  );
}

function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  const { data: children, isLoading: childrenLoading } = useQuery({
    queryKey: ["/api/children"],
    enabled: !!user,
  });

  const baseMenuItems = [
    { title: "Dashboard", url: "/dashboard", icon: Home },
    { title: "Journal", url: "/journal", icon: BookOpen },
    { title: "Opportunities", url: "/opportunities", icon: MapPin },
    { title: "Settings", url: "/settings", icon: SettingsIcon },
    { title: "Privacy & Safety", url: "/privacy", icon: Shield },
  ];

  // Only show Transcripts menu item after children data loads and if high school children exist
  const menuItems = !childrenLoading && children?.some((child: any) => child.isHighSchoolMode)
    ? [
        ...baseMenuItems.slice(0, 2),
        { title: "Transcripts", url: "/transcripts", icon: GraduationCap },
        ...baseMenuItems.slice(2),
      ]
    : baseMenuItems;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <div className="px-4 py-6 border-b border-sidebar-border">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-6 h-6 text-sidebar-primary" />
              <div>
                <h2 className="text-lg font-heading font-bold">Pollinate</h2>
                <p className="text-xs text-sidebar-foreground/70">Home Education Curriculum</p>
              </div>
            </div>
            {user && (
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={user.profileImageUrl} />
                  <AvatarFallback className="text-sm">
                    {getInitials(`${user.firstName || ""} ${user.lastName || ""}`)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-xs text-sidebar-foreground/70 truncate">{user.email}</p>
                </div>
              </div>
            )}
          </div>

          <SidebarGroupContent className="px-2 py-4">
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    className={location === item.url ? "bg-sidebar-accent" : ""}
                    data-testid={`nav-${item.title.toLowerCase()}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>

          <div className="mt-auto px-2 py-4 border-t border-sidebar-border">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href="/api/logout" data-testid="nav-logout">
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </div>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

function MobileRouter() {
  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/" component={Today} />
          <Route path="/today" component={Today} />
          <Route path="/this-week" component={ThisWeek} />
          <Route path="/resources" component={ResourcesPage} />
          <Route path="/progress" component={ProgressPage} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/journal" component={Journal} />
          <Route path="/opportunities" component={Opportunities} />
          <Route path="/transcripts" component={TranscriptPage} />
          <Route path="/settings" component={FamilySettings} />
          <Route path="/privacy" component={Privacy} />
          <Route path="/pricing" component={Pricing} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
      <BottomNav />
    </>
  );
}

function DesktopRouter() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={Today} />
        <Route path="/today" component={Today} />
        <Route path="/this-week" component={ThisWeek} />
        <Route path="/resources" component={ResourcesPage} />
        <Route path="/progress" component={ProgressPage} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/journal" component={Journal} />
        <Route path="/opportunities" component={Opportunities} />
        <Route path="/transcripts" component={TranscriptPage} />
        <Route path="/settings" component={FamilySettings} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/pricing" component={Pricing} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function PublicRouter() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/pricing" component={Pricing} />
      <Route component={NotFound} />
    </Switch>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();
  const isMobile = useMobile();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <PublicRouter />;
  }

  if (location === "/onboarding") {
    return <Onboarding />;
  }

  // Mobile-first routes (Today, This Week, Resources, Progress)
  const mobileRoutes = ["/", "/today", "/this-week", "/resources", "/progress"];
  const isMobileRoute = mobileRoutes.includes(location);

  // On mobile devices, show mobile layout for mobile routes
  if (isMobile && isMobileRoute) {
    return (
      <div className="min-h-screen w-full bg-background">
        <MobileRouter />
      </div>
    );
  }

  // For desktop or non-mobile routes, use sidebar layout
  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between p-2 border-b border-border bg-background sticky top-0 z-40">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
          </header>
          <main className="flex-1 overflow-y-auto">
            <DesktopRouter />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppContent() {
  const { isAuthenticated } = useAuth();
  
  return (
    <>
      <Router />
      <Toaster />
      {isAuthenticated && <FloatingHelpButton />}
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

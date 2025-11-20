import { Link, useLocation } from "wouter";
import { Home, Calendar, Library, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const [location] = useLocation();

  const navItems = [
    { title: "Today", url: "/today", icon: Home, testId: "button-nav-today" },
    { title: "This Week", url: "/this-week", icon: Calendar, testId: "button-nav-this-week" },
    { title: "Resources", url: "/resources", icon: Library, testId: "button-nav-resources" },
    { title: "Progress", url: "/progress", icon: TrendingUp, testId: "button-nav-progress" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border safe-area-inset-bottom">
      <div className="grid grid-cols-4 h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.url || (item.url === "/today" && location === "/");
          
          return (
            <Link
              key={item.url}
              href={item.url}
              className={cn(
                "flex flex-col items-center justify-center gap-1 hover-elevate transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
              data-testid={item.testId}
            >
              <Icon className={cn("w-6 h-6", isActive && "fill-primary/10")} />
              <span className="text-xs font-medium">{item.title}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

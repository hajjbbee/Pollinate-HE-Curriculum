import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMode?: "signin" | "signup";
}

export function AuthModal({ open, onOpenChange, defaultMode = "signup" }: AuthModalProps) {
  const [mode, setMode] = useState<"signin" | "signup">(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const { signup, login } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validation
      if (mode === "signup") {
        if (!firstName?.trim() || !lastName?.trim()) {
          toast({
            title: "Missing information",
            description: "Please enter your first and last name",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        // Password strength validation
        if (password.length < 8) {
          toast({
            title: "Weak password",
            description: "Password must be at least 8 characters long",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
          toast({
            title: "Weak password",
            description: "Password must contain both letters and numbers",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
      }

      // Perform signup/login
      if (mode === "signup") {
        await signup(email, password, firstName, lastName);
        toast({
          title: "Welcome to Pollinate!",
          description: "Your account has been created successfully.",
        });
      } else {
        await login(email, password);
        toast({
          title: "Welcome back!",
          description: "You've been signed in successfully.",
        });
      }
      
      // Wait a moment for the auth state to update before closing modal
      await new Promise(resolve => setTimeout(resolve, 500));
      onOpenChange(false);
    } catch (error: any) {
      // Parse Supabase error codes for better UX
      let errorMessage = "Please check your details and try again";
      
      if (error.message?.includes("already registered") || error.message?.includes("already exists")) {
        errorMessage = "This email is already registered. Try signing in instead.";
      } else if (error.message?.includes("invalid") || error.message?.includes("Invalid")) {
        errorMessage = mode === "signup" 
          ? "Please use a valid email address"
          : "Invalid email or password. Please try again.";
      } else if (error.message?.includes("rate limit")) {
        errorMessage = "Too many attempts. Please wait a moment and try again.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: mode === "signup" ? "Signup failed" : "Login failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]" data-testid="dialog-auth">
        <DialogHeader>
          <DialogTitle data-testid="text-auth-title">
            {mode === "signup" ? "Create your account" : "Sign in to Pollinate"}
          </DialogTitle>
          <DialogDescription>
            {mode === "signup"
              ? "Start your personalised home education journey"
              : "Welcome back! Sign in to continue"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  disabled={isLoading}
                  data-testid="input-firstname"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  disabled={isLoading}
                  data-testid="input-lastname"
                />
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              data-testid="input-email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              disabled={isLoading}
              data-testid="input-password"
              placeholder={mode === "signup" ? "At least 8 characters with letters & numbers" : ""}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-submit-auth">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "signup" ? "Create account" : "Sign in"}
          </Button>
          <div className="text-center text-sm">
            {mode === "signup" ? (
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="text-primary hover:underline"
                data-testid="button-switch-signin"
              >
                Already have an account? Sign in
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setMode("signup")}
                className="text-primary hover:underline"
                data-testid="button-switch-signup"
              >
                Don't have an account? Sign up
              </button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

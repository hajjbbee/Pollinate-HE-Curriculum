import { useState } from "react";
import { Button } from "@/components/ui/button";
import { HelpModal } from "@/components/HelpModal";
import { HelpCircle } from "lucide-react";

export function FloatingHelpButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="icon"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50 hover-elevate active-elevate-2"
        data-testid="button-floating-help"
        aria-label="Help & Guides"
      >
        <HelpCircle className="w-6 h-6" />
      </Button>
      <HelpModal open={open} onOpenChange={setOpen} />
    </>
  );
}

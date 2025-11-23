import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { MessageCircle, Sparkles, Upload } from "lucide-react";
import { ObjectUploader } from "@/components/ObjectUploader";

interface HelpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HelpModal({ open, onOpenChange }: HelpModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { message: string; screenshotUrl?: string }) => {
      return await apiRequest("POST", "/api/support", data);
    },
    onSuccess: () => {
      toast({
        title: "Message sent!",
        description: "Got it! I'm a home education mum too — I'll reply within a few hours.",
      });
      setMessage("");
      setScreenshotUrl(null);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Couldn't send message",
        description: error.message || "Please try again in a moment.",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (!message.trim()) {
      toast({
        title: "Please write a message",
        description: "Let me know how I can help!",
        variant: "destructive",
      });
      return;
    }

    sendMessageMutation.mutate({
      message: message.trim(),
      screenshotUrl: screenshotUrl || undefined,
    });
  };

  const handleUploadComplete = (url: string) => {
    setScreenshotUrl(url);
    setUploading(false);
    toast({
      title: "Screenshot uploaded",
      description: "Thanks! This will help me understand your question.",
    });
  };

  const handleUploadError = (error: string) => {
    setUploading(false);
    toast({
      title: "Upload failed",
      description: error || "Please try again in a moment.",
      variant: "destructive",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Help & Guides
          </DialogTitle>
          <DialogDescription>
            Quick answers to common questions, or send me a message
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="faqs" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="faqs" data-testid="tab-faqs">
              Quick Guides
            </TabsTrigger>
            <TabsTrigger value="contact" data-testid="tab-contact">
              Message Me
            </TabsTrigger>
          </TabsList>

          <TabsContent value="faqs" className="mt-4">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="ai-learning" data-testid="faq-ai-learning">
                <AccordionTrigger data-testid="trigger-ai-learning">
                  How does the AI learn my child's interests?
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 text-muted-foreground">
                    <p>
                      Hey friend, here's exactly how it works! When you set up your family, 
                      you tell me about each child's current interests. Then, as you journal 
                      about what they loved (or didn't!), the AI picks up on patterns.
                    </p>
                    <p>
                      For example, if your child keeps coming back to dinosaurs, space, or 
                      building things, the next curriculum refresh will weave more of that in. 
                      It's like having a teaching partner who's always paying attention!
                    </p>
                    <div className="mt-4 p-4 bg-muted rounded-md">
                      <p className="text-sm font-medium">Watch the 60-second guide:</p>
                      <div className="mt-2 aspect-video bg-muted-foreground/10 rounded flex items-center justify-center text-sm">
                        [Loom video placeholder: How AI learns your child's interests]
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="change-settings" data-testid="faq-change-settings">
                <AccordionTrigger data-testid="trigger-change-settings">
                  How do I change my address or add a child?
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 text-muted-foreground">
                    <p>
                      Super easy! Click the "Edit Family" button (top right with the yellow gear icon), 
                      and you can update your address, add/remove children, or change travel radius.
                    </p>
                    <p>
                      When you save, it'll automatically regenerate your curriculum with the new 
                      local opportunities near your updated address. Give it about 30 seconds to work its magic!
                    </p>
                    <div className="mt-4 p-4 bg-muted rounded-md">
                      <p className="text-sm font-medium">Watch the 60-second guide:</p>
                      <div className="mt-2 aspect-video bg-muted-foreground/10 rounded flex items-center justify-center text-sm">
                        [Loom video placeholder: Editing family settings]
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="events-not-showing" data-testid="faq-events-not-showing">
                <AccordionTrigger data-testid="trigger-events-not-showing">
                  Why isn't a local event showing up?
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 text-muted-foreground">
                    <p>
                      Great question! The AI pulls events from Eventbrite and local Facebook 
                      home education groups. If you're not seeing something you expected:
                    </p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Check your travel radius in Settings (default is 30 minutes)</li>
                      <li>Make sure the event is listed on Eventbrite or in connected FB groups</li>
                      <li>Events are refreshed weekly, so new ones might take a few days</li>
                    </ul>
                    <p className="mt-2">
                      Pro tip: You can always add Facebook group events manually by copying 
                      the event URL and pasting it into the "Capture This Interest" section in your Journal!
                    </p>
                    <div className="mt-4 p-4 bg-muted rounded-md">
                      <p className="text-sm font-medium">Watch the 60-second guide:</p>
                      <div className="mt-2 aspect-video bg-muted-foreground/10 rounded flex items-center justify-center text-sm">
                        [Loom video placeholder: Why events aren't showing]
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="regenerate-week" data-testid="faq-regenerate-week">
                <AccordionTrigger data-testid="trigger-regenerate-week">
                  How do I regenerate a week?
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 text-muted-foreground">
                    <p>
                      Click the "Regenerate" button on any week card (it's on the right side). 
                      This is perfect if:
                    </p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>A child's interests have shifted mid-week</li>
                      <li>You need different local opportunities for that week</li>
                      <li>The week just doesn't feel right for your family</li>
                    </ul>
                    <p className="mt-2">
                      The AI will generate a brand new week based on your current settings 
                      and recent journal entries. Takes about 20-30 seconds!
                    </p>
                    <div className="mt-4 p-4 bg-muted rounded-md">
                      <p className="text-sm font-medium">Watch the 60-second guide:</p>
                      <div className="mt-2 aspect-video bg-muted-foreground/10 rounded flex items-center justify-center text-sm">
                        [Loom video placeholder: Regenerating a week]
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="today-view" data-testid="faq-today-view">
                <AccordionTrigger data-testid="trigger-today-view">
                  How do I use the Today view?
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 text-muted-foreground">
                    <p>
                      The Today view is your daily dashboard! It shows exactly what's planned 
                      for today across all your children. You can:
                    </p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>See all activities scheduled for today in one place</li>
                      <li>Mark activities as complete with a tap</li>
                      <li>Add emoji reactions to show how each activity went</li>
                      <li>Upload photos of your child's work or discoveries</li>
                      <li>Record quick voice notes about what happened</li>
                    </ul>
                    <p className="mt-2">
                      Think of it as your daily home education companion — start here each morning 
                      to see what's ahead, and come back throughout the day to capture the magic as it happens!
                    </p>
                    <div className="mt-4 p-4 bg-muted rounded-md">
                      <p className="text-sm font-medium">Watch the 60-second guide:</p>
                      <div className="mt-2 aspect-video bg-muted-foreground/10 rounded flex items-center justify-center text-sm">
                        [Loom video placeholder: Using the Today view]
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="journaling" data-testid="faq-journaling">
                <AccordionTrigger data-testid="trigger-journaling">
                  How does journaling work?
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 text-muted-foreground">
                    <p>
                      Journaling is where the magic happens! There are two ways to capture learning:
                    </p>
                    <div className="space-y-2">
                      <div>
                        <p className="font-medium text-foreground">1. Today's Reflections (planned activities)</p>
                        <p className="text-sm">
                          Mark activities complete, add emoji reactions (loved it, it was okay, 
                          or skip for today), upload photos, and record voice notes.
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">2. Capture Emerging Interests (unschooling moments)</p>
                        <p className="text-sm">
                          This is the free-space section! If your child suddenly became obsessed 
                          with volcanoes or spent 3 hours building a cardboard castle, capture it here. 
                          The AI will weave it into next week's curriculum.
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 p-4 bg-muted rounded-md">
                      <p className="text-sm font-medium">Watch the 60-second guide:</p>
                      <div className="mt-2 aspect-video bg-muted-foreground/10 rounded flex items-center justify-center text-sm">
                        [Loom video placeholder: How journaling works]
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="export-portfolio" data-testid="faq-export-portfolio">
                <AccordionTrigger data-testid="trigger-export-portfolio">
                  How do I export a portfolio for state requirements?
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 text-muted-foreground">
                    <p>
                      Head to the Progress tab and click "Export Portfolio (PDF)" at the top right. 
                      This generates a beautiful, state-compliant portfolio with:
                    </p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>All completed activities with dates</li>
                      <li>Photos and journal entries</li>
                      <li>Mastery tracking for each child</li>
                      <li>Skills developed and emerging interests</li>
                    </ul>
                    <p className="mt-2">
                      Perfect for annual evaluations or portfolio reviews. You can export 
                      for a specific date range or the whole term!
                    </p>
                    <div className="mt-4 p-4 bg-muted rounded-md">
                      <p className="text-sm font-medium">Watch the 60-second guide:</p>
                      <div className="mt-2 aspect-video bg-muted-foreground/10 rounded flex items-center justify-center text-sm">
                        [Loom video placeholder: Exporting portfolio for state requirements]
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>

          <TabsContent value="contact" className="mt-4 space-y-4">
            <div className="space-y-4">
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-md">
                <p className="text-sm text-muted-foreground">
                  I'm here to help! Send me a message and I'll get back to you within a few hours. 
                  I'm a home education mum too, so I get it.
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="support-message" className="text-sm font-medium">
                  What can I help with?
                </label>
                <Textarea
                  id="support-message"
                  data-testid="input-support-message"
                  placeholder="e.g., 'The curriculum isn't loading' or 'How do I change my subscription?'"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Optional: Add a screenshot
                </label>
                <p className="text-xs text-muted-foreground">
                  Screenshots help me understand your issue faster
                </p>
                {screenshotUrl ? (
                  <div className="relative">
                    <img
                      src={screenshotUrl}
                      alt="Screenshot"
                      className="w-full rounded-md border"
                      data-testid="preview-screenshot"
                    />
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setScreenshotUrl(null)}
                      className="absolute top-2 right-2"
                      data-testid="button-remove-screenshot"
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <ObjectUploader
                    maxNumberOfFiles={1}
                    maxFileSize={5 * 1024 * 1024}
                    onGetUploadParameters={async () => {
                      setUploading(true);
                      try {
                        const response = await fetch("/api/upload-url");
                        if (!response.ok) {
                          throw new Error("Failed to get upload URL");
                        }
                        const { method, url } = await response.json();
                        return { method, url };
                      } catch (error: any) {
                        handleUploadError(error.message || "Failed to prepare upload");
                        throw error;
                      }
                    }}
                    onComplete={(result) => {
                      if (result.successful && result.successful.length > 0) {
                        const uploadedFile = result.successful[0];
                        const url = uploadedFile.uploadURL?.split("?")[0];
                        if (url) {
                          handleUploadComplete(url);
                        } else {
                          handleUploadError("Upload completed but no URL returned");
                        }
                      } else if (result.failed && result.failed.length > 0) {
                        const failedFile = result.failed[0];
                        handleUploadError(failedFile.error || "Upload failed");
                      }
                    }}
                    buttonClassName="w-full"
                    data-testid="button-upload-screenshot"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploading ? "Uploading..." : "Upload Screenshot"}
                  </ObjectUploader>
                )}
              </div>

              <Button
                onClick={handleSendMessage}
                disabled={sendMessageMutation.isPending || !message.trim()}
                className="w-full"
                data-testid="button-send-message"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                {sendMessageMutation.isPending ? "Sending..." : "Send Message"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Lock, Download, Trash2, CheckCircle2 } from "lucide-react";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-green-50/50 via-green-50/30 to-background dark:from-green-950/20 dark:via-green-950/10 dark:to-background border-b border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Shield className="w-8 h-8 text-green-700 dark:text-green-500" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-heading font-bold text-foreground">
                Privacy & Safety
              </h1>
              <p className="text-lg text-muted-foreground mt-1">
                Your family's information is safe, private, and always yours
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 mt-8 space-y-6">
        {/* Main Privacy Card */}
        <Card className="border-2 border-green-200 dark:border-green-900/50 bg-green-50/30 dark:bg-green-950/10">
          <CardHeader>
            <CardTitle className="text-2xl font-heading flex items-center gap-3">
              <Lock className="w-6 h-6 text-green-700 dark:text-green-500" />
              Your children's information is 100% private, safe, and yours alone
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-base leading-relaxed">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-700 dark:text-green-500 mt-1 flex-shrink-0" />
              <p className="text-foreground">
                <strong>No one else can ever see your children's names, ages, photos, journal entries, or curriculum</strong> — not other families, not advertisers, not even me (the founder).
              </p>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-700 dark:text-green-500 mt-1 flex-shrink-0" />
              <p className="text-foreground">
                Everything is <strong>encrypted end-to-end</strong> and stored securely with industry-standard security (the same security banks use).
              </p>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-700 dark:text-green-500 mt-1 flex-shrink-0" />
              <p className="text-foreground">
                Photos and journal entries are only stored on secure servers and are <strong>NEVER shared or used for AI training</strong>.
              </p>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-700 dark:text-green-500 mt-1 flex-shrink-0" />
              <p className="text-foreground">
                You can <strong>download or permanently delete your family's data with one tap</strong> in Family Settings → Privacy & Data.
              </p>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-700 dark:text-green-500 mt-1 flex-shrink-0" />
              <p className="text-foreground font-bold">
                We never sell data. Ever. Full stop.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* How We Protect Your Data */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-heading flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              How we protect your data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-foreground">
            <div className="space-y-1">
              <h3 className="font-medium">Secure Storage</h3>
              <p className="text-sm text-muted-foreground">
                All data is encrypted both in transit (when sending to our servers) and at rest (when stored). We use industry-standard encryption protocols.
              </p>
            </div>

            <div className="space-y-1">
              <h3 className="font-medium">Access Control</h3>
              <p className="text-sm text-muted-foreground">
                Only you can access your family's data. Each account is completely isolated — no other users can see your information.
              </p>
            </div>

            <div className="space-y-1">
              <h3 className="font-medium">Photo Privacy</h3>
              <p className="text-sm text-muted-foreground">
                Photos are stored in private cloud storage with strict access controls. They're never made public and are only accessible through your secure account.
              </p>
            </div>

            <div className="space-y-1">
              <h3 className="font-medium">AI Privacy</h3>
              <p className="text-sm text-muted-foreground">
                When we use AI to generate curriculum suggestions, we only send relevant context (like age and interests) — never photos or personally identifying details. AI providers are contractually prohibited from using your data for training.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Your Control */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-heading flex items-center gap-2">
              <Download className="w-5 h-5 text-primary" />
              You're always in control
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-foreground">
            <div className="space-y-1">
              <h3 className="font-medium">Export Your Data</h3>
              <p className="text-sm text-muted-foreground">
                Download all your family's data with one tap in Family Settings → Privacy & Data. Get a complete ZIP file with photos, journals, and curricula as PDFs.
              </p>
            </div>

            <div className="space-y-1">
              <h3 className="font-medium flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                Delete Your Data
              </h3>
              <p className="text-sm text-muted-foreground">
                You can instantly delete all photos and journal entries, or permanently remove your entire account with one tap in Family Settings → Privacy & Data. Once deleted, it's gone forever — no backups, no recovery.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Questions */}
        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center">
              <strong>Questions about privacy?</strong> Email me directly at{" "}
              <a 
                href="mailto:pollinatecurriculum@proton.me" 
                className="text-primary hover:underline"
                data-testid="link-privacy-email"
              >
                pollinatecurriculum@proton.me
              </a>
              <br />
              I'm a mum too, and I take this seriously.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

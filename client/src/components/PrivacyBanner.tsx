import { Lock } from "lucide-react";

export function PrivacyBanner() {
  return (
    <div className="bg-green-50/50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/50 rounded-lg px-4 py-3">
      <div className="flex items-center gap-2 text-sm text-green-900 dark:text-green-100">
        <Lock className="w-4 h-4 flex-shrink-0" />
        <p>
          <strong>Only you</strong> can see your children's photos and entries — always private, always safe.
        </p>
      </div>
    </div>
  );
}

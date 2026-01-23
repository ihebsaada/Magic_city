// src/components/ui/LoadingScreen.tsx
import { Loader2 } from "lucide-react";

export const LoadingScreen = () => {
  return (
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Caricamento...</p>
    </div>
  );
};

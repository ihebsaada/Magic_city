import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Lock } from "lucide-react";

export default function Index() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-8 px-4 animate-fade-in">
        <div className="space-y-4">
          <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight">
            Magic City Drip
          </h1>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            Premium fashion admin dashboard. Manage products, collections, orders, and more.
          </p>
        </div>

        <Button asChild size="lg" className="gap-2">
          <Link to="/admin">
            <Lock className="h-4 w-4" />
            Enter Admin Portal
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

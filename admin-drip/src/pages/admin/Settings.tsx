// src/pages/admin/Settings.tsx
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { BASE_API_URL } from "@/services/api";
import {
  Settings as SettingsIcon,
  Server,
  Shield,
  Palette,
  Truck,
  Bell,
  Plug,
  Users,
  CreditCard,
} from "lucide-react";

function ComingSoonBadge() {
  return (
    <Badge className="bg-muted text-muted-foreground border-0">
      Coming soon
    </Badge>
  );
}

function LockedHint({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground">{text}</p>;
}

export default function Settings() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight">
          Settings
        </h1>
        <p className="text-muted-foreground">Manage your store configuration</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* API Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Server className="h-5 w-5 text-muted-foreground" />
                <CardTitle>API Configuration</CardTitle>
              </div>
              <Badge className="bg-success/10 text-success border-0">
                Live
              </Badge>
            </div>
            <CardDescription>Backend connection settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apiUrl">Base API URL</Label>
              <Input
                id="apiUrl"
                value={BASE_API_URL}
                readOnly
                className="bg-muted font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Configure via{" "}
                <span className="font-mono">VITE_BASE_API_URL</span>
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="webhookUrl">Stripe webhook URL</Label>
              <Input
                id="webhookUrl"
                value={`${BASE_API_URL.replace(/\/api$/, "")}/api/stripe/webhook`}
                readOnly
                className="bg-muted font-mono text-sm"
              />
              <LockedHint text="Tip: copy/paste this URL in Stripe Dashboard (when you go live)." />
            </div>
          </CardContent>
        </Card>

        {/* Store Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <SettingsIcon className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Store Settings</CardTitle>
              </div>
              <ComingSoonBadge />
            </div>
            <CardDescription>General store configuration</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Maintenance Mode</Label>
                <p className="text-xs text-muted-foreground">
                  Temporarily disable the storefront
                </p>
              </div>
              <Switch disabled />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Test Payments</Label>
                <p className="text-xs text-muted-foreground">
                  Enable Stripe test mode
                </p>
              </div>
              <Switch disabled defaultChecked />
            </div>

            <Separator />

            <div className="rounded-lg border p-4 bg-muted/30">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <div className="font-medium">Future features</div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    These options are planned and will be available in upcoming
                    updates.
                  </p>
                </div>
                <Button variant="outline" disabled>
                  Request access
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                *This panel is informational for now (Coming soon).
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Branding (coming soon) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Branding</CardTitle>
              </div>
              <ComingSoonBadge />
            </div>
            <CardDescription>Logo, colors, store identity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="storeName">Store name</Label>
              <Input id="storeName" placeholder="Magic City Drip" disabled />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Primary color</Label>
                <Input id="primaryColor" placeholder="#000000" disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accentColor">Accent color</Label>
                <Input id="accentColor" placeholder="#f59e0b" disabled />
              </div>
            </div>
            <LockedHint text="Coming soon: upload logo & favicon, and theme your storefront." />
          </CardContent>
        </Card>

        {/* Shipping & Taxes (coming soon) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Shipping & Taxes</CardTitle>
              </div>
              <ComingSoonBadge />
            </div>
            <CardDescription>
              Delivery rules and tax configuration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="freeShippingThreshold">
                  Free shipping from
                </Label>
                <Input
                  id="freeShippingThreshold"
                  placeholder="99.90"
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="flatShipping">Flat shipping fee</Label>
                <Input id="flatShipping" placeholder="9.90" disabled />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxNote">Tax note</Label>
              <Textarea
                id="taxNote"
                placeholder="VAT included / Tax calculated at checkout..."
                disabled
              />
            </div>
            <LockedHint text="Coming soon: zones (EU/US), carriers, COD, and tax rules." />
          </CardContent>
        </Card>

        {/* Notifications (coming soon) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Notifications</CardTitle>
              </div>
              <ComingSoonBadge />
            </div>
            <CardDescription>
              Email / WhatsApp alerts for orders
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notifEmail">Notification email</Label>
              <Input
                id="notifEmail"
                placeholder="orders@magiccitydrip.com"
                disabled
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Order confirmation email</Label>
                <p className="text-xs text-muted-foreground">
                  Send email after checkout
                </p>
              </div>
              <Switch disabled />
            </div>
            <LockedHint text="Coming soon: templates, SMTP, WhatsApp and SMS." />
          </CardContent>
        </Card>

        {/* Integrations (coming soon) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Plug className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Integrations</CardTitle>
              </div>
              <ComingSoonBadge />
            </div>
            <CardDescription>Connect external tools</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ga">Google Analytics ID</Label>
              <Input id="ga" placeholder="G-XXXXXXXXXX" disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="metaPixel">Meta Pixel</Label>
              <Input id="metaPixel" placeholder="1234567890" disabled />
            </div>
            <LockedHint text="Coming soon: GA4, Meta Pixel, TikTok pixel, and webhooks." />
          </CardContent>
        </Card>

        {/* Security */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Security</CardTitle>
              </div>
              <ComingSoonBadge />
            </div>
            <CardDescription>
              Authentication and access settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Admin authentication is currently basic. Real JWT + role-based
              access will be enabled soon.
            </p>

            <Separator />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="adminEmail">Admin email</Label>
                <Input
                  id="adminEmail"
                  placeholder="admin@magiccity.com"
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="twofa">2FA</Label>
                <Input
                  id="twofa"
                  placeholder="Enable two-factor authentication"
                  disabled
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div className="font-medium">Team accounts</div>
                  <ComingSoonBadge />
                </div>
                <p className="text-xs text-muted-foreground">
                  Invite staff members with limited permissions (orders only,
                  products only, etc.)
                </p>
              </div>
              <Button variant="outline" disabled>
                Invite
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { Settings, Shield, Bell, Globe, Palette } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const AdminSettings = () => (
  <div className="space-y-6 max-w-2xl">
    <div>
      <h2 className="text-2xl font-bold text-foreground">Settings</h2>
      <p className="text-sm text-muted-foreground">
        Platform configuration and preferences
      </p>
    </div>

    <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
      <h3 className="font-bold text-foreground flex items-center gap-2">
        <Globe className="w-4 h-4" /> General
      </h3>
      <div>
        <label className="text-sm font-medium text-foreground block mb-1.5">
          Business Name
        </label>
        <Input defaultValue="LIQZAR" className="rounded-xl" />
      </div>
      <div>
        <label className="text-sm font-medium text-foreground block mb-1.5">
          Support Email
        </label>
        <Input defaultValue="support@liqzar.co.za" className="rounded-xl" />
      </div>
      <div>
        <label className="text-sm font-medium text-foreground block mb-1.5">
          Support Phone
        </label>
        <Input defaultValue="+27 11 123 4567" className="rounded-xl" />
      </div>
    </div>

    <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
      <h3 className="font-bold text-foreground flex items-center gap-2">
        <Shield className="w-4 h-4" /> Security
      </h3>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">
            Two-Factor Authentication
          </p>
          <p className="text-xs text-muted-foreground">
            Require 2FA for admin accounts
          </p>
        </div>
        <div className="w-10 h-6 bg-primary rounded-full relative">
          <div className="w-4 h-4 bg-primary-foreground rounded-full absolute right-1 top-1" />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Session Timeout</p>
          <p className="text-xs text-muted-foreground">
            Auto-logout after inactivity
          </p>
        </div>
        <span className="text-sm font-medium text-foreground">30 min</span>
      </div>
    </div>

    <Button className="bg-foreground text-background hover:bg-foreground/90 rounded-xl">
      Save Changes
    </Button>
  </div>
);

export default AdminSettings;

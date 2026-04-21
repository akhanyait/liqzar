import { Shield, Smartphone, Lock } from "lucide-react";
import BackButton from "@/components/BackButton";

const SecurityPage = () => (
  <div className="pb-28 bg-background overflow-x-hidden">
    <div className="bg-primary pt-6 pb-4 px-4">
      <div className="container flex items-center gap-3">
        <BackButton />
        <div>
          <h1 className="text-xl font-bold text-primary-foreground">
            Privacy & Security
          </h1>
          <p className="text-xs text-primary-foreground/70 mt-0.5">
            Manage your account security
          </p>
        </div>
      </div>
    </div>
    <div className="container px-4 mt-6 space-y-4">
      {[
        { icon: Lock, label: "Change PIN", desc: "Update your login PIN" },
        {
          icon: Smartphone,
          label: "Two-Factor Auth",
          desc: "Add extra security to your account",
        },
        {
          icon: Shield,
          label: "Privacy Settings",
          desc: "Control your data and preferences",
        },
      ].map(({ icon: Icon, label, desc }) => (
        <div
          key={label}
          className="bg-background border border-border rounded-2xl p-4 flex items-center gap-4"
        >
          <Icon className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-foreground">{label}</h3>
            <p className="text-xs text-muted-foreground">{desc}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default SecurityPage;

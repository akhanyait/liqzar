import { Settings, Globe, Moon } from "lucide-react";
import BackButton from "@/components/BackButton";

const PreferencesPage = () => (
  <div className="pb-28 bg-background overflow-x-hidden">
    <div className="bg-primary pt-6 pb-4 px-4">
      <div className="container flex items-center gap-3">
        <BackButton />
        <div>
          <h1 className="text-xl font-bold text-primary-foreground">
            Preferences
          </h1>
          <p className="text-xs text-primary-foreground/70 mt-0.5">
            Customize your experience
          </p>
        </div>
      </div>
    </div>
    <div className="container px-4 mt-6 space-y-4">
      {[
        { icon: Globe, label: "Language", value: "English" },
        { icon: Moon, label: "Dark Mode", value: "Off" },
        { icon: Settings, label: "Currency", value: "ZAR (R)" },
      ].map(({ icon: Icon, label, value }) => (
        <div
          key={label}
          className="bg-background border border-border rounded-2xl p-4 flex items-center gap-4"
        >
          <Icon className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-foreground">{label}</h3>
          </div>
          <span className="text-xs text-muted-foreground">{value}</span>
        </div>
      ))}
    </div>
  </div>
);

export default PreferencesPage;

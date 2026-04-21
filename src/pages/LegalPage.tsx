import { FileText } from "lucide-react";
import BackButton from "@/components/BackButton";

const LegalPage = () => (
  <div className="pb-28 bg-background overflow-x-hidden">
    <div className="bg-primary pt-6 pb-4 px-4">
      <div className="container flex items-center gap-3">
        <BackButton />
        <div>
          <h1 className="text-xl font-bold text-primary-foreground">Legal</h1>
          <p className="text-xs text-primary-foreground/70 mt-0.5">
            Terms, privacy, and policies
          </p>
        </div>
      </div>
    </div>
    <div className="container px-4 mt-6">
      <div className="bg-background border border-border rounded-2xl overflow-hidden divide-y divide-border">
        {[
          "Terms & Conditions",
          "Privacy Policy",
          "Cookie Policy",
          "Liquor License Information",
          "Delivery Terms",
        ].map((item) => (
          <div key={item} className="flex items-center gap-3 p-4">
            <FileText
              className="w-4 h-4 text-muted-foreground"
              strokeWidth={1.5}
            />
            <span className="text-sm font-medium text-foreground flex-1">
              {item}
            </span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground text-center mt-6">
        Not for sale to persons under the age of 18. Drink responsibly.
      </p>
    </div>
  </div>
);

export default LegalPage;

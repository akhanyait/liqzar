import { Star } from "lucide-react";
import BackButton from "@/components/BackButton";

const ReviewsPage = () => (
  <div className="pb-28 bg-background overflow-x-hidden">
    <div className="bg-primary pt-6 pb-4 px-4">
      <div className="container flex items-center gap-3">
        <BackButton />
        <div>
          <h1 className="text-xl font-bold text-primary-foreground">
            Rate & Review
          </h1>
          <p className="text-xs text-primary-foreground/70 mt-0.5">
            Share your experience with others
          </p>
        </div>
      </div>
    </div>
    <div className="container px-4 mt-6">
      <div className="bg-background border border-border rounded-2xl p-8 text-center">
        <Star
          className="w-10 h-10 text-muted-foreground mx-auto mb-3"
          strokeWidth={1.5}
        />
        <h3 className="font-bold text-foreground">No reviews yet</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Purchase a product to leave your first review.
        </p>
      </div>
    </div>
  </div>
);

export default ReviewsPage;

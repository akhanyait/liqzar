import { useState } from "react";
import { Star, MessageCircle, Send, ShieldCheck, Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useProductReviews, useSubmitReview } from "@/hooks/useProductReviews";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

interface Props {
  productId: string;
}

const StarRating = ({ rating, onRate, interactive = false }: { rating: number; onRate?: (r: number) => void; interactive?: boolean }) => (
  <div className="flex gap-0.5">
    {Array.from({ length: 5 }).map((_, i) => (
      <button
        key={i}
        type="button"
        disabled={!interactive}
        onClick={() => onRate?.(i + 1)}
        className={interactive ? "cursor-pointer hover:scale-110 transition-transform" : "cursor-default"}
      >
        <Star className={`w-4 h-4 ${i < rating ? "fill-primary text-primary" : "text-muted-foreground/30"}`} />
      </button>
    ))}
  </div>
);

const ProductReviews = ({ productId }: Props) => {
  const { user } = useAuth();
  const { data: reviews = [], isLoading } = useProductReviews(productId);
  const submitReview = useSubmitReview();
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState("");
  const [showForm, setShowForm] = useState(false);

  const handleSubmit = () => {
    if (!newComment.trim() || newRating < 1) return;
    submitReview.mutate(
      { productId, rating: newRating, comment: newComment.trim() },
      { onSuccess: () => { setNewComment(""); setNewRating(5); setShowForm(false); } }
    );
  };

  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-primary" />
          <h3 className="font-display font-bold text-foreground text-lg">
            Reviews {reviews.length > 0 && <span className="text-muted-foreground font-normal text-sm">({reviews.length})</span>}
          </h3>
        </div>
        {avgRating && (
          <div className="flex items-center gap-1.5">
            <Star className="w-4 h-4 fill-primary text-primary" />
            <span className="text-sm font-bold text-foreground">{avgRating}</span>
          </div>
        )}
      </div>

      {/* Add Review */}
      {user ? (
        <div>
          {!showForm ? (
            <Button variant="outline" size="sm" onClick={() => setShowForm(true)} className="w-full rounded-xl">
              Write a review
            </Button>
          ) : (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="p-4 rounded-2xl bg-secondary space-y-3"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Your rating:</span>
                <StarRating rating={newRating} onRate={setNewRating} interactive />
              </div>
              <Textarea
                placeholder="Share your experience with this product..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                maxLength={500}
                className="bg-background border-border rounded-xl resize-none"
                rows={3}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setShowForm(false)} className="rounded-xl">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={!newComment.trim() || submitReview.isPending}
                  className="rounded-xl warm-gradient text-primary-foreground gap-1"
                >
                  <Send className="w-3.5 h-3.5" />
                  {submitReview.isPending ? "Posting..." : "Post Review"}
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-3 bg-secondary rounded-xl">
          Sign in to leave a review
        </p>
      )}

      {/* Reviews List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No reviews yet. Be the first!</p>
      ) : (
        <AnimatePresence>
          <div className="space-y-3">
            {reviews.map((review, i) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-4 rounded-2xl bg-secondary"
              >
                <div className="flex items-start gap-3">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                      {(review.profile?.full_name || "A")[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-semibold text-foreground truncate">
                          {review.profile?.full_name || "Anonymous"}
                        </span>
                        {(review as any).verified_buyer && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary bg-primary/10 border border-primary/40 rounded-full">
                            <ShieldCheck className="w-2.5 h-2.5" strokeWidth={2.5} />
                            Verified
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <StarRating rating={review.rating} />
                    <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{review.comment}</p>
                    {user && user.id !== review.user_id && (
                      <button
                        onClick={async () => {
                          const { error } = await supabase
                            .from("review_flags" as any)
                            .insert({ review_id: review.id, user_id: user.id, reason: "inappropriate" } as any);
                          toast({
                            title: error ? "Could not flag" : "Reported for moderation",
                            description: error?.message,
                          });
                        }}
                        className="mt-2 inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                        aria-label="Flag review"
                      >
                        <Flag className="w-2.5 h-2.5" /> Report
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
};

export default ProductReviews;

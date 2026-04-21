export const formatCurrency = (amount: number): string => {
  return `R${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export const formatTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const timeAgo = (dateString: string): string => {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateString);
};

export const getStatusColor = (status: string): string => {
  switch (status) {
    case "delivered":
      return "#10B981";
    case "cancelled":
    case "failed":
      return "#EF4444";
    case "en_route":
    case "picked_up":
      return "#3B82F6";
    case "preparing":
    case "ready":
    case "confirmed":
      return "#F59E0B";
    default:
      return "#9A8860";
  }
};

export const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    pending: "Pending",
    confirmed: "Confirmed",
    preparing: "Preparing",
    ready: "Ready",
    picked_up: "Picked Up",
    en_route: "On the Way",
    delivered: "Delivered",
    cancelled: "Cancelled",
    failed: "Failed",
  };
  return labels[status] || status;
};

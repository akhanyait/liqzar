import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Clock,
  MapPin,
  Zap,
  Target,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  RefreshCw,
  Lightbulb,
  ThermometerSun,
  Droplets,
  Wind,
  Calendar,
  BarChart3,
  Route,
  Users,
  Star,
  Gift,
  X,
  Send,
  Mic,
  MessageCircle,
} from "lucide-react";

interface AIInsight {
  id: string;
  type: "tip" | "warning" | "opportunity" | "achievement";
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
  priority: "high" | "medium" | "low";
}

interface DemandZone {
  area: string;
  demand: "high" | "medium" | "low";
  surge: number;
  eta: string;
}

interface EarningsPrediction {
  hour: string;
  predicted: number;
  actual?: number;
}

const DriverAIAssistant = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "insights" | "earnings" | "demand" | "chat"
  >("insights");
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [chatMessages, setChatMessages] = useState<
    Array<{ role: "user" | "ai"; message: string }>
  >([
    {
      role: "ai",
      message:
        "Hi! I'm your AI driving assistant. Ask me anything about routes, earnings, or delivery tips!",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const demandZones: DemandZone[] = [
    { area: "Sandton CBD", demand: "high", surge: 1.8, eta: "5 min" },
    { area: "Rosebank", demand: "high", surge: 1.5, eta: "12 min" },
    { area: "Fourways", demand: "medium", surge: 1.2, eta: "18 min" },
    { area: "Bryanston", demand: "medium", surge: 1.1, eta: "15 min" },
    { area: "Randburg", demand: "low", surge: 1.0, eta: "22 min" },
  ];

  const earningsPrediction: EarningsPrediction[] = [
    { hour: "14:00", predicted: 85, actual: 92 },
    { hour: "15:00", predicted: 110, actual: 105 },
    { hour: "16:00", predicted: 145, actual: 160 },
    { hour: "17:00", predicted: 180 },
    { hour: "18:00", predicted: 220 },
    { hour: "19:00", predicted: 195 },
    { hour: "20:00", predicted: 150 },
  ];

  const weatherImpact = {
    condition: "Partly Cloudy",
    temp: 24,
    impact: "+12% demand expected",
    icon: ThermometerSun,
  };

  const mockInsights: AIInsight[] = [
    {
      id: "1",
      type: "opportunity",
      title: "🔥 Surge Zone Active",
      description:
        "Sandton CBD has 1.8x surge pricing right now. You're 5 min away - perfect timing!",
      action: { label: "Navigate", onClick: () => {} },
      priority: "high",
    },
    {
      id: "2",
      type: "tip",
      title: "💡 Optimal Route Found",
      description:
        "Complete your current 3 deliveries via M1 South to save 18 min and R24 in fuel.",
      action: { label: "Apply Route", onClick: () => {} },
      priority: "high",
    },
    {
      id: "3",
      type: "achievement",
      title: "⭐ Rating Streak",
      description:
        "You've maintained 5.0 rating for 12 consecutive deliveries! Keep it up for a bonus.",
      priority: "medium",
    },
    {
      id: "4",
      type: "warning",
      title: "⚠️ Traffic Alert",
      description:
        "N1 South accident reported. Avoid for next 45 min. Alternative: William Nicol.",
      priority: "high",
    },
    {
      id: "5",
      type: "tip",
      title: "📊 Peak Hours Coming",
      description:
        "Based on historical data, 17:00-19:00 will be busy. Consider extending your shift.",
      priority: "medium",
    },
  ];

  useEffect(() => {
    // Simulate loading insights
    setIsLoadingInsights(true);
    setTimeout(() => {
      setInsights(mockInsights);
      setIsLoadingInsights(false);
    }, 1000);
  }, []);

  const refreshInsights = () => {
    setIsLoadingInsights(true);
    setTimeout(() => {
      // Shuffle and update insights
      setInsights([...mockInsights].sort(() => Math.random() - 0.5));
      setIsLoadingInsights(false);
    }, 800);
  };

  const handleChatSend = () => {
    if (!chatInput.trim()) return;

    const userMessage = chatInput;
    setChatMessages((prev) => [
      ...prev,
      { role: "user", message: userMessage },
    ]);
    setChatInput("");
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      let aiResponse = "";
      const lowerInput = userMessage.toLowerCase();

      if (
        lowerInput.includes("earn") ||
        lowerInput.includes("money") ||
        lowerInput.includes("tips")
      ) {
        aiResponse =
          "Based on your patterns, you earn most between 17:00-20:00. Today's projected earnings: R1,450. Pro tip: Sandton area customers tip 23% higher on average!";
      } else if (
        lowerInput.includes("traffic") ||
        lowerInput.includes("route")
      ) {
        aiResponse =
          "Current traffic is moderate. Best routes now: 1) M1 → Grayston (12 min), 2) William Nicol → Sandton (15 min). Avoid N1 due to earlier accident.";
      } else if (lowerInput.includes("surge") || lowerInput.includes("busy")) {
        aiResponse =
          "Surge zones active: Sandton (1.8x), Rosebank (1.5x). Happy hour rush starting in 45 min - position yourself in Sandton for maximum orders!";
      } else if (
        lowerInput.includes("rating") ||
        lowerInput.includes("review")
      ) {
        aiResponse =
          "Your rating is excellent at 4.92! Top factors: punctuality (98%), communication (95%), order accuracy (99%). Keep responding to customer messages within 30 seconds.";
      } else if (lowerInput.includes("weather")) {
        aiResponse =
          "Currently 24°C, partly cloudy. No rain expected. Weather typically increases demand by 8-12% in the next 2 hours.";
      } else if (lowerInput.includes("fuel") || lowerInput.includes("gas")) {
        aiResponse =
          "Based on your current route, you'll use approximately 8L of fuel today (R180). Nearest affordable station: Shell on William Nicol (R0.15 cheaper).";
      } else {
        aiResponse =
          "I can help with: earnings predictions, traffic updates, surge zones, ratings tips, weather impact, and fuel efficiency. What would you like to know?";
      }

      setChatMessages((prev) => [...prev, { role: "ai", message: aiResponse }]);
      setIsTyping(false);
    }, 1500);
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case "opportunity":
        return <Zap className="w-4 h-4 text-yellow-500" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case "achievement":
        return <Star className="w-4 h-4 text-green-500" />;
      default:
        return <Lightbulb className="w-4 h-4 text-blue-500" />;
    }
  };

  const getDemandColor = (demand: string) => {
    switch (demand) {
      case "high":
        return "text-green-500 bg-green-500/10";
      case "medium":
        return "text-yellow-500 bg-yellow-500/10";
      default:
        return "text-muted-foreground bg-muted";
    }
  };

  const projectedEarnings = earningsPrediction.reduce(
    (sum, e) => sum + e.predicted,
    0,
  );
  const actualEarnings = earningsPrediction
    .filter((e) => e.actual)
    .reduce((sum, e) => sum + (e.actual || 0), 0);

  return (
    <div className="bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/20 rounded-2xl overflow-hidden">
      {/* Header */}
      <div
        className="p-4 flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Brain className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-bold text-foreground flex items-center gap-1.5">
              AI Assistant <Sparkles className="w-3.5 h-3.5 text-primary" />
            </h3>
            <p className="text-xs text-muted-foreground">
              {insights.filter((i) => i.priority === "high").length}{" "}
              high-priority insights
            </p>
          </div>
        </div>
        <motion.div animate={{ rotate: isExpanded ? 90 : 0 }}>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </motion.div>
      </div>

      {/* Expandable content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            {/* Tabs */}
            <div className="px-4 flex gap-1 border-b border-border/50">
              {[
                { id: "insights", label: "Insights", icon: Lightbulb },
                { id: "earnings", label: "Earnings", icon: DollarSign },
                { id: "demand", label: "Demand", icon: Target },
                { id: "chat", label: "AI Chat", icon: MessageCircle },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-4 max-h-[400px] overflow-y-auto">
              {/* Insights Tab */}
              {activeTab === "insights" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground">
                      Real-time AI insights
                    </p>
                    <button
                      onClick={refreshInsights}
                      className="text-xs text-primary flex items-center gap-1"
                    >
                      <RefreshCw
                        className={`w-3 h-3 ${isLoadingInsights ? "animate-spin" : ""}`}
                      />
                      Refresh
                    </button>
                  </div>

                  {/* Weather card */}
                  <div className="p-3 rounded-xl bg-gradient-to-r from-blue-500/10 to-yellow-500/10 border border-blue-500/20">
                    <div className="flex items-center gap-3">
                      <weatherImpact.icon className="w-8 h-8 text-yellow-500" />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {weatherImpact.condition} • {weatherImpact.temp}°C
                        </p>
                        <p className="text-xs text-green-500 font-medium">
                          {weatherImpact.impact}
                        </p>
                      </div>
                    </div>
                  </div>

                  {insights.map((insight) => (
                    <motion.div
                      key={insight.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`p-3 rounded-xl border ${
                        insight.priority === "high"
                          ? "bg-primary/5 border-primary/20"
                          : "bg-card border-border/50"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {getInsightIcon(insight.type)}
                        <div className="flex-1">
                          <p className="text-sm font-bold text-foreground">
                            {insight.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {insight.description}
                          </p>
                          {insight.action && (
                            <button
                              onClick={insight.action.onClick}
                              className="mt-2 text-xs font-bold text-primary flex items-center gap-1"
                            >
                              {insight.action.label}{" "}
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Earnings Tab */}
              {activeTab === "earnings" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                      <p className="text-xs text-muted-foreground">
                        Actual (so far)
                      </p>
                      <p className="text-2xl font-bold text-green-500">
                        R{actualEarnings}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                      <p className="text-xs text-muted-foreground">
                        Projected Today
                      </p>
                      <p className="text-2xl font-bold text-primary">
                        R{projectedEarnings}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Hourly Breakdown
                    </p>
                    <div className="space-y-2">
                      {earningsPrediction.map((e) => (
                        <div key={e.hour} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-12">
                            {e.hour}
                          </span>
                          <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden relative">
                            <div
                              className="h-full bg-primary/30 rounded-full"
                              style={{ width: `${(e.predicted / 220) * 100}%` }}
                            />
                            {e.actual && (
                              <div
                                className="absolute top-0 left-0 h-full bg-green-500 rounded-full"
                                style={{ width: `${(e.actual / 220) * 100}%` }}
                              />
                            )}
                          </div>
                          <span className="text-xs font-medium text-foreground w-16 text-right">
                            {e.actual ? `R${e.actual}` : `~R${e.predicted}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                      <p className="text-sm font-bold text-foreground">
                        AI Earning Tip
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Work 2 more hours (17:00-19:00) to potentially earn an
                      additional R400. This is your highest-earning window based
                      on 30-day history.
                    </p>
                  </div>
                </div>
              )}

              {/* Demand Tab */}
              {activeTab === "demand" && (
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Live demand zones near you
                  </p>

                  <div className="space-y-2">
                    {demandZones.map((zone) => (
                      <div
                        key={zone.area}
                        className="p-3 rounded-xl bg-card border border-border/50 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`px-2 py-1 rounded-lg text-xs font-bold ${getDemandColor(zone.demand)}`}
                          >
                            {zone.demand.toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {zone.area}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {zone.eta} away
                            </p>
                          </div>
                        </div>
                        {zone.surge > 1 && (
                          <div className="text-right">
                            <p className="text-lg font-bold text-green-500">
                              {zone.surge}x
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              surge
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-4 h-4 text-yellow-500" />
                      <p className="text-sm font-bold text-foreground">
                        Upcoming Surge
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Happy hour expected 17:00-19:00. Position in
                      Sandton/Rosebank for 2x surge opportunity.
                    </p>
                  </div>
                </div>
              )}

              {/* AI Chat Tab */}
              {activeTab === "chat" && (
                <div className="flex flex-col h-[300px]">
                  <div className="flex-1 overflow-y-auto space-y-3 mb-3">
                    {chatMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] p-3 rounded-2xl ${
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground rounded-br-md"
                              : "bg-muted text-foreground rounded-bl-md"
                          }`}
                        >
                          <p className="text-sm">{msg.message}</p>
                        </div>
                      </div>
                    ))}
                    {isTyping && (
                      <div className="flex justify-start">
                        <div className="bg-muted p-3 rounded-2xl rounded-bl-md">
                          <div className="flex gap-1">
                            <span
                              className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                              style={{ animationDelay: "0ms" }}
                            />
                            <span
                              className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                              style={{ animationDelay: "150ms" }}
                            />
                            <span
                              className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                              style={{ animationDelay: "300ms" }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && handleChatSend()}
                      placeholder="Ask about earnings, routes, tips..."
                      className="flex-1 px-4 py-2 rounded-xl bg-muted text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <button
                      onClick={handleChatSend}
                      className="p-2 rounded-xl bg-primary text-primary-foreground"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DriverAIAssistant;

import React, { Component, ErrorInfo, ReactNode } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
}

/**
 * ErrorBoundary catches JavaScript errors in child components and
 * displays a themed fallback UI instead of crashing the app.
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, componentStack: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ componentStack: errorInfo.componentStack ?? null });
  }

  handleTryAgain = (): void => {
    this.setState({ hasError: false, error: null, componentStack: null });
    this.props.onReset?.();
  };

  handleGoHome = (): void => {
    this.setState({ hasError: false, error: null, componentStack: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.logo}>LIQZAR</Text>
            <View style={styles.divider} />
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.subtitle}>
              An unexpected error occurred. Please try again or return to the
              home screen.
            </Text>

            <ScrollView style={styles.errorBox}>
              <Text style={styles.errorText}>
                {this.state.error?.message || "Unknown error"}
                {"\n\n"}
                STACK:
                {"\n"}
                {this.state.error?.stack || "(no stack)"}
                {"\n\n"}
                COMPONENT:
                {"\n"}
                {this.state.componentStack || "(no component stack)"}
              </Text>
            </ScrollView>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={this.handleTryAgain}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>Try Again</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={this.handleGoHome}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryButtonText}>Go Home</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const GOLD = "#D4AF37";
const DARK_BG = "#0d0b08";
const DARK_SURFACE = "#1a1714";
const GOLD_DIM = "rgba(212, 175, 55, 0.3)";
const TEXT_MUTED = "#a09880";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_BG,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  content: {
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
  },
  logo: {
    fontSize: 32,
    fontWeight: "700",
    color: GOLD,
    letterSpacing: 4,
    marginBottom: 16,
  },
  divider: {
    width: 60,
    height: 2,
    backgroundColor: GOLD,
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: TEXT_MUTED,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  errorBox: {
    width: "100%",
    maxHeight: 320,
    backgroundColor: DARK_SURFACE,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: GOLD_DIM,
    padding: 12,
    marginBottom: 32,
  },
  errorText: {
    fontSize: 12,
    color: TEXT_MUTED,
    fontFamily: "monospace",
  },
  primaryButton: {
    width: "100%",
    backgroundColor: GOLD,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: DARK_BG,
  },
  secondaryButton: {
    width: "100%",
    backgroundColor: "transparent",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: GOLD_DIM,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: GOLD,
  },
});

export default ErrorBoundary;

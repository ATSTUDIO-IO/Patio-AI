declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}

export function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean>
) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", eventName, params ?? {});
  }
}

export function trackCTAClick(location: string) {
  trackEvent("cta_click", {
    event_category: "conversion",
    event_label: location,
  });
}

export function trackPlanClick(planName: string) {
  trackEvent("plan_click", {
    event_category: "conversion",
    event_label: planName,
    plan_name: planName,
  });
}

export function trackDemoClick() {
  trackEvent("demo_click", {
    event_category: "engagement",
    event_label: "ver_demo",
  });
}

export function trackSectionView(sectionName: string) {
  trackEvent("section_view", {
    event_category: "engagement",
    event_label: sectionName,
  });
}

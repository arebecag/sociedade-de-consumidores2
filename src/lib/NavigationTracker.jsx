import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { pagesConfig } from "@/pages.config";
import { base44 } from "@/api/base44Client";
import { getToken } from "@/api/base44Client";

export default function NavigationTracker() {
  const location = useLocation();
  const { Pages, mainPage } = pagesConfig;
  const mainPageKey = mainPage ?? Object.keys(Pages)[0];

  useEffect(() => {
    const pathname = location.pathname;
    const pageName = pathname === "/" || pathname === "" ? mainPageKey : pathname.replace(/^\//, "").split("/")[0];
    if (getToken() && pageName) {
      base44.appLogs.logUserInApp(pageName).catch(() => {});
    }
  }, [location, Pages, mainPageKey]);

  return null;
}

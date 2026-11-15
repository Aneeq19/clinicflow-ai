import { useEffect, useState } from "react";
import { publicRequest } from "./api";

export default function useBusiness() {
  const [business, setBusiness] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 15000);
    let active = true;
    publicRequest("/business", { signal: controller.signal })
      .then((result) => {
        if (active) setBusiness(result.settings);
      })
      .catch(() => {
        if (active)
          setError(
            "Business information is unavailable. Check the backend connection, then refresh.",
          );
      });
    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, []);
  return { business, error };
}

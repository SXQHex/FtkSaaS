import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { readAppearance } from "./appearance";

export function useAccountAppearance(accountId: string) {
  const query = useQuery({ queryKey: ["account-appearance", accountId], queryFn: readAppearance });
  const theme = query.data?.values.theme;
  const scale = query.data?.values.font_scale;
  const contrast = query.data?.values.contrast;
  useEffect(() => {
    if (!theme) return;
    document.documentElement.dataset.theme = theme;
    if (contrast) document.documentElement.dataset.contrast = contrast;
    if (typeof scale === "number") document.documentElement.style.zoom = String(scale);
    else document.documentElement.style.removeProperty("zoom");
    return () => {
      delete document.documentElement.dataset.theme;
      delete document.documentElement.dataset.contrast;
      document.documentElement.style.removeProperty("zoom");
    };
  }, [accountId, theme, scale, contrast]);
  return query;
}

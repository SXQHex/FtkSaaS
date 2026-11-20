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
    const root = document.documentElement;
    root.dataset.theme = theme;
    if (contrast) root.dataset.contrast = contrast;
    if (typeof scale === "number" && scale !== 1) root.style.fontSize = `${scale * 100}%`;
    return () => {
      delete root.dataset.theme;
      delete root.dataset.contrast;
      root.style.removeProperty("font-size");
    };
  }, [accountId, theme, scale, contrast]);
  return query;
}

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { readTheme } from "./appearance";

export function useAccountTheme(accountId: string) {
  const query = useQuery({ queryKey: ["account-theme", accountId], queryFn: readTheme });
  const theme = query.data?.theme;
  useEffect(() => {
    if (!theme) return;
    document.documentElement.dataset.theme = theme;
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [accountId, theme]);
  return query;
}

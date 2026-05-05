import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { subscribeDemoChanges } from "@/lib/demo-data";

export function useDemoSync(queryKeys: (string | (string | undefined)[])[]) {
  const qc = useQueryClient();
  useEffect(() => {
    return subscribeDemoChanges(() => {
      for (const key of queryKeys) {
        qc.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] });
      }
    });
  }, [qc, JSON.stringify(queryKeys)]); // eslint-disable-line react-hooks/exhaustive-deps
}

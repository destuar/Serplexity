/**
 * @file useEmbeddedPage.ts
 * @description Hook for managing embedded page states within components
 */

import { useCallback, useState } from "react";
import type { BreadcrumbItem } from "../contexts/NavigationContextTypes";
import { useNavigation } from "./useNavigation";

export const useEmbeddedPage = (
  basePage: string,
  onNavigateBack?: () => void
) => {
  const [embeddedPage, setEmbeddedPage] = useState<string | null>(null);
  const { setBreadcrumbs } = useNavigation();

  const openEmbeddedPage = useCallback(
    (
      pageName: string,
      pageTitleOrTrail: string | Array<string | BreadcrumbItem>
    ) => {
      setEmbeddedPage(pageName);
      const trailItems: BreadcrumbItem[] = (
        Array.isArray(pageTitleOrTrail) ? pageTitleOrTrail : [pageTitleOrTrail]
      ).map((t) => (typeof t === "string" ? { label: t } : t));

      // Update breadcrumbs to show nested navigation; support multi-level trails
      setBreadcrumbs([
        { label: "Action Center" },
        {
          label: basePage,
          onClick: () => {
            setEmbeddedPage(null);
            setBreadcrumbs([{ label: "Action Center" }, { label: basePage }]);
            if (onNavigateBack) {
              onNavigateBack();
            }
          },
        },
        ...trailItems,
      ]);
    },
    [basePage, setBreadcrumbs, onNavigateBack]
  );

  const closeEmbeddedPage = useCallback(() => {
    setEmbeddedPage(null);
    setBreadcrumbs([{ label: "Action Center" }, { label: basePage }]);
    // Call the callback to let parent component clear its state
    if (onNavigateBack) {
      onNavigateBack();
    }
  }, [basePage, setBreadcrumbs, onNavigateBack]);

  return {
    embeddedPage,
    openEmbeddedPage,
    closeEmbeddedPage,
    isEmbedded: embeddedPage !== null,
  };
};

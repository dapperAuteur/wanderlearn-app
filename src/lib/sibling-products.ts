/**
 * Canonical WitUS ecosystem sibling-product list.
 *
 * Mirrors `gemini/witus/lib/products.ts` (the upstream canonical list)
 * and `claude/fly-witus/src/components/site-footer.tsx`'s inline
 * SIBLING_PRODUCTS constant. When the ecosystem changes, update:
 *
 *   1. The upstream `gemini/witus/lib/products.ts`
 *   2. Each sibling repo's mirror (this file, fly-witus's footer, etc.)
 *
 * The shared raw URL with the full canonical recipe lives at:
 * https://raw.githubusercontent.com/dapperAuteur/witus-online/main/public/brand/footer-recipe.md
 */
export interface SiblingProduct {
  name: string;
  href: string;
}

export const SIBLING_PRODUCTS: SiblingProduct[] = [
  { name: "WitUS.online", href: "https://witus.online" },
  { name: "WitUS Inbox", href: "https://inbox.witus.online" },
  { name: "CentenarianOS", href: "https://centenarianos.com" },
  { name: "Work.WitUS", href: "https://work.witus.online" },
  { name: "Tour Manager OS", href: "https://tour.witus.online" },
  { name: "Wanderlust", href: "https://wanderlust.witus.online" },
  { name: "Fly.WitUS", href: "https://fly.witus.online" },
  { name: "FlashLearnAI", href: "https://flashlearnai.witus.online" },
  // Corrected 2026-08: this pointed at centenarianos.com/academy, which was
  // wrong ecosystem-wide. Learn.WitUS is a standalone multi-tenant LMS at
  // learn.witus.online, not a section inside CentenarianOS.
  { name: "Learn.WitUS", href: "https://learn.witus.online" },
  { name: "AwesomeWebStore", href: "https://awesomewebstore.com" },
];

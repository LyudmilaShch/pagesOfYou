import { PageType } from '@prisma/client';

/** A magazine type is orderable only once it has at least one COVER and one BACK_COVER template
 * — the same minimum `OrdersService.createDraft` enforces. Shared by the public catalog
 * (`MagazineTypesService`, which hides ineligible types entirely) and the admin catalog
 * (`AdminMagazineTypesService`, which surfaces this as `isAvailableToCustomers` so admins can see
 * why a type is invisible on the site) so the rule can't drift between the two. */
export function hasCoverAndBackCoverTemplates(pages: Array<{ pageType: PageType }>): boolean {
  let hasCover = false;
  let hasBackCover = false;

  for (const page of pages) {
    if (page.pageType === PageType.COVER) hasCover = true;
    if (page.pageType === PageType.BACK_COVER) hasBackCover = true;
    if (hasCover && hasBackCover) break;
  }

  return hasCover && hasBackCover;
}

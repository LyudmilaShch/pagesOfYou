import { adminDefaultSpreadsApi } from '@/shared/api/admin/default-spreads.api'
import { adminMagazinePagesApi } from '@/shared/api/admin/magazine-pages.api'
import { adminMagazineTypesApi } from '@/shared/api/admin/magazine-types.api'
import { buildTocAdminSamples, type TocAdminSample } from './toc-list.util'

/** Enough rows to cover the default journal and the spare lines an admin may add. */
const SAMPLE_ROW_COUNT = 64

export async function loadTocAdminSamples(magazineTypeId: string): Promise<TocAdminSample[]> {
  const [type, pages, spreads] = await Promise.all([
    adminMagazineTypesApi.getOne(magazineTypeId),
    adminMagazinePagesApi.list(magazineTypeId),
    adminDefaultSpreadsApi.list(magazineTypeId),
  ])
  return buildTocAdminSamples({
    pages,
    includedSpreads: type.includedSpreads,
    defaultSpreads: spreads.map((spread) => ({
      layoutMode: spread.layoutMode,
      magazinePageId: spread.magazinePageId,
      rightMagazinePageId: spread.rightMagazinePageId,
    })),
    rowCount: SAMPLE_ROW_COUNT,
  })
}

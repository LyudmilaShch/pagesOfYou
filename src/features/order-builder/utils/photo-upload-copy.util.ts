/** Short hover text on the cover's add/replace photo button. */
export const COVER_PICK_TOOLTIP = 'Для обложки лучше вертикальное фото со спокойным фоном.'

/** Shown in the gallery picker only while a cover slot is the target. */
export const COVER_GALLERY_BANNER =
  'Выберите вертикальное фото в хорошем качестве. Лучше всего подойдёт снимок со спокойным фоном и без большого количества мелких деталей — так текст и оформление обложки будут выглядеть аккуратно и хорошо читаться. Горизонтальный снимок на обложке сильно обрежется.'

/** Yellow warning under the photo-step intro once a landscape photo is on the cover. */
export const COVER_LANDSCAPE_WARNING =
  'Горизонтальное фото на обложке: кадр сильно обрежется. Лучше выбрать вертикальное.'

/** Tooltip on the cover thumbnail badge. Same wording the photo step used before the banner. */
export const COVER_ORIENTATION_BADGE =
  'Горизонтальное фото: на обложке кадр сильно обрежется.'

/** Intro under the photo-step title. The count is the same hole count as «N не на месте». */
export function photoUploadIntro(missingCount: number): string {
  const placement = 'Хотите изменить расположение? Перетащите фото из галереи на нужную страницу.'
  if (missingCount > 0) {
    return `Загрузите ${missingCount} фотографий — мы автоматически расставим их по страницам журнала. ${placement}`
  }
  return `Фото расставлены. ${placement}`
}

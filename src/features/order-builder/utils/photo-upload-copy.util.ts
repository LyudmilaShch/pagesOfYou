import { pluralize } from '../../../shared/utils/pluralize.util.ts'

/** Short hover text on the cover's add/replace photo button. */
export const COVER_PICK_TOOLTIP = 'Для обложки лучше вертикальное фото со спокойным фоном.'

/** Shown in the gallery picker only while a cover slot is the target. */
export const COVER_GALLERY_BANNER =
  'Выберите вертикальное фото в хорошем качестве. Лучше всего подойдёт снимок со спокойным фоном и без большого количества мелких деталей — так текст и оформление обложки будут выглядеть аккуратно и хорошо читаться.'

/** Intro under the photo-step title. `count` is how many photos the line asks for. */
export function photoUploadIntro(count: number): string {
  const placement = 'Хотите изменить расположение? Перетащите фото из галереи на нужную страницу.'
  if (count > 0) {
    const word = pluralize(count, 'фотографию', 'фотографии', 'фотографий')
    return `Загрузите ${count} ${word} — мы автоматически расставим их по страницам журнала. ${placement}`
  }
  return `Фото расставлены. ${placement}`
}

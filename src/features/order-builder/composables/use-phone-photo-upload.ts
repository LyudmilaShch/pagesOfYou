import { computed, onBeforeUnmount, ref } from 'vue'

import { extractApiErrorMessage } from '@/shared/utils/api-error.util'
import { phoneUploadApi } from '../api/phone-upload.api'
import { photoGalleryApi, type GalleryPhoto, type PhotoGalleryScope } from '../api/photo-gallery.api'
import {
  phoneUploadAbsoluteUrl,
  phoneUploadStorageKey,
  readStoredPhoneUploadSession,
  unseenPhotos,
  type StoredPhoneUploadSession,
} from '../utils/phone-upload-session.util'

const POLL_MS = 2500

/**
 * QR session for step 2. The computer polls the gallery it already owns; the phone never
 * receives the guest id or the order id. Closing the dialog keeps the session. Leaving the
 * page revokes it.
 */
export function usePhonePhotoUpload(options: {
  getScope: () => PhotoGalleryScope
  getPhotos: () => GalleryPhoto[]
  setPhotos: (photos: GalleryPhoto[]) => void
  onNewPhoto: (url: string) => Promise<void>
}) {
  const dialogOpen = ref(false)
  const session = ref<StoredPhoneUploadSession | null>(null)
  const newCount = ref(0)
  const creating = ref(false)
  const errorMessage = ref<string | null>(null)

  const knownIds = new Set<string>()
  /** Photos uploaded from this computer. The poll must not auto-place them a second time. */
  const desktopIds = new Set<string>()
  const deferred: GalleryPhoto[] = []
  let holdCount = 0
  let timer: ReturnType<typeof setInterval> | null = null
  let pollInFlight = false
  let placeChain: Promise<void> = Promise.resolve()

  const uploadUrl = computed(() => {
    const current = session.value
    if (!current || typeof window === 'undefined') {
      return ''
    }
    return phoneUploadAbsoluteUrl(window.location.origin, import.meta.env.BASE_URL, current.uploadToken)
  })

  function storageKey(): string {
    return phoneUploadStorageKey(options.getScope())
  }

  function noteAll(photos: readonly GalleryPhoto[]): void {
    for (const photo of photos) {
      knownIds.add(photo.id)
    }
  }

  /** A photo that this computer uploaded itself. Counted as known and never auto-placed by the poll. */
  function noteFromDesktop(id: string): void {
    knownIds.add(id)
    desktopIds.add(id)
  }

  function clearStored(): void {
    try {
      sessionStorage.removeItem(storageKey())
    } catch {
      // Storage can be blocked. The in-memory session still drives this visit.
    }
  }

  function writeStored(value: StoredPhoneUploadSession): void {
    try {
      sessionStorage.setItem(storageKey(), JSON.stringify(value))
    } catch {
      // A reload will ask for a new code. The current QR keeps working until then.
    }
  }

  function readStored(): StoredPhoneUploadSession | null {
    try {
      return readStoredPhoneUploadSession(sessionStorage, storageKey())
    } catch {
      return null
    }
  }

  function stopPolling(): void {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  function sessionStillLive(current: StoredPhoneUploadSession): boolean {
    return Date.parse(current.expiresAt) > Date.now()
  }

  function dropExpiredSession(): void {
    session.value = null
    clearStored()
    stopPolling()
  }

  function enqueuePlace(photosOldestFirst: readonly GalleryPhoto[]): void {
    const fromPhone = photosOldestFirst.filter((photo) => !desktopIds.has(photo.id))
    if (fromPhone.length === 0) {
      return
    }
    newCount.value += fromPhone.length
    for (const photo of fromPhone) {
      placeChain = placeChain.then(() => options.onNewPhoto(photo.url)).catch(() => undefined)
    }
  }

  function holdAutoPlace(): void {
    holdCount += 1
  }

  function releaseAutoPlace(): void {
    holdCount = Math.max(0, holdCount - 1)
    if (holdCount > 0) {
      return
    }
    const pending = deferred.splice(0, deferred.length)
    enqueuePlace(pending)
  }

  function adopt(freshNewestFirst: GalleryPhoto[]): void {
    for (const photo of freshNewestFirst) {
      knownIds.add(photo.id)
    }
    if (freshNewestFirst.length === 0) {
      return
    }
    options.setPhotos([...freshNewestFirst, ...options.getPhotos()])
    const oldestFirst = [...freshNewestFirst].reverse()
    if (holdCount > 0) {
      deferred.push(...oldestFirst)
      return
    }
    enqueuePlace(oldestFirst)
  }

  async function poll(): Promise<void> {
    const current = session.value
    if (!current || pollInFlight) {
      return
    }
    if (!sessionStillLive(current)) {
      dropExpiredSession()
      return
    }

    pollInFlight = true
    try {
      const listed = await photoGalleryApi.list(options.getScope())
      if (session.value?.uploadToken !== current.uploadToken) {
        return
      }
      adopt(unseenPhotos(listed, knownIds))
    } catch {
      // The next tick tries again. One failed read should not close the QR.
    } finally {
      pollInFlight = false
    }
  }

  function startPolling(): void {
    if (timer || !session.value) {
      return
    }
    void poll()
    timer = setInterval(() => {
      void poll()
    }, POLL_MS)
  }

  /** Resume a code that survived a reload of step 2. Does not revoke anything. */
  function restore(): void {
    const stored = readStored()
    if (!stored) {
      return
    }
    session.value = stored
    startPolling()
  }

  async function openDialog(): Promise<void> {
    errorMessage.value = null
    dialogOpen.value = true

    const existing = session.value ?? readStored()
    if (existing && sessionStillLive(existing)) {
      session.value = existing
      startPolling()
      return
    }
    if (existing) {
      dropExpiredSession()
    }
    if (creating.value) {
      return
    }

    creating.value = true
    try {
      const created = await phoneUploadApi.create(options.getScope())
      const stored: StoredPhoneUploadSession = {
        uploadToken: created.uploadToken,
        revokeToken: created.revokeToken,
        expiresAt: new Date(created.expiresAt).toISOString(),
      }
      writeStored(stored)
      session.value = stored
      newCount.value = 0
      startPolling()
    } catch (err: unknown) {
      errorMessage.value = extractApiErrorMessage(err, 'Не удалось подготовить код для телефона.')
    } finally {
      creating.value = false
    }
  }

  function closeDialog(): void {
    dialogOpen.value = false
  }

  /** Step 2 was left. The phone link stops accepting files. A reload of this page does not call this. */
  async function revoke(): Promise<void> {
    const current = session.value ?? readStored()
    session.value = null
    dialogOpen.value = false
    clearStored()
    stopPolling()
    deferred.length = 0
    if (!current) {
      return
    }
    try {
      await phoneUploadApi.revoke(current.revokeToken)
    } catch {
      // The local link is already gone. The token expires on its own if this request does not land.
    }
  }

  onBeforeUnmount(() => {
    stopPolling()
  })

  return {
    dialogOpen,
    uploadUrl,
    newCount,
    creating,
    errorMessage,
    noteAll,
    noteFromDesktop,
    holdAutoPlace,
    releaseAutoPlace,
    restore,
    openDialog,
    closeDialog,
    revoke,
  }
}

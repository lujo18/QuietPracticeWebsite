export const APP_STORE_URL =
  "https://apps.apple.com/us/app/quiet-practice-secure-journal/id6760091118"

const IN_APP_BROWSER_PATTERNS = {
  instagram: /Instagram/i,
  tiktok: /musical_ly|BytedanceWebview|\bTikTok\b|trill/i,
}

export function hasStayParam(search = "") {
  return new URLSearchParams(search).getAll("stay").includes("1")
}

export function isIOSDevice({ userAgent = "", platform = "", maxTouchPoints = 0 } = {}) {
  const isIOSUserAgent = /iPhone|iPad|iPod/i.test(userAgent)
  const isIPadDesktopMode = platform === "MacIntel" && maxTouchPoints > 1
  return isIOSUserAgent || isIPadDesktopMode
}

export function isAndroidDevice({ userAgent = "" } = {}) {
  return /Android/i.test(userAgent)
}

export function getInAppBrowserKind({ userAgent = "" } = {}) {
  if (IN_APP_BROWSER_PATTERNS.instagram.test(userAgent)) {
    return "instagram"
  }

  if (IN_APP_BROWSER_PATTERNS.tiktok.test(userAgent)) {
    return "tiktok"
  }

  return null
}

export function isInAppBrowser({ userAgent = "" } = {}) {
  return getInAppBrowserKind({ userAgent }) !== null
}

export function shouldRedirectToAppStore({
  userAgent = "",
  platform = "",
  maxTouchPoints = 0,
  search = "",
} = {}) {
  if (hasStayParam(search)) {
    return false
  }

  if (isInAppBrowser({ userAgent })) {
    return false
  }

  return isIOSDevice({ userAgent, platform, maxTouchPoints })
}

export function buildStayUrl(url = "") {
  const parsed = new URL(url)
  const params = new URLSearchParams(parsed.search)
  if (!params.getAll("stay").includes("1")) {
    params.append("stay", "1")
  }
  parsed.search = params.toString()
  return parsed.toString()
}

export function buildChromeIntentUrl({
  targetUrl = APP_STORE_URL,
  fallbackUrl = "",
} = {}) {
  const target = new URL(targetUrl)
  const fallback = fallbackUrl || target.toString()
  const intentPath = `${target.host}${target.pathname}${target.search}`
  return `intent://${intentPath}#Intent;scheme=${target.protocol.replace(":", "")};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(fallback)};end`
}

export function getHandoffState({
  userAgent = "",
  platform = "",
  maxTouchPoints = 0,
  search = "",
} = {}) {
  const stay = hasStayParam(search)
  const inAppBrowserKind = getInAppBrowserKind({ userAgent })
  const iOS = isIOSDevice({ userAgent, platform, maxTouchPoints })
  const android = isAndroidDevice({ userAgent })

  if (inAppBrowserKind) {
    return {
      kind: "in-app-browser",
      inAppBrowserKind,
      iOS,
      android,
      stay,
      redirectToAppStore: false,
      showOverlay: true,
      autoOpenChromeIntent: android && !stay,
    }
  }

  if (iOS) {
    return {
      kind: "ios-browser",
      inAppBrowserKind: null,
      iOS: true,
      android: false,
      stay,
      redirectToAppStore: !stay,
      showOverlay: false,
      autoOpenChromeIntent: false,
    }
  }

  if (android) {
    return {
      kind: "android-browser",
      inAppBrowserKind: null,
      iOS: false,
      android: true,
      stay,
      redirectToAppStore: false,
      showOverlay: false,
      autoOpenChromeIntent: false,
    }
  }

  return {
    kind: "default-browser",
    inAppBrowserKind: null,
    iOS: false,
    android: false,
    stay,
    redirectToAppStore: false,
    showOverlay: false,
    autoOpenChromeIntent: false,
  }
}

function getFocusableElements(container) {
  if (!container) {
    return []
  }

  return Array.from(
    container.querySelectorAll(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute("hidden"))
}

function showOverlay({
  overlayElement,
  statusElement,
  inAppBrowserKind,
  iOS,
  android,
  openChromeIntent,
  onDismiss,
}) {
  if (!overlayElement) {
    return () => {}
  }

  overlayElement.hidden = false
  overlayElement.dataset.browserKind = inAppBrowserKind || ""
  overlayElement.dataset.deviceKind = iOS ? "ios" : android ? "android" : "other"

  const titleElement = overlayElement.querySelector("[data-overlay-title]")
  const bodyElement = overlayElement.querySelector("[data-overlay-body]")
  const chromeAction = overlayElement.querySelector("[data-overlay-chrome]")
  const appStoreAction = overlayElement.querySelector("[data-overlay-app-store]")
  const contentElement = overlayElement.querySelector(".in-app-overlay__content")
  const browserLabel = inAppBrowserKind === "instagram" ? "Instagram" : "TikTok"

  if (titleElement) {
    titleElement.textContent = `You're in the ${browserLabel} browser`
  }

  if (bodyElement) {
    bodyElement.innerHTML = ""
    const chooseLine = document.createElement("span")
    chooseLine.className = "in-app-overlay__line"
    chooseLine.append("Tap ")
    const menu = document.createElement("strong")
    menu.textContent = "•••"
    chooseLine.append(menu, " and choose")

    const openLine = document.createElement("span")
    openLine.className = "in-app-overlay__line"
    const openStrong = document.createElement("strong")
    openStrong.textContent = "Open in browser"
    openLine.append(openStrong)

    bodyElement.append(chooseLine, openLine)
  }

  const onChromeClick =
    android && typeof openChromeIntent === "function" ? openChromeIntent : null

  if (chromeAction) {
    chromeAction.hidden = !android
    if (onChromeClick) {
      chromeAction.addEventListener("click", onChromeClick)
    }
  }

  if (appStoreAction) {
    appStoreAction.hidden = true
  }

  if (statusElement) {
    statusElement.textContent = android
      ? "Quiet Practice is currently available on iPhone and iPad. No Android app or Play Store listing is available yet."
      : "Open this page in Safari, then tap Get Quiet Practice."
  }

  const previousFocus =
    document.activeElement instanceof HTMLElement ? document.activeElement : null
  const focusableElements = getFocusableElements(overlayElement)
  const initialFocus = focusableElements[0] || contentElement || overlayElement

  let closed = false

  const closeOverlay = () => {
    if (closed || overlayElement.hidden) {
      return
    }

    closed = true
    overlayElement.hidden = true
    overlayElement.removeEventListener("keydown", onKeyDown)
    overlayElement.removeEventListener("click", onOverlayClick)
    if (chromeAction && onChromeClick) {
      chromeAction.removeEventListener("click", onChromeClick)
    }
    if (typeof onDismiss === "function") {
      onDismiss()
    }
    if (previousFocus && typeof previousFocus.focus === "function") {
      previousFocus.focus()
    }
  }

  const onKeyDown = (event) => {
    if (overlayElement.hidden) {
      return
    }

    if (event.key === "Escape") {
      event.preventDefault()
      closeOverlay()
      return
    }

    if (event.key !== "Tab") {
      return
    }

    const elements = getFocusableElements(overlayElement)
    if (elements.length === 0) {
      event.preventDefault()
      return
    }

    const first = elements[0]
    const last = elements[elements.length - 1]
    const active = document.activeElement

    if (event.shiftKey && active === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const onOverlayClick = (event) => {
    if (event.target === overlayElement) {
      closeOverlay()
    }
  }

  overlayElement.addEventListener("keydown", onKeyDown)
  overlayElement.addEventListener("click", onOverlayClick)

  if (initialFocus && typeof initialFocus.focus === "function") {
    if (initialFocus === contentElement || initialFocus === overlayElement) {
      initialFocus.setAttribute("tabindex", "-1")
    }
    initialFocus.focus()
  }

  return closeOverlay
}

function applyAndroidBrowserState({
  primaryCtaElement,
  statusElement,
  helpElement,
  showAppStoreCta = true,
}) {
  if (primaryCtaElement) {
    primaryCtaElement.hidden = !showAppStoreCta
    if (showAppStoreCta) {
      primaryCtaElement.textContent = "View on the App Store"
    }
  }

  if (statusElement) {
    statusElement.textContent = showAppStoreCta
      ? "Quiet Practice is currently available on iPhone and iPad. No Android app or Play Store listing is available yet."
      : "Quiet Practice is currently available on iPhone and iPad. No Android app or Play Store listing is available yet."
  }

  if (helpElement) {
    const title = helpElement.querySelector("h2")
    const paragraphs = helpElement.querySelectorAll("p")
    if (title) {
      title.textContent = "iPhone and iPad only"
    }

    if (paragraphs[0]) {
      paragraphs[0].textContent =
        "Quiet Practice is currently available for iPhone and iPad."
    }

    if (paragraphs[1]) {
      paragraphs[1].textContent = showAppStoreCta
        ? "You can view the App Store listing from this device, but there is no Android app or Google Play listing yet."
        : "There is no Android app or Google Play listing yet. If you opened this page in an in-app browser, use your browser menu to open it in Chrome."
    }
  }
}

export function runHandoff({
  userAgent = "",
  platform = "",
  maxTouchPoints = 0,
  search = "",
  href = "",
  replace,
  openUrl,
  statusElement = null,
  overlayElement = null,
  primaryCtaElement = null,
  helpElement = null,
} = {}) {
  const state = getHandoffState({ userAgent, platform, maxTouchPoints, search })
  const currentHref =
    href || (typeof window !== "undefined" ? window.location.href : APP_STORE_URL)
  const navigateExternal =
    typeof openUrl === "function"
      ? openUrl
      : (url) => {
          if (typeof window !== "undefined") {
            window.location.href = url
          }
        }

  if (state.kind === "android-browser") {
    applyAndroidBrowserState({ primaryCtaElement, statusElement, helpElement })
  }

  if (state.showOverlay && state.android) {
    applyAndroidBrowserState({
      primaryCtaElement,
      statusElement,
      helpElement,
      showAppStoreCta: false,
    })
  }

  if (state.showOverlay) {
    const openChromeIntent = () => {
      try {
        const intentUrl = buildChromeIntentUrl({
          targetUrl: currentHref,
          fallbackUrl: buildStayUrl(currentHref),
        })
        navigateExternal(intentUrl)
      } catch {
        // Best-effort only; keep overlay usable.
      }
    }

    showOverlay({
      overlayElement,
      statusElement,
      inAppBrowserKind: state.inAppBrowserKind,
      iOS: state.iOS,
      android: state.android,
      openChromeIntent,
      onDismiss:
        state.android && state.kind === "in-app-browser"
          ? () =>
              applyAndroidBrowserState({
                primaryCtaElement,
                statusElement,
                helpElement,
                showAppStoreCta: false,
              })
          : undefined,
    })

    if (state.autoOpenChromeIntent) {
      try {
        const intentUrl = buildChromeIntentUrl({
          targetUrl: currentHref,
          fallbackUrl: buildStayUrl(currentHref),
        })
        navigateExternal(intentUrl)
      } catch {
        // Best-effort only; user can tap Open in Chrome.
      }
    }

    return false
  }

  if (state.redirectToAppStore) {
    if (typeof replace !== "function") {
      return false
    }

    if (statusElement) {
      statusElement.textContent =
        "Opening the App Store… If it doesn’t open, use the button below."
    }

    replace(APP_STORE_URL)
    return true
  }

  return false
}

if (
  typeof window !== "undefined" &&
  typeof document !== "undefined" &&
  typeof navigator !== "undefined"
) {
  runHandoff({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
    search: window.location.search,
    href: window.location.href,
    replace: window.location.replace.bind(window.location),
    statusElement: document.getElementById("handoff-status"),
    overlayElement: document.getElementById("in-app-overlay"),
    primaryCtaElement: document.querySelector(".primary-cta"),
    helpElement: document.querySelector(".help"),
  })
}
export const APP_STORE_URL =
  "https://apps.apple.com/us/app/quiet-practice-secure-journal/id6760091118"

export function shouldRedirectToAppStore({
  userAgent = "",
  platform = "",
  maxTouchPoints = 0,
  search = "",
} = {}) {
  if (new URLSearchParams(search).getAll("stay").includes("1")) {
    return false
  }

  const isIOSDevice = /iPhone|iPad|iPod/i.test(userAgent)
  const isIPadDesktopMode = platform === "MacIntel" && maxTouchPoints > 1

  return isIOSDevice || isIPadDesktopMode
}

export function runHandoff({
  userAgent = "",
  platform = "",
  maxTouchPoints = 0,
  search = "",
  replace,
  statusElement = null,
} = {}) {
  if (typeof replace !== "function") {
    return false
  }

  if (
    !shouldRedirectToAppStore({
      userAgent,
      platform,
      maxTouchPoints,
      search,
    })
  ) {
    return false
  }

  if (statusElement) {
    statusElement.textContent =
      "Opening the App Store… If it doesn’t open, use the button below."
  }

  replace(APP_STORE_URL)
  return true
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
    replace: window.location.replace.bind(window.location),
    statusElement: document.getElementById("handoff-status"),
  })
}

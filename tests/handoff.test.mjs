import assert from "node:assert/strict"
import test from "node:test"

import {
  APP_STORE_URL,
  buildChromeIntentUrl,
  buildStayUrl,
  getHandoffState,
  getInAppBrowserKind,
  isInAppBrowser,
  runHandoff,
  shouldRedirectToAppStore,
} from "../handoff.mjs"

const iphone = {
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
  platform: "iPhone",
  maxTouchPoints: 5,
  search: "",
}

const ipad = {
  userAgent:
    "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
  platform: "iPad",
  maxTouchPoints: 5,
  search: "",
}

const desktop = {
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15",
  platform: "MacIntel",
  maxTouchPoints: 0,
  search: "",
}

const genericStatus = "Available free for iPhone and iPad."
const openingStatus =
  "Opening the App Store… If it doesn’t open, use the button below."

test("uses the exact canonical HTTPS App Store listing", () => {
  assert.equal(
    APP_STORE_URL,
    "https://apps.apple.com/us/app/quiet-practice-secure-journal/id6760091118",
  )
})

test("redirects iPhone visitors", () => {
  assert.equal(shouldRedirectToAppStore(iphone), true)
})

test("redirects iPad visitors", () => {
  assert.equal(shouldRedirectToAppStore(ipad), true)
})

test("redirects iPod visitors", () => {
  assert.equal(
    shouldRedirectToAppStore({ ...iphone, userAgent: "iPod", platform: "iPod" }),
    true,
  )
})

test("redirects iPad desktop-mode visitors", () => {
  assert.equal(
    shouldRedirectToAppStore({
      ...desktop,
      maxTouchPoints: 5,
    }),
    true,
  )
})

test("does not redirect Android visitors", () => {
  assert.equal(
    shouldRedirectToAppStore({
      userAgent:
        "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36",
      platform: "Linux armv8l",
      maxTouchPoints: 5,
      search: "",
    }),
    false,
  )
})

test("does not redirect desktop visitors", () => {
  assert.equal(shouldRedirectToAppStore(desktop), false)
})

test("stay=1 suppresses automatic navigation", () => {
  assert.equal(shouldRedirectToAppStore({ ...iphone, search: "?stay=1" }), false)
})

test("any stay=1 occurrence suppresses automatic navigation", () => {
  assert.equal(
    shouldRedirectToAppStore({ ...iphone, search: "?stay=0&stay=1" }),
    false,
  )
})

test("announces the App Store attempt before replacing the page", () => {
  const statusElement = { textContent: genericStatus }
  const calls = []

  const redirected = runHandoff({
    ...iphone,
    statusElement,
    replace(url) {
      assert.equal(statusElement.textContent, openingStatus)
      calls.push(url)
    },
  })

  assert.equal(redirected, true)
  assert.deepEqual(calls, [APP_STORE_URL])
})

test("does not replace the page for non-iOS visitors", () => {
  const statusElement = { textContent: genericStatus }
  let replaced = false

  const redirected = runHandoff({
    ...desktop,
    statusElement,
    replace() {
      replaced = true
    },
  })

  assert.equal(redirected, false)
  assert.equal(replaced, false)
  assert.equal(statusElement.textContent, genericStatus)
})

test("does not replace the page or change status when stay=1 is present", () => {
  const statusElement = { textContent: genericStatus }
  let replaced = false

  const redirected = runHandoff({
    ...iphone,
    search: "?stay=1",
    statusElement,
    replace() {
      replaced = true
    },
  })

  assert.equal(redirected, false)
  assert.equal(replaced, false)
  assert.equal(statusElement.textContent, genericStatus)
})

test("detects TikTok in-app browser on iPhone", () => {
  assert.equal(
    getInAppBrowserKind({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_34.0.0 JsSdk/2.0",
    }),
    "tiktok",
  )
})

test("detects TikTok in-app browser on Android", () => {
  assert.equal(
    getInAppBrowserKind({
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UQ1A.240205.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.6422.165 Mobile Safari/537.36 trill_34.0.0 JsSdk/1.0 NetType/WIFI",
    }),
    "tiktok",
  )
})

test("detects Instagram in-app browser", () => {
  assert.equal(
    isInAppBrowser({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.0.0",
    }),
    true,
  )
})

test("does not flag normal Safari", () => {
  assert.equal(isInAppBrowser(iphone), false)
  assert.equal(getInAppBrowserKind(iphone), null)
})

test("does not flag normal Chrome", () => {
  assert.equal(
    isInAppBrowser({
      userAgent:
        "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
    }),
    false,
  )
})

test("does not flag uncertain or unrelated user agents", () => {
  const uncertainAgents = [
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36 [FBAN/FBAV]",
    "",
  ]

  for (const userAgent of uncertainAgents) {
    assert.equal(getInAppBrowserKind({ userAgent }), null)
  }
})

test("iOS in-app browser does not redirect to App Store automatically", () => {
  const statusElement = { textContent: genericStatus }
  let replaced = false

  const redirected = runHandoff({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_34.0.0",
    platform: "iPhone",
    maxTouchPoints: 5,
    search: "",
    statusElement,
    replace() {
      replaced = true
    },
  })

  assert.equal(redirected, false)
  assert.equal(replaced, false)
})

test("Android in-app browser gets no fake Play Store fallback and best-effort Chrome intent", () => {
  const statusElement = { textContent: genericStatus }
  const primaryCtaElement = { textContent: "Get Quiet Practice" }
  const helpTitle = { textContent: "App Store help" }
  const helpParagraphs = [{ textContent: "" }, { textContent: "" }]
  const helpElement = {
    querySelector(selector) {
      return selector === "h2" ? helpTitle : null
    },
    querySelectorAll(selector) {
      return selector === "p" ? helpParagraphs : []
    },
  }
  const openedUrls = []

  const redirected = runHandoff({
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UQ1A.240205.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.6422.165 Mobile Safari/537.36 BytedanceWebview[d8a7c]",
    platform: "Linux armv8l",
    maxTouchPoints: 5,
    search: "",
    href: "https://quietpractice.app/?ref=tiktok",
    statusElement,
    primaryCtaElement,
    helpElement,
    openUrl(url) {
      openedUrls.push(url)
    },
    replace() {
      throw new Error("should not redirect")
    },
  })

  assert.equal(redirected, false)
  assert.equal(openedUrls.length, 1)
  assert.match(openedUrls[0], /^intent:\/\//)
  assert.match(openedUrls[0], /package=com\.android\.chrome/)
  assert.match(
    openedUrls[0],
    /S\.browser_fallback_url=https%3A%2F%2Fquietpractice\.app%2F%3Fref%3Dtiktok%26stay%3D1/,
  )
  assert.doesNotMatch(openedUrls[0], /market:\/\//)
  assert.doesNotMatch(openedUrls[0], /play\.google\.com/)
  assert.match(statusElement.textContent, /iPhone and iPad/)
  assert.match(statusElement.textContent, /No Android app or Play Store listing/)
  assert.doesNotMatch(statusElement.textContent, /Google Play/)
  assert.match(primaryCtaElement.textContent, /Get Quiet Practice|App Store/)
})

test("Android in-app overlay shows Open in Chrome and Continue to page without App Store action", () => {
  const statusElement = { textContent: genericStatus }
  const primaryCtaElement = { textContent: "Get Quiet Practice" }
  const helpTitle = { textContent: "App Store help" }
  const helpParagraphs = [{ textContent: "" }, { textContent: "" }]
  const helpElement = {
    querySelector(selector) {
      return selector === "h2" ? helpTitle : null
    },
    querySelectorAll(selector) {
      return selector === "p" ? helpParagraphs : []
    },
  }
  const chromeAction = createEventTarget({ hidden: true })
  const dismissButton = createEventTarget()
  const overlayElement = createOverlayStub({ chromeAction, dismissButton })

  withDomStubs(() => {
    runHandoff({
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile Safari/537.36 TikTok 34.0.0",
      platform: "Linux armv8l",
      maxTouchPoints: 5,
      search: "?stay=1",
      href: "https://quietpractice.app/?ref=tiktok",
      statusElement,
      primaryCtaElement,
      helpElement,
      overlayElement,
      openUrl() {},
    })
  })

  assert.equal(overlayElement.hidden, false)
  assert.equal(chromeAction.hidden, false)
  assert.equal(dismissButton.hidden, false)
  assert.equal(overlayElement._parts.appStoreAction.hidden, true)
  assert.equal(primaryCtaElement.hidden, true)
  assert.match(statusElement.textContent, /No Android app or Play Store listing/)
  assert.equal(helpTitle.textContent, "iPhone and iPad only")
})

test("Android in-app browser stay=1 suppresses auto intent but keeps overlay state", () => {
  const openedUrls = []

  const state = getHandoffState({
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile Safari/537.36 TikTok 34.0.0",
    platform: "Linux armv8l",
    maxTouchPoints: 5,
    search: "?stay=1",
  })

  runHandoff({
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile Safari/537.36 TikTok 34.0.0",
    platform: "Linux armv8l",
    maxTouchPoints: 5,
    search: "?stay=1",
    href: "https://quietpractice.app/",
    openUrl(url) {
      openedUrls.push(url)
    },
  })

  assert.equal(state.showOverlay, true)
  assert.equal(state.autoOpenChromeIntent, false)
  assert.deepEqual(openedUrls, [])
})

test("normal Android browser gets iPhone/iPad-only message and no Play Store URL", () => {
  const statusElement = { textContent: genericStatus }
  const primaryCtaElement = { textContent: "Get Quiet Practice" }
  const helpTitle = { textContent: "App Store help" }
  const helpParagraphs = [{ textContent: "" }, { textContent: "" }]
  const helpElement = {
    querySelector(selector) {
      return selector === "h2" ? helpTitle : null
    },
    querySelectorAll(selector) {
      return selector === "p" ? helpParagraphs : []
    },
  }

  const redirected = runHandoff({
    userAgent:
      "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
    platform: "Linux armv8l",
    maxTouchPoints: 5,
    search: "",
    statusElement,
    primaryCtaElement,
    helpElement,
    replace() {
      throw new Error("should not redirect Android")
    },
  })

  assert.equal(redirected, false)
  assert.match(statusElement.textContent, /iPhone and iPad/)
  assert.match(statusElement.textContent, /No Android app or Play Store listing/)
  assert.doesNotMatch(statusElement.textContent, /Google Play|Play Store app/)
  assert.equal(primaryCtaElement.textContent, "View on the App Store")
  assert.match(helpParagraphs[1].textContent, /no Android app or Google Play listing/i)
})

test("buildChromeIntentUrl targets Chrome with safe fallback and no market URL", () => {
  const url = buildChromeIntentUrl({
    targetUrl: "https://quietpractice.app/?stay=1",
    fallbackUrl: "https://quietpractice.app/?stay=1",
  })

  assert.match(url, /^intent:\/\/quietpractice\.app\/\?stay=1#Intent;/)
  assert.match(url, /scheme=https;/)
  assert.match(url, /package=com\.android\.chrome;/)
  assert.match(url, /S\.browser_fallback_url=https%3A%2F%2Fquietpractice\.app%2F%3Fstay%3D1;end$/)
  assert.doesNotMatch(url, /market:\/\//)
})

test("iOS redirect still uses exact App Store URL in normal browser", () => {
  const statusElement = { textContent: genericStatus }
  const calls = []

  const redirected = runHandoff({
    ...iphone,
    statusElement,
    replace(url) {
      calls.push(url)
    },
  })

  assert.equal(redirected, true)
  assert.deepEqual(calls, [APP_STORE_URL])
})

test("buildStayUrl adds stay=1 while preserving other params", () => {
  assert.equal(
    buildStayUrl("https://quietpractice.app/?ref=tiktok"),
    "https://quietpractice.app/?ref=tiktok&stay=1",
  )
  assert.equal(
    buildStayUrl("https://quietpractice.app/?stay=1&ref=tiktok"),
    "https://quietpractice.app/?stay=1&ref=tiktok",
  )
})

test("Chrome intent fallback uses conservative stay=1 URL for auto and button flows", () => {
  const openedUrls = []

  runHandoff({
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile Safari/537.36 TikTok 34.0.0",
    platform: "Linux armv8l",
    maxTouchPoints: 5,
    search: "",
    href: "https://quietpractice.app/?ref=tiktok&utm_source=bio",
    openUrl(url) {
      openedUrls.push(url)
    },
  })

  assert.equal(openedUrls.length, 1)
  assert.match(
    openedUrls[0],
    /S\.browser_fallback_url=https%3A%2F%2Fquietpractice\.app%2F%3Fref%3Dtiktok%26utm_source%3Dbio%26stay%3D1/,
  )

  const chromeClickUrls = []
  const chromeAction = createEventTarget({ hidden: true })
  const overlayElement = createOverlayStub({ chromeAction })
  withDomStubs(() => {
    runHandoff({
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile Safari/537.36 TikTok 34.0.0",
      platform: "Linux armv8l",
      maxTouchPoints: 5,
      search: "?stay=1",
      href: "https://quietpractice.app/?ref=tiktok&utm_source=bio",
      overlayElement,
      openUrl(url) {
        chromeClickUrls.push(url)
      },
    })
    chromeAction.dispatch("click")
  })

  assert.equal(chromeClickUrls.length, 1)
  assert.match(
    chromeClickUrls[0],
    /S\.browser_fallback_url=https%3A%2F%2Fquietpractice\.app%2F%3Fref%3Dtiktok%26utm_source%3Dbio%26stay%3D1/,
  )
})

test("Android in-app overlay dismiss leaves honest iPhone/iPad-only fallback state", () => {
  const statusElement = { textContent: genericStatus }
  const primaryCtaElement = { textContent: "Get Quiet Practice" }
  const helpTitle = { textContent: "App Store help" }
  const helpParagraphs = [
    { textContent: "If the App Store does not open, tap the App Store button." },
    {
      textContent:
        "If you opened this page in an app’s built-in browser, tap the ••• menu and choose Open in browser. Menu labels can vary.",
    },
  ]
  const helpElement = {
    querySelector(selector) {
      return selector === "h2" ? helpTitle : null
    },
    querySelectorAll(selector) {
      return selector === "p" ? helpParagraphs : []
    },
  }
  const dismissButton = createEventTarget()
  const overlayElement = createOverlayStub({ dismissButton })

  withDomStubs(() => {
    runHandoff({
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile Safari/537.36 TikTok 34.0.0",
      platform: "Linux armv8l",
      maxTouchPoints: 5,
      search: "?stay=1",
      href: "https://quietpractice.app/?ref=tiktok",
      statusElement,
      primaryCtaElement,
      helpElement,
      overlayElement,
      openUrl() {},
    })

    assert.equal(overlayElement.hidden, false)
    dismissButton.dispatch("click")
  })

  assert.equal(overlayElement.hidden, true)
  assert.equal(primaryCtaElement.hidden, true)
  assert.notEqual(primaryCtaElement.textContent, "View on the App Store")
  assert.match(statusElement.textContent, /No Android app or Play Store listing/)
  assert.equal(helpTitle.textContent, "iPhone and iPad only")
  assert.match(helpParagraphs[1].textContent, /no Android app or Google Play listing/i)
  assert.equal(overlayElement._parts.appStoreAction.hidden, true)
})

function createEventTarget(initial = {}) {
  const listeners = new Map()
  return {
    hidden: false,
    ...initial,
    addEventListener(type, handler) {
      const handlers = listeners.get(type) || []
      handlers.push(handler)
      listeners.set(type, handlers)
    },
    removeEventListener(type, handler) {
      const handlers = listeners.get(type) || []
      listeners.set(
        type,
        handlers.filter((item) => item !== handler),
      )
    },
    dispatch(type, event = {}) {
      const handlers = listeners.get(type) || []
      for (const handler of [...handlers]) {
        handler({ type, target: this, preventDefault() {}, ...event })
      }
    },
    listenerCount(type) {
      return (listeners.get(type) || []).length
    },
    hasAttribute(name) {
      return Boolean(this[name])
    },
    focus() {},
  }
}

function createOverlayStub({ dismissButton = createEventTarget(), chromeAction = createEventTarget({ hidden: true }) } = {}) {
  const appStoreAction = createEventTarget({ hidden: true })
  const title = { textContent: "" }
  const body = {
    innerHTML: "",
    children: [],
    append(...nodes) {
      this.children.push(...nodes)
    },
  }

  const overlay = createEventTarget({
    hidden: true,
    dataset: {},
    querySelector(selector) {
      const map = {
        "[data-overlay-title]": title,
        "[data-overlay-body]": body,
        "[data-overlay-chrome]": chromeAction,
        "[data-overlay-app-store]": appStoreAction,
        "[data-overlay-dismiss]": dismissButton,
      }
      return map[selector] || null
    },
    querySelectorAll(selector) {
      if (
        selector ===
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) {
        return [chromeAction, appStoreAction, dismissButton].filter((el) => !el.hidden)
      }
      return []
    },
  })

  overlay._parts = { title, body, chromeAction, appStoreAction, dismissButton }
  return overlay
}

function withDomStubs(fn) {
  const prevDocument = globalThis.document
  const prevHTMLElement = globalThis.HTMLElement
  globalThis.HTMLElement = class HTMLElement {}
  globalThis.document = {
    activeElement: null,
    createElement() {
      return {
        textContent: "",
        className: "",
        children: [],
        append(...nodes) {
          this.children.push(...nodes)
        },
      }
    },
  }
  try {
    return fn()
  } finally {
    if (prevDocument === undefined) {
      delete globalThis.document
    } else {
      globalThis.document = prevDocument
    }
    if (prevHTMLElement === undefined) {
      delete globalThis.HTMLElement
    } else {
      globalThis.HTMLElement = prevHTMLElement
    }
  }
}

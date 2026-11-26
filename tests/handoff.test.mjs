import assert from "node:assert/strict"
import test from "node:test"

import {
  APP_STORE_URL,
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

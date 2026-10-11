import { useEffect, useState } from 'react'

/**
 * Returns false on first render and flips to true once the page has finished loading and the
 * browser is idle (or sooner, the moment the visitor touches the page). Used to start heavy,
 * purely decorative work (WebGL) AFTER the text and the still images have painted, so it can't
 * delay first paint or block the main thread while the page is loading.
 *
 * @param delay ms to wait after the window `load` event before starting
 */
export function useDeferredMount(delay = 0) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let done = false
    let timer = 0
    let idle = 0
    const wake = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll']

    const cleanup = () => {
      clearTimeout(timer)
      if (idle && 'cancelIdleCallback' in window) cancelIdleCallback(idle)
      window.removeEventListener('load', schedule)
      wake.forEach((e) => window.removeEventListener(e, go))
    }
    function go() {
      if (done) return
      done = true
      cleanup()
      setReady(true)
    }
    function schedule() {
      timer = setTimeout(() => {
        if ('requestIdleCallback' in window) idle = requestIdleCallback(go, { timeout: 1500 })
        else go()
      }, delay)
    }

    wake.forEach((e) => window.addEventListener(e, go, { passive: true, once: true }))
    if (document.readyState === 'complete') schedule()
    else window.addEventListener('load', schedule, { once: true })
    return cleanup
  }, [delay])

  return ready
}
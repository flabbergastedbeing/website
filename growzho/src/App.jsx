import { Component, Suspense, lazy, useState, useEffect } from 'react'
import CameraFigure from './CameraFigure.jsx'
// import ClothLogo from './components/ui/cloth-logo.jsx' // cloth logo is out of the hero for now; restore with the line below
import { TextRoll, TextRollWords } from './components/ui/text-roll.jsx'
import { useDeferredMount } from './useDeferredMount.js'

// The WebGL gradient (three.js + shadergradient) is a separate chunk, fetched only after the page
// has painted, so the headline and copy are on screen before any of that code is downloaded or run.
const HeroGradient = lazy(() => import('./HeroGradient.jsx'))
// ms after page load before the gradient starts (it also starts on the first touch / mouse move)
const GRADIENT_DELAY = 2200

// If the WebGL gradient fails to load (e.g. blocked HDR env map), keep the page up and the pane black.
class GradientBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? null : this.props.children }
}

const proof = [
  ['4', '+', 'Team members'],
  ['2', '+', 'Verified clients'],
  ['100', '%', 'On-time delivery'],
  ['2026', '', 'Founded, Vadodara'],
]
const clients = ['Northwind', 'Kiln&Co', 'Parallax', 'Oddsock', 'Fieldnote', 'Mosaic/', 'Halcyon', 'Brightside']
const features = [
  ['01', 'Schedule', 'Queue posts across Instagram, TikTok, LinkedIn and X on a single calendar.'],
  ['02', 'Create', 'Draft captions, resize creative and reuse winners with built-in templates.'],
  ['03', 'Engage', 'One inbox for comments and DMs. Reply fast, assign, never lose a thread.'],
  ['04', 'Measure', 'Clean reports on reach, growth and what actually drove them.'],
]
const stats = [
  ['3.4×', 'Average follower growth'],
  ['12h', 'Saved per team, per week'],
  ['9', 'Networks in one place'],
  ['98%', 'Posts shipped on schedule'],
]
const steps = [
  ['01', 'Connect', 'Link your accounts in a few clicks. No code, no agency call.'],
  ['02', 'Plan', 'Fill a month of content in one sitting with templates and bulk upload.'],
  ['03', 'Grow', "Growzho posts at the best times and reports back on what's working."],
]

export default function App() {
  const [sent, setSent] = useState(false)
  const [active, setActive] = useState('')
  const showGradient = useDeferredMount(GRADIENT_DELAY)

  // highlight the nav link of the section the reader is currently in (none while still in the hero).
  // Layout is read at most once per frame, and never during the first render, so it can't force a reflow.
  useEffect(() => {
    const ids = ['platform', 'numbers', 'process', 'start']
    let raf = 0
    const update = () => {
      raf = 0
      const line = window.innerHeight * 0.4
      let cur = ''
      for (const id of ids) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= line) cur = id
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = 'start'
      setActive(cur)
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(update) }
    schedule()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [])

  useEffect(() => {
    const els = document.querySelectorAll('.reveal')
    if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in-view')); return }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in-view'); io.unobserve(e.target) } })
    }, { threshold: 0.15 })
    els.forEach((e) => io.observe(e))
    return () => io.disconnect()
  }, [])

  return (
    <>
      <nav>
        <div className="in">
          <a href="#top" className="logo">growzho.</a>
          <div className="links">
            {[['platform', 'Platform'], ['numbers', 'Results'], ['process', 'Process'], ['start', 'Pricing']].map(([id, label]) => (
              <a key={id} href={`#${id}`} className={active === id ? 'on' : undefined} aria-current={active === id ? 'true' : undefined}>{label}</a>
            ))}
          </div>
          <div className="r"><a href="#start" className="btn">Contact Us</a></div>
        </div>
      </nav>

      <main id="top">
        <header className="hero">
          <div id="gl" aria-hidden="true">{showGradient && <GradientBoundary><Suspense fallback={null}><HeroGradient /></Suspense></GradientBoundary>}</div>
          <div className="pane shade">
            <div className="copy">
              <h1 className="display rise" style={{ "--d": "0.1s" }}>
                {['Professional', 'Content.', 'Real', 'Growth.'].map((line) => (
                  <span className="line" key={line}><TextRoll>{line}</TextRoll>{' '}</span>
                ))}
              </h1>
              <p className="body rise" style={{ "--d": "0.3s" }}>
                <TextRollWords>
                  {'Full-scale Social Media Management powered by in-house Photography and Videography, crafted to build unmissable visual authority and genuine audience traction.'}
                </TextRollWords>
              </p>
              <div className="actions">
                <a href="#start" className="touch rise" style={{ "--d": "0.5s" }}><TextRoll>Get in touch</TextRoll><span className="arrow-r" aria-hidden="true">→</span></a>
                <a href="#trusted" className="scroll rise" style={{ "--d": "0.62s" }}><TextRoll>Scroll to Explore</TextRoll><span className="arrow" aria-hidden="true">↓</span></a>
              </div>
            </div>
          </div>
          <div className="pane mark">
            <div className="figure">
              <CameraFigure className="rise zoom" style={{ "--d": "0.2s" }} />
              {/* <ClothLogo className="rise zoom" style={{ "--d": "0.2s" }} /> */}
              <div className="proof">
                {proof.map(([n, s, l], i) => (
                  <div key={l} className="rise" style={{ "--d": `${0.5 + i * 0.12}s` }}><b><TextRoll>{n + s}</TextRoll></b><span><TextRoll>{l}</TextRoll></span></div>
                ))}
              </div>
            </div>
            <span className="cap"><TextRoll>growzho.in — Scale your story</TextRoll></span>
          </div>
        </header>

        <section id="trusted" className="wrap reveal">
          <p className="label">Trusted by fast-moving brands</p>
          <div className="logos">{clients.map((c) => <div key={c}>{c}</div>)}</div>
        </section>

        <section id="platform" className="wrap reveal">
          <div className="head">
            <h2 className="h-lg">One dashboard.<br />Every channel. Zero chaos.</h2>
            <p className="body">Four tools that replace the spreadsheet, the three browser tabs and the Monday panic.</p>
          </div>
          <div className="grid">
            {features.map(([n, t, d]) => (
              <div className="cell" key={n}>
                <span className="n">{n}</span>
                <div><h3 className="h">{t}</h3><p>{d}</p></div>
              </div>
            ))}
          </div>
        </section>

        <section id="numbers" className="wrap reveal">
          <p className="label">Results across 1,200+ accounts</p>
          <div className="stats">
            {stats.map(([b, s]) => <div className="stat" key={s}><b>{b}</b><span>{s}</span></div>)}
          </div>
        </section>

        <section id="process" className="wrap reveal">
          <div className="head">
            <h2 className="h-lg">Live in an afternoon.</h2>
            <p className="body">No onboarding marathon. Connect, plan, publish.</p>
          </div>
          <div>
            {steps.map(([n, t, d]) => (
              <div className="step" key={n}>
                <span className="n">{n}</span><h3 className="h">{t}</h3><p>{d}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="start" className="wrap cta reveal">
          <p className="label">Get started</p>
          <h2 className="display">Ready to<br />grow?</h2>
          <form onSubmit={(e) => { e.preventDefault(); setSent(true) }}>
            <input type="email" placeholder="you@company.com" aria-label="Work email" required />
            <button className="btn lg" type="submit">{sent ? 'Thanks ✓' : 'Request access'}</button>
          </form>
        </section>
      </main>

      <footer>
        <div className="wrap in">
          <span>© 2026 growzho.</span>
          <div><a href="#platform">Platform</a><a href="#process">Process</a><a href="#">Privacy</a><a href="#">Terms</a></div>
        </div>
      </footer>
    </>
  )
}
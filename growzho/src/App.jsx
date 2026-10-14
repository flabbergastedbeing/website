import { Component, Suspense, lazy, useState, useEffect, useLayoutEffect } from 'react'
import CameraFigure from './CameraFigure.jsx'
import ClothLogo from './components/ui/cloth-logo.jsx' // the cloth logo lives in the About section; it can go back in the hero (see the comment there)
import { TextRoll, TextRollWords } from './components/ui/text-roll.jsx'
import { useDeferredMount } from './useDeferredMount.js'

// The WebGL gradient (three.js + shadergradient) is a separate chunk, fetched only after the page
// has painted, so the headline and copy are on screen before any of that code is downloaded or run.
const HeroGradient = lazy(() => import('./HeroGradient.jsx'))
// The sector figures (3D books, cup, dress) are their own chunk too; the card keeps its space until they arrive.
const SectorFigure = lazy(() => import('./SectorFigure.jsx'))
// ms after page load before the gradient starts (it also starts on the first touch / mouse move)
const GRADIENT_DELAY = 2200

// One headline line per mask, so motion.js can slide each line up on its own.
function Lines({ l }) {
  return l.map((t, i) => <span className="ln" key={i}><span className="ln-i">{t}</span></span>)
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

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
const sectors = [
  {
    n: '01',
    fig: 'books',
    title: 'Education',
    forWho: 'Coaching Institutes & Academies',
    desc: 'Turn student results into enrollments. We craft authentic classroom photography, high-retention student testimonial reels, and result-oriented campaigns that build parent trust and fill batches.',
    tags: ['Admissions Campaigns', 'Faculty Spotlight', 'Campus Videography'],
    cta: 'Inquire for Education',
  },
  {
    n: '02',
    fig: 'cup',
    title: 'Cafe & Restaurant',
    forWho: 'Hospitality, Bistros & Dining',
    desc: 'Fill seats and fuel cravings. We capture mouthwatering culinary photography, cinematic sizzling reels, and atmosphere-driven videos that turn casual scrollers into loyal diners.',
    tags: ['Food Styling & Shoots', 'Viral Menu Reels', 'Foot-Traffic Growth'],
    cta: 'Inquire for Hospitality',
  },
  {
    n: '03',
    fig: 'dress',
    title: 'Lifestyle Brand',
    forWho: 'Fashion, Beauty, Wellness & D2C',
    desc: 'Cultivate aesthetic desire and brand love. From editorial lookbooks to culture-driven vertical storytelling, we create the distinctive digital presence your brand deserves.',
    tags: ['Product Lookbooks', 'Trend-Driven Reels', 'Feed Aesthetic Design'],
    cta: 'Inquire for Lifestyle',
  },
]
const stats = [
  ['2', 'Verified clients with positive feedback'],
  ['100%', 'On-time project delivery, every time'],
  ['Jan', '2026 — Agency founded & operational'],
  ['100%', 'Client content ownership — always yours'],
]
const reviews = [
  {
    q: 'Best work and best timely delivery. Growzho delivered exactly what we needed for our brand — the quality of content and how smoothly the whole project was handled stood out from the start.',
    name: 'Herb Infinity', init: 'HI', role: 'Beauty Brand', handle: '@herbinfinity.co',
  },
  {
    q: 'Budget-friendly and quality works. Growzho understood what we needed, delivered on time, and made sure we got real value. Exactly the kind of agency a community organisation can rely on.',
    name: 'Bajar Yuvak Mandal', init: 'BY', role: 'Community Organisation', handle: '@bajar_yuvak_mandal_',
  },
]
const pillars = [
  ['Industry-Specialized', 'We understand what makes a parent choose a coaching class, what makes a customer walk into a cafe, and what makes a follower become a fan.'],
  ['Full Multimedia Production', 'Photography, videography, design, and strategy — all under one roof. No more coordinating multiple vendors.'],
  ['Results-Driven', 'More student inquiries. More cafe foot traffic. More engaged followers. Every strategy is tied to a real business outcome.'],
]

export default function App() {
  const [sent, setSent] = useState(false)
  const [active, setActive] = useState('')
  const [scrolled, setScrolled] = useState(false)
  const showGradient = useDeferredMount(GRADIENT_DELAY)

  // highlight the nav link of the section the reader is currently in (none while still in the hero).
  // Layout is read at most once per frame, and never during the first render, so it can't force a reflow.
  useEffect(() => {
    const ids = ['specialisation', 'numbers', 'about', 'start']
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
      setScrolled(window.scrollY > 8) // the bar fades in as soon as the page moves
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

  // Scroll motion (GSAP). The `motion` class hides the things that will animate in, before first paint,
  // so there is no flash; if the motion code is slow or fails to load, the class is removed and everything shows.
  useLayoutEffect(() => {
    if (prefersReducedMotion()) return
    document.documentElement.classList.add('motion')
    return () => document.documentElement.classList.remove('motion')
  }, [])
  useEffect(() => {
    if (prefersReducedMotion()) return
    const html = document.documentElement
    let off
    let cancelled = false
    const giveUp = setTimeout(() => html.classList.remove('motion'), 6000)
    import('./motion.js')
      .then((m) => { if (cancelled) return; clearTimeout(giveUp); off = m.initMotion(document) })
      .catch(() => html.classList.remove('motion'))
    return () => { cancelled = true; clearTimeout(giveUp); off?.() }
  }, [])

  return (
    <>
      <div className="wipe" aria-hidden="true"><span className="wipe-label" /><span className="wipe-hint">Scroll to continue ↓</span></div>
      <nav className={scrolled ? 'scrolled' : undefined}>
        <div className="in">
          <a href="#top" className="logo">growzho.</a>
          <div className="links">
            {[['top', 'Home'], ['specialisation', 'Specialisation'], ['numbers', 'Results'], ['about', 'About']].map(([id, label]) => (
              <a key={id} href={`#${id}`} className={(active || 'top') === id ? 'on' : undefined} aria-current={(active || 'top') === id ? 'true' : undefined}>{label}</a>
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
                <a href="#specialisation" className="scroll rise" style={{ "--d": "0.62s" }}><TextRoll>Scroll to Explore</TextRoll><span className="arrow" aria-hidden="true">↓</span></a>
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

        <section id="specialisation" className="wrap">
          <p className="label">01 // Specialisation</p>
          <div className="head">
            <h2 className="h-lg"><Lines l={['Industry', 'Specialisation.']} /></h2>
            <p className="body">Tailored creative playbooks &amp; multimedia production for high-growth sectors.</p>
          </div>
          <div className="sectors">
            {sectors.map((x) => (
              <article className="sector" key={x.n}>
                <span className="n">Sector {x.n}</span>
                <Suspense fallback={<div className="fig" />}><SectorFigure kind={x.fig} /></Suspense>
                <h3 className="h">{x.title}</h3>
                <p className="for">{x.forWho}</p>
                <p className="desc">{x.desc}</p>
                <ul className="tags">{x.tags.map((t) => <li key={t}>{t}</li>)}</ul>
                <a href="#start" className="go"><TextRoll>{x.cta}</TextRoll><span className="arrow-r" aria-hidden="true">→</span></a>
              </article>
            ))}
          </div>
        </section>

        <section id="numbers" className="wrap">
          <p className="label">02 // Client outcomes</p>
          <div className="head">
            <h2 className="h-lg"><Lines l={['Results &', 'Reviews.']} /></h2>
            <p className="body">Real outcomes for real clients.</p>
          </div>
          <div className="stats">
            {stats.map(([b, s]) => <div className="stat" key={s}><b>{b}</b><span>{s}</span></div>)}
          </div>
          <div className="reviews">
            {reviews.map((r) => (
              <figure className="review" key={r.name}>
                <div className="stars" role="img" aria-label="5 out of 5 stars">★★★★★</div>
                <blockquote>&ldquo;{r.q}&rdquo;</blockquote>
                <figcaption>
                  <span className="av" aria-hidden="true">{r.init}</span>
                  <span><b>{r.name}</b><span className="meta">{r.role} · {r.handle}</span></span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section id="about" className="wrap">
          <p className="label">03 // About us</p>
          <div className="head">
            <h2 className="h-lg"><Lines l={['Who we are.']} /></h2>
            <p className="body">Founded 2026 · Vadodara, Gujarat</p>
          </div>
          <div className="about">
            <div className="story">
              <h3 className="h">A Creative Agency Built in Vadodara</h3>
              <p>Growzho.in is a social media and creative agency founded in January 2026, based in Vadodara, Gujarat. We work with brands across beauty, lifestyle, and culture — helping them show up online with content that actually reflects who they are. From brand identity and graphic design to social media management, video editing, and content strategy, we handle the creative so our clients can focus on what they do best.</p>
              <p className="soft">We’re a young, hands-on team. Every project gets direct attention from the people building it — no middlemen, no templated output.</p>
              <blockquote>“We don’t just make content. We build the creative identity your brand deserves.”</blockquote>
            </div>
            <div className="story-logo">
              <ClothLogo poster="/hero-logo-cutout.webp" delay={3600} />
            </div>
          </div>
          <div className="pillars">
            {pillars.map(([t, d]) => (
              <div className="pillar" key={t}><h3 className="h">{t}</h3><p>{d}</p></div>
            ))}
          </div>
        </section>

        <section id="start" className="wrap cta">
          <p className="label">Get started</p>
          <h2 className="display"><Lines l={['Ready to', 'grow?']} /></h2>
          <form onSubmit={(e) => { e.preventDefault(); setSent(true) }}>
            <input type="email" placeholder="you@company.com" aria-label="Work email" required />
            <button className="btn lg" type="submit">{sent ? 'Thanks ✓' : 'Request access'}</button>
          </form>
        </section>
      </main>

      <footer>
        <div className="wrap in">
          <span>© 2026 growzho.</span>
          <div><a href="#specialisation">Specialisation</a><a href="#about">About</a><a href="#">Privacy</a><a href="#">Terms</a></div>
        </div>
      </footer>
    </>
  )
}
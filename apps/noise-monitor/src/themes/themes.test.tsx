/* Every theme must actually respond to the band it is given.
 *
 * This is the test that would have caught the defect the themes shipped with.
 * Four of the eight took `noiseLevel` and `threshold` and re-derived the bands
 * themselves from hardcoded 0.5/0.8 ratios of the alarm point -- six copies of
 * that logic across the app in total. So a teacher could set "loud" to 60, the
 * alarm would respect it, and the egg would stay green until 42.5. The display
 * and the alarm disagreed, and nothing anywhere said so.
 *
 * Rendering each theme at each band and requiring four distinct outputs pins
 * that shut: a theme that ignores part of the band range cannot pass.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import type { ComponentType } from 'react'
import type { NoiseBand, ThemeProps } from '../types'

import { EggTheme } from './EggTheme'
import { EggClassicTheme } from './EggClassicTheme'
import { GlassTheme } from './GlassTheme'
import { CustomTheme } from './CustomTheme'
import { ThermometerTheme } from './ThermometerTheme'
import { BatteryTheme } from './BatteryTheme'
import { WeatherTheme } from './WeatherTheme'
import { VolcanoTheme } from './VolcanoTheme'

afterEach(cleanup)

const BANDS: NoiseBand[] = ['quiet', 'moderate', 'loud', 'tooLoud']

/**
 * Props with `band` as the ONLY thing that varies.
 *
 * The first version of this test moved intensity and isTooLoud along with the
 * band, and a theme reverted to deriving its stages from intensity ratios
 * still passed -- the outputs differed, just not because of the band. Holding
 * everything else fixed is what makes "ignores the band" fail.
 */
const FIXED_INTENSITY = 0.7

const propsFor = (band: NoiseBand, isTooLoud = false): ThemeProps => ({
  band,
  intensity: FIXED_INTENSITY,
  isTooLoud,
  customImages: [
    { id: '1', name: 'a', url: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' },
    { id: '2', name: 'b', url: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' },
    { id: '3', name: 'c', url: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' }
  ],
  backgroundColor: 'dark'
})

// ComponentType, not a bare function signature: some themes are declared as
// React.FC (returning ReactNode) and some as plain functions returning Element.
const renderHtml = (Theme: ComponentType<ThemeProps>, props: ThemeProps) => {
  const { container } = render(<Theme {...props} />)
  const html = container.innerHTML
  cleanup()
  return html
}

const THEMES = {
  EggTheme,
  EggClassicTheme,
  GlassTheme,
  CustomTheme,
  ThermometerTheme,
  BatteryTheme,
  WeatherTheme,
  VolcanoTheme
} as const

describe.each(Object.entries(THEMES))('%s', (name, Theme) => {
  it('renders at every band without throwing', () => {
    for (const band of BANDS) {
      const { container } = render(<Theme {...propsFor(band, band === 'tooLoud')} />)
      expect(container.firstChild, `${name} rendered nothing at ${band}`).not.toBeNull()
      cleanup()
    }
  })

  it('distinguishes quiet, moderate and loud on the band alone', () => {
    // intensity and isTooLoud are identical across these three, so anything
    // that differs can only have come from `band`. A theme deriving its
    // stages from ratios of the level -- which four of the eight used to do --
    // renders all three the same here and fails.
    const seen = new Map<string, NoiseBand>()
    for (const band of ['quiet', 'moderate', 'loud'] as const) {
      const html = renderHtml(Theme, propsFor(band))
      const previous = seen.get(html)
      expect(
        previous,
        `${name} renders identically for "${previous}" and "${band}" when only ` +
          `the band differs, so it is not reading the band`
      ).toBeUndefined()
      seen.set(html, band)
    }
    expect(seen.size).toBe(3)
  })

  it('shows the alert state as its own thing', () => {
    // tooLoud always arrives with isTooLoud set, so this is the one real
    // state where both move together.
    const loud = renderHtml(Theme, propsFor('loud'))
    const tooLoud = renderHtml(Theme, propsFor('tooLoud', true))
    expect(tooLoud, `${name} looks the same raising the alarm as not`).not.toBe(loud)
  })
})

describe('the contract itself', () => {
  it('passes the same props shape to all eight themes', () => {
    // There used to be two contracts, and NoiseMonitor built both. If a theme
    // is reverted to its own prop shape this stops compiling, which is the
    // point -- but assert it at runtime too so the intent is visible.
    for (const [name, Theme] of Object.entries(THEMES)) {
      expect(() => render(<Theme {...propsFor('loud')} />), name).not.toThrow()
      cleanup()
    }
  })

  it('CustomTheme copes with fewer images than bands', () => {
    // BAND_IMAGE indexes up to 2; a teacher who uploaded one picture must not
    // get an undefined image.
    const props = { ...propsFor('tooLoud'), customImages: [
      { id: '1', name: 'only', url: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' }
    ] }
    const { container } = render(<CustomTheme {...props} />)
    expect(container.querySelectorAll('img').length).toBeGreaterThan(0)
  })

  it('CustomTheme copes with no images at all', () => {
    const props = { ...propsFor('quiet'), customImages: [] }
    const { container } = render(<CustomTheme {...props} />)
    expect(container.textContent).toBeTruthy()
  })
})

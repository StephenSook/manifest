// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { installNativeLayout, NATIVE_LAYOUT_CSS } from '../native-layout';

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  delete document.body.dataset.manifestNative;
});

describe('installNativeLayout', () => {
  it('fits native controls without disabling user zoom', () => {
    document.head.innerHTML =
      '<meta name="viewport" content="width=device-width, initial-scale=1">';
    document.body.style.fontSize = '14px';
    document.body.innerHTML = `
      <header>Web navigation</header>
      <main>
        <form aria-label="Mission setup form">
          <input type="radio" aria-label="Amateur radio" />
          <input type="checkbox" aria-label="Imaging mission" />
          <input type="date" aria-label="Launch date" style="font-size: 13px" />
          <input type="number" aria-label="Primary downlink frequency" style="font-size: 13px" />
          <select aria-label="Orbit regime" style="font-size: 13px">
            <option>Low Earth orbit</option>
          </select>
          <textarea aria-label="Mission notes" style="font-size: 13px"></textarea>
          <button type="submit">Save mission</button>
        </form>
      </main>
    `;

    const uninstall = installNativeLayout(document);
    const viewport = document.querySelector<HTMLMetaElement>(
      'meta[name="viewport"]',
    );
    const header = document.querySelector('header');
    const controls = document.querySelectorAll('input, select, textarea');
    const numberInput = document.querySelector('input[type="number"]');
    const button = document.querySelector('button');

    expect(document.body.dataset.manifestNative).toBe('true');
    expect(viewport?.content).toContain('viewport-fit=cover');
    expect(viewport?.content).not.toContain('user-scalable=no');
    expect(viewport?.content).not.toContain('maximum-scale=1');
    expect(getComputedStyle(header!).display).toBe('none');
    for (const control of Array.from(controls)) {
      expect(getComputedStyle(control).fontSize).toBe('16px');
    }
    expect(getComputedStyle(numberInput!).minHeight).toBe('44px');
    expect(getComputedStyle(button!).minHeight).toBe('44px');
    expect(getComputedStyle(document.body).overflowX).not.toBe('hidden');

    uninstall();

    expect(document.body.dataset.manifestNative).toBeUndefined();
    expect(viewport?.content).toBe('width=device-width, initial-scale=1');
    expect(document.getElementById('manifest-native-layout')).toBeNull();
  });

  it('keeps shared native state until the final installation is removed', () => {
    document.head.innerHTML =
      '<meta name="viewport" content="width=device-width, initial-scale=1">';

    const uninstallFirst = installNativeLayout(document);
    const uninstallSecond = installNativeLayout(document);

    uninstallFirst();

    expect(document.body.dataset.manifestNative).toBe('true');
    expect(document.getElementById('manifest-native-layout')).not.toBeNull();
    expect(
      document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
        ?.content,
    ).toContain('viewport-fit=cover');

    uninstallSecond();

    expect(document.body.dataset.manifestNative).toBeUndefined();
    expect(document.getElementById('manifest-native-layout')).toBeNull();
    expect(
      document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
        ?.content,
    ).toBe('width=device-width, initial-scale=1');
  });

  it('consumes every safe-area edge on native surfaces', () => {
    expect(NATIVE_LAYOUT_CSS).toContain('safe-area-inset-top');
    expect(NATIVE_LAYOUT_CSS).toContain('safe-area-inset-right');
    expect(NATIVE_LAYOUT_CSS).toContain('safe-area-inset-bottom');
    expect(NATIVE_LAYOUT_CSS).toContain('safe-area-inset-left');
  });
});

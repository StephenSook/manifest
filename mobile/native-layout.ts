const STYLE_ID = 'manifest-native-layout';
const NATIVE_ATTRIBUTE = 'data-manifest-native';
const VIEWPORT_FIT = 'viewport-fit=cover';

export const NATIVE_LAYOUT_CSS = `
body[${NATIVE_ATTRIBUTE}="true"] {
  --manifest-safe-area-top: env(safe-area-inset-top, 0px);
  --manifest-safe-area-right: env(safe-area-inset-right, 0px);
  --manifest-safe-area-bottom: env(safe-area-inset-bottom, 0px);
  --manifest-safe-area-left: env(safe-area-inset-left, 0px);
  -webkit-text-size-adjust: 100%;
}

body[${NATIVE_ATTRIBUTE}="true"] > header {
  display: none !important;
}

body[${NATIVE_ATTRIBUTE}="true"] > main {
  min-width: 0;
  max-width: 100%;
  padding-top: calc(var(--manifest-safe-area-top) + 0.5rem);
  overflow-wrap: anywhere;
}

body[${NATIVE_ATTRIBUTE}="true"] > main > div {
  width: 100%;
  max-width: 100% !important;
  padding-left: calc(var(--manifest-safe-area-left) + 0.875rem) !important;
  padding-right: calc(var(--manifest-safe-area-right) + 0.875rem) !important;
}

body[${NATIVE_ATTRIBUTE}="true"] form[aria-label="Mission setup form"] > section {
  padding-left: 1rem !important;
  padding-right: 1rem !important;
}

body[${NATIVE_ATTRIBUTE}="true"] input,
body[${NATIVE_ATTRIBUTE}="true"] select,
body[${NATIVE_ATTRIBUTE}="true"] textarea {
  font-size: 16px !important;
}

body[${NATIVE_ATTRIBUTE}="true"] input:not([type="checkbox"]):not([type="radio"]),
body[${NATIVE_ATTRIBUTE}="true"] select,
body[${NATIVE_ATTRIBUTE}="true"] textarea {
  min-height: 44px;
}

body[${NATIVE_ATTRIBUTE}="true"] input[type="checkbox"],
body[${NATIVE_ATTRIBUTE}="true"] input[type="radio"] {
  width: 22px;
  height: 22px;
}

body[${NATIVE_ATTRIBUTE}="true"] button,
body[${NATIVE_ATTRIBUTE}="true"] form [role="button"] {
  min-height: 44px;
}

body[${NATIVE_ATTRIBUTE}="true"] table {
  width: 100% !important;
  table-layout: fixed;
}

body[${NATIVE_ATTRIBUTE}="true"] td,
body[${NATIVE_ATTRIBUTE}="true"] th,
body[${NATIVE_ATTRIBUTE}="true"] code,
body[${NATIVE_ATTRIBUTE}="true"] a {
  overflow-wrap: anywhere;
}
`;

interface NativeLayoutState {
  installs: number;
  previousNativeValue: string | null;
  viewport: HTMLMetaElement | null;
  previousViewport: string | null;
  createdStyle: boolean;
}

const nativeLayoutStates = new WeakMap<Document, NativeLayoutState>();

function addViewportFit(content: string): string {
  const values = content
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (!values.some((value) => value.startsWith('viewport-fit='))) {
    values.push(VIEWPORT_FIT);
  }
  return values.join(', ');
}

export function installNativeLayout(currentDocument: Document): () => void {
  const activeState = nativeLayoutStates.get(currentDocument);
  if (activeState) {
    activeState.installs += 1;
    return createUninstall(currentDocument, activeState);
  }

  const previousNativeValue = currentDocument.body.getAttribute(
    NATIVE_ATTRIBUTE,
  );
  const viewport = currentDocument.querySelector<HTMLMetaElement>(
    'meta[name="viewport"]',
  );
  const previousViewport = viewport?.getAttribute('content') ?? null;

  currentDocument.body.setAttribute(NATIVE_ATTRIBUTE, 'true');

  let style = currentDocument.getElementById(STYLE_ID);
  const createdStyle = style === null;
  if (createdStyle) {
    style = currentDocument.createElement('style');
    style.id = STYLE_ID;
    style.textContent = NATIVE_LAYOUT_CSS;
    currentDocument.head.append(style);
  }

  if (viewport) {
    viewport.content = addViewportFit(viewport.content);
  }

  const state: NativeLayoutState = {
    installs: 1,
    previousNativeValue,
    viewport,
    previousViewport,
    createdStyle,
  };
  nativeLayoutStates.set(currentDocument, state);
  return createUninstall(currentDocument, state);
}

function createUninstall(
  currentDocument: Document,
  state: NativeLayoutState,
): () => void {
  let installed = true;
  return () => {
    if (!installed) return;
    installed = false;
    state.installs -= 1;
    if (state.installs > 0) return;

    if (state.previousNativeValue === null) {
      currentDocument.body.removeAttribute(NATIVE_ATTRIBUTE);
    } else {
      currentDocument.body.setAttribute(
        NATIVE_ATTRIBUTE,
        state.previousNativeValue,
      );
    }
    if (state.createdStyle) currentDocument.getElementById(STYLE_ID)?.remove();
    if (state.viewport) {
      if (state.previousViewport === null) {
        state.viewport.removeAttribute('content');
      } else {
        state.viewport.content = state.previousViewport;
      }
    }
    nativeLayoutStates.delete(currentDocument);
  };
}

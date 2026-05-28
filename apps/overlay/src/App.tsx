import { getCurrentWindow } from '@tauri-apps/api/window';

// `data-tauri-drag-region` is Tauri's native drag mechanism (it calls
// startDragging on mousedown). Note: the Electron-style `-webkit-app-region:
// drag` CSS the spec mentions is NOT supported by macOS WKWebView — this
// attribute is the Tauri equivalent. Interactive controls simply omit it.
export default function App() {
  const hide = () => {
    void getCurrentWindow().hide();
  };

  return (
    <main className="overlay" data-tauri-drag-region>
      <header className="brand" data-tauri-drag-region>
        <span className="dot" data-tauri-drag-region />
        <span className="title" data-tauri-drag-region>
          PG Overlay
        </span>
      </header>
      <p className="subtitle" data-tauri-drag-region>
        Tauri v2 shell spike
      </p>
      <p className="hint" data-tauri-drag-region>
        Drag anywhere · floats over fullscreen · menu-bar controlled
      </p>
      <div className="actions">
        <button type="button" onClick={hide}>
          Hide
        </button>
      </div>
    </main>
  );
}

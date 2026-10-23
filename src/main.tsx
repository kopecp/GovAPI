import { createRoot } from "react-dom/client";
import { Component } from "react";
import type { ReactNode } from "react";
import App from "./App";
import "./styles.css";

class AppBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <div className="state-box">
          <h1>Nie udało się wyświetlić widoku</h1>
          <p>Spróbuj ponownie otworzyć katalog danych.</p>
          <button
            className="button primary"
            onClick={() => {
              window.location.hash = "/datasets";
              window.location.reload();
            }}
          >
            Wróć do katalogu
          </button>
        </div>
      );
    return this.props.children;
  }
}
createRoot(document.getElementById("root")!).render(
  <AppBoundary>
    <App />
  </AppBoundary>,
);

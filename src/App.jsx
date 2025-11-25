import PaintingAnimator from "./components/PaintingAnimator";

export default function App() {
  return (
    <div className="app-art">
      <header className="app-header">
        <h1 className="app-title">ArtReveal — Live Drawing & Painting</h1>
        <p className="app-sub">Upload any image. Watch it be sketched and painted.</p>
      </header>

      <main>
        <PaintingAnimator />
      </main>

      <footer className="app-footer">
        <small>Artistic theme • Pencil tracing • Smooth brush painting</small>
      </footer>
    </div>
  );
}

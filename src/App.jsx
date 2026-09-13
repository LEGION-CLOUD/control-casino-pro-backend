export default function App() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#08080F', color: '#E9E9F5', fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <div style={{ maxWidth: 720, textAlign: 'center', padding: 32, borderRadius: 18, border: '1px solid #1E1E32', background: '#12121F' }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>CONTROL CASINO PRO</h1>
        <p style={{ marginTop: 16, color: '#8B8BA7', lineHeight: 1.6 }}>
          La aplicación funcional y segura se ejecuta desde la carpeta frontend. Esta instancia raíz queda desactivada para evitar duplicación, bypass y autenticación falsa.
        </p>
        <p style={{ marginTop: 12, fontSize: 14, color: '#D4AF37' }}>
          Usar la app real en frontend y la API real en frontend/src/server.js.
        </p>
      </div>
    </div>
  );
}

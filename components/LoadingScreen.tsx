export default function LoadingScreen() {
  return (
    <div className="page">
      <div className="card" style={{ display: 'flex', justifyContent: 'center' }}>
        <div className="spinner" role="status" aria-label="Loading" />
      </div>
    </div>
  );
}
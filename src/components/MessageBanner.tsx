import { useGame } from '../state/GameContext';

export function MessageBanner() {
  const {
    state: { message },
    dismissMessage
  } = useGame();

  if (!message) {
    return null;
  }

  return (
    <div
      className="card"
      style={{
        marginBottom: '1.5rem',
        borderLeft: '4px solid rgba(203, 146, 255, 0.65)',
        background: 'rgba(34, 17, 56, 0.8)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
        <p style={{ margin: 0 }}>{message}</p>
        <button className="small-button" type="button" onClick={dismissMessage}>
          Close
        </button>
      </div>
    </div>
  );
}

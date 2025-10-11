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
    <div className="card message-banner" role="status">
      <p className="message-banner__text">{message}</p>
      <button className="small-button" type="button" onClick={dismissMessage}>
        Close
      </button>
    </div>
  );
}

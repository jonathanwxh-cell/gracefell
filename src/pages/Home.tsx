import { useEffect, useRef, useState } from 'react';
import { Game, type GameUiSnapshot } from '@/game/engine';

const INITIAL_UI: GameUiSnapshot = {
  state: 'title',
  status: 'Title screen',
  muted: false,
  grace: 0,
  graceLabel: 'MEASURED',
  shakeEnabled: true,
  flashReduced: false,
  hapticsEnabled: true,
  touch: false,
};

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [ui, setUi] = useState<GameUiSnapshot>(INITIAL_UI);

  useEffect(() => {
    if (!canvasRef.current) return;
    const game = new Game(canvasRef.current);
    gameRef.current = game;
    let previous = '';
    const sync = () => {
      const next = game.uiSnapshot();
      const serialized = JSON.stringify(next);
      if (serialized !== previous) {
        previous = serialized;
        setUi(next);
      }
    };
    sync();
    const timer = window.setInterval(sync, 250);
    return () => {
      window.clearInterval(timer);
      gameRef.current = null;
      game.destroy();
    };
  }, []);

  const act = (action: (game: Game) => void) => {
    const game = gameRef.current;
    if (!game) return;
    action(game);
    setUi(game.uiSnapshot());
  };

  const confirmLabel = ui.state === 'dead' ? 'Retry fight'
    : ui.state === 'victory' ? 'Fight again'
    : ui.state === 'intro' ? 'Skip introduction'
    : 'Start fight';

  return (
    <main className="game-shell">
      <canvas
        ref={canvasRef}
        role="application"
        aria-label="Gracefell boss arena"
        aria-describedby="game-instructions game-status"
        tabIndex={0}
        onPointerDown={(event) => event.currentTarget.focus({ preventScroll: true })}
      />

      <section className="game-accessibility" aria-label="Gracefell controls and accessibility settings">
        <h1>Gracefell</h1>
        <p id="game-instructions">
          Move with WASD or arrow keys, roll with Space, attack with J, use a heavy attack with K,
          and drink a flask with F. On touch screens, steer on the left and use the action buttons on the right.
        </p>
        <p id="game-status" aria-live="polite">{ui.status}</p>
        <div className="game-accessibility__actions">
          <button
            type="button"
            disabled={ui.state === 'fight'}
            onClick={() => act((game) => game.confirm())}
          >
            {confirmLabel}
          </button>
          <button type="button" onClick={() => act((game) => game.toggleMuted())}>
            Sound {ui.muted ? 'off' : 'on'}
          </button>
          <button type="button" onClick={() => act((game) => game.setGrace(game.grace - 1))}>
            Easier trial
          </button>
          <output aria-label="Current trial">{ui.graceLabel}</output>
          <button type="button" onClick={() => act((game) => game.setGrace(game.grace + 1))}>
            Harder trial
          </button>
          <button type="button" onClick={() => act((game) => game.toggleShake())}>
            Screen shake {ui.shakeEnabled ? 'on' : 'off'}
          </button>
          <button type="button" onClick={() => act((game) => game.toggleFlashes())}>
            Flashes {ui.flashReduced ? 'reduced' : 'full'}
          </button>
          {ui.touch && (
            <button type="button" onClick={() => act((game) => game.toggleHaptics())}>
              Haptics {ui.hapticsEnabled ? 'on' : 'off'}
            </button>
          )}
        </div>
      </section>
    </main>
  );
}

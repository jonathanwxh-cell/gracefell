import { useEffect, useRef, useState } from 'react';
import { Game, type GameUiSnapshot } from '@/game/engine';

const INITIAL_UI: GameUiSnapshot = {
  state: 'title',
  status: 'Title screen',
  muted: false,
  grace: -2,
  graceLabel: 'JOURNEY -2',
  graceSummary: 'recommended · 15% slower · 30% softer · 4 flasks',
  oathRank: 0,
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

  const confirmFromUi = () => {
    act((game) => {
      game.confirm();
      // A confirm hands control back to the canvas. Without this, the title
      // button becomes disabled while retaining focus and can pause the fight
      // permanently for keyboard and assistive-technology players.
      game.setUiFocused(false);
    });
    canvasRef.current?.focus({ preventScroll: true });
  };

  const confirmLabel = ui.state === 'dead' ? 'Retry fight'
    : ui.state === 'victory' ? 'Fight again'
    : ui.state === 'intro' ? 'Skip introduction'
    : 'Start fight';
  const trialLocked = ui.state === 'intro' || ui.state === 'fight';

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

      <section
        className="game-accessibility"
        aria-label="Gracefell controls and accessibility settings"
        onFocusCapture={() => act((game) => game.setUiFocused(true))}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            act((game) => game.setUiFocused(false));
          }
        }}
      >
        <h1>Gracefell</h1>
        <p id="game-instructions">
          Move with WASD or arrow keys, roll with Space, attack with J, use a heavy attack with K,
          and drink a flask with F. Roll through an attack for a perfect dodge; perfect dodges,
          heavy attacks, and combo finishers break poise so a staggered Malakar takes extra damage.
          On touch screens, steer on the left and use the action buttons on the right.
        </p>
        <p id="game-status" aria-live="polite">{ui.status}</p>
        <div className="game-accessibility__actions">
          <button
            type="button"
            disabled={ui.state === 'fight'}
            onClick={confirmFromUi}
          >
            {confirmLabel}
          </button>
          <button type="button" onClick={() => act((game) => game.toggleMuted())}>
            Sound {ui.muted ? 'off' : 'on'}
          </button>
          <button type="button" disabled={trialLocked} onClick={() => act((game) => game.setGrace(game.grace - 1))}>
            More Grace
          </button>
          <output aria-label="Current trial">{ui.graceLabel}</output>
          <button type="button" disabled={trialLocked} onClick={() => act((game) => game.setGrace(game.grace + 1))}>
            More Oath
          </button>
          <output aria-label="Trial effects">{ui.graceSummary}</output>
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

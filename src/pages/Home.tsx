import { useEffect, useRef, useState } from 'react';
import { Game, type GameUiSnapshot } from '@/game/engine';

const INITIAL_UI: GameUiSnapshot = {
  state: 'title',
  status: 'Title screen',
  paused: false,
  manualPaused: false,
  muted: false,
  musicVolume: 0.85,
  sfxVolume: 1,
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
  const musicControlRef = useRef<HTMLInputElement>(null);
  const [ui, setUi] = useState<GameUiSnapshot>(INITIAL_UI);
  const [mixOpen, setMixOpen] = useState(false);

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
    game.uiChanged = sync;
    sync();
    const timer = window.setInterval(sync, 250);
    return () => {
      window.clearInterval(timer);
      game.uiChanged = null;
      gameRef.current = null;
      game.destroy();
    };
  }, []);

  useEffect(() => {
    if (mixOpen) musicControlRef.current?.focus({ preventScroll: true });
  }, [mixOpen]);

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

  const togglePauseFromUi = () => {
    act((game) => game.togglePause());
    // Keep keyboard control with the game after a mouse/touch activation so
    // combat input and the pause shortcuts work immediately after resuming.
    canvasRef.current?.focus({ preventScroll: true });
  };

  const openMix = () => {
    setMixOpen(true);
    act((game) => game.setUiFocused(true, true));
  };

  const closeMix = () => {
    setMixOpen(false);
    act((game) => game.setUiFocused(false));
    canvasRef.current?.focus({ preventScroll: true });
  };

  const confirmLabel = ui.state === 'dead' ? 'Retry fight'
    : ui.state === 'victory' ? 'Fight again'
    : ui.state === 'intro' ? 'Skip introduction'
    : 'Start fight';
  const trialLocked = ui.state === 'intro' || ui.state === 'fight';

  return (
    <main
      className="game-shell"
      onKeyDownCapture={(event) => {
        if (!mixOpen) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          closeMix();
        } else if (event.key.toLowerCase() === 'p') {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      <canvas
        ref={canvasRef}
        role="application"
        aria-label="Gracefell boss arena"
        aria-describedby="game-instructions game-status"
        tabIndex={mixOpen ? -1 : 0}
        onPointerDown={(event) => event.currentTarget.focus({ preventScroll: true })}
      />

      {ui.state === 'fight' && (
        <>
          <button
            type="button"
            className="game-mix-toggle"
            aria-controls="game-audio-controls"
            aria-expanded={mixOpen}
            disabled={ui.manualPaused}
            tabIndex={mixOpen ? -1 : undefined}
            onClick={mixOpen ? closeMix : openMix}
          >
            MIX
          </button>
          <button
            type="button"
            className={`game-pause-toggle${ui.manualPaused ? ' is-paused' : ''}`}
            aria-pressed={ui.manualPaused}
            aria-keyshortcuts="P Escape"
            disabled={mixOpen}
            tabIndex={mixOpen ? -1 : undefined}
            onClick={togglePauseFromUi}
          >
            {ui.manualPaused ? 'RESUME' : 'PAUSE'}
          </button>
        </>
      )}

      {mixOpen && (
        <div
          className="game-mix-backdrop"
          aria-hidden="true"
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            closeMix();
          }}
        />
      )}

      <section
        className={`game-accessibility${mixOpen ? ' is-mix-open' : ''}`}
        role={mixOpen ? 'dialog' : undefined}
        aria-modal={mixOpen || undefined}
        aria-label={mixOpen ? 'Combat mix' : 'Gracefell controls and accessibility settings'}
        onFocusCapture={() => act((game) => game.setUiFocused(true, mixOpen))}
        onBlurCapture={(event) => {
          if (!mixOpen && !event.currentTarget.contains(event.relatedTarget as Node | null)) {
            act((game) => game.setUiFocused(false));
          }
        }}
        onKeyDownCapture={(event) => {
          if (mixOpen && event.key === 'Tab') {
            const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
              'button:not(:disabled), input:not(:disabled)',
            ));
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus({ preventScroll: true });
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus({ preventScroll: true });
            }
          }
        }}
      >
        <h1>{mixOpen ? 'Combat mix' : 'Gracefell'}</h1>
        <p id="game-instructions">
          {mixOpen
            ? 'The fight is safely paused while the score keeps playing. Set the music behind the action, test the combat crack, then resume.'
            : 'Move with WASD or arrow keys, roll with Space, attack with J, use a heavy attack with K, drink a flask with F, and pause or resume with P or Escape. Roll through an attack for a perfect dodge; perfect dodges, heavy attacks, and combo finishers break poise so a staggered Malakar takes extra damage. On touch screens, steer on the left and use the action buttons on the right.'}
        </p>
        <p id="game-status" aria-live="polite">{ui.status}</p>
        <div id="game-audio-controls" className="game-accessibility__actions">
          {!mixOpen && (
            <button
              type="button"
              disabled={ui.state === 'fight'}
              onClick={confirmFromUi}
            >
              {confirmLabel}
            </button>
          )}
          <button type="button" onClick={() => act((game) => game.toggleMuted())}>
            Sound {ui.muted ? 'off' : 'on'}
          </button>
          <label className="game-accessibility__range">
            <span>Music {Math.round(ui.musicVolume * 100)}%</span>
            <input
              ref={musicControlRef}
              type="range"
              aria-label="Music volume"
              min="0"
              max="100"
              step="5"
              value={Math.round(ui.musicVolume * 100)}
              onChange={(event) => act((game) => game.setMusicVolume(Number(event.target.value) / 100))}
            />
          </label>
          <label className="game-accessibility__range">
            <span>Combat effects {Math.round(ui.sfxVolume * 100)}%</span>
            <input
              type="range"
              aria-label="Combat effects volume"
              min="0"
              max="100"
              step="5"
              value={Math.round(ui.sfxVolume * 100)}
              onChange={(event) => act((game) => game.setSfxVolume(Number(event.target.value) / 100))}
            />
          </label>
          {mixOpen ? (
            <>
              <button type="button" onClick={() => act((game) => game.previewSfx())}>
                TEST SFX
              </button>
              <button type="button" className="game-accessibility__done" onClick={closeMix}>
                DONE · RESUME
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </section>
    </main>
  );
}

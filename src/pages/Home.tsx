import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Game, type GameUiSnapshot, type ScoreHistoryEntry } from '@/game/engine';

type GameDialog = 'mix' | 'battle-menu' | 'scores' | null;

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
  wins: 0,
  attempts: 0,
  scoreHistory: [],
  combat: {
    playerHpPercent: 100,
    playerStaminaPercent: 100,
    playerFlasks: 4,
    bossHpPercent: 100,
    bossPhase: 1,
    bossPoisePercent: 100,
    bossState: 'idle',
    telegraph: '',
    comboHits: 0,
    queuedLights: 0,
  },
};

const formatFightTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
};

const formatCompletedAt = (completedAt: string | null) => {
  if (!completedAt) return 'Date unavailable';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(completedAt));
};

const formatTrial = (trial: number) => (
  trial < 0 ? `Journey ${trial}` : trial > 0 ? `Oath +${trial}` : 'Pilgrim 0'
);

const scoreKey = (score: ScoreHistoryEntry, index: number) => (
  `${score.completedAt ?? 'legacy'}-${score.time}-${score.grade}-${index}`
);

function trapDialogFocus(event: ReactKeyboardEvent<HTMLElement>) {
  if (event.key !== 'Tab') return;
  const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
    'button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
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

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const musicControlRef = useRef<HTMLInputElement>(null);
  const battleResumeRef = useRef<HTMLButtonElement>(null);
  const scoresCloseRef = useRef<HTMLButtonElement>(null);
  const scoresToggleRef = useRef<HTMLButtonElement>(null);
  const [ui, setUi] = useState<GameUiSnapshot>(INITIAL_UI);
  const [dialog, setDialog] = useState<GameDialog>(null);

  const mixOpen = dialog === 'mix';
  const dialogOpen = dialog !== null;

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
    if (dialog === 'mix') musicControlRef.current?.focus({ preventScroll: true });
    if (dialog === 'battle-menu') battleResumeRef.current?.focus({ preventScroll: true });
    if (dialog === 'scores') scoresCloseRef.current?.focus({ preventScroll: true });
  }, [dialog]);

  const act = (action: (game: Game) => void) => {
    const game = gameRef.current;
    if (!game) return;
    action(game);
    setUi(game.uiSnapshot());
  };

  const focusGame = () => canvasRef.current?.focus({ preventScroll: true });

  const confirmFromUi = () => {
    act((game) => {
      game.confirm();
      game.setUiFocused(false);
    });
    focusGame();
  };

  const togglePauseFromUi = () => {
    act((game) => game.togglePause());
    focusGame();
  };

  const openMix = () => {
    setDialog('mix');
    act((game) => game.setUiFocused(true, true));
  };

  const closeMix = () => {
    setDialog(null);
    act((game) => game.setUiFocused(false));
    focusGame();
  };

  const openBattleMenu = () => {
    setDialog('battle-menu');
    act((game) => game.setUiFocused(true, false));
  };

  const closeBattleMenu = () => {
    setDialog(null);
    act((game) => game.setUiFocused(false));
    focusGame();
  };

  const returnToMainMenu = () => {
    setDialog(null);
    act((game) => game.returnToTitle());
    focusGame();
  };

  const openScores = () => {
    setDialog('scores');
    act((game) => game.setUiFocused(true, false));
  };

  const closeScores = () => {
    setDialog(null);
    act((game) => game.setUiFocused(false));
    window.setTimeout(() => scoresToggleRef.current?.focus({ preventScroll: true }), 0);
  };

  const closeActiveDialog = () => {
    if (dialog === 'mix') closeMix();
    else if (dialog === 'battle-menu') closeBattleMenu();
    else if (dialog === 'scores') closeScores();
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
        if (!dialogOpen) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          closeActiveDialog();
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
        tabIndex={dialogOpen ? -1 : 0}
        onPointerDown={(event) => event.currentTarget.focus({ preventScroll: true })}
      />

      {ui.state === 'title' && (
        <button
          ref={scoresToggleRef}
          type="button"
          className="game-scores-toggle"
          aria-controls="game-score-history"
          aria-expanded={dialog === 'scores'}
          disabled={dialogOpen}
          tabIndex={dialogOpen ? -1 : undefined}
          onClick={openScores}
        >
          SCORES
        </button>
      )}

      {ui.state !== 'title' && (
        <button
          type="button"
          className="game-menu-toggle"
          aria-controls="game-battle-menu"
          aria-expanded={dialog === 'battle-menu'}
          disabled={ui.manualPaused || dialogOpen}
          tabIndex={dialogOpen ? -1 : undefined}
          onClick={openBattleMenu}
        >
          MENU
        </button>
      )}

      {ui.state === 'fight' && (
        <>
          <button
            type="button"
            className="game-mix-toggle"
            aria-controls="game-audio-controls"
            aria-expanded={mixOpen}
            disabled={ui.manualPaused || dialogOpen}
            tabIndex={dialogOpen ? -1 : undefined}
            onClick={openMix}
          >
            MIX
          </button>
          <button
            type="button"
            className={`game-pause-toggle${ui.manualPaused ? ' is-paused' : ''}`}
            aria-pressed={ui.manualPaused}
            aria-keyshortcuts="P Escape"
            disabled={dialogOpen}
            tabIndex={dialogOpen ? -1 : undefined}
            onClick={togglePauseFromUi}
          >
            {ui.manualPaused ? 'RESUME' : 'PAUSE'}
          </button>
        </>
      )}

      {dialogOpen && (
        <div
          className="game-dialog-backdrop"
          aria-hidden="true"
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            closeActiveDialog();
          }}
        />
      )}

      {(dialog === null || mixOpen) && (
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
          onKeyDownCapture={mixOpen ? trapDialogFocus : undefined}
        >
          <h1>{mixOpen ? 'Combat mix' : 'Gracefell'}</h1>
          <p id="game-instructions">
            {mixOpen
              ? 'The fight is safely paused while the score keeps playing. Set the music behind the action, test the combat crack, then resume.'
              : 'Move with WASD or arrow keys, roll with Space, attack with J, use a heavy attack with K, drink a flask with F, and pause or resume with P or Escape. Roll through an attack for a perfect dodge; perfect dodges, heavy attacks, and combo finishers break poise so a staggered Malakar takes extra damage. On touch screens, steer on the left and use the action buttons on the right.'}
          </p>
          <p id="game-status" aria-live="polite">{ui.status}</p>
          {ui.state === 'fight' && (
            <dl id="game-combat-status" className="game-combat-status" aria-label="Current combat status">
              <div><dt>Health</dt><dd>{ui.combat.playerHpPercent}%</dd></div>
              <div><dt>Stamina</dt><dd>{ui.combat.playerStaminaPercent}%</dd></div>
              <div><dt>Flasks</dt><dd>{ui.combat.playerFlasks}</dd></div>
              <div><dt>Malakar health</dt><dd>{ui.combat.bossHpPercent}%</dd></div>
              <div><dt>Malakar phase</dt><dd>{ui.combat.bossPhase}</dd></div>
              <div><dt>Malakar poise</dt><dd>{ui.combat.bossPoisePercent}%</dd></div>
              <div><dt>Malakar action</dt><dd>{ui.combat.telegraph || ui.combat.bossState}</dd></div>
              <div><dt>Combo</dt><dd>{ui.combat.comboHits} of 3</dd></div>
              <div><dt>Queued attacks</dt><dd>{ui.combat.queuedLights}</dd></div>
            </dl>
          )}
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
      )}

      {dialog === 'battle-menu' && (
        <section
          id="game-battle-menu"
          className="game-dialog game-battle-menu"
          role="dialog"
          aria-modal="true"
          aria-labelledby="game-battle-menu-title"
          aria-describedby="game-battle-menu-description"
          onKeyDownCapture={trapDialogFocus}
        >
          <p className="game-dialog__eyebrow">Battle paused</p>
          <h1 id="game-battle-menu-title">Return to the main menu?</h1>
          <p id="game-battle-menu-description">
            This battle will be abandoned. Victories and scores you already earned stay saved.
          </p>
          <div className="game-dialog__actions">
            <button ref={battleResumeRef} type="button" className="is-primary" onClick={closeBattleMenu}>
              RESUME BATTLE
            </button>
            <button type="button" onClick={returnToMainMenu}>
              RETURN TO MAIN MENU
            </button>
          </div>
        </section>
      )}

      {dialog === 'scores' && (
        <section
          id="game-score-history"
          className="game-dialog game-score-history"
          role="dialog"
          aria-modal="true"
          aria-labelledby="game-score-history-title"
          onKeyDownCapture={trapDialogFocus}
        >
          <div className="game-dialog__heading">
            <div>
              <p className="game-dialog__eyebrow">Chronicle</p>
              <h1 id="game-score-history-title">Victory scores</h1>
            </div>
            <button ref={scoresCloseRef} type="button" className="game-dialog__close" onClick={closeScores}>
              CLOSE
            </button>
          </div>
          <p className="game-score-history__summary">
            {ui.wins} {ui.wins === 1 ? 'victory' : 'victories'} across {ui.attempts} {ui.attempts === 1 ? 'attempt' : 'attempts'}.
            The latest 20 victories are kept on this device.
          </p>
          {ui.scoreHistory.length === 0 ? (
            <div className="game-score-history__empty">
              Defeat Malakar to write your first score into the chronicle.
            </div>
          ) : (
            <ol className="game-score-history__list" aria-label="Saved victory scores">
              {ui.scoreHistory.map((score, index) => (
                <li key={scoreKey(score, index)}>
                  <div className="game-score-history__grade" aria-label={`Grade ${score.grade}`}>{score.grade}</div>
                  <div className="game-score-history__result">
                    <strong>{formatFightTime(score.time)}</strong>
                    <span>{formatTrial(score.trial)}</span>
                    <time dateTime={score.completedAt ?? undefined}>{formatCompletedAt(score.completedAt)}</time>
                  </div>
                  <dl>
                    <div><dt>Damage</dt><dd>{Math.round(score.damageDealt)}</dd></div>
                    <div><dt>Wounds</dt><dd>{score.woundsTaken}</dd></div>
                    <div><dt>Flasks</dt><dd>{score.flasksUsed ?? 0}</dd></div>
                    <div><dt>Perfects</dt><dd>{score.perfectDodges ?? 0}</dd></div>
                    <div><dt>Attempt</dt><dd>{score.attempt}</dd></div>
                  </dl>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </main>
  );
}

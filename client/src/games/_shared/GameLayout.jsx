import React from 'react';
import RulesButton from '@/components/games/RulesButton';

/**
 * GameLayout — the shared shell every rebuilt game page mounts into.
 *
 * Slots:
 *   - `title`           game name shown in the header
 *   - `gameType`        used by RulesButton + provably-fair badge
 *   - `rules`           rules content (passed through to RulesButton)
 *   - `headerExtras`    extra header-right content (sound toggle, etc.)
 *   - `canvas`          the main game stage (canvas/board)
 *   - `controls`        BetControls + per-game custom inputs
 *   - `history`         optional right-rail history / players list
 *   - `provablyFair`    the ProvablyFairPanel (or null to hide)
 *   - `banner`          optional disconnect/error banner above the stage
 *
 * Layout collapses to a single column at < lg.
 */
const GameLayout = ({
  title,
  gameType,
  rules,
  headerExtras = null,
  canvas,
  controls,
  history = null,
  provablyFair = null,
  banner = null,
}) => {
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-bg-base text-text-primary px-4 py-6 lg:px-8 lg:py-8">
      <header className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight">{title}</h1>
          {rules ? <RulesButton gameType={gameType} gameName={title} rules={rules} /> : null}
        </div>
        <div className="flex items-center gap-2">{headerExtras}</div>
      </header>

      {banner ? <div className="mb-4">{banner}</div> : null}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 lg:gap-6">
        <div className="flex flex-col gap-4">
          <section
            className="bg-bg-elevated border border-border-light rounded-lg p-3 lg:p-4"
            aria-label={`${title} game stage`}
          >
            {canvas}
          </section>
          {provablyFair ? (
            <section aria-label="Provably fair verification" className="bg-bg-elevated border border-border-light rounded-lg p-3 lg:p-4">
              {provablyFair}
            </section>
          ) : null}
        </div>

        <aside className="flex flex-col gap-4">
          <section
            className="bg-bg-elevated border border-border-light rounded-lg p-3 lg:p-4"
            aria-label="Bet controls"
          >
            {controls}
          </section>
          {history ? (
            <section
              className="bg-bg-elevated border border-border-light rounded-lg p-3 lg:p-4"
              aria-label="History"
            >
              {history}
            </section>
          ) : null}
        </aside>
      </div>
    </main>
  );
};

export default GameLayout;

import React from 'react';
import Button from '@/components/ui/Button';

/**
 * DisconnectOverlay — full-stage overlay surfaced whenever the game socket
 * is not in the 'connected' state.
 *
 * Props
 *   status    'connecting' | 'connected' | 'disconnected' | 'error'
 *   lastError optional { message, source } payload
 *
 * Returns null when connected.
 */
const DisconnectOverlay = ({ status, lastError = null }) => {
  if (status === 'connected') return null;

  const { title, body, showSpinner, showRetry } = describe(status, lastError);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="absolute inset-0 z-30 flex items-center justify-center bg-bg-base/80 backdrop-blur-sm"
    >
      <div className="w-[min(90%,360px)] flex flex-col items-center gap-3 bg-bg-elevated border border-border-light rounded-lg p-5 text-center shadow-lg">
        {showSpinner ? (
          <span
            className="inline-block h-8 w-8 rounded-full border-2 border-border-light border-t-accent-gold animate-spin"
            aria-hidden="true"
          />
        ) : (
          <span
            className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-status-error/20 text-status-error"
            aria-hidden="true"
          >
            !
          </span>
        )}
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
        {body ? (
          <p className="text-sm text-text-secondary break-words">{body}</p>
        ) : null}
        {showRetry ? (
          <Button
            variant="outlineAccent"
            size="sm"
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        ) : null}
      </div>
    </div>
  );
};

function describe(status, lastError) {
  switch (status) {
    case 'connecting':
      return {
        title: 'Connecting…',
        body: 'Establishing a secure session.',
        showSpinner: true,
        showRetry: false,
      };
    case 'disconnected':
      return {
        title: 'Disconnected',
        body: 'Reconnecting…',
        showSpinner: true,
        showRetry: false,
      };
    case 'error':
      return {
        title: 'Connection error',
        body: lastError?.message || 'Unable to reach the game server.',
        showSpinner: false,
        showRetry: true,
      };
    default:
      return {
        title: 'Offline',
        body: 'Reconnecting…',
        showSpinner: true,
        showRetry: false,
      };
  }
}

export default DisconnectOverlay;

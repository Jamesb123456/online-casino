import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import ErrorBoundary from '@/components/ErrorBoundary';

// Component that throws when shouldThrow=true
const ProblemChild = ({ shouldThrow, message = 'Test crash' }) => {
  if (shouldThrow) {
    throw new Error(message);
  }
  return <div data-testid="child-ok">child rendered fine</div>;
};

// Wrapper that allows toggling the child's error state from outside
const ToggleableBoundary = ({ initialThrow = true }) => {
  const [throwing, setThrowing] = React.useState(initialThrow);
  return (
    <div>
      <button onClick={() => setThrowing(false)}>Stop throwing</button>
      <ErrorBoundary>
        <ProblemChild shouldThrow={throwing} />
      </ErrorBoundary>
    </div>
  );
};

describe('ErrorBoundary', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    // Suppress expected React error logs in test output
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders children when no error is thrown', () => {
    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByTestId('child-ok')).toBeInTheDocument();
  });

  it('catches errors thrown by children and renders the fallback UI', () => {
    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={true} message="Boom" />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/an unexpected error has occurred/i)).toBeInTheDocument();
  });

  it('renders the thrown error message inside the fallback', () => {
    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={true} message="Specific failure" />
      </ErrorBoundary>
    );
    expect(screen.getByText(/Specific failure/i)).toBeInTheDocument();
  });

  it('renders Return to Home and Refresh Page buttons in the fallback', () => {
    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByRole('button', { name: /return to home/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refresh page/i })).toBeInTheDocument();
  });

  it('logs the error to console.error when caught', () => {
    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={true} message="Logged error" />
      </ErrorBoundary>
    );
    // React itself + our handler both log
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('keeps showing the fallback even after children stop throwing (no auto-recovery)', () => {
    const { container } = render(<ToggleableBoundary initialThrow={true} />);
    // Initial: fallback visible
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Trigger child to stop throwing; without manual reset the boundary stays errored.
    fireEvent.click(screen.getByRole('button', { name: /stop throwing/i }));
    expect(container.textContent).toContain('Something went wrong');
  });

  it('recovers when re-mounted with a fresh boundary instance', () => {
    const { rerender } = render(
      <ErrorBoundary key="first">
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Re-mount with a new key + a non-throwing child to simulate a reset
    rerender(
      <ErrorBoundary key="second">
        <ProblemChild shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByTestId('child-ok')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });
});

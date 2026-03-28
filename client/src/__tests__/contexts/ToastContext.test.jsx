import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ToastProvider, useToast } from '@/contexts/ToastContext';

// Mock the Toast component so we can inspect props without worrying about
// its internal timer and visibility logic
vi.mock('@/components/ui/Toast', () => ({
  default: ({ message, type, duration, onClose }) => (
    <div data-testid={`toast-${type}`} data-duration={duration}>
      <span data-testid="toast-message">{message}</span>
      <button data-testid="toast-close" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));

// Test helper component that exposes toast context methods
function TestComponent() {
  const { addToast, removeToast, success, error, warning, info } = useToast();
  const [lastId, setLastId] = React.useState('');

  return (
    <div>
      <span data-testid="lastId">{lastId}</span>
      <button
        data-testid="add-toast"
        onClick={() => {
          const id = addToast('Test message', 'info', 3000);
          setLastId(id);
        }}
      >
        Add Toast
      </button>
      <button
        data-testid="add-success"
        onClick={() => {
          const id = success('Success!');
          setLastId(id);
        }}
      >
        Success
      </button>
      <button
        data-testid="add-error"
        onClick={() => {
          const id = error('Error!');
          setLastId(id);
        }}
      >
        Error
      </button>
      <button
        data-testid="add-warning"
        onClick={() => {
          const id = warning('Warning!');
          setLastId(id);
        }}
      >
        Warning
      </button>
      <button
        data-testid="add-info"
        onClick={() => {
          const id = info('Info!');
          setLastId(id);
        }}
      >
        Info
      </button>
      <button data-testid="remove-toast" onClick={() => removeToast(lastId)}>
        Remove
      </button>
    </div>
  );
}

describe('ToastContext', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ToastProvider renders children', () => {
    render(
      <ToastProvider>
        <span data-testid="child">hello</span>
      </ToastProvider>
    );
    expect(screen.getByTestId('child')).toHaveTextContent('hello');
  });

  it('addToast() creates a toast with id, message, type, duration', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    await user.click(screen.getByTestId('add-toast'));

    // Toast should be rendered
    expect(screen.getByTestId('toast-info')).toBeInTheDocument();
    expect(screen.getByTestId('toast-message')).toHaveTextContent('Test message');

    // ID should be set
    const id = screen.getByTestId('lastId').textContent;
    expect(id).toMatch(/^toast-/);
  });

  it('success() creates success toast', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    await user.click(screen.getByTestId('add-success'));

    expect(screen.getByTestId('toast-success')).toBeInTheDocument();
    expect(screen.getByTestId('toast-message')).toHaveTextContent('Success!');
  });

  it('error() creates error toast', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    await user.click(screen.getByTestId('add-error'));

    expect(screen.getByTestId('toast-error')).toBeInTheDocument();
    expect(screen.getByTestId('toast-message')).toHaveTextContent('Error!');
  });

  it('warning() creates warning toast', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    await user.click(screen.getByTestId('add-warning'));

    expect(screen.getByTestId('toast-warning')).toBeInTheDocument();
    expect(screen.getByTestId('toast-message')).toHaveTextContent('Warning!');
  });

  it('info() creates info toast', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    await user.click(screen.getByTestId('add-info'));

    expect(screen.getByTestId('toast-info')).toBeInTheDocument();
    expect(screen.getByTestId('toast-message')).toHaveTextContent('Info!');
  });

  it('removeToast() removes toast by id', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    await user.click(screen.getByTestId('add-toast'));
    expect(screen.getByTestId('toast-info')).toBeInTheDocument();

    await user.click(screen.getByTestId('remove-toast'));

    await waitFor(() => {
      expect(screen.queryByTestId('toast-info')).not.toBeInTheDocument();
    });
  });

  it('toast auto-removes via onClose callback from Toast component', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    await user.click(screen.getByTestId('add-toast'));
    expect(screen.getByTestId('toast-info')).toBeInTheDocument();

    // Click the close button provided by the mocked Toast
    await user.click(screen.getByTestId('toast-close'));

    await waitFor(() => {
      expect(screen.queryByTestId('toast-info')).not.toBeInTheDocument();
    });
  });

  it('multiple toasts can exist simultaneously', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    await user.click(screen.getByTestId('add-success'));
    await user.click(screen.getByTestId('add-error'));

    // Both toasts should be visible
    expect(screen.getByTestId('toast-success')).toBeInTheDocument();
    expect(screen.getByTestId('toast-error')).toBeInTheDocument();

    const messages = screen.getAllByTestId('toast-message');
    expect(messages).toHaveLength(2);
    expect(messages[0]).toHaveTextContent('Success!');
    expect(messages[1]).toHaveTextContent('Error!');
  });

  it('useToast hook returns context values', async () => {
    let hookResult;

    function Capture() {
      hookResult = useToast();
      return null;
    }

    render(
      <ToastProvider>
        <Capture />
      </ToastProvider>
    );

    expect(hookResult).toBeDefined();
    expect(typeof hookResult.addToast).toBe('function');
    expect(typeof hookResult.removeToast).toBe('function');
    expect(typeof hookResult.success).toBe('function');
    expect(typeof hookResult.error).toBe('function');
    expect(typeof hookResult.warning).toBe('function');
    expect(typeof hookResult.info).toBe('function');
  });

  it('useToast throws when used outside ToastProvider', () => {
    function BadComponent() {
      useToast();
      return null;
    }

    // Suppress console.error for the expected error
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<BadComponent />)).toThrow(
      'useToast must be used within a ToastProvider'
    );
    spy.mockRestore();
  });
});

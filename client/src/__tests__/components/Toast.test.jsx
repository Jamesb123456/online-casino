import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import Toast from '@/components/ui/Toast';

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- Basic rendering ---

  it('should render the toast message', () => {
    render(<Toast message="Operation successful" />);
    expect(screen.getByText('Operation successful')).toBeInTheDocument();
  });

  it('should render with default info type', () => {
    const { container } = render(<Toast message="Info message" />);
    const toast = container.firstChild;
    expect(toast.className).toContain('border-l-status-info');
  });

  // --- Types ---

  it('should render success type with correct styling', () => {
    const { container } = render(<Toast message="Success!" type="success" />);
    const toast = container.firstChild;
    expect(toast.className).toContain('border-l-status-success');
  });

  it('should render error type with correct styling', () => {
    const { container } = render(<Toast message="Error!" type="error" />);
    const toast = container.firstChild;
    expect(toast.className).toContain('border-l-status-error');
  });

  it('should render warning type with correct styling', () => {
    const { container } = render(<Toast message="Warning!" type="warning" />);
    const toast = container.firstChild;
    expect(toast.className).toContain('border-l-status-warning');
  });

  it('should render info type with correct styling', () => {
    const { container } = render(<Toast message="Info" type="info" />);
    const toast = container.firstChild;
    expect(toast.className).toContain('border-l-status-info');
  });

  it('should fall back to info styling for unknown type', () => {
    const { container } = render(<Toast message="Unknown" type="custom" />);
    const toast = container.firstChild;
    expect(toast.className).toContain('border-l-status-info');
  });

  // --- Icons ---

  it('should render an icon for each toast type', () => {
    const { container } = render(<Toast message="With icon" type="success" />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
  });

  // --- Close / dismiss ---

  it('should call onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<Toast message="Close me" onClose={onClose} />);

    act(() => {
      fireEvent.click(screen.getByLabelText('Close'));
    });

    // handleClose sets isVisible to false and calls onClose after 300ms
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should have an accessible close button', () => {
    render(<Toast message="Test" />);
    expect(screen.getByLabelText('Close')).toBeInTheDocument();
  });

  // --- Auto-dismiss ---

  it('should auto-dismiss after default duration (5000ms)', () => {
    const onClose = vi.fn();
    render(<Toast message="Auto dismiss" onClose={onClose} />);

    // Before timeout
    expect(screen.getByText('Auto dismiss')).toBeInTheDocument();

    // Advance to just before 5000ms
    act(() => {
      vi.advanceTimersByTime(4999);
    });
    // Toast should still be visible from the component's perspective
    // (the onClose hasn't been called yet)
    expect(onClose).not.toHaveBeenCalled();

    // Advance past 5000ms
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should auto-dismiss after custom duration', () => {
    const onClose = vi.fn();
    render(<Toast message="Quick dismiss" duration={2000} onClose={onClose} />);

    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should hide content after auto-dismiss', () => {
    render(<Toast message="Disappearing" duration={1000} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // After auto-dismiss, isVisible becomes false and component returns null
    expect(screen.queryByText('Disappearing')).not.toBeInTheDocument();
  });

  // --- Multiple toasts (rendered independently) ---

  it('should render multiple toasts simultaneously', () => {
    render(
      <>
        <Toast message="First toast" type="success" />
        <Toast message="Second toast" type="error" />
        <Toast message="Third toast" type="warning" />
      </>
    );
    expect(screen.getByText('First toast')).toBeInTheDocument();
    expect(screen.getByText('Second toast')).toBeInTheDocument();
    expect(screen.getByText('Third toast')).toBeInTheDocument();
  });

  it('should allow independent dismissal of multiple toasts', () => {
    const onClose1 = vi.fn();
    const onClose2 = vi.fn();
    render(
      <>
        <Toast message="Toast A" duration={1000} onClose={onClose1} />
        <Toast message="Toast B" duration={3000} onClose={onClose2} />
      </>
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onClose1).toHaveBeenCalledTimes(1);
    expect(onClose2).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onClose2).toHaveBeenCalledTimes(1);
  });

  // --- Positioning ---

  it('should be positioned fixed at top-right', () => {
    const { container } = render(<Toast message="Positioned" />);
    const toast = container.firstChild;
    expect(toast.className).toContain('fixed');
    expect(toast.className).toContain('top-4');
    expect(toast.className).toContain('right-4');
  });

  it('should have z-50 for stacking context', () => {
    const { container } = render(<Toast message="Stacked" />);
    expect(container.firstChild.className).toContain('z-50');
  });

  // --- Styling ---

  it('should have a left border accent (border-l-4)', () => {
    const { container } = render(<Toast message="Bordered" />);
    expect(container.firstChild.className).toContain('border-l-4');
  });

  it('should have backdrop blur and card background', () => {
    const { container } = render(<Toast message="Glass" />);
    expect(container.firstChild.className).toContain('backdrop-blur-xl');
  });

  // --- No onClose callback ---

  it('should not throw when onClose is not provided and auto-dismiss fires', () => {
    render(<Toast message="No callback" duration={1000} />);
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }).not.toThrow();
  });
});

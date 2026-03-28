import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Modal from '@/components/ui/Modal';

vi.mock('@/components/ui/Button', () => ({
  default: ({ children, ...props }) => <button {...props}>{children}</button>,
}));

describe('Modal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render when isOpen is true', () => {
    render(<Modal isOpen={true} onClose={vi.fn()} title="Test">Content</Modal>);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('should not render when isOpen is false', () => {
    render(<Modal isOpen={false} onClose={vi.fn()} title="Test">Content</Modal>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should render title', () => {
    render(<Modal isOpen={true} onClose={vi.fn()} title="My Title">C</Modal>);
    expect(screen.getByText('My Title')).toBeInTheDocument();
  });

  it('should render footer when provided', () => {
    render(<Modal isOpen={true} onClose={vi.fn()} title="T" footer={<span>Footer</span>}>C</Modal>);
    expect(screen.getByText('Footer')).toBeInTheDocument();
  });

  it('should show close button by default', () => {
    render(<Modal isOpen={true} onClose={vi.fn()} title="T">C</Modal>);
    expect(screen.getByLabelText('Close')).toBeInTheDocument();
  });

  it('should hide close button when showCloseButton is false', () => {
    render(<Modal isOpen={true} onClose={vi.fn()} title="T" showCloseButton={false}>C</Modal>);
    expect(screen.queryByLabelText('Close')).not.toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<Modal isOpen={true} onClose={onClose} title="T">C</Modal>);
    act(() => { fireEvent.click(screen.getByLabelText('Close')); });
    act(() => { vi.advanceTimersByTime(300); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(<Modal isOpen={true} onClose={onClose} title="T">C</Modal>);
    act(() => { fireEvent.keyDown(document, { key: 'Escape' }); });
    act(() => { vi.advanceTimersByTime(300); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should not call onClose on Escape when closeOnEsc is false', () => {
    const onClose = vi.fn();
    render(<Modal isOpen={true} onClose={onClose} title="T" closeOnEsc={false}>C</Modal>);
    act(() => { fireEvent.keyDown(document, { key: 'Escape' }); });
    act(() => { vi.advanceTimersByTime(500); });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('should call onClose when overlay is clicked', () => {
    const onClose = vi.fn();
    render(<Modal isOpen={true} onClose={onClose} title="T">C</Modal>);
    const overlay = screen.getByRole('dialog').parentElement;
    act(() => { fireEvent.click(overlay); });
    act(() => { vi.advanceTimersByTime(300); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should not call onClose when clicking inside the modal content', () => {
    const onClose = vi.fn();
    render(<Modal isOpen={true} onClose={onClose} title="T"><p>Inner</p></Modal>);
    act(() => { fireEvent.click(screen.getByText('Inner')); });
    act(() => { vi.advanceTimersByTime(500); });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('should not call onClose on overlay click when closeOnOverlayClick is false', () => {
    const onClose = vi.fn();
    render(<Modal isOpen={true} onClose={onClose} title="T" closeOnOverlayClick={false}>C</Modal>);
    const overlay = screen.getByRole('dialog').parentElement;
    act(() => { fireEvent.click(overlay); });
    act(() => { vi.advanceTimersByTime(500); });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('should have correct ARIA attributes', () => {
    render(<Modal isOpen={true} onClose={vi.fn()} title="T">C</Modal>);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('should render with different sizes', () => {
    const { rerender } = render(<Modal isOpen={true} onClose={vi.fn()} title="T" size="sm">C</Modal>);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    rerender(<Modal isOpen={true} onClose={vi.fn()} title="T" size="lg">C</Modal>);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

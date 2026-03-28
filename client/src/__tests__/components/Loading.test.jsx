import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Loading from '@/components/ui/Loading';

describe('Loading', () => {
  // --- Default rendering ---

  it('should render with default "Loading..." message', () => {
    render(<Loading />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should render a spinning indicator', () => {
    const { container } = render(<Loading />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).not.toBeNull();
  });

  // --- Custom message ---

  it('should render a custom message', () => {
    render(<Loading message="Fetching data..." />);
    expect(screen.getByText('Fetching data...')).toBeInTheDocument();
  });

  it('should not render message when message is empty string', () => {
    render(<Loading message="" />);
    const { container } = render(<Loading message="" />);
    const pTag = container.querySelector('p');
    expect(pTag).toBeNull();
  });

  it('should not render message when message is null', () => {
    render(<Loading message={null} />);
    // message is falsy, so the paragraph should not render
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  // --- Sizes ---

  it('should apply sm size classes', () => {
    const { container } = render(<Loading size="sm" />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner.className).toContain('h-6');
    expect(spinner.className).toContain('w-6');
    expect(spinner.className).toContain('border-2');
  });

  it('should apply md size classes by default', () => {
    const { container } = render(<Loading />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner.className).toContain('h-10');
    expect(spinner.className).toContain('w-10');
  });

  it('should apply lg size classes', () => {
    const { container } = render(<Loading size="lg" />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner.className).toContain('h-16');
    expect(spinner.className).toContain('w-16');
    expect(spinner.className).toContain('border-4');
  });

  // --- Structure ---

  it('should have a flex container with centering', () => {
    const { container } = render(<Loading />);
    const wrapper = container.firstChild;
    expect(wrapper.className).toContain('flex');
    expect(wrapper.className).toContain('flex-col');
    expect(wrapper.className).toContain('items-center');
    expect(wrapper.className).toContain('justify-center');
  });

  it('should have padding on the container', () => {
    const { container } = render(<Loading />);
    expect(container.firstChild.className).toContain('p-4');
  });

  // --- Spinner styling ---

  it('should have rounded-full class on spinner', () => {
    const { container } = render(<Loading />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner.className).toContain('rounded-full');
  });

  it('should have gold accent border color', () => {
    const { container } = render(<Loading />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner.className).toContain('border-accent-gold');
    expect(spinner.className).toContain('border-t-transparent');
  });

  // --- Message styling ---

  it('should style the message with secondary text color', () => {
    render(<Loading message="Please wait" />);
    const message = screen.getByText('Please wait');
    expect(message.className).toContain('text-text-secondary');
    expect(message.className).toContain('mt-4');
  });
});

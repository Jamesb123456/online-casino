import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Button from '@/components/ui/Button';

describe('Button', () => {
  // --- Basic rendering ---

  it('should render as a button element by default', () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole('button', { name: 'Click me' });
    expect(button).toBeInTheDocument();
    expect(button.tagName).toBe('BUTTON');
  });

  it('should render children text content', () => {
    render(<Button>Submit Order</Button>);
    expect(screen.getByText('Submit Order')).toBeInTheDocument();
  });

  it('should render children JSX content', () => {
    render(
      <Button>
        <span data-testid="inner">Icon</span> Save
      </Button>
    );
    expect(screen.getByTestId('inner')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('should have type="button" by default', () => {
    render(<Button>Click</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('should accept a custom type prop', () => {
    render(<Button type="submit">Submit</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  // --- Click handling ---

  it('should fire onClick handler when clicked', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    await user.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should not fire onClick when no handler is provided', async () => {
    const user = userEvent.setup();
    render(<Button>No handler</Button>);
    // Should not throw
    await user.click(screen.getByRole('button'));
  });

  // --- Disabled state ---

  it('should have disabled attribute when disabled', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should not fire onClick when disabled', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(
      <Button onClick={handleClick} disabled>
        Disabled
      </Button>
    );

    await user.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('should apply disabled styling classes when disabled', () => {
    render(<Button disabled>Disabled</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('opacity-50');
    expect(button.className).toContain('cursor-not-allowed');
  });

  it('should apply active styling when not disabled', () => {
    render(<Button>Active</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('cursor-pointer');
    expect(button.className).toContain('active:scale-[0.98]');
  });

  // --- Variants ---

  const allVariants = [
    'primary',
    'secondary',
    'accent',
    'danger',
    'success',
    'outline',
    'outlineAccent',
    'gradient',
    'gradientAccent',
    'subtle',
    'glass',
  ];

  it.each(allVariants)('should render variant "%s" without errors', (variant) => {
    render(<Button variant={variant}>Variant {variant}</Button>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should apply primary variant classes by default', () => {
    render(<Button>Default</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('bg-accent-gold');
  });

  it('should apply danger variant classes', () => {
    render(<Button variant="danger">Delete</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('bg-status-error');
  });

  it('should apply success variant classes', () => {
    render(<Button variant="success">Confirm</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('bg-status-success');
  });

  it('should fall back to primary classes for unknown variant', () => {
    render(<Button variant="nonexistent">Fallback</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('bg-accent-gold');
  });

  // --- Sizes ---

  const allSizes = ['xs', 'sm', 'md', 'lg', 'xl'];

  it.each(allSizes)('should render size "%s" without errors', (size) => {
    render(<Button size={size}>Size {size}</Button>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should apply xs size classes', () => {
    render(<Button size="xs">Tiny</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('py-1');
    expect(button.className).toContain('px-2');
    expect(button.className).toContain('text-xs');
  });

  it('should apply xl size classes', () => {
    render(<Button size="xl">Huge</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('py-4');
    expect(button.className).toContain('px-8');
    expect(button.className).toContain('text-xl');
  });

  it('should apply md size classes by default', () => {
    render(<Button>Medium</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('py-2');
    expect(button.className).toContain('px-4');
  });

  // --- fullWidth ---

  it('should apply w-full class when fullWidth is true', () => {
    render(<Button fullWidth>Full Width</Button>);
    expect(screen.getByRole('button').className).toContain('w-full');
  });

  it('should not apply w-full class when fullWidth is false', () => {
    render(<Button>Not Full Width</Button>);
    expect(screen.getByRole('button').className).not.toContain('w-full');
  });

  // --- glow ---

  it('should apply glow class when glow is true', () => {
    render(<Button glow>Glowing</Button>);
    expect(screen.getByRole('button').className).toContain('shadow-glow-gold');
  });

  it('should not apply glow class when glow is false', () => {
    render(<Button>No Glow</Button>);
    // The primary variant also has hover:shadow-glow-gold, but the non-hover
    // glow class is "shadow-glow-gold" without a prefix. We check that the
    // standalone glow class is absent by verifying the class string doesn't
    // have it outside of a hover context. Since the component concatenates
    // classes, we rely on the glow ternary producing an empty string.
    const button = screen.getByRole('button');
    // glow prop adds 'shadow-glow-gold' directly; primary variant has 'hover:shadow-glow-gold'
    // When glow=false, the glow ternary yields '', so 'shadow-glow-gold' only appears with 'hover:' prefix
    const classWithoutHover = button.className
      .split(/\s+/)
      .filter((c) => c === 'shadow-glow-gold');
    // glow is false, so we check primary variant doesn't accidentally add the non-hover version
    // Actually, the primary variant only adds 'hover:shadow-glow-gold', not 'shadow-glow-gold'
    expect(classWithoutHover).toHaveLength(0);
  });

  // --- Rounded ---

  const allRounded = ['none', 'sm', 'md', 'lg', 'xl', 'full'];

  it.each(allRounded)('should render rounded="%s" without errors', (rounded) => {
    render(<Button rounded={rounded}>Rounded {rounded}</Button>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should apply rounded-md by default', () => {
    render(<Button>Default Rounded</Button>);
    expect(screen.getByRole('button').className).toContain('rounded-md');
  });

  it('should apply rounded-full when rounded="full"', () => {
    render(<Button rounded="full">Pill</Button>);
    expect(screen.getByRole('button').className).toContain('rounded-full');
  });

  it('should apply rounded-none when rounded="none"', () => {
    render(<Button rounded="none">Square</Button>);
    expect(screen.getByRole('button').className).toContain('rounded-none');
  });

  // --- Custom className ---

  it('should apply custom className', () => {
    render(<Button className="my-custom-class">Custom</Button>);
    expect(screen.getByRole('button').className).toContain('my-custom-class');
  });

  // --- Accessibility ---

  it('should have focus-visible ring styles for keyboard accessibility', () => {
    render(<Button>Focusable</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('focus-visible:ring-2');
    expect(button.className).toContain('focus:outline-none');
  });

  it('should include transition classes', () => {
    render(<Button>Animated</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('transition-all');
    expect(button.className).toContain('duration-200');
  });
});

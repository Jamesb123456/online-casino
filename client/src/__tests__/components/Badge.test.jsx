import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Badge from '@/components/ui/Badge';

describe('Badge', () => {
  // --- Basic rendering ---

  it('should render with text content', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('should render as a span element', () => {
    render(<Badge>Label</Badge>);
    expect(screen.getByText('Label').tagName).toBe('SPAN');
  });

  it('should render JSX children', () => {
    render(
      <Badge>
        <strong data-testid="inner">Bold text</strong>
      </Badge>
    );
    expect(screen.getByTestId('inner')).toBeInTheDocument();
  });

  // --- Variants ---

  const allVariants = [
    'primary',
    'secondary',
    'accent',
    'success',
    'danger',
    'warning',
    'info',
    'purple',
    'dark',
    'light',
    'outline',
    'outlineAccent',
    'ghost',
    'gradient',
    'gradientAccent',
    'subtle',
  ];

  it.each(allVariants)('should render variant "%s" without errors', (variant) => {
    render(<Badge variant={variant}>Badge {variant}</Badge>);
    expect(screen.getByText(`Badge ${variant}`)).toBeInTheDocument();
  });

  it('should apply primary variant classes by default', () => {
    render(<Badge>Default</Badge>);
    const badge = screen.getByText('Default');
    expect(badge.className).toContain('bg-accent-gold/15');
    expect(badge.className).toContain('text-accent-gold');
  });

  it('should apply success variant classes', () => {
    render(<Badge variant="success">Success</Badge>);
    const badge = screen.getByText('Success');
    expect(badge.className).toContain('bg-status-success/15');
    expect(badge.className).toContain('text-status-success');
  });

  it('should apply danger variant classes', () => {
    render(<Badge variant="danger">Error</Badge>);
    const badge = screen.getByText('Error');
    expect(badge.className).toContain('bg-status-error/15');
    expect(badge.className).toContain('text-status-error');
  });

  it('should apply outline variant with border', () => {
    render(<Badge variant="outline">Outlined</Badge>);
    const badge = screen.getByText('Outlined');
    expect(badge.className).toContain('border-border-light');
    expect(badge.className).toContain('bg-transparent');
  });

  it('should apply gradient variant classes', () => {
    render(<Badge variant="gradient">Gradient</Badge>);
    const badge = screen.getByText('Gradient');
    expect(badge.className).toContain('bg-gradient-to-r');
  });

  it('should fall back to primary for unknown variant', () => {
    render(<Badge variant="nonexistent">Fallback</Badge>);
    const badge = screen.getByText('Fallback');
    expect(badge.className).toContain('bg-accent-gold/15');
  });

  // --- Sizes ---

  const allSizes = ['xs', 'sm', 'md', 'lg'];

  it.each(allSizes)('should render size "%s" without errors', (size) => {
    render(<Badge size={size}>Size {size}</Badge>);
    expect(screen.getByText(`Size ${size}`)).toBeInTheDocument();
  });

  it('should apply md size classes by default', () => {
    render(<Badge>Default size</Badge>);
    const badge = screen.getByText('Default size');
    expect(badge.className).toContain('text-sm');
    expect(badge.className).toContain('py-1');
    expect(badge.className).toContain('px-2.5');
  });

  it('should apply xs size classes', () => {
    render(<Badge size="xs">Tiny</Badge>);
    const badge = screen.getByText('Tiny');
    expect(badge.className).toContain('text-xs');
    expect(badge.className).toContain('py-0.5');
    expect(badge.className).toContain('px-1.5');
  });

  it('should apply lg size classes', () => {
    render(<Badge size="lg">Large</Badge>);
    const badge = screen.getByText('Large');
    expect(badge.className).toContain('py-1.5');
    expect(badge.className).toContain('px-3');
  });

  // --- Pill (rounded) ---

  it('should apply rounded-full when pill is true (default)', () => {
    render(<Badge>Pill</Badge>);
    expect(screen.getByText('Pill').className).toContain('rounded-full');
  });

  it('should apply rounded-md when pill is false', () => {
    render(<Badge pill={false}>Rounded</Badge>);
    const badge = screen.getByText('Rounded');
    expect(badge.className).toContain('rounded-md');
    expect(badge.className).not.toContain('rounded-full');
  });

  // --- Glow ---

  it('should apply glow class when glow is true', () => {
    render(<Badge glow>Glowing</Badge>);
    expect(screen.getByText('Glowing').className).toContain('shadow-glow-gold');
  });

  it('should not apply glow class when glow is false (default)', () => {
    render(<Badge>No glow</Badge>);
    expect(screen.getByText('No glow').className).not.toContain('shadow-glow-gold');
  });

  // --- Dot ---

  it('should render a dot indicator when dot is true', () => {
    render(<Badge dot>Dot Badge</Badge>);
    const badge = screen.getByText('Dot Badge');
    // The dot is a sibling span inside the badge
    const dotEl = badge.querySelector('span');
    expect(dotEl).not.toBeNull();
    expect(dotEl.className).toContain('rounded-full');
    expect(dotEl.className).toContain('h-2');
    expect(dotEl.className).toContain('w-2');
  });

  it('should not render a dot when dot is false (default)', () => {
    render(<Badge>No dot</Badge>);
    const badge = screen.getByText('No dot');
    const dotEl = badge.querySelector('span');
    expect(dotEl).toBeNull();
  });

  it('should apply correct dot color for success variant', () => {
    render(
      <Badge variant="success" dot>
        Success Dot
      </Badge>
    );
    const badge = screen.getByText('Success Dot');
    const dotEl = badge.querySelector('span');
    expect(dotEl.className).toContain('bg-status-success');
  });

  it('should apply correct dot color for danger variant', () => {
    render(
      <Badge variant="danger" dot>
        Danger Dot
      </Badge>
    );
    const badge = screen.getByText('Danger Dot');
    const dotEl = badge.querySelector('span');
    expect(dotEl.className).toContain('bg-status-error');
  });

  // --- Bordered ---

  it('should apply border classes when bordered is true', () => {
    render(<Badge bordered>Bordered</Badge>);
    const badge = screen.getByText('Bordered');
    expect(badge.className).toContain('border');
    expect(badge.className).toContain('border-white/10');
  });

  it('should not apply bordered classes when bordered is false (default)', () => {
    render(<Badge>Not bordered</Badge>);
    // Primary variant does not have 'border-white/10'
    expect(screen.getByText('Not bordered').className).not.toContain('border-white/10');
  });

  // --- Custom className ---

  it('should apply custom className', () => {
    render(<Badge className="my-custom-badge">Custom</Badge>);
    expect(screen.getByText('Custom').className).toContain('my-custom-badge');
  });

  // --- Base classes ---

  it('should always have inline-flex and items-center classes', () => {
    render(<Badge>Base</Badge>);
    const badge = screen.getByText('Base');
    expect(badge.className).toContain('inline-flex');
    expect(badge.className).toContain('items-center');
    expect(badge.className).toContain('justify-center');
    expect(badge.className).toContain('font-medium');
  });
});

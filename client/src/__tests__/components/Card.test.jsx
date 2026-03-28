import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Card from '@/components/ui/Card';

describe('Card', () => {
  // --- Basic rendering ---

  it('should render children content', () => {
    render(<Card>Card body content</Card>);
    expect(screen.getByText('Card body content')).toBeInTheDocument();
  });

  it('should render as a div element', () => {
    const { container } = render(<Card>Content</Card>);
    expect(container.firstChild.tagName).toBe('DIV');
  });

  it('should render JSX children', () => {
    render(
      <Card>
        <span data-testid="child">Inner element</span>
      </Card>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  // --- Title and subtitle ---

  it('should render title in header when title prop is provided', () => {
    render(<Card title="Card Title">Body</Card>);
    const heading = screen.getByText('Card Title');
    expect(heading).toBeInTheDocument();
    expect(heading.tagName).toBe('H3');
  });

  it('should render subtitle when subtitle prop is provided', () => {
    render(<Card title="Title" subtitle="Card subtitle text">Body</Card>);
    expect(screen.getByText('Card subtitle text')).toBeInTheDocument();
  });

  it('should render header section when only subtitle is provided', () => {
    render(<Card subtitle="Only subtitle">Body</Card>);
    expect(screen.getByText('Only subtitle')).toBeInTheDocument();
  });

  it('should not render header when neither title nor subtitle is provided', () => {
    const { container } = render(<Card>Body only</Card>);
    // The header has a border-b class; body div is the only child div
    const headerDiv = container.querySelector('.border-b.border-border');
    expect(headerDiv).toBeNull();
  });

  it('should render both title and subtitle together', () => {
    render(
      <Card title="Main Title" subtitle="Supporting text">
        Body
      </Card>
    );
    expect(screen.getByText('Main Title')).toBeInTheDocument();
    expect(screen.getByText('Supporting text')).toBeInTheDocument();
  });

  // --- Footer ---

  it('should render footer content when footerContent prop is provided', () => {
    render(
      <Card footerContent={<span>Footer info</span>}>
        Body
      </Card>
    );
    expect(screen.getByText('Footer info')).toBeInTheDocument();
  });

  it('should not render footer when footerContent is not provided', () => {
    const { container } = render(<Card>Body only</Card>);
    // Footer has border-t class
    const footerDiv = container.querySelector('.border-t.border-border');
    expect(footerDiv).toBeNull();
  });

  it('should render footer with JSX content', () => {
    render(
      <Card footerContent={<button data-testid="footer-btn">Action</button>}>
        Body
      </Card>
    );
    expect(screen.getByTestId('footer-btn')).toBeInTheDocument();
  });

  // --- Variants ---

  const allVariants = ['default', 'primary', 'accent', 'outlined', 'elevated', 'dark', 'glass'];

  it.each(allVariants)('should render variant "%s" without errors', (variant) => {
    render(<Card variant={variant}>Variant {variant}</Card>);
    expect(screen.getByText(`Variant ${variant}`)).toBeInTheDocument();
  });

  it('should apply default variant classes by default', () => {
    const { container } = render(<Card>Default</Card>);
    expect(container.firstChild.className).toContain('bg-bg-card');
    expect(container.firstChild.className).toContain('border-border');
  });

  it('should apply primary variant classes', () => {
    const { container } = render(<Card variant="primary">Primary</Card>);
    expect(container.firstChild.className).toContain('border-accent-gold/20');
  });

  it('should apply accent variant classes', () => {
    const { container } = render(<Card variant="accent">Accent</Card>);
    expect(container.firstChild.className).toContain('border-accent-purple/20');
  });

  it('should apply outlined variant with transparent background', () => {
    const { container } = render(<Card variant="outlined">Outlined</Card>);
    expect(container.firstChild.className).toContain('bg-transparent');
  });

  it('should apply elevated variant with shadow', () => {
    const { container } = render(<Card variant="elevated">Elevated</Card>);
    expect(container.firstChild.className).toContain('shadow-card');
  });

  it('should apply glass variant classes', () => {
    const { container } = render(<Card variant="glass">Glass</Card>);
    expect(container.firstChild.className).toContain('glass');
  });

  it('should fall back to default variant for unknown variant', () => {
    const { container } = render(<Card variant="nonexistent">Fallback</Card>);
    expect(container.firstChild.className).toContain('bg-bg-card');
  });

  // --- hoverable ---

  it('should add hover classes when hoverable is true', () => {
    const { container } = render(<Card hoverable>Hoverable</Card>);
    expect(container.firstChild.className).toContain('hover:-translate-y-0.5');
    expect(container.firstChild.className).toContain('hover:shadow-lg');
    expect(container.firstChild.className).toContain('transition-all');
  });

  it('should not add hover classes when hoverable is false', () => {
    const { container } = render(<Card>Static</Card>);
    expect(container.firstChild.className).not.toContain('hover:-translate-y-0.5');
  });

  // --- accent ---

  it('should add glow effect when accent is true', () => {
    const { container } = render(<Card accent>Accented</Card>);
    expect(container.firstChild.className).toContain('shadow-glow-gold');
  });

  it('should not add glow effect when accent is false', () => {
    const { container } = render(<Card>Normal</Card>);
    expect(container.firstChild.className).not.toContain('shadow-glow-gold');
  });

  // --- Custom className ---

  it('should apply custom className to the card container', () => {
    const { container } = render(<Card className="my-card-class">Custom</Card>);
    expect(container.firstChild.className).toContain('my-card-class');
  });

  // --- headerClassName and bodyClassName ---

  it('should apply headerClassName to the header section', () => {
    const { container } = render(
      <Card title="Title" headerClassName="custom-header">
        Body
      </Card>
    );
    const header = container.querySelector('.custom-header');
    expect(header).not.toBeNull();
  });

  it('should apply bodyClassName to the body section', () => {
    const { container } = render(
      <Card bodyClassName="custom-body">Body</Card>
    );
    const body = container.querySelector('.custom-body');
    expect(body).not.toBeNull();
  });

  // --- Structure ---

  it('should have overflow-hidden class', () => {
    const { container } = render(<Card>Content</Card>);
    expect(container.firstChild.className).toContain('overflow-hidden');
  });

  it('should render all sections in correct order: header, body, footer', () => {
    const { container } = render(
      <Card title="Header" footerContent={<span>Footer</span>}>
        Body content
      </Card>
    );
    const children = container.firstChild.children;
    // Header (with border-b), Body (with p-5), Footer (with border-t)
    expect(children.length).toBe(3);
    expect(children[0].textContent).toContain('Header');
    expect(children[1].textContent).toContain('Body content');
    expect(children[2].textContent).toContain('Footer');
  });
});

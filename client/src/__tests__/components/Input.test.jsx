import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Input from '@/components/ui/Input';

describe('Input', () => {
  // --- Basic rendering ---

  it('should render an input element', () => {
    render(<Input name="test" />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('should render with type="text" by default', () => {
    render(<Input name="test" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'text');
  });

  // --- Label ---

  it('should render a label when label prop is provided', () => {
    render(<Input name="email" label="Email Address" />);
    expect(screen.getByText('Email Address')).toBeInTheDocument();
    expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
  });

  it('should not render a label when label prop is not provided', () => {
    const { container } = render(<Input name="test" />);
    expect(container.querySelector('label')).toBeNull();
  });

  it('should associate the label with the input via htmlFor/id', () => {
    render(<Input name="username" label="Username" />);
    const label = screen.getByText('Username');
    const input = screen.getByRole('textbox');
    expect(label).toHaveAttribute('for', 'username');
    expect(input).toHaveAttribute('id', 'username');
  });

  it('should use id prop for association when provided', () => {
    render(<Input name="username" id="custom-id" label="Username" />);
    const label = screen.getByText('Username');
    const input = screen.getByRole('textbox');
    expect(label).toHaveAttribute('for', 'custom-id');
    expect(input).toHaveAttribute('id', 'custom-id');
  });

  it('should show required indicator on label when required', () => {
    render(<Input name="test" label="Required Field" required />);
    const label = screen.getByText('Required Field');
    expect(label.className).toContain('after:content-["*"]');
  });

  // --- Placeholder ---

  it('should display placeholder text', () => {
    render(<Input name="test" placeholder="Enter your name" />);
    expect(screen.getByPlaceholderText('Enter your name')).toBeInTheDocument();
  });

  // --- Value and onChange ---

  it('should display the value prop', () => {
    render(<Input name="test" value="Hello" onChange={() => {}} />);
    expect(screen.getByRole('textbox')).toHaveValue('Hello');
  });

  it('should call onChange when user types', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<Input name="test" value="" onChange={handleChange} />);

    await user.type(screen.getByRole('textbox'), 'a');
    expect(handleChange).toHaveBeenCalled();
  });

  // --- Error ---

  it('should display error message when error prop is provided', () => {
    render(<Input name="test" error="This field is required" />);
    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  it('should not display error message when error is empty', () => {
    const { container } = render(<Input name="test" error="" />);
    const errorP = container.querySelector('.text-status-error');
    expect(errorP).toBeNull();
  });

  it('should apply error border styling when error is provided', () => {
    render(<Input name="test" error="Error!" />);
    const input = screen.getByRole('textbox');
    expect(input.className).toContain('border-status-error');
  });

  it('should apply normal border styling when no error', () => {
    render(<Input name="test" />);
    const input = screen.getByRole('textbox');
    expect(input.className).toContain('border-border');
    expect(input.className).toContain('focus:border-accent-gold');
  });

  // --- Disabled state ---

  it('should be disabled when disabled prop is true', () => {
    render(<Input name="test" disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('should apply disabled styling when disabled', () => {
    render(<Input name="test" disabled />);
    const input = screen.getByRole('textbox');
    expect(input.className).toContain('cursor-not-allowed');
    expect(input.className).toContain('opacity-60');
  });

  it('should not be disabled by default', () => {
    render(<Input name="test" />);
    expect(screen.getByRole('textbox')).not.toBeDisabled();
  });

  // --- Input types ---

  it('should render as password type', () => {
    render(<Input name="pass" type="password" />);
    const input = document.querySelector('input[type="password"]');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('name', 'pass');
  });

  it('should render as email type', () => {
    render(<Input name="email" type="email" />);
    const input = document.querySelector('input[type="email"]');
    expect(input).toBeInTheDocument();
  });

  it('should render as number type', () => {
    render(<Input name="amount" type="number" />);
    expect(screen.getByRole('spinbutton')).toBeInTheDocument();
  });

  // --- autoFocus ---

  it('should have autoFocus attribute when autoFocus is true', () => {
    render(<Input name="test" autoFocus />);
    const input = screen.getByRole('textbox');
    // autoFocus causes the element to be the active element
    expect(input).toHaveFocus();
  });

  // --- Number input props ---

  it('should apply min, max, step attributes for number inputs', () => {
    render(<Input name="amount" type="number" min={0} max={100} step={5} />);
    const input = screen.getByRole('spinbutton');
    expect(input).toHaveAttribute('min', '0');
    expect(input).toHaveAttribute('max', '100');
    expect(input).toHaveAttribute('step', '5');
  });

  // --- Name attribute ---

  it('should apply name attribute to the input', () => {
    render(<Input name="my-field" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('name', 'my-field');
  });

  // --- Required attribute ---

  it('should set required attribute on the input when required', () => {
    render(<Input name="test" required />);
    expect(screen.getByRole('textbox')).toBeRequired();
  });

  // --- Custom classNames ---

  it('should apply custom className to the wrapper div', () => {
    const { container } = render(<Input name="test" className="my-wrapper" />);
    expect(container.firstChild.className).toContain('my-wrapper');
  });

  it('should apply inputClassName to the input element', () => {
    render(<Input name="test" inputClassName="my-input-class" />);
    expect(screen.getByRole('textbox').className).toContain('my-input-class');
  });

  it('should apply labelClassName to the label element', () => {
    render(<Input name="test" label="Label" labelClassName="my-label-class" />);
    expect(screen.getByText('Label').className).toContain('my-label-class');
  });

  // --- Structure ---

  it('should have a wrapper div with mb-4 class', () => {
    const { container } = render(<Input name="test" />);
    expect(container.firstChild.className).toContain('mb-4');
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ApiStatus from '@/components/ui/ApiStatus';

describe('ApiStatus', () => {
  // --- Loading state ---

  it('should render loading state when status is "loading"', () => {
    render(
      <ApiStatus status="loading">
        <p>Content</p>
      </ApiStatus>
    );
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('should render loading state when loading prop is true', () => {
    render(
      <ApiStatus loading={true}>
        <p>Content</p>
      </ApiStatus>
    );
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('should display custom loading message', () => {
    render(
      <ApiStatus status="loading" loadingMessage="Fetching users...">
        <p>Content</p>
      </ApiStatus>
    );
    expect(screen.getByText('Fetching users...')).toBeInTheDocument();
  });

  // --- Error state ---

  it('should render error state when status is "error"', () => {
    render(
      <ApiStatus status="error">
        <p>Content</p>
      </ApiStatus>
    );
    expect(screen.getByText('An error occurred. Please try again.')).toBeInTheDocument();
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('should render error state when error prop is truthy', () => {
    render(
      <ApiStatus error="Something went wrong">
        <p>Content</p>
      </ApiStatus>
    );
    expect(screen.getByText('An error occurred. Please try again.')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should display custom error message', () => {
    render(
      <ApiStatus status="error" errorMessage="Failed to load data.">
        <p>Content</p>
      </ApiStatus>
    );
    expect(screen.getByText('Failed to load data.')).toBeInTheDocument();
  });

  it('should display error detail when error is a string', () => {
    render(
      <ApiStatus error="Network timeout">
        <p>Content</p>
      </ApiStatus>
    );
    expect(screen.getByText('Network timeout')).toBeInTheDocument();
  });

  it('should not display error detail when error is not a string', () => {
    render(
      <ApiStatus error={true}>
        <p>Content</p>
      </ApiStatus>
    );
    expect(screen.getByText('An error occurred. Please try again.')).toBeInTheDocument();
    // Only the generic message should show, not "true"
    expect(screen.queryByText('true')).not.toBeInTheDocument();
  });

  it('should have error styling classes', () => {
    const { container } = render(
      <ApiStatus status="error">
        <p>Content</p>
      </ApiStatus>
    );
    const errorDiv = container.firstChild;
    expect(errorDiv.className).toContain('bg-status-error/10');
    expect(errorDiv.className).toContain('border-status-error/20');
    expect(errorDiv.className).toContain('text-status-error');
  });

  // --- Empty state ---

  it('should render empty state when status is "empty"', () => {
    render(
      <ApiStatus status="empty">
        <p>Content</p>
      </ApiStatus>
    );
    expect(screen.getByText('No data available.')).toBeInTheDocument();
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('should render empty state when isEmpty prop is true', () => {
    render(
      <ApiStatus isEmpty={true}>
        <p>Content</p>
      </ApiStatus>
    );
    expect(screen.getByText('No data available.')).toBeInTheDocument();
  });

  it('should display custom empty message', () => {
    render(
      <ApiStatus status="empty" emptyMessage="No users found.">
        <p>Content</p>
      </ApiStatus>
    );
    expect(screen.getByText('No users found.')).toBeInTheDocument();
  });

  it('should have empty state styling classes', () => {
    const { container } = render(
      <ApiStatus status="empty">
        <p>Content</p>
      </ApiStatus>
    );
    const emptyDiv = container.firstChild;
    expect(emptyDiv.className).toContain('bg-bg-surface');
    expect(emptyDiv.className).toContain('border-border');
    expect(emptyDiv.className).toContain('text-text-muted');
  });

  // --- Success / children ---

  it('should render children when no loading/error/empty state', () => {
    render(
      <ApiStatus>
        <p>Success content</p>
      </ApiStatus>
    );
    expect(screen.getByText('Success content')).toBeInTheDocument();
  });

  it('should render children when status is not a special value', () => {
    render(
      <ApiStatus status="success">
        <p>Data loaded</p>
      </ApiStatus>
    );
    expect(screen.getByText('Data loaded')).toBeInTheDocument();
  });

  it('should render children when all flags are false/undefined', () => {
    render(
      <ApiStatus loading={false} error={null} isEmpty={false}>
        <p>Visible content</p>
      </ApiStatus>
    );
    expect(screen.getByText('Visible content')).toBeInTheDocument();
  });

  // --- Priority: loading > error > empty > children ---

  it('should prioritize loading over error', () => {
    render(
      <ApiStatus status="loading" error="some error">
        <p>Content</p>
      </ApiStatus>
    );
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('An error occurred. Please try again.')).not.toBeInTheDocument();
  });

  it('should prioritize error over empty', () => {
    render(
      <ApiStatus status="error" isEmpty={true}>
        <p>Content</p>
      </ApiStatus>
    );
    expect(screen.getByText('An error occurred. Please try again.')).toBeInTheDocument();
    expect(screen.queryByText('No data available.')).not.toBeInTheDocument();
  });

  it('should prioritize empty over children', () => {
    render(
      <ApiStatus isEmpty={true}>
        <p>Should not show</p>
      </ApiStatus>
    );
    expect(screen.getByText('No data available.')).toBeInTheDocument();
    expect(screen.queryByText('Should not show')).not.toBeInTheDocument();
  });

  // --- Combined prop usage ---

  it('should support both status and boolean props for loading', () => {
    render(
      <ApiStatus loading={true} status="loading">
        <p>Content</p>
      </ApiStatus>
    );
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  // --- Rendering JSX children ---

  it('should render complex JSX children in success state', () => {
    render(
      <ApiStatus>
        <div data-testid="complex">
          <h1>Title</h1>
          <ul>
            <li>Item 1</li>
            <li>Item 2</li>
          </ul>
        </div>
      </ApiStatus>
    );
    expect(screen.getByTestId('complex')).toBeInTheDocument();
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });
});

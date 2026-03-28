import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/layouts/MainLayout', () => ({
  default: ({ children }) => <div data-testid="main-layout">{children}</div>,
}));

import NotFoundPage from '@/pages/NotFoundPage';

describe('NotFoundPage', () => {
  const renderPage = () => {
    return render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    );
  };

  it('should render 404 text', () => {
    renderPage();
    expect(screen.getByText('404')).toBeInTheDocument();
  });

  it('should render page not found heading', () => {
    renderPage();
    expect(screen.getByText(/page not found/i)).toBeInTheDocument();
  });

  it('should render descriptive message', () => {
    renderPage();
    expect(screen.getByText(/the page you are looking for does not exist/i)).toBeInTheDocument();
  });

  it('should have a link back to home', () => {
    renderPage();
    const homeLink = screen.getByRole('link', { name: /back to home/i });
    expect(homeLink).toBeInTheDocument();
    expect(homeLink).toHaveAttribute('href', '/');
  });

  it('should render in main layout', () => {
    renderPage();
    expect(screen.getByTestId('main-layout')).toBeInTheDocument();
  });
});

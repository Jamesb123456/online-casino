import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('@/components/Header', () => ({ default: () => <header data-testid="header" /> }));
vi.mock('@/components/Footer', () => ({ default: () => <footer data-testid="footer" /> }));
vi.mock('@/components/SidebarNav', () => ({ default: () => <nav data-testid="sidebar" /> }));
vi.mock('@/components/MobileBottomNav', () => ({
  default: () => <nav data-testid="mobile-nav" />,
}));
vi.mock('@/components/chat/ChatBox', () => ({ default: () => <aside data-testid="chat-box" /> }));

import MainLayout from '@/layouts/MainLayout';

describe('MainLayout', () => {
  it('renders header, sidebar, footer, mobile nav and chat box', () => {
    render(
      <MainLayout>
        <p>child content</p>
      </MainLayout>,
    );

    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('footer')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-nav')).toBeInTheDocument();
    expect(screen.getByTestId('chat-box')).toBeInTheDocument();
  });

  it('renders the skip-to-content link', () => {
    render(<MainLayout>x</MainLayout>);
    const link = screen.getByText(/Skip to main content/i);
    expect(link).toBeInTheDocument();
    expect(link.getAttribute('href')).toBe('#main-content');
  });

  it('renders children inside the main element', () => {
    render(
      <MainLayout>
        <span data-testid="kid">hi</span>
      </MainLayout>,
    );
    expect(screen.getByTestId('kid')).toBeInTheDocument();
  });
});

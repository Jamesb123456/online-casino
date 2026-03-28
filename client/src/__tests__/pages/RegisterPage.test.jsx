import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

const { mockRegister, mockNavigate, MockAuthContext } = vi.hoisted(() => {
  const { createContext } = require('react');
  return {
    mockRegister: vi.fn(),
    mockNavigate: vi.fn(),
    MockAuthContext: createContext({}),
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/contexts/AuthContext', () => ({
  AuthContext: MockAuthContext,
}));

vi.mock('@/layouts/MainLayout', () => ({
  default: ({ children }) => <div data-testid="main-layout">{children}</div>,
}));

import RegisterPage from '@/pages/RegisterPage';

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRegister.mockResolvedValue({ id: 1, username: 'testuser' });
  });

  const renderPage = () => {
    return render(
      <MockAuthContext.Provider value={{ register: mockRegister }}>
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      </MockAuthContext.Provider>
    );
  };

  it('should render registration form', () => {
    renderPage();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  });

  it('should render Create Account heading', () => {
    renderPage();
    expect(screen.getByText(/create/i)).toBeInTheDocument();
    // "Account" appears in heading and "Already have an account?" - use getAllByText
    expect(screen.getAllByText(/account/i).length).toBeGreaterThanOrEqual(1);
  });

  it('should render register button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument();
  });

  it('should render link to login page', () => {
    renderPage();
    expect(screen.getByText(/already have an account/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /login/i })).toHaveAttribute('href', '/login');
  });

  it('should show error when passwords do not match', async () => {
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/username/i), 'testuser');
    await user.type(screen.getByLabelText(/^password$/i), 'password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'different');
    await user.click(screen.getByRole('button', { name: /register/i }));

    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('should call register on valid submission', async () => {
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/username/i), 'testuser');
    await user.type(screen.getByLabelText(/^password$/i), 'password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /register/i }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        username: 'testuser',
        password: 'password123',
      });
    });
  });

  it('should render secure connection notice', () => {
    renderPage();
    expect(screen.getByText(/secure, encrypted connection/i)).toBeInTheDocument();
  });
});

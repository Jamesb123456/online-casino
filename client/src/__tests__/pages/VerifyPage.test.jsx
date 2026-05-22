import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  api: { get: mockGet, post: mockPost },
}));

vi.mock('@/layouts/MainLayout', () => ({
  default: ({ children }) => <div data-testid="main-layout">{children}</div>,
}));

import VerifyPage from '@/pages/VerifyPage';

describe('VerifyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <VerifyPage />
      </MemoryRouter>
    );

  const fillRequiredFields = async (user, overrides = {}) => {
    const values = {
      serverSeed: 'abc123serverseed',
      serverSeedHash: 'deadbeefhash',
      clientSeed: 'myclientseed',
      nonce: '7',
      ...overrides,
    };
    await user.type(screen.getByLabelText(/Server Seed$/i), values.serverSeed);
    await user.type(screen.getByLabelText(/Server Seed Hash/i), values.serverSeedHash);
    await user.type(screen.getByLabelText(/Client Seed/i), values.clientSeed);
    await user.type(screen.getByLabelText(/Nonce/i), values.nonce);
    return values;
  };

  it('should render the verification heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /Verify a Game Result/i })).toBeInTheDocument();
  });

  it('should render seed, nonce, and game type inputs', () => {
    renderPage();
    expect(screen.getByLabelText(/Server Seed$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Server Seed Hash/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Client Seed/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Nonce/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Game Type/i)).toBeInTheDocument();
  });

  it('should include crash, roulette, and generic game type options', () => {
    renderPage();
    const select = screen.getByLabelText(/Game Type/i);
    expect(select).toHaveValue('crash');
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.value);
    expect(options).toEqual(expect.arrayContaining(['crash', 'roulette', 'generic']));
  });

  it('should show a validation error when required fields are missing', async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Verify Result/i }));
    expect(screen.getByText(/please fill in all required fields/i)).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('should POST to /verify with the form payload on submit', async () => {
    mockPost.mockResolvedValue({
      valid: true,
      serverSeedHashMatch: true,
      rawResult: 0.1234567891,
      crashPoint: 2.34,
    });
    renderPage();
    const user = userEvent.setup();
    const values = await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /Verify Result/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/verify', {
        serverSeed: values.serverSeed,
        serverSeedHash: values.serverSeedHash,
        clientSeed: values.clientSeed,
        nonce: 7,
        gameType: 'crash',
      });
    });
  });

  it('should display the verification result on success', async () => {
    mockPost.mockResolvedValue({
      valid: true,
      serverSeedHashMatch: true,
      rawResult: 0.1234567891,
      crashPoint: 2.34,
    });
    renderPage();
    const user = userEvent.setup();
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /Verify Result/i }));

    await waitFor(() => {
      expect(screen.getByText(/Verification Result/i)).toBeInTheDocument();
      expect(screen.getByText(/Hash Verified - Game is Fair/i)).toBeInTheDocument();
      expect(screen.getByText('VALID')).toBeInTheDocument();
      expect(screen.getByText('2.34x')).toBeInTheDocument();
    });
  });

  it('should display an error message when the backend rejects the request', async () => {
    mockPost.mockRejectedValue(new Error('Invalid server seed'));
    renderPage();
    const user = userEvent.setup();
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /Verify Result/i }));

    await waitFor(() => {
      expect(screen.getByText(/Invalid server seed/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Verification Result/i)).not.toBeInTheDocument();
  });

  it('should fall back to a generic error message when backend throws without a message', async () => {
    mockPost.mockRejectedValue(new Error(''));
    renderPage();
    const user = userEvent.setup();
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /Verify Result/i }));

    await waitFor(() => {
      expect(screen.getByText(/verification failed/i)).toBeInTheDocument();
    });
  });

  it('should generate a client seed via the API', async () => {
    mockGet.mockResolvedValue({ clientSeed: 'generated-seed-xyz' });
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^Generate$/i }));

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/verify/generate-client-seed');
      expect(screen.getByLabelText(/Client Seed/i)).toHaveValue('generated-seed-xyz');
    });
  });
});

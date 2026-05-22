import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

const { mockGet, mockPost, mockPut, mockDelete, mockUseAuth } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
  mockDelete: vi.fn(),
  mockUseAuth: vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({
  default: () => mockUseAuth(),
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/services/api', () => ({
  default: { get: mockGet, post: mockPost, put: mockPut, delete: mockDelete },
  api: { get: mockGet, post: mockPost, put: mockPut, delete: mockDelete },
}));

vi.mock('@/components/admin/AdminLayout', () => ({
  default: ({ children }) => <div data-testid="admin-layout">{children}</div>,
}));

vi.mock('@/contexts/ToastContext', () => {
  const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };
  return { useToast: () => toast };
});

import ChatModerationPage from '@/pages/admin/ChatModerationPage';

const sampleMessages = [
  {
    id: 1,
    content: 'hello world',
    userId: 2,
    username: 'bob',
    createdAt: '2026-05-19T10:00:00.000Z',
    deletedAt: null,
  },
  {
    id: 2,
    content: 'this was bad',
    userId: 3,
    username: 'mallory',
    createdAt: '2026-05-19T11:00:00.000Z',
    deletedAt: '2026-05-19T11:01:00.000Z',
  },
];

const sampleMutes = [
  {
    id: 1,
    userId: 3,
    username: 'mallory',
    mutedUntil: '2099-12-31T23:59:59.000Z',
    reason: 'spam',
    createdAt: '2026-05-19T11:00:00.000Z',
  },
];

describe('ChatModerationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 1, username: 'admin', role: 'admin' } });
    mockGet.mockImplementation((url) => {
      if (url === '/admin/chat/messages') return Promise.resolve({ rows: sampleMessages });
      if (url === '/admin/chat/mutes') return Promise.resolve({ rows: sampleMutes });
      if (url === '/admin/chat/profanity-words') return Promise.resolve({ words: ['fuck', 'shit'] });
      return Promise.resolve({});
    });
    mockPost.mockResolvedValue({ ok: true });
    mockPut.mockResolvedValue({ words: ['fuck', 'shit', 'damn'] });
    mockDelete.mockResolvedValue({ ok: true });
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <ChatModerationPage />
      </MemoryRouter>
    );

  it('renders the four moderation sections for admins', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('chat-messages-card')).toBeInTheDocument();
    });
    expect(screen.getByTestId('chat-mutes-card')).toBeInTheDocument();
    expect(screen.getByTestId('chat-mute-form-card')).toBeInTheDocument();
    expect(screen.getByTestId('chat-profanity-card')).toBeInTheDocument();
  });

  it('loads messages, mutes, and profanity words on mount', async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/admin/chat/messages', expect.any(Object));
    });
    expect(mockGet).toHaveBeenCalledWith('/admin/chat/mutes');
    expect(mockGet).toHaveBeenCalledWith('/admin/chat/profanity-words');
  });

  it('shows the deleted chip for soft-deleted messages', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('hello world')).toBeInTheDocument();
    });
    expect(screen.getByText('deleted')).toBeInTheDocument();
  });

  it('asks for confirmation before deleting a message', async () => {
    renderPage();
    await waitFor(() => screen.getByText('hello world'));

    const deleteBtn = screen.getAllByRole('button', { name: /^Delete$/i })[0];
    fireEvent.click(deleteBtn);

    // Modal title appears
    await waitFor(() => {
      expect(screen.getByText(/Soft-delete this message/i)).toBeInTheDocument();
    });

    // No DELETE call until confirm
    expect(mockDelete).not.toHaveBeenCalled();

    const confirmBtn = screen.getByRole('button', { name: /Confirm delete/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith('/admin/chat/messages/1', expect.any(Object));
    });
  });

  it('submits a mute via POST /admin/chat/mute', async () => {
    renderPage();
    await waitFor(() => screen.getByTestId('chat-mute-form-card'));

    const userInput = screen.getByLabelText(/User ID/i);
    fireEvent.change(userInput, { target: { value: '42' } });

    // 1 hour radio
    const oneHourRadio = screen.getByLabelText(/^1 hour$/);
    fireEvent.click(oneHourRadio);

    const muteBtn = screen.getByRole('button', { name: /^Mute$/i });
    fireEvent.click(muteBtn);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/admin/chat/mute',
        expect.objectContaining({ userId: 42, durationMinutes: 60 })
      );
    });
  });

  it('hides the profanity wordlist editor for non-admin (operator) users', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 4, username: 'op', role: 'operator' } });
    renderPage();
    await waitFor(() => screen.getByTestId('chat-messages-card'));
    expect(screen.queryByTestId('chat-profanity-card')).not.toBeInTheDocument();
  });
});

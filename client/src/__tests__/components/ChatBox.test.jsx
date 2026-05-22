import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const { mockUseAuth, mockChat } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockChat: {
    connect: vi.fn().mockResolvedValue(),
    disconnect: vi.fn(),
    on: vi.fn(() => () => {}),
    sendMessage: vi.fn(),
    sendTyping: vi.fn(),
    sendStopTyping: vi.fn(),
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  default: () => mockUseAuth(),
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/services/socket/chatSocketService', () => ({
  default: mockChat,
}));

import ChatBox from '@/components/chat/ChatBox';

describe('ChatBox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChat.connect.mockResolvedValue();
    mockChat.on.mockImplementation(() => () => {});
  });

  it('renders nothing when there is no user', () => {
    mockUseAuth.mockReturnValue({ user: null });
    const { container } = render(<ChatBox />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the chat toggle button for an authenticated user', () => {
    mockUseAuth.mockReturnValue({ user: { id: 1, username: 'tester' } });
    render(<ChatBox />);
    expect(screen.getByRole('button', { name: /open chat/i })).toBeInTheDocument();
  });

  it('opens the chat panel when the toggle button is clicked', async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({ user: { id: 1, username: 'tester' } });
    render(<ChatBox />);
    await user.click(screen.getByRole('button', { name: /open chat/i }));
    expect(screen.getByText(/Global Chat/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Type a message/i)).toBeInTheDocument();
  });

  it('subscribes to the chat socket service for an authenticated user', () => {
    mockUseAuth.mockReturnValue({ user: { id: 1, username: 'tester' } });
    render(<ChatBox />);
    expect(mockChat.connect).toHaveBeenCalled();
    expect(mockChat.on).toHaveBeenCalledWith('newMessage', expect.any(Function));
  });
});

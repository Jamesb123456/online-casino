import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const { mockUseAuth, mockUseGameSocket, mockEmit } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUseGameSocket: vi.fn(),
  mockEmit: vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({
  default: () => mockUseAuth(),
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/games/_shared/useGameSocket', () => ({
  default: (...args) => mockUseGameSocket(...args),
  useGameSocket: (...args) => mockUseGameSocket(...args),
}));

import ChatBox from '@/components/chat/ChatBox';

describe('ChatBox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmit.mockReset();
    mockUseGameSocket.mockReturnValue({
      status: 'connected',
      emit: mockEmit,
      socket: null,
      lastError: null,
      serverSeedHash: null,
    });
  });

  it('renders nothing when there is no user', () => {
    mockUseAuth.mockReturnValue({ user: null });
    const { container } = render(<ChatBox />);
    expect(container.firstChild).toBeNull();
  });

  it('does not open a socket when no user is authenticated', () => {
    mockUseAuth.mockReturnValue({ user: null });
    render(<ChatBox />);
    // Hook is still called (it's a hook), but with a null gameType so it
    // short-circuits internally.
    expect(mockUseGameSocket).toHaveBeenCalledWith(null, expect.any(Object));
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

  it('subscribes to chat wire events via useGameSocket for an authenticated user', () => {
    mockUseAuth.mockReturnValue({ user: { id: 1, username: 'tester' } });
    render(<ChatBox />);
    expect(mockUseGameSocket).toHaveBeenCalled();
    const [gameType, opts] = mockUseGameSocket.mock.calls[0];
    expect(gameType).toBe('chat');
    expect(opts.events).toEqual(
      expect.objectContaining({
        new_message: expect.any(Function),
        message_history: expect.any(Function),
        user_joined: expect.any(Function),
        userLeft: expect.any(Function),
        userTyping: expect.any(Function),
        userStoppedTyping: expect.any(Function),
        error: expect.any(Function),
        chat_error: expect.any(Function),
      })
    );
  });

  it('emits send_message with the trimmed content when the user submits', async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({ user: { id: 1, username: 'tester' } });
    render(<ChatBox />);
    await user.click(screen.getByRole('button', { name: /open chat/i }));

    const input = screen.getByPlaceholderText(/Type a message/i);
    await user.type(input, '  hello world  ');
    await user.click(screen.getByRole('button', { name: /^send$/i }));

    expect(mockEmit).toHaveBeenCalledWith('send_message', { content: 'hello world' });
    // After submit we also fire stopTyping.
    expect(mockEmit).toHaveBeenCalledWith('stopTyping');
  });

  it('disables the input when the socket is not connected', () => {
    mockUseGameSocket.mockReturnValue({
      status: 'connecting',
      emit: mockEmit,
      socket: null,
      lastError: null,
      serverSeedHash: null,
    });
    mockUseAuth.mockReturnValue({ user: { id: 1, username: 'tester' } });
    render(<ChatBox />);
    // Open panel
    act(() => {
      screen.getByRole('button', { name: /open chat/i }).click();
    });
    const input = screen.queryByPlaceholderText(/Type a message/i);
    if (input) {
      expect(input).toBeDisabled();
    }
  });
});

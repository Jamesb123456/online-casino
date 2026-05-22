import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { AuthContext } from '../contexts/AuthContext';
import { useAuth } from './useAuth';

describe('useAuth hook', () => {
  it('returns the AuthContext value when wrapped in provider', () => {
    const fakeAuth = {
      user: { id: 1, username: 'alice' },
      loading: false,
      error: null,
      login: () => {},
      logout: () => {},
    };

    const wrapper = ({ children }) =>
      React.createElement(AuthContext.Provider, { value: fakeAuth }, children);

    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current).toBe(fakeAuth);
  });

  it('returns null user when provider value has null user', () => {
    const fakeAuth = { user: null, loading: false };
    const wrapper = ({ children }) =>
      React.createElement(AuthContext.Provider, { value: fakeAuth }, children);

    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.user).toBeNull();
  });

  it('throws when used outside of AuthProvider', () => {
    // No wrapper means context value is undefined (the default).
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow(/AuthProvider/);
  });
});

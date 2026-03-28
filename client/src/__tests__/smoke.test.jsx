import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('Client smoke test', () => {
  it('should pass', () => {
    expect(1 + 1).toBe(2);
  });
});

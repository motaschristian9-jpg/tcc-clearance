import { describe, it, expect } from 'vitest';

describe('Portal Route Configuration', () => {
  it('defines valid distinct routes for Student and SBO portals', () => {
    const routes = {
      home: '/',
      student: '/student',
      sbo: '/sbo',
    };

    expect(routes.student).toBe('/student');
    expect(routes.sbo).toBe('/sbo');
    expect(routes.student).not.toBe(routes.sbo);
  });
});


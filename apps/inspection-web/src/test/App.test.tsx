import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from '../App';

describe('App Component - Login View', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should show login form when user is not authenticated', () => {
    render(<App />);
    expect(screen.getByText('Sign in')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('should display login form with demo account hints', () => {
    render(<App />);
    expect(screen.getByText(/Development demo accounts/i)).toBeInTheDocument();
    expect(screen.getByText(/inspector@example.com/i)).toBeInTheDocument();
  });
});

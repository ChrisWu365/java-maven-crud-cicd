import { test, expect, type Page } from '@playwright/test';

test.describe('Inspection Application E2E Tests', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('http://localhost:5173');
  });

  test('should display login page', async ({ page }: { page: Page }) => {
    await expect(page.getByText('Sign in')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
  });

  test('should login with inspector credentials', async ({ page }: { page: Page }) => {
    await page.getByLabel('Email').fill('inspector@example.com');
    await page.getByLabel('Password').fill('Inspector123!');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText('Inspection workspace')).toBeVisible();
    await expect(page.getByText(/INSPECTOR/i)).toBeVisible();
  });

  test('should show new inspection button for inspector role', async ({ page }: { page: Page }) => {
    await page.getByLabel('Email').fill('inspector@example.com');
    await page.getByLabel('Password').fill('Inspector123!');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText('+ New inspection')).toBeVisible();
  });

  test('should not show new inspection button for viewer role', async ({ page }: { page: Page }) => {
    await page.getByLabel('Email').fill('viewer@example.com');
    await page.getByLabel('Password').fill('Viewer123!');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText('+ New inspection')).not.toBeVisible();
  });

  test('should sign out successfully', async ({ page }: { page: Page }) => {
    await page.getByLabel('Email').fill('inspector@example.com');
    await page.getByLabel('Password').fill('Inspector123!');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await page.getByRole('button', { name: 'Sign out' }).click();

    await expect(page.getByText('Sign in')).toBeVisible();
  });

  test('should display statistics on dashboard', async ({ page }: { page: Page }) => {
    await page.getByLabel('Email').fill('inspector@example.com');
    await page.getByLabel('Password').fill('Inspector123!');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText('Total inspections')).toBeVisible();
    await expect(page.getByText('Action required')).toBeVisible();
    await expect(page.getByText('Completed')).toBeVisible();
  });

  test('should show inspection list table', async ({ page }: { page: Page }) => {
    await page.getByLabel('Email').fill('inspector@example.com');
    await page.getByLabel('Password').fill('Inspector123!');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText('Recent inspections')).toBeVisible();
    await expect(page.getByText('Building / location')).toBeVisible();
    await expect(page.getByText('Status')).toBeVisible();
    await expect(page.getByText('Inspector')).toBeVisible();
  });
});

import { expect, test } from '@playwright/test';

test.describe('authentication', () => {
  test('redirects anonymous users to the login page', async ({ page }) => {
    await page.goto('/users');
    await expect(page).toHaveURL(/\/login\?redirect=/);
  });

  test('rejects wrong credentials', async ({ page }) => {
    await page.goto('/login');
    // Unknown e-mail, so the demo accounts never hit the lockout threshold.
    await page.getByLabel('E-posta').fill('nobody@enterprisepulse.dev');
    await page.getByLabel('Şifre').fill('wrong-password');
    await page.getByRole('button', { name: 'Giriş yap' }).click();
    await expect(page.getByText('Invalid email or password')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('admin signs in, sees the dashboard and returns to the requested page', async ({ page }) => {
    await page.goto('/users');
    await page.getByRole('button', { name: 'Admin' }).click();
    await page.getByRole('button', { name: 'Giriş yap' }).click();

    await expect(page).toHaveURL(/\/users$/);
    await expect(page.getByRole('heading', { name: 'Kullanıcılar' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'admin@enterprisepulse.dev' })).toBeVisible();

    await page.getByRole('link', { name: 'Gösterge Paneli' }).first().click();
    await expect(page.getByRole('heading', { name: /Hoş geldiniz/ })).toBeVisible();
  });

  test('employee cannot open role management', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Personel' }).click();
    await page.getByRole('button', { name: 'Giriş yap' }).click();
    await expect(page.getByRole('heading', { name: /Hoş geldiniz/ })).toBeVisible();

    await page.goto('/roles');
    await expect(page).toHaveURL(/\/forbidden/);
  });
});

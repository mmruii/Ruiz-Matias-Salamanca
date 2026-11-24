import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('pedido para retirar descuenta stock y aparece en el panel', async ({ page }) => {
  await page.goto('/panel-de-control');
  await page.getByLabel('Usuario', { exact: false }).fill('admin-test');
  await page.getByLabel('Clave de administrador').fill(process.env.E2E_ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Nuevo producto' })).toBeVisible();
  const name = `Pedido e2e ${Date.now()}`;
  const response = await page.request.post('/api/products', {
    data: {
      name,
      description: 'Producto para probar pedidos',
      category: 'Panadería',
      price: 1250,
      stock: 3,
    },
  });
  expect(response.status()).toBe(201);
  const product = (await response.json()).data;
  try {
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await page.goto('/productos');
    const card = page.getByRole('article').filter({ hasText: name });
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Agregar al pedido' }).click();
    await card.getByRole('button', { name: 'Agregar al pedido' }).click();
    await page.getByRole('link', { name: 'Mi pedido' }).click();
    await expect(page.getByLabel(`Cantidad de ${name}`)).toHaveValue('2');
    await page.getByLabel('Nombre', { exact: true }).fill('Cliente de prueba');
    await page.getByLabel('Teléfono', { exact: true }).fill('1123456789');
    await page.setViewportSize({ width: 320, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    const accessibility = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    let firstAttempt = true;
    await page.route('**/api/orders', async (route) => {
      if (firstAttempt && route.request().method() === 'POST') {
        firstAttempt = false;
        const sent = await route.fetch();
        expect(sent.status()).toBe(201);
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, message: 'Respuesta interrumpida' }),
        });
      } else {
        await route.continue();
      }
    });
    await page.getByRole('button', { name: 'Confirmar pedido' }).click();
    await expect(page.getByRole('button', { name: 'Reintentar confirmación' })).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'Reintentar confirmación' }).click();
    await expect(page.getByRole('heading', { name: 'Pedido confirmado' })).toBeVisible();
    const updated = await page.request.get(`/api/products/${product.id}`);
    expect((await updated.json()).data.stock).toBe(1);
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/panel-de-control');
    await page.getByLabel('Usuario', { exact: false }).fill('admin-test');
    await page.getByLabel('Clave de administrador').fill(process.env.E2E_ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Pedidos para retirar' })).toBeVisible();
    await expect(page.getByText('Cliente de prueba', { exact: false })).toBeVisible();
    await expect(page.getByText(`2 × ${name}`, { exact: false })).toBeVisible();
  } finally {
    await page.request.delete(`/api/products/${product.id}`);
  }
});

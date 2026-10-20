import { expect, test } from '@playwright/test';

test('processa uma gravação WebM do microfone pelo navegador', async ({ page }) => {
  // Use a synthetic microphone stream so this test does not depend on the
  // machine running the suite having a physical microphone attached.
  await page.addInitScript(() => {
    const AudioContextConstructor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    navigator.mediaDevices.getUserMedia = async () => {
      const context = new AudioContextConstructor();
      const oscillator = context.createOscillator();
      const destination = context.createMediaStreamDestination();
      oscillator.frequency.value = 440;
      oscillator.connect(destination);
      oscillator.start();
      return destination.stream;
    };
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Gravar pelo microfone' }).click();
  await expect(page.getByRole('button', { name: 'Parar gravação' })).toBeVisible();
  await page.waitForTimeout(12_500);
  await expect(page.getByRole('button', { name: 'Gravar pelo microfone' })).toBeVisible();

  const result = page.locator('section').filter({ hasText: 'Resultado' }).last();
  await expect(result).toContainText('resultado', { timeout: 90_000 });
  await expect(result).toContainText(/%/, { timeout: 5_000 });
  await expect(result).not.toContainText('Audio must be a readable', { timeout: 5_000 });

  const historyItem = page.locator('button.history-item').first();
  await expect(historyItem).toBeVisible({ timeout: 5_000 });
  await historyItem.click();
  const historyDialog = page.getByRole('dialog');
  await expect(historyDialog).toBeVisible();
  await expect(historyDialog).toContainText('Um momento de cuidado');
  await expect(historyDialog).toContainText(/%/);
  await page.getByRole('button', { name: 'Fechar resultado' }).click();
  await expect(historyDialog).toBeHidden();

  await page.getByRole('button', { name: 'Excluir' }).last().click();
  const deleteDialog = page.getByRole('dialog');
  await expect(deleteDialog).toBeVisible();
  await expect(deleteDialog).toContainText('Excluir este registro?');
  await page.getByRole('button', { name: 'Manter registro' }).click();
  await expect(deleteDialog).toBeHidden();
});

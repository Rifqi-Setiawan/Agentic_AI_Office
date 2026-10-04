import {test,expect} from '@playwright/test';

// Reproducible checks for the opt-in DOM route. Browser binary must be available.
test('DOM world preserves canonical topology and opens the real inspector',async({page})=>{
  await page.goto('/?officeRenderer=claude&seed=42');
  await expect(page.locator('.scene-viewport')).toHaveAttribute('data-ready','true');
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.locator('[data-agent-id]')).toHaveCount(17);
  await expect(page.locator('.debug-slot')).toHaveCount(133);
  await expect(page.locator('.debug-door')).toHaveCount(26);
  await expect(page.getByRole('navigation',{name:'Navigasi 17 ruang'}).getByRole('button')).toHaveCount(18);
  await page.getByRole('button',{name:'Fokus Z08 Dev Pods',exact:true}).click();
  await page.getByRole('button',{name:'Pilih Prism',exact:true}).click();
  await expect(page.getByTestId('agent-inspector')).toBeVisible();
  await expect(page.getByTestId('agent-inspector')).toContainText('Prism');
});

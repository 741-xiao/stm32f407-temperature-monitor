import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '../../../.tools/browser/node_modules/playwright/index.mjs';
import { expect } from '../../../.tools/browser/node_modules/playwright/test.mjs';

// API fixtures stay in the browser: these checks never insert data or control hardware.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const resources = path.join(root, 'src/main/resources');
const output = path.join(root, 'target/ui-preview');
const live = process.argv.includes('--live');
const base = 'http://127.0.0.1:8080';
const fixture = Array.from({ length: 37 }, (_, index) => ({
  id: 137 - index,
  temp: (27.4 - index * 0.12).toFixed(1),
  hum: (62.5 + Math.sin(index / 4) * 7).toFixed(1),
  light: String(830 + index * 8),
  supersonic: (31.2 + index * 0.3).toFixed(1),
  people: index % 3 === 0 ? '1' : '0',
  kongqi: String(290 + index * 4),
  ip: '192.0.2.107',
  colltime: `2026-09-15 20:${String(59 - index).padStart(2, '0')}:00`
}));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });

async function scenario(name, viewport, action) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'reduce', acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  const state = { data: fixture, fail: false, control: '0', commands: [], requests: 0 };
  page.on('pageerror', error => errors.push(error.message));
  await context.tracing.start({ screenshots: true, snapshots: true });
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== base) return route.abort();
    if (url.pathname === '/selectAllCollData') {
      state.requests += 1;
      return route.fulfill({ status: state.fail ? 500 : 200, contentType: 'application/json', body: JSON.stringify(state.fail ? { error: 'fixture failure' } : state.data) });
    }
    if (/^\/change(LED|BEEP)$/.test(url.pathname)) {
      state.commands.push(url.pathname + url.search);
      return route.fulfill({ status: 200, contentType: 'text/plain', body: state.control });
    }
    if (live) return route.continue();
    const relative = ['/', '/index'].includes(url.pathname) ? 'templates/index.html' : url.pathname === '/chart' ? 'templates/chart.html' : `static${url.pathname}`;
    const file = path.resolve(resources, relative);
    if (!file.startsWith(resources + path.sep)) return route.abort();
    try {
      const contentType = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' }[path.extname(file)] ?? 'application/octet-stream';
      return route.fulfill({ status: 200, contentType, body: await readFile(file) });
    } catch { return route.fulfill({ status: 404, body: 'Not found' }); }
  });
  try {
    await action(page, state);
    assert.deepEqual(errors, [], 'No uncaught browser errors');
    console.log(`PASS ${name}`);
    await context.tracing.stop();
  } catch (error) {
    await page.screenshot({ path: path.join(output, `${name}-failure.png`), fullPage: true });
    await context.tracing.stop({ path: path.join(output, `${name}-trace.zip`) });
    throw error;
  } finally { await context.close(); }
}

async function pause(page) {
  await page.getByRole('button', { name: '自动刷新 · 2 秒' }).click();
  await expect(page.getByRole('button', { name: '自动刷新已暂停' })).toHaveAttribute('aria-pressed', 'false');
}

try {
  await Promise.all([
    scenario('overview', { width: 1440, height: 1050 }, async (page, state) => {
      await page.goto(base);
      await expect(page.locator('#value-temp')).toHaveText('27.4');
      await expect(page.locator('#note-temp')).toHaveText('温度超过 26 ℃');
      await expect(page.locator('#page-number')).toHaveText('1 / 4');
      await page.screenshot({ path: path.join(output, 'overview-desktop.png'), fullPage: true });
      await pause(page);
      await page.getByRole('button', { name: '下一页' }).click();
      await expect(page.locator('#page-summary')).toContainText('11–20');
      await page.getByRole('searchbox', { name: '搜索采集记录' }).fill('137');
      await expect(page.locator('#page-summary')).toContainText('共 1 条匹配记录');
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: '导出 CSV' }).click();
      const download = await downloadPromise;
      const csvPath = path.join(output, 'filtered-export.csv');
      await download.saveAs(csvPath);
      const csv = await readFile(csvPath, 'utf8');
      assert.equal(csv.split('\r\n').length, 2);
      assert.ok(csv.includes('"137"'));
      await page.getByRole('searchbox').fill('no-match');
      await expect(page.getByText('没有找到匹配的记录')).toBeVisible();
      await expect(page.getByRole('button', { name: '导出 CSV' })).toBeDisabled();
      await page.getByRole('searchbox').fill('');
      await page.getByRole('combobox', { name: '趋势记录范围' }).selectOption('60');
      await page.getByRole('button', { name: '湿度', exact: true }).click();
      const series = await page.locator('#main-chart').evaluate(element => window.echarts.getInstanceByDom(element).getOption().series[0]);
      assert.equal(series.name, '湿度');
      assert.equal(series.data.length, 37);
      await page.getByRole('button', { name: '开启指示灯' }).click();
      await expect(page.getByRole('status')).toContainText('设备未连接');
      state.control = '1';
      await page.getByRole('button', { name: '关闭蜂鸣器' }).click();
      await expect(page.getByRole('status')).toContainText('蜂鸣器关闭指令已发送');
      assert.deepEqual(state.commands, ['/changeLED?status=true', '/changeBEEP?status=false']);
      state.fail = true;
      await page.getByRole('button', { name: '立即刷新' }).click();
      await expect(page.getByRole('alert')).toContainText('当前展示上次成功读取的记录');
      await expect(page.locator('#value-temp')).toHaveText('27.4');
      state.fail = false;
      state.data = [{ ...fixture[0], ip: '<img src=x onerror=alert(1)>' }];
      await page.getByRole('button', { name: '重新加载' }).click();
      await expect(page.getByRole('cell', { name: '<img src=x onerror=alert(1)>', exact: true })).toBeVisible();
      assert.equal(await page.locator('#rows img').count(), 0);
    }),
    scenario('history', { width: 1440, height: 1050 }, async (page, state) => {
      state.data = [fixture[0]];
      await page.goto(`${base}/chart`);
      await expect(page.locator('#history-count')).toHaveText('1');
      await expect(page.locator('#history-max-temp')).toHaveText('27.4');
      await pause(page);
      for (const key of ['temp', 'hum', 'light', 'kongqi', 'supersonic', 'people']) {
        await expect(page.locator(`#empty-${key}`)).toBeHidden();
        const data = await page.locator(`#chart-${key}`).evaluate(element => window.echarts.getInstanceByDom(element).getOption().series[0].data);
        assert.equal(data.length, 1);
        assert.equal(data[0], Number(fixture[0][key]));
      }
      state.data = fixture;
      await page.getByRole('button', { name: '立即刷新' }).click();
      await expect(page.locator('#history-count')).toHaveText('30');
      await page.getByRole('combobox', { name: '历史记录范围' }).selectOption('60');
      await expect(page.locator('#history-count')).toHaveText('37');
      await page.screenshot({ path: path.join(output, 'history-desktop.png'), fullPage: true });
      state.data = [{ ...fixture[0], temp: '', hum: null }];
      await page.getByRole('button', { name: '立即刷新' }).click();
      await expect(page.locator('#history-max-temp')).toHaveText('--');
      await expect(page.locator('#history-avg-hum')).toHaveText('--');
      await expect(page.locator('#empty-temp')).toBeVisible();
    }),
    scenario('empty-and-mobile', { width: 390, height: 844 }, async (page, state) => {
      state.data = [];
      await page.goto(base);
      await expect(page.locator('#records-empty-title')).toHaveText('暂无采集记录');
      await expect(page.locator('#value-temp')).toHaveText('--');
      await expect(page.getByRole('button', { name: '导出 CSV' })).toBeDisabled();
      await page.screenshot({ path: path.join(output, 'overview-mobile-empty.png'), fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'No horizontal page overflow on mobile');
      await pause(page);
      state.data = fixture;
      await page.getByRole('button', { name: '立即刷新' }).click();
      await expect(page.locator('#value-temp')).toHaveText('27.4');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: path.join(output, 'overview-mobile.png'), fullPage: true });
      await page.getByRole('link', { name: '历史曲线', exact: true }).click();
      await expect(page.locator('#history-count')).toHaveText('30');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: path.join(output, 'history-mobile.png'), fullPage: true });
      state.fail = true;
      await page.reload();
      await expect(page.getByRole('alert')).toContainText('暂时无法读取采集数据');
    })
  ]);
} finally { await browser.close(); }
console.log(`All dashboard checks passed (${live ? 'running Spring Boot pages' : 'source templates'}). Screenshots: ${output}`);

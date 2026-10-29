/* Run against an empty isolated test DB, HTTP 18080 and TCP 15107. */
const { chromium } = require('../.tools/browser/node_modules/playwright');
const assert = require('node:assert/strict');
const net = require('node:net');
const fs = require('node:fs/promises');
const path = require('node:path');

const base = process.env.SHT30_TEST_URL || 'http://127.0.0.1:18080';
const port = Number(process.env.SHT30_TEST_TCP || 15107);
const artifacts = path.resolve(__dirname, '../huiningLi/WebServer/target/sht30-e2e');

async function until(check, description) {
  const deadline = Date.now() + 20000;
  do {
    try { if (await check()) return; } catch (error) { /* service may be starting */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  } while (Date.now() < deadline);
  throw new Error(`Timed out: ${description}`);
}

(async () => {
  await fs.mkdir(artifacts, { recursive: true });
  await until(async () => (await fetch(`${base}/selectAllCollData`)).ok, 'HTTP API');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, acceptDownloads: true });
  await context.tracing.start({ screenshots: true, snapshots: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const socket = net.createConnection({ host: '127.0.0.1', port });
  await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('error', reject); });
  const rows = async () => (await fetch(`${base}/selectAllCollData`)).json();
  try {
    assert.equal((await rows()).length, 0, 'Use an empty test database');
    await page.goto(base);
    await page.getByText('暂无采集记录', { exact: true }).last().waitFor();
    assert.deepEqual(await page.getByRole('columnheader').allTextContents(),
      ['编号', '温度 / ℃', '湿度 / %RH', '报警阈值 / ℃', '采集时报警', '设备 IP', '采集时间']);
    assert.match(await page.locator('.profile').innerText(), /肖肃[\s\S]*202440700102/);
    socket.write('SHT30,27.50,');
    assert.equal((await rows()).length, 0);
    socket.write('60.00,26.00,1\r\nSHT30,25.00,58.50,26.00,0\r\n');
    await until(async () => (await rows()).length === 2, 'TCP → database');
    await until(async () => await page.locator('#rows tr').count() === 2, 'automatic table refresh');
    assert.equal(await page.locator('#value-temp').innerText(), '25');
    assert.equal(await page.locator('#value-alarm').innerText(), '报警关闭');
    socket.write('bad frame\r\nSHT30,NaN,50,26,0\r\nSHT30,28.00,50.00,28.00,1\r\n');
    await until(async () => (await rows()).length === 3, 'invalid frame rejection and changed threshold');
    await until(async () => await page.locator('#value-threshold').innerText() === '28 ℃', 'threshold synchronization');
    assert.equal(await page.locator('#value-alarm').innerText(), '报警开启');
    await page.screenshot({ path: path.join(artifacts, 'overview.png'), fullPage: true });
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出 CSV' }).click();
    const download = await downloadPromise;
    await download.saveAs(path.join(artifacts, 'samples.csv'));
    const csv = await fs.readFile(path.join(artifacts, 'samples.csv'), 'utf8');
    assert.match(csv, /肖肃/);
    assert.match(csv, /202440700102/);
    assert.match(csv, /报警阈值/);
    assert(!/光照|测距|空气质量|人体感应/.test(csv));
    await page.getByRole('searchbox', { name: '搜索采集记录' }).fill('no-match');
    await page.getByText('没有找到匹配的记录', { exact: true }).waitFor();
    await page.getByRole('searchbox', { name: '搜索采集记录' }).fill('');
    await page.route('**/selectAllCollData', route => route.fulfill({ status: 503, body: 'unavailable' }));
    await page.getByRole('button', { name: '立即刷新' }).click();
    await page.getByRole('alert').waitFor();
    assert.equal(await page.locator('#rows tr').count(), 3, 'retain last good rows on network failure');
    await page.unroute('**/selectAllCollData');
    await page.getByRole('button', { name: '重新加载' }).click();
    await page.getByRole('alert').waitFor({ state: 'hidden' });
    await page.getByRole('link', { name: '历史曲线', exact: true }).click();
    await until(async () => await page.locator('#history-count').innerText() === '3', 'history records');
    assert.equal(await page.locator('.history-chart').count(), 2);
    await page.screenshot({ path: path.join(artifacts, 'history.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base);
    await until(async () => await page.locator('#rows tr').count() === 3, 'mobile records');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.screenshot({ path: path.join(artifacts, 'mobile.png'), fullPage: true });
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(artifacts, 'result.json'), JSON.stringify({ passed: true, rows: await rows(), browserErrors: errors }, null, 2));
    console.log('PASS: real TCP → MySQL → API → Chinese desktop/mobile list, auto refresh, alarm threshold, CSV, search, error recovery and history.');
  } finally {
    socket.end();
    await context.tracing.stop({ path: path.join(artifacts, 'trace.zip') });
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

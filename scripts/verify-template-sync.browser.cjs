// Isolated browser regression: build first; all external requests are mocked.
// PLAYWRIGHT_MODULE can point to the bundled Playwright package (no install needed).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '../dist/price/browser');
const files = new Map();
const owner = 'browser-synthetic-owner';
let templateFailure = false;
let templateRequests = 0;
const errors = [];
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + pathname);
  if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403).end(); return; }
  const target = fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(root, 'index.html');
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
  res.setHeader('Content-Type', types[path.extname(target)] || 'application/octet-stream');
  fs.createReadStream(target).pipe(res);
});

async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE || chromium.executablePath() });
  try {
    async function waitStatus(page, text) {
      await page.waitForFunction(expected => {
        const nodes = document.querySelectorAll('app-cloud-sync-status');
        return nodes.length === 1 && nodes[0].textContent?.includes(expected);
      }, text);
      const status = page.locator('app-cloud-sync-status');
      assert.equal(await status.count(), 1, 'only one aggregate sync status is rendered');
      assert.ok(!(await status.innerText()).includes('報價：'), 'no quotation sub-status label');
      assert.ok(!(await status.innerText()).includes('常用客戶與項目：'), 'no template sub-status label');
      if (['已同步', '等待同步', '本機儲存'].includes(text)) {
        assert.equal(await page.getByRole('button', { name: '重試同步', exact: true }).count(), 0, 'normal and waiting states have no manual retry');
      }
    }
    async function device() {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
      await context.addInitScript(() => {
        if (!localStorage.getItem('synthetic-initialized')) {
          localStorage.setItem('refresh_token', 'synthetic-refresh');
          localStorage.setItem('synthetic-initialized', 'true');
        }
      });
      await context.route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
        const json = value => route.fulfill({ json: value });
        if (url.pathname.endsWith('/api/auth/refresh')) return json({ accessToken: 'synthetic-session', refreshToken: 'synthetic-refresh', expiresIn: 3600 });
        if (url.pathname.endsWith('/user/me')) return json({ user: { id: owner, email: 'browser@example.test', displayName: '合成測試會員' }, profiles: { quotation: { role: 'premium' } } });
        if (url.pathname.endsWith('/api/drive-auth/token')) return json({ accessToken: 'synthetic-drive', ownerId: owner, email: 'browser@example.test', expiresIn: 3600 });
        if (url.hostname === 'www.googleapis.com') {
          if (request.method() === 'POST') {
            const parts = request.postData().split(/--price-quotation-templates-[^\r\n]+/);
            const documents = parts.filter(part => part.includes('Content-Type: application/json')).map(part => JSON.parse(part.slice(part.indexOf('\r\n\r\n') + 4).trim()));
            assert.equal(documents.length, 2, 'template multipart metadata and body');
            const [metadata, operation] = documents;
            assert.equal(metadata.appProperties.app, 'price-quotation-templates');
            assert.equal(operation.ownerSub, owner);
            const id = `synthetic-file-${files.size + 1}`;
            files.set(id, { metadata, operation });
            return json({ id, ...metadata });
          }
          if (url.searchParams.get('alt') === 'media') {
            const id = url.pathname.split('/').at(-1);
            assert.ok(files.has(id));
            return json(files.get(id).operation);
          }
          const q = url.searchParams.get('q') || '';
          if (!q.includes("value='price-quotation-templates'")) return json({ files: [] });
          templateRequests++;
          if (templateFailure) return route.fulfill({ status: 503, json: { error: { message: 'Synthetic unavailable' } } });
          const operationId = q.match(/key='operationId' and value='([^']+)'/)?.[1];
          return json({ files: [...files].filter(([, file]) => !operationId || file.operation.operationId === operationId).map(([id, file]) => ({ id, ...file.metadata })) });
        }
        // Never send API requests to the project's configured production service.
        if (url.origin === origin && !url.pathname.startsWith('/api/')) return route.continue();
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(origin);
      await waitStatus(page, '已同步');
      return { context, page };
    }
    const a = await device();
    const b = await device();
    await a.page.locator('[formcontrolname="customerCompany"]').fill('合成跨裝置公司');
    await a.page.getByTitle('將目前填寫的客戶資料儲存為常用客戶', { exact: true }).click();
    await waitStatus(a.page, '已同步');
    await a.page.waitForFunction(() => {
      const store = JSON.parse(localStorage.getItem('quotation:templates:user:browser-synthetic-owner:v2'));
      return store?.operations.length > 0 && store.pendingIds.length === 0;
    });
    await b.page.evaluate(() => window.dispatchEvent(new Event('online')));
    await waitStatus(b.page, '已同步');
    await b.page.locator('summary[aria-label="常用客戶"]').click();
    await b.page.getByRole('button', { name: '合成跨裝置公司', exact: true }).click();
    await b.page.getByRole('button', { name: '套用選取的常用客戶', exact: true }).click();
    assert.equal(await b.page.locator('[formcontrolname="customerCompany"]').inputValue(), '合成跨裝置公司');

    b.page.once('dialog', dialog => dialog.accept('合成重新命名'));
    await b.page.getByRole('button', { name: '重新命名選取的常用客戶', exact: true }).click();
    await b.page.waitForFunction(() => {
      const store = JSON.parse(localStorage.getItem('quotation:templates:user:browser-synthetic-owner:v2'));
      return store.operations.some(op => op.value?.name === '合成重新命名') && store.pendingIds.length === 0;
    });
    await a.page.evaluate(() => window.dispatchEvent(new Event('online')));
    await waitStatus(a.page, '已同步');
    await a.page.locator('summary[aria-label="常用客戶"]').click();
    await a.page.getByRole('button', { name: '合成重新命名', exact: true }).click();

    templateFailure = true;
    await a.page.evaluate(() => window.dispatchEvent(new Event('online')));
    await waitStatus(a.page, '同步失敗');
    assert.ok(!(await a.page.locator('app-cloud-sync-status').innerText()).includes('已同步'), 'aggregate failure cannot claim synced');
    templateFailure = false;
    await a.page.getByRole('button', { name: '重試同步', exact: true }).click();
    await waitStatus(a.page, '已同步');

    // Both devices edit the version they saw while synchronization is disabled.
    for (const { page } of [a, b]) {
      await page.getByRole('checkbox', { name: '切換本機或雲端儲存', exact: true }).uncheck();
      await waitStatus(page, '本機儲存');
    }
    a.page.once('dialog', dialog => dialog.accept('合成分支 A'));
    await a.page.getByRole('button', { name: '重新命名選取的常用客戶', exact: true }).click();
    b.page.once('dialog', dialog => dialog.accept('合成分支 B'));
    await b.page.getByRole('button', { name: '重新命名選取的常用客戶', exact: true }).click();
    for (const { page } of [a, b]) {
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('quotation:templates:user:browser-synthetic-owner:v2')).pendingIds.length > 0);
    }
    await a.page.getByRole('checkbox', { name: '切換本機或雲端儲存', exact: true }).click();
    await waitStatus(a.page, '已同步');
    await b.page.getByRole('checkbox', { name: '切換本機或雲端儲存', exact: true }).click();
    await waitStatus(b.page, '有衝突');
    await b.page.getByRole('button', { name: '保留所有未刪除版本為不同資料', exact: true }).click();
    await waitStatus(b.page, '已同步');
    await a.page.evaluate(() => window.dispatchEvent(new Event('online')));
    await waitStatus(a.page, '已同步');
    await a.page.locator('summary[aria-label="常用客戶"]').click();
    await a.page.getByRole('button', { name: '合成分支 B', exact: true }).waitFor();
    await a.page.getByRole('button', { name: '合成分支 A', exact: true }).click();
    const beforeDelete = await a.page.evaluate(() =>
      JSON.parse(localStorage.getItem('quotation:templates:user:browser-synthetic-owner:v2')).operations.length
    );
    await a.page.getByRole('button', { name: '刪除選取的常用客戶', exact: true }).click();
    await a.page.getByRole('dialog').getByRole('button', { name: '刪除', exact: true }).click();
    await a.page.waitForFunction(before => {
      const envelope = JSON.parse(localStorage.getItem('quotation:templates:user:browser-synthetic-owner:v2'));
      return envelope?.operations.length > before && envelope.pendingIds.length === 0;
    }, beforeDelete);
    await waitStatus(a.page, '已同步');
    await b.page.evaluate(() => window.dispatchEvent(new Event('online')));
    await waitStatus(b.page, '已同步');
    await b.page.locator('summary[aria-label="常用客戶"]').click();
    await b.page.getByRole('button', { name: '合成分支 B', exact: true }).waitFor();
    assert.equal(await b.page.getByRole('button', { name: '合成分支 A', exact: true }).count(), 0, 'deletion propagated');

    await a.page.getByRole('checkbox', { name: '切換本機或雲端儲存', exact: true }).uncheck();
    await waitStatus(a.page, '本機儲存');
    const before = templateRequests;
    await a.page.evaluate(() => window.dispatchEvent(new Event('online')));
    assert.equal(templateRequests, before, 'disabled sync sends no template requests');
    await a.page.getByRole('checkbox', { name: '切換本機或雲端儲存', exact: true }).click();
    await waitStatus(a.page, '已同步');
    await a.page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await a.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'mobile has no horizontal overflow');
    await a.page.screenshot({ path: '/tmp/price-template-sync-mobile.png', fullPage: false });
    assert.deepEqual(errors, [], 'no browser runtime errors');
    console.log(JSON.stringify({ passed: true, logicalOperations: files.size, templateRequests, checks: ['two isolated devices', 'create/search/apply', 'rename', 'one aggregate status', 'automatic background sync', 'retry only on failure', 'offline concurrent edits', 'keep both conflict resolution', 'delete propagation', 'disable guards', 'mobile layout', 'no runtime errors'] }));
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());

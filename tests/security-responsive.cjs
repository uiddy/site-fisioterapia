const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright-core');

const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const output = path.join(root, 'test-results');
const html = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg' };
const report = { viewports: [], checks: [], accessibility: [], errors: [] };
fs.mkdirSync(output, { recursive: true });

// Servidor de teste apenas local, sem acesso aos arquivos de configuração.
const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const filename = pathname === '/' ? 'index.html' : pathname.slice(1);
    const file = path.resolve(publicDir, filename);
    if (path.dirname(file) !== publicDir || !mime[path.extname(file)] || !fs.existsSync(file)) {
        res.writeHead(404).end();
        return;
    }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)], 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
});

async function checkAccessibility(page, label) {
    await page.evaluate(fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'));
    const violations = await page.evaluate(async () => (await axe.run(document, {
        // O CSS já foi carregado pelo navegador; evita fetch adicional do axe
        // para folhas externas, que a CSP do site bloqueia intencionalmente.
        preload: false,
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] }
    })).violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ html: n.html, summary: n.failureSummary })) })));
    report.accessibility.push({ label, violations });
    assert.deepEqual(violations, [], `Acessibilidade: ${label}`);
}

async function main() {
    assert(!/cdn\.tailwindcss\.com/.test(html), 'Estilos devem funcionar sem executar o CDN');
    assert(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), 'Sem JavaScript inline');
    assert(!/\son\w+\s*=/i.test(html), 'Sem handlers inline');
    assert(!/unsafe-inline|unsafe-eval/.test(html), 'CSP sem permissões inseguras');
    assert(/script-src 'self'/.test(html) && /object-src 'none'/.test(html));
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    assert.equal(ids.length, new Set(ids).size, 'IDs únicos');
    for (const match of html.matchAll(/href="#([^"]+)"/g)) assert(ids.includes(match[1]), `Âncora ${match[1]}`);
    for (const match of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) {
        assert(/rel="[^"]*noopener/.test(match[0]) && /rel="[^"]*noreferrer/.test(match[0]), 'Links externos protegidos');
    }
    assert(/all\.min\.css" integrity="sha512-/.test(html), 'Integridade dos ícones');
    report.checks.push('CSP, integridade, links externos, IDs e âncoras');

    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}/`;
    const browser = process.env.CHROME_CDP_URL
        ? await chromium.connectOverCDP(process.env.CHROME_CDP_URL)
        : await chromium.launch({ executablePath: process.env.BROWSER_PATH || '/usr/bin/google-chrome', headless: true });
    try {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
        const page = await context.newPage();
        page.on('pageerror', error => report.errors.push(error.message));
        page.on('console', msg => { if (msg.type() === 'error') report.errors.push(msg.text()); });
        await page.goto(url, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        assert.equal(await page.locator('.image-zoom').count(), 5);

        const sizes = [[320,568],[360,640],[375,667],[390,844],[412,915],[568,320],[640,360],[768,1024],[820,1180],[1024,768],[1280,800],[1440,900],[1920,1080],[2560,1440]];
        for (const [width, height] of sizes) {
            await page.setViewportSize({ width, height });
            await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
            const overflow = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(el => {
                if (el.closest('dialog') || el.classList.contains('shape-blob') || el.classList.contains('sr-only')) return false;
                const rect = el.getBoundingClientRect();
                const style = getComputedStyle(el);
                const exceedsViewport = rect.left < -1 || rect.right > innerWidth + 1;
                const clipsText = el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 2 && !['hidden', 'clip'].includes(style.overflowX) && style.display !== 'inline';
                return rect.width > 0 && (exceedsViewport || clipsText);
            }).map(el => ({ tag: el.tagName, text: el.textContent.trim().slice(0,60), class: el.className })));
            report.viewports.push({ width, height, overflow });
            assert.deepEqual(overflow, [], `Conteúdo fora da tela em ${width}×${height}`);
            const menuButton = page.locator('#mobile-menu-btn');
            assert.equal(await menuButton.isVisible(), width < 1280);
            if (width < 1280) {
                await menuButton.click();
                assert.equal(await menuButton.getAttribute('aria-expanded'), 'true');
                const menu = await page.locator('#mobile-menu').boundingBox();
                assert(menu.y + menu.height <= height + 1, `Menu cortado em ${width}×${height}`);
                await page.locator('#mobile-menu a').last().scrollIntoViewIfNeeded();
                await page.keyboard.press('Escape');
                assert.equal(await menuButton.getAttribute('aria-expanded'), 'false');
                assert(await menuButton.evaluate(el => el === document.activeElement));
            }
        }
        report.checks.push('14 dimensões, incluindo celulares em paisagem; menu com Esc, foco e rolagem');

        // Os menus devem levar às seções sem esconder seu conteúdo sob o cabeçalho fixo.
        const sections = ['inicio', 'tratamentos', 'sobre', 'profissional', 'depoimentos', 'horarios', 'duvidas', 'contato'];
        await page.emulateMedia({ reducedMotion: 'reduce' });
        for (const width of [320, 1440]) {
            await page.setViewportSize({ width, height: 900 });
            const navigation = page.locator(width < 1280 ? '#mobile-menu' : '.desktop-navigation');
            assert.deepEqual(await navigation.locator('a[href^="#"]').evaluateAll(links => links.map(link => link.hash.slice(1))), sections);
            for (const id of sections) {
                if (width < 1280) await page.locator('#mobile-menu-btn').click();
                await navigation.locator(`a[href="#${id}"]`).click();
                assert.equal(new URL(page.url()).hash, `#${id}`);
                if (id !== 'inicio') {
                    const section = await page.locator(`#${id}`).boundingBox();
                    const header = await page.locator('#navbar').boundingBox();
                    assert(section.y >= header.y + header.height - 1, `Seção ${id} escondida pelo cabeçalho em ${width}px`);
                }
            }
        }
        const firstQuestion = page.locator('#duvidas summary').first();
        await firstQuestion.focus();
        await page.keyboard.press('Enter');
        assert(await firstQuestion.evaluate(el => el.parentElement.open), 'FAQ abre pelo teclado');
        await checkAccessibility(page, 'pergunta frequente aberta');
        await page.keyboard.press('Enter');
        assert(!(await firstQuestion.evaluate(el => el.parentElement.open)), 'FAQ fecha pelo teclado');
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        report.checks.push('Oito seções acessíveis pelos menus mobile e desktop; FAQ operável por teclado');

        await page.setViewportSize({ width: 320, height: 568 });
        await checkAccessibility(page, 'mobile 320px');
        await page.locator('#mobile-menu-btn').click();
        await checkAccessibility(page, 'menu mobile aberto');
        await page.locator('#mobile-menu a[href="#sobre"]').click();
        assert.equal(await page.locator('#mobile-menu-btn').getAttribute('aria-expanded'), 'false');
        await page.locator('#mobile-menu-btn').click();
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.waitForFunction(() => document.querySelector('#mobile-menu-btn').getAttribute('aria-expanded') === 'false');
        await checkAccessibility(page, 'desktop 1440px');

        const normalColor = await page.locator('.appointment-button').evaluate(el => getComputedStyle(el).backgroundColor);
        const headerColor = await page.locator('#navbar a[href^="https:"]').first().evaluate(el => getComputedStyle(el).backgroundColor);
        assert.equal(normalColor, headerColor, 'Mesmo verde nos dois botões');
        await page.locator('.appointment-button').hover();
        await page.waitForTimeout(250);
        await checkAccessibility(page, 'botão de avaliação em hover');

        await page.setViewportSize({ width: 320, height: 568 });
        for (let i = 0; i < 5; i++) {
            const trigger = page.locator('.image-zoom').nth(i);
            await trigger.click();
            await page.waitForFunction(() => { const img = document.querySelector('#image-viewer-photo'); return img.complete && img.naturalWidth > 0; });
            assert(await page.locator('#image-viewer').isVisible());
            assert.equal(await page.locator('#image-viewer-caption').isVisible(), i === 0);
            if (i === 0) {
                assert.match(await page.locator('#image-viewer-caption').innerText(), /CREFITO: 202965-F/);
                await checkAccessibility(page, 'foto ampliada');
            }
            const bounds = await page.locator('#image-viewer-photo').boundingBox();
            assert(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 321 && bounds.y + bounds.height <= 569, 'Foto ampliada cabe na tela');
            await page.keyboard.press('Tab');
            assert(await page.evaluate(() => document.activeElement.closest('dialog') !== null), 'Foco permanece no modal');
            if (i % 3 === 0) await page.keyboard.press('Escape');
            else if (i % 3 === 1) await page.locator('.image-viewer-close').click();
            else await page.mouse.click(2, 100);
            await page.waitForFunction(() => !document.querySelector('#image-viewer').open && document.body.style.overflow !== 'hidden');
            assert(await trigger.evaluate(el => el === document.activeElement), 'Foco retorna à foto');
        }
        report.checks.push('Cinco fotos, imagens carregadas, legenda somente na fisioterapeuta, Esc/botão/clique externo, foco e rolagem');

        // Conteúdo de legenda é tratado como texto, sem interpretar HTML.
        await page.locator('#inicio figcaption').evaluate(el => { el.dataset.original = el.textContent; el.textContent = '<img src=x onerror="window.captionInjected=true">'; });
        await page.locator('.image-zoom').first().click();
        assert.equal(await page.locator('#image-viewer-caption img').count(), 0);
        assert.equal(await page.evaluate(() => window.captionInjected === true), false);
        await page.keyboard.press('Escape');
        await page.locator('#inicio figcaption').evaluate(el => { el.textContent = el.dataset.original; });
        report.checks.push('Legenda não interpreta HTML');

        await page.emulateMedia({ reducedMotion: 'reduce' });
        assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior), 'auto');
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.evaluate(() => scrollTo({top:0,behavior:'instant'}));
        await page.screenshot({ path: path.join(output, 'mobile.png'), fullPage: true });
        await page.screenshot({ path: path.join(output, 'mobile-top.png') });
        for (const id of ['beneficios', 'tratamentos', 'sobre', 'profissional', 'depoimentos', 'horarios', 'duvidas', 'contato']) {
            await page.locator(`#${id}`).screenshot({ path: path.join(output, `mobile-${id}.png`) });
        }
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.screenshot({ path: path.join(output, 'desktop.png'), fullPage: true });
        assert.deepEqual(report.errors, [], 'Sem erros de JavaScript, carregamento ou CSP no uso normal');

        // A tentativa controlada abaixo deve ser bloqueada pela CSP.
        await page.evaluate(() => {
            window.inlineScriptExecuted = false;
            const script = document.createElement('script');
            script.textContent = 'window.inlineScriptExecuted = true';
            document.head.append(script);
        });
        assert.equal(await page.evaluate(() => window.inlineScriptExecuted), false);
        assert(report.errors.some(error => /Content Security Policy|script-src/i.test(error)));
        report.errors = report.errors.filter(error => !/Content Security Policy|script-src/i.test(error));
        report.checks.push('CSP bloqueia execução de script inline injetado; movimento reduzido respeitado');
        await context.close();

        const touch = await browser.newContext({ viewport: {width:390,height:844}, isMobile:true, hasTouch:true, deviceScaleFactor:3 });
        const mobile = await touch.newPage();
        await mobile.goto(url, {waitUntil:'networkidle'});
        await mobile.locator('#mobile-menu-btn').tap();
        assert.equal(await mobile.locator('#mobile-menu-btn').getAttribute('aria-expanded'), 'true');
        await mobile.locator('#mobile-menu a[href="#inicio"]').tap();
        await mobile.locator('.image-zoom').first().tap();
        assert(await mobile.locator('#image-viewer').isVisible());
        await mobile.setViewportSize({width:844,height:390});
        const rotatedImage = await mobile.locator('#image-viewer-photo').boundingBox();
        assert(rotatedImage.y + rotatedImage.height <= 390, 'Foto cabe após rotação');
        await mobile.locator('.image-viewer-close').tap();
        assert.equal(await mobile.locator('#image-viewer').isVisible(), false);
        await touch.close();
        report.checks.push('Toque, densidade 3× e rotação do celular com a foto aberta');

        const offline = await browser.newContext();
        await offline.route('https://**/*', route => route.abort());
        const fallback = await offline.newPage();
        await fallback.goto(url, {waitUntil:'networkidle'});
        assert.equal(await fallback.locator('.image-zoom').count(), 5);
        assert.equal(await fallback.locator('#navbar').evaluate(el=>getComputedStyle(el).position), 'fixed');
        await fallback.locator('.image-zoom').first().click();
        assert(await fallback.locator('#image-viewer').isVisible());
        await offline.close();
        report.checks.push('CSS, fotos e interações funcionam com CDNs externos bloqueados');
    } finally {
        await browser.close();
    }
}

main().then(() => {
    report.passed = true;
    console.log(`PASSOU: ${report.viewports.length} tamanhos, ${report.accessibility.length} auditorias de acessibilidade e ${report.checks.length} grupos de verificações.`);
}).catch(error => {
    report.passed = false;
    report.failure = error.stack;
    console.error(error);
    process.exitCode = 1;
}).finally(() => {
    fs.writeFileSync(path.join(output, 'review.json'), JSON.stringify(report, null, 2));
    server.close();
});

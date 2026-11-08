// Loads live IDX pages, takes pictures as they are today and with test.css added on top. Saves nothing anywhere else.
const { chromium } = require('playwright');
const fs = require('fs');
const B = 'https://inhabitthetriangle.idxbroker.com';
const pages = JSON.parse(fs.readFileSync('pages.json','utf8'));
const css = fs.existsSync('test.css') ? fs.readFileSync('test.css','utf8') : '';
const dumpHtml = process.env.DUMP !== '0';
fs.mkdirSync('out', { recursive: true });
(async () => {
  const br = await chromium.launch();
  for (const [w,h,tag,mobile] of [[1280,900,'pc',false],[390,844,'ph',true]]) {
    const ctx = await br.newContext({ viewport:{width:w,height:h}, deviceScaleFactor:1, isMobile:mobile, hasTouch:mobile,
      userAgent: mobile ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' : undefined });
    for (const p of pages) {
      const pg = await ctx.newPage();
      try {
        await pg.goto(B + p.u, { waitUntil:'networkidle', timeout:60000 }).catch(()=>{});
        await pg.waitForTimeout(2500);
        if (dumpHtml && tag==='pc') fs.writeFileSync(`out/${p.n}.html`, await pg.content());
        const full = await pg.evaluate(()=>document.documentElement.scrollHeight);
        const clip = { x:0, y:0, width:w, height: Math.min(full, p.maxh || 2600) };
        await pg.screenshot({ path:`out/${p.n}-${tag}-before.png`, fullPage:true, clip });
        if (css) {
          await pg.addStyleTag({ content: css });
          await pg.waitForTimeout(800);
          const full2 = await pg.evaluate(()=>document.documentElement.scrollHeight);
          await pg.screenshot({ path:`out/${p.n}-${tag}-after.png`, fullPage:true, clip:{ x:0,y:0,width:w,height:Math.min(full2,p.maxh||2600)} });
          // measure: horizontal overflow
          const ov = await pg.evaluate(()=>document.documentElement.scrollWidth - innerWidth);
          fs.appendFileSync('out/overflow.txt', `${p.n} ${tag} overflow=${ov}\n`);
        }
      } catch(e) { fs.appendFileSync('out/errors.txt', `${p.n} ${tag} ${e}\n`); }
      await pg.close();
    }
    await ctx.close();
  }
  await br.close();
})();

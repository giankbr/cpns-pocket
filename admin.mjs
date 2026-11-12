import { chromium } from "playwright";
const b = await chromium.launch({ channel: "chrome" });
const killer = setTimeout(()=>b.close().then(()=>process.exit(1)), 110000);
const login = async (page, em, pw) => { await page.goto("https://cpns-pocket.vercel.app/login",{waitUntil:"networkidle"}); await page.fill("input[type=email]",em); await page.fill("input[type=password]",pw); await page.click("button[type=submit]"); await page.waitForURL("**/dashboard",{timeout:30000}); };
try {
  // admin
  let ctx = await b.newContext({viewport:{width:1440,height:1000}}); let page = await ctx.newPage();
  await login(page,"vakbarrr@gmail.com","Surya16#");
  console.log("admin nav 'Progress User':", (await page.evaluate(()=>document.body.innerText)).includes("Progress User"));
  await page.goto("https://cpns-pocket.vercel.app/admin",{waitUntil:"networkidle"});
  const t = await page.evaluate(()=>document.body.innerText);
  console.log("admin page shows users table:", t.includes("Progress semua pengguna"), "| sees Cantikku:", t.includes("anisamulyaningsih09@gmail.com"));
  await page.screenshot({ path: process.argv[2]+"/admin.png", fullPage:true });
  await ctx.close();
  // member
  ctx = await b.newContext({viewport:{width:1440,height:1000}}); page = await ctx.newPage();
  await login(page,"anisamulyaningsih09@gmail.com","Nisagian0902");
  console.log("member nav 'Progress User' hidden:", !(await page.evaluate(()=>document.body.innerText)).includes("Progress User"));
  await page.goto("https://cpns-pocket.vercel.app/admin",{waitUntil:"networkidle"});
  console.log("member blocked from /admin (redirected):", /\/dashboard$/.test(page.url()));
} finally { clearTimeout(killer); await b.close(); }

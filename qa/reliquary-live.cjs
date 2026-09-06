// Windows owner-GPU acceptance of real input with the new renderer active.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.GRACEFELL_URL||'http://127.0.0.1:8493/';
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-gpu','--use-angle=d3d11']});
  const receipts=[];
  try {
    for (const [width,height,touch] of [[1280,800,false],[390,844,true],[360,640,true]]) {
      const context=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch});
      const page=await context.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base,{waitUntil:'networkidle'});
      await page.waitForFunction(()=>window.__game);
      await page.waitForFunction(()=>window.__game.stateT>1);
      const target=page.locator('canvas').first();
      const prompt=await page.evaluate(()=>({x:innerWidth/2,y:window.__game.titleTextLayout().promptY}));
      if(touch) await page.touchscreen.tap(prompt.x,prompt.y);
      else await target.click({position:prompt});
      await page.waitForFunction(()=>window.__game.state==='fight',null,{timeout:12000});
      await page.waitForFunction(()=>window.__game.reliquaryReady,null,{timeout:5000});
      await page.screenshot({path:`.artifacts/reliquary/live-${width}-opening.png`});
      const before=await page.evaluate(()=>({x:window.__game.player.x,y:window.__game.player.y,t:window.__game.time}));
      if(!touch) {
        await page.keyboard.down('d');
        await page.waitForFunction(x=>window.__game.player.x>x+15,before.x);
        await page.keyboard.up('d');
        await page.keyboard.press('Space');
        await page.waitForFunction(()=>window.__game.player.state==='roll');
        await page.screenshot({path:`.artifacts/reliquary/live-${width}-roll.png`});
        await page.waitForFunction(()=>window.__game.player.state==='move');
        await page.keyboard.press('j');
        await page.waitForFunction(()=>window.__game.player.state==='light');
        await page.screenshot({path:`.artifacts/reliquary/live-${width}-attack.png`});
      } else {
        const layout=await page.evaluate(()=>window.__game.touchLayout());
        // The production control geometry is the source of input coordinates.
        receipts.push({width,layout});
        const roll=layout.btns.find(b=>b.id==='roll');
        if(!roll) throw new Error('Roll coordinate absent from touch layout');
        await page.touchscreen.tap(roll.x,roll.y);
        await page.waitForFunction(()=>window.__game.player.state==='roll');
        await page.screenshot({path:`.artifacts/reliquary/live-${width}-roll.png`});
      }
      assert.deepEqual(errors,[]);
      receipts.push({width,height,active:await page.evaluate(()=>window.__game.visualDebugState().boss.active)});
      await context.close();
    }
    fs.writeFileSync('.artifacts/reliquary/live-input-receipt.json',JSON.stringify(receipts,null,2));
    console.log(JSON.stringify(receipts,null,2));
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

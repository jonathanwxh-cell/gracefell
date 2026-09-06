// Deterministic motion audition: actual runtime models, magnified for review.
// This is not gameplay footage or a replacement combat camera.
const { chromium } = require('playwright');
const fs = require('node:fs');
const out = '.artifacts/motion';
fs.mkdirSync(out, { recursive: true });
const fps = 24, duration = 10;
(async () => {
  const browser = await chromium.launch({channel:'chrome',headless:true,args:['--enable-gpu','--use-angle=d3d11']});
  try {
    for (const [label, url] of [['before', 'https://gracefell.alyoechosys.dev/'], ['after', process.env.GRACEFELL_URL || 'http://127.0.0.1:8493/']]) {
      if (process.argv.includes('--after-only') && label === 'before') continue;
      const page = await browser.newPage({ viewport: {width:700,height:500},deviceScaleFactor:1 });
      await page.goto(url,{waitUntil:'networkidle'});
      await page.locator('canvas').first().click({position:{x:100,y:100}});
      await page.evaluate(()=>{const g=window.__game;g.paused=true;cancelAnimationFrame(g.raf);g.raf=0;});
      await page.waitForFunction(()=>{window.__game.render();return window.__game.reliquaryReady;});
      await page.evaluate(label=>{
        const canvas=document.createElement('canvas');canvas.width=700;canvas.height=500;
        canvas.id='motion-audition';canvas.style.cssText='position:fixed;inset:0;z-index:9999;background:#11151b';document.body.append(canvas);
        window.__motionLabel=label;
        window.__drawMotion=(time)=>{
          const ctx=canvas.getContext('2d'), r=window.__game.reliquary;
          const p={x:Math.max(0,Math.min(time-2,2))*220,y:0,r:15,time,facing:-.85,
            vx:time>=2&&time<4?220:0,vy:0,state:'move',t:0,moving:time>=2&&time<4,
            comboStep:0,rollDir:-.85,swordAngle:-.85,heavyCharging:false,heavyCharge:0,hurt:false};
          let action=time<2?'Breathing / guard':time<4?'Travel-driven footfalls':'Recovery';
          if(time>=4&&time<5.08){const a=time-4,step=a<.32?0:a<.64?1:2,total=step===2?.44:.32,elapsed=a-(step===2?.64:step===1?.32:0);p.state='light';p.t=total-elapsed;p.comboStep=step;p.swordAngle=p.facing+(step===1?-1:1)*(-1.05+elapsed/total*2.1);action='Alternating cuts';}
          if(time>=5.6&&time<6.72){const a=time-5.6;p.state='heavy';p.t=a<.42?.62-a:a<.92?.2:1.12-a;p.heavyCharging=a>=.42&&a<.92;p.heavyCharge=Math.max(0,a-.42);p.swordAngle=p.facing-1.25+(a<.92?0:(a-.92)/.2*2.5);action='Gather / charge / release';}
          if(time>=7.1&&time<7.52){p.state='roll';p.t=7.52-time;action='Tuck / roll / recover';}
          if(time>=8&&time<9){p.state='flask';p.t=9-time;action='Raise / drink / lower';}
          const b={x:Math.max(0,Math.min(time-2,2))*75,y:0,r:34,time,facing:.75,
            vx:time>=2&&time<4?75:0,vy:0,state:'stalk',stateRemaining:0,attack:'swipe',phase:1,
            windupProgress:0,hurtFlash:0,haloSpent:0,secondSwordDraw:0,recoil:0,recoilAng:0,techniqueImpact:null,techniqueImpactStrength:0};
          if(time>=4&&time<4.9){b.state='windup';b.windupProgress=(time-4)/.9;}
          if(time>=4.9&&time<5){b.state='strike';b.stateRemaining=5-time;}
          if(time>=5&&time<5.6){b.state='recover';b.stateRemaining=5.6-time;}
          if(time>=5.8&&time<6.9){b.state='windup';b.attack='slam';b.windupProgress=(time-5.8)/1.1;}
          if(time>=6.9&&time<6.96){b.state='strike';b.attack='slam';b.stateRemaining=6.96-time;}
          if(time>=6.96&&time<7.6){b.state='recover';b.attack='slam';b.stateRemaining=7.6-time;}
          if(time>=8){b.state='staggered';b.stateRemaining=10-time;}
          ctx.fillStyle='#11151b';ctx.fillRect(0,0,700,500);
          const grad=ctx.createRadialGradient(350,280,50,350,280,440);grad.addColorStop(0,'#28313b');grad.addColorStop(1,'#0b1015');ctx.fillStyle=grad;ctx.fillRect(0,0,700,500);
          ctx.strokeStyle='#39434a';ctx.lineWidth=1;
          for(const x of [185,510]){ctx.beginPath();ctx.ellipse(x,382,115,24,0,0,Math.PI*2);ctx.stroke();}
          ctx.save();ctx.translate(185-p.x*4,370);ctx.scale(4,4);r.renderPlayer(ctx,p,false);ctx.restore();
          ctx.save();ctx.translate(510-b.x*2.05,370);ctx.scale(2.05,2.05);r.renderBoss(ctx,b,false);ctx.restore();
          ctx.fillStyle='#e9ddc6';ctx.textAlign='center';ctx.font='22px Georgia';ctx.fillText(window.__motionLabel==='before'?'BEFORE · deployed v2.28':'AFTER · local motion pass',350,38);
          ctx.font='15px Georgia';ctx.fillStyle='#98c6c9';ctx.fillText(action,350,72);
          ctx.fillStyle='#d6cfbd';ctx.fillText('KITE-VEIL',185,435);ctx.fillText('MALAKAR',510,435);
          ctx.font='12px sans-serif';ctx.fillStyle='#87939b';ctx.fillText('Actual runtime models · magnified motion audition · not the gameplay camera',350,472);
        };
      },label);
      for(let i=0;i<duration*fps;i++){
        await page.evaluate(time=>window.__drawMotion(time),i/fps);
        await page.locator('#motion-audition').screenshot({path:`${out}/${label}-${String(i).padStart(3,'0')}.png`});
      }
      await page.close();
      console.log(`Captured ${label}: ${duration}s at ${fps}fps`);
    }
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

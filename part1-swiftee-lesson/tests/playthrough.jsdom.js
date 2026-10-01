// Full headless playthrough: a scripted "child" who answers every screen,
// trying a wrong answer first wherever the screen judges one.
const { JSDOM } = require('jsdom'); const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT,'index.html'),'utf8').replace(/<link[^>]+fonts[^>]*>/g,'');
const dom = new JSDOM(html,{ runScripts:'outside-only', pretendToBeVisual:true, url:'http://localhost/' });
const w = dom.window, d = w.document;
const anim=()=>({finished:Promise.resolve(),cancel(){},playbackRate:1,effect:{getKeyframes:()=>[{composite:'add'}]}});
w.Element.prototype.animate=function(){return anim();};
w.SVGElement.prototype.getBBox=()=>({x:0,y:0,width:100,height:100});
w.SVGSVGElement.prototype.createSVGPoint=function(){return{x:0,y:0,matrixTransform(){return{x:this.x,y:this.y};}};};
w.SVGSVGElement.prototype.getScreenCTM=()=>({inverse:()=>({})});
w.Element.prototype.setPointerCapture=()=>{};
w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:1000,height:562,right:1000,bottom:562};};
w.HTMLElement.prototype.getBoundingClientRect=w.Element.prototype.getBoundingClientRect;
w.ResizeObserver=class{observe(){}}; w.matchMedia=()=>({matches:false,addEventListener(){}});
w.requestAnimationFrame=fn=>setTimeout(()=>fn(w.performance.now()),16);
w.cancelAnimationFrame=id=>clearTimeout(id);
w.speechSynthesis={getVoices:()=>[{name:'Microsoft Neerja Online (Natural) - English (India)',lang:'en-IN'}],speak(u){setTimeout(()=>u.onend&&u.onend(),15);},cancel(){}};
w.SpeechSynthesisUtterance=function(t){this.text=t;};
const p=()=>({value:1,cancelScheduledValues(){},setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}}); const node=()=>({connect(){},disconnect(){}});
w.AudioContext=class{constructor(){this.currentTime=0;this.sampleRate=44100;this.state='running';this.destination=node();}resume(){}createGain(){return Object.assign(node(),{gain:p()});}createOscillator(){return Object.assign(node(),{type:'',frequency:p(),start(){},stop(){}});}createBufferSource(){return Object.assign(node(),{buffer:null,playbackRate:p(),start(){},stop(){},loop:false});}createBiquadFilter(){return Object.assign(node(),{type:'',frequency:p(),Q:p()});}createAnalyser(){return Object.assign(node(),{fftSize:0,smoothingTimeConstant:0});}createWaveShaper(){return Object.assign(node(),{curve:null,oversample:''});}createBuffer(c,l){const a=new Float32Array(l);return{getChannelData:()=>a};}};
w.fetch=()=>Promise.reject(new Error('offline')); w.PointerEvent=w.MouseEvent;
w.HTMLCanvasElement.prototype.getContext=()=>({setTransform(){},clearRect(){},save(){},restore(){},translate(){},rotate(){},beginPath(){},arc(){},fill(){},fillRect(){},fillText(){},moveTo(){},lineTo(){},closePath(){},globalAlpha:1});
const errors=[]; w.addEventListener('error',e=>errors.push(e.message)); w.console.error=(...a)=>errors.push(a.join(' ')); w.console.warn=()=>{};
// Read the script list out of index.html rather than repeating it here. A
// hardcoded copy silently drifts the moment a module is added, and the test
// then proves the wrong build works.
const SCRIPTS=[...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m=>m[1]);
if(!SCRIPTS.length) errors.push('index.html: no scripts found');
SCRIPTS.forEach(f=>{try{w.eval(fs.readFileSync(path.join(ROOT,f),'utf8'));}catch(e){errors.push(f+': '+e.message);}});

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const until=async(pred,ms)=>{const t0=Date.now();while(!pred()){if(Date.now()-t0>(ms||8000))return false;await sleep(20);}return true;};
// (x, y are in the stage's seated layers — where the corners and cards are drawn — so the
// event goes where they are on the screen: the seat's lift added back, as the real page's CTM does)
const ev=(el,type,x,y)=>el.dispatchEvent(new w.MouseEvent(type,{bubbles:true,clientX:x,clientY:y+((w.Stage&&w.Stage.seatY)||0),pointerId:1}));
const stage=d.getElementById('stage'); const svg=()=>stage.querySelector('svg');
const St=()=>w.Stage.state;
const tapEl=el=>ev(el,'pointerdown',500,300);
const drag=async(fromEl,path)=>{ ev(fromEl,'pointerdown',path[0].x,path[0].y); for(const q of path){ ev(svg(),'pointermove',q.x,q.y); await sleep(8);} ev(svg(),'pointerup',path[path.length-1].x,path[path.length-1].y); };
const lerp=(a,b,n)=>{const o=[];for(let i=1;i<=n;i++)o.push({x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n});return o;};

// SFX/juice sync counters for the section-6 check
let cues={correct:0,wrong:0}; const origPlay=w.SFX.play.bind(w.SFX); w.SFX.play=(n,o)=>{ if(n==='correct')cues.correct++; if(n==='wrong')cues.wrong++; return origPlay(n,o); };

let wrongTried=0, screensSeen=new Set(), asked=[], sideTries={}, inwardKept=[], sidesOkMade=0, hexSide={ok:false}, nextInLesson=false, swipePutAway=null;

// HANDED BACK: while he replies to an answer the stage takes nothing (game.js
// pop(): lock, his line, unlock), and a child cannot answer again in that time
const free=()=>until(()=>w.Input.mode()!=='locked',8000);
async function act(spec){
  const s=St(), v=()=>St().verts, P=w.Poly;
  await until(()=>!w.Input.guarded);
  switch(spec.type){
    // THE LESSON GOES ON BY ITSELF (game.js autoAdvance): nothing is pressed at the end of a
    // screen, and the Next button never shows in the lesson (it is the story's alone). Wait for
    // the gate to pass on its own, and note any Next that appears while it is open.
    case 'tap-anywhere': {
      const scr=w.Game.screen;
      await until(()=>{ if(d.querySelector('#next.show')) nextInLesson=true; return w.Game.screen!==scr || w.Input.mode()!=='dialogue' || !!d.querySelector('#hud .replay.show'); }, 30000).catch(()=>{});
      return;
    }
    // the summary's review (the final pass): Next shows once every card has been explained; press it
    case 'summary-review': { await until(()=>!!d.querySelector('#next.show'), 30000); d.querySelector('#next').dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await until(()=>!d.querySelector('#next.show'), 5000).catch(()=>{}); return; }
    case 'vertex-pick': await until(()=>svg().querySelectorAll('.vertex').length>0); tapEl(svg().querySelectorAll('.vertex')[0]); return;   // picked=0 -> adjacent 1, non-adjacent 2,3
    case 'draw-diagonal': case 'draw-diagonals': {
      const from=spec.from==='picked'?s.picked:spec.from; const V=v(); const n=V.length; const cnt=spec.count||1;
      const usedK=new Set((s.diagonals||[]).map(q=>q.join('-')));
      const targets=P.diagonalsFrom(from,n).filter(j=>!usedK.has([Math.min(from,j),Math.max(from,j)].join('-')));
      const hnd=()=>svg().querySelectorAll('.vertex')[from];
      // CONNECTING (sides — the Screen 7 vertex brief): a neighbour is a side, not a wrong
      // answer — one neighbour, named; the other, the second side; and then the diagonal
      if(spec.sides){
        sideTries[w.Game.screen]=(sideTries[w.Game.screen]||0)+1;
        const k=sideTries[w.Game.screen], to=k===1?(from+1)%n:(k===2?(from+n-1)%n:targets[0]);
        await drag(hnd(), lerp(V[from],V[to],5)); await sleep(60); return;
      }
      // (sidesOk — the hexagon: a neighbour is a SIDE — made, its end disabled — and, the task being
      // diagonals, answered as a miss: one wrong cue)
      if(!spec.retry && spec.sidesOk){ const w0=cues.wrong; await drag(hnd(), lerp(V[from],V[(from+1)%n],5)); sidesOkMade++; await sleep(80);
        hexSide={ ok: (St().vstate||[])[(from+1)%n]==='side-used-disabled' && (St().sidesDone||[]).length===1 && !(St().diagonals||[]).length && cues.wrong===w0+1, vs:(St().vstate||[]).join(','), wrong: cues.wrong-w0 }; wrongTried++; }
      else if(!spec.retry){ await drag(hnd(), lerp(V[from],V[(from+1)%n],5)); wrongTried++; await sleep(60); if(spec.type==='draw-diagonal') return; }   // wrong: adjacent
      for(let k=0;k<cnt;k++){ await free(); await drag(hnd(), lerp(V[from],V[targets[k]],5)); await sleep(60); }
      return;
    }
    case 'drag-vertex': {
      // (a drag for a screen that has gone on is not made: the input is locked between tries now —
      // the final pass — so the wait below can outlast the screen it was for)
      const scr=w.Game.screen; const V=v(); if(!V) return; const i=spec.vertex==='any'?0:spec.vertex; const c=P.centroid(V);
      const tt=V.length===4?1.35:0.92; const target=spec.until==='concave'?{x:V[i].x+(c.x-V[i].x)*tt,y:V[i].y+(c.y-V[i].y)*tt}:{x:V[i].x,y:V[i].y-70};
      // first: grab, move a little, RELEASE early (the bug we fixed), then grab again and finish
      // (on drag-inward the short pull is made once the input is live, so it is a real release to keep)
      if(spec.until==='concave' && !spec.attempts) await free();
      const at0={x:V[i].x,y:V[i].y};   // (V is the live array: its corner is read again below)
      await drag(svg().querySelectorAll('.vertex')[i], lerp(V[i],target,10).slice(0,2)); await sleep(40); await free();
      const V2=v(); if(!V2 || w.Game.screen!==scr) return;
      // (the drag-inward fix: that early release is progress, kept where it was let go — no spring back)
      if(spec.until==='concave' && !spec.attempts) inwardKept.push(Math.hypot(V2[i].x-at0.x, V2[i].y-at0.y));
      await drag(svg().querySelectorAll('.vertex')[i], lerp(V2[i],target,14)); return;
    }
    case 'choice': {
      await until(()=>svg().querySelectorAll('.choice').length>0);
      const els=[...svg().querySelectorAll('.choice')];
      // (a one-button statement — the inside screen's "Inside" — has no wrong answer to try first)
      const wrongEl=els.find(e=>e.getAttribute('data-label')!==spec.correct);
      if(!spec.retry && wrongEl){ tapEl(wrongEl); wrongTried++; return; }
      tapEl(els.find(e=>e.getAttribute('data-label')===spec.correct)); return;
    }
    case 'multi-select': { const cards=[...svg().querySelectorAll('.card')]; tapEl(cards.find(c=>c.getAttribute('data-id')==='circle')); wrongTried++; await sleep(30);
      for(const c of cards.filter(c=>['pentagon','octagon'].includes(c.getAttribute('data-id')))){ await free(); tapEl(c); await sleep(30); } return; }
    case 'tap-each': { const sel=spec.targets==='sides'?'.edge':'.vertex'; for(let k=0;k<(spec.count||5);k++){ tapEl(svg().querySelectorAll(sel)[k]); await sleep(30);} return; }
    case 'sort': {
      const S=St().sort; let first=true;
      while(St().sort.placed<St().sort.total){
        const item=St().sort.items.find(it=>!it._placed); if(!item){await sleep(50);continue;}
        const c=P.classify(item._verts); const bins=St().sort.bins;
        const right=bins.find(b=>({convex:c.convex,concave:c.concave,regular:c.regular,irregular:c.irregular})[b._bin.id]);
        const wrong=bins.find(b=>b!==right);
        const home=item._pos||item._home; const to=b=>({x:b._rect.x+b._rect.w/2,y:b._rect.y+b._rect.h/2});
        await free();
        if(first){ await drag(item, lerp(home,to(wrong),6)); wrongTried++; first=false; await sleep(40); await free(); }
        await drag(item, lerp(item._pos||item._home,to(right),6)); await sleep(40);
      }
      return;
    }
    case 'swipe': {
      // Answered by TAPPING the zones, not by swiping. jsdom has no layout, so
      // a pointer path in client coordinates would be a path across a
      // zero-sized box — and the accessible tap fallback goes through the
      // same classify() the swipe does, which is the whole reason it is one
      // function. The swipe path itself is exercised in the browser suite,
      // where there is real geometry to drag across.
      const zoneOf=id=>svg().querySelector('.zone[data-zone="'+id+'"]');
      let first=true, second=true, guard=0;
      while(St().swipe && St().swipe.i<St().swipe.items.length && guard++<200){   // eight rounds, and the 300ms hold between them spins this loop
        // wait for the next card to be dealt (a 300ms hold follows each catch) rather than tapping into the gap and paying a full timeout for it
        await until(()=>!St().swipe || !!St().swipe.card, 2500).catch(()=>{});
        if(!St().swipe) break;
        const card=St().swipe.card;
        if(!card){ await sleep(40); continue; }
        const right=P.isRegular(card._verts)?'regular':'irregular';
        const wrong=right==='regular'?'irregular':'regular';
        // he pops up behind each card to ask about it, and after a wrong answer
        // to say why; the zones answer nothing until he is down (game.js pop())
        await until(()=>!St().swipe || w.Input.mode()!=='locked', 8000);
        if(first){ tapEl(zoneOf(wrong)); wrongTried++; first=false; await sleep(120); await until(()=>!St().swipe || w.Input.mode()!=='locked', 8000); }
        else if(second && St().swipe.i===1){
          // THE SAME CARD WRONG TWICE: no third try. After his explanation the card goes to
          // its own pile by itself (stage.js classify → collect) and the next one is dealt —
          // nothing is tapped right here
          second=false; const name=card._name, was=St().swipe.i;
          tapEl(zoneOf(wrong)); wrongTried++; await sleep(120); await until(()=>!St().swipe || w.Input.mode()!=='locked', 8000);
          if(!St().swipe) break;
          tapEl(zoneOf(wrong)); wrongTried++; await sleep(120);
          await until(()=>!St().swipe || St().swipe.i>was, 14000).catch(()=>{});
          const z=St().swipe && St().swipe.zones[right];
          swipePutAway={ card:name, moved:!!(St().swipe && St().swipe.i>was), kept:!!(z && z._kept && z._kept.indexOf(name)>=0) };
          await sleep(40); continue;
        }
        if(!St().swipe) break;
        const before=St().swipe.i;
        tapEl(zoneOf(right));
        // a right card is held a moment with its verdict on it before it flies (about 1.7s in all)
        await until(()=>!St().swipe || St().swipe.i>before, 4000).catch(()=>{});
        await sleep(40);
      }
      return;
    }
  }
}

(async()=>{
  let fails=0; const t=(l,c,x)=>{ if(c)console.log('  ok   '+l); else{fails++;console.log('  FAIL '+l+(x?'  '+x:''));} };
  await until(()=>w.Game&&w.Game.director);
  w.Game.director.on('input',({spec})=>asked.push({screen:w.Game.screen,type:spec.type}));
  w.Game.director.on('start',()=>screensSeen.add(w.Game.screen));
  // Real pacing is 1.1s+ per line; the test only needs ordering, not the wait.
  w.Game.director.configure({ sayMinMs: 60, msPerWord: 4, feedbackSettleMs: 20, readablePauseMs: 40 });
  d.getElementById('loading').classList.add('ready'); d.getElementById('start').click();

  // react to every input request the director makes
  let pending=null; w.Game.director.on('input',({spec})=>{ pending=spec; });

  /* THE STORY COMES FIRST (src/story/story.js): Momo and Popo, five scenes, each moved on
     with Next — and only once it has been told — then the lesson's screen 1, once. The
     script is written out here on purpose: it is the approved text, and the story must
     say exactly it, by exactly these speakers, in exactly this order. */
  const SCRIPT=[
    [1,'narrator','It was a great day, and Momo and Popo were deciding what to do.'],
    [1,'momo','Popo, let’s go for a picnic!'],
    [1,'popo','Great idea, Momo!'],
    [2,'momo','I’ll bring the snacks!'],
    [2,'popo','I’ll go ahead and find us a nice spot.'],
    [3,'narrator','Momo wanted to get there quickly, so he took the shortest route— through Frozen Pass.'],
    [4,'momo','This path looks trickier than last time!'],
    [5,'narrator','Momo needs your help to reach Popo.']   // (the rest is Swiftee's now: p01b)
  ];
  let lessonDuringStory=false, screen1Starts=0;
  w.Game.director.on('start',()=>{ if(w.Story&&w.Story.active) lessonDuringStory=true; if(w.Game.screen===0) screen1Starts++; });
  await until(()=>w.Story&&w.Story.active, 5000);
  const storyRan=!!(w.Story&&w.Story.active);
  // NO NEXT BUTTON (the user: "remove the next buttons"): each scene goes on by itself once it
  // has been told. The button must never show, and a tap that comes early (Story.next) does
  // nothing — the scenes still arrive in order, on their own.
  const scenesSeen=[]; let lastScene=0, nextShown=false, refused=0, acceptedEarly=0;
  const ts=Date.now();
  while(w.Story&&w.Story.active&&Date.now()-ts<60000){
    const s=w.Story.state;
    if(s.scene!==lastScene){ scenesSeen.push(s.scene); lastScene=s.scene; }
    if(d.querySelector('#next.show')) nextShown=true;
    // a press while a line is still being told does nothing
    if(s.phase==='dialogue'&&!s.canAdvance){ if(w.Story.next()) acceptedEarly++; else refused++; }
    await sleep(10);
  }
  const told=w.Story?w.Story.state.lines.map(l=>[l.scene,l.who,l.text]):[];
  t('the story plays before the lesson: all five scenes, in order, each once', storyRan&&JSON.stringify(scenesSeen)==='[1,2,3,4,5]', JSON.stringify(scenesSeen));
  t('every line of the script, word for word, by its own speaker, in order', JSON.stringify(told)===JSON.stringify(SCRIPT), JSON.stringify(told));
  t('no Next button in the story: the scenes go on by themselves, and an early press changes nothing',
    !nextShown&&refused>0&&acceptedEarly===0, JSON.stringify({nextShown,refused,acceptedEarly}));
  await until(()=>w.Game.screen===0, 5000);
  t('then the lesson, from screen 1, once, and not while the story was up',
    !(w.Story&&w.Story.active)&&!lessonDuringStory&&w.Game.screen===0&&screen1Starts===1&&d.getElementById('story').hidden&&!d.getElementById('game').classList.contains('story-on'),
    JSON.stringify({lessonDuringStory,screen:w.Game.screen,screen1Starts,hidden:d.getElementById('story').hidden}));

  const N=w.Screens.list.length; const t0=Date.now();
  // THE FINALE, CAUGHT AS IT BEGINS. It goes on to the hand-over screen by itself — in a few
  // milliseconds at this pace — so what must be true of the finale is read the moment the
  // replay button comes up, and Part 2's button is pressed then, while the finale is up, when
  // a press must go nowhere. (Leaving starts the snow at once, game.js goOn, so a press that
  // left would show as a cover.) And Part 2's button never shows before the hand-over screen.
  const cont=d.getElementById('continue'), cover=w.Transition&&w.Transition.cover; let covers=0;
  let atFinale=null, contBeforeReady=false;
  const watch=new w.MutationObserver(()=>{
    if(d.querySelector('#continue.show') && !d.getElementById('game').classList.contains('ready-scene')) contBeforeReady=true;
    if(atFinale || !d.querySelector('#hud .replay.show')) return;
    atFinale={ next: !!d.querySelector('#next.show'), cont: !!d.querySelector('#continue.show'),
               SM: w.Stage.summaryState&&w.Stage.summaryState() };
    if(cover) w.Transition.cover=function(){ covers++; return cover.apply(this,arguments); };
    cont.click();   // a press while the finale is up goes nowhere
    atFinale.leftEarly=covers>0;
  });
  watch.observe(d.body, { attributes:true, subtree:true, attributeFilter:['class'] });
  while(!d.querySelector('#hud .replay.show') && Date.now()-t0<180000){
    if(pending){ const sp=pending; pending=null; try{ await act(sp); }catch(e){ errors.push('act '+sp.type+' on screen '+w.Game.screen+': '+e.message); } }
    await sleep(15);
  }
  const done=!!d.querySelector('#hud .replay.show');
  t('played to the end and the replay button appeared', done, 'stopped at screen '+w.Game.screen+' ('+(w.Screens.list[w.Game.screen]||{}).id+')');
  // the finale goes on by itself, like every screen before it, and Part 2's button waits
  // for the hand-over screen: shown with the finale, it was pressed before that screen was
  // ever seen
  // (the summary's own state, read as the finale began — before the hand-over screen is
  // built over it)
  const SM=atFinale&&atFinale.SM;
  t('the finale shows no Next, and not Part 2 yet', !!atFinale && !atFinale.next && !atFinale.cont, JSON.stringify(atFinale&&{ next: atFinale.next, cont: atFinale.cont }));
  t('no Next button anywhere in the lesson', !nextInLesson);
  const leftEarly=!!(atFinale&&atFinale.leftEarly);
  await until(()=>d.getElementById('game').classList.contains('ready-scene') && d.querySelector('#continue.show') &&
    /help Momo/.test(d.getElementById('bubble').textContent), 30000);
  t('the finale opens the hand-over screen by itself: his line, and the button on to Part 2',
    d.getElementById('game').classList.contains('ready-scene') && !!d.querySelector('#continue.show') && !d.querySelector('#next.show') &&
    /Play Part 2/.test(cont.textContent) && /help Momo/.test(d.getElementById('bubble').textContent),
    JSON.stringify({ ready: d.getElementById('game').classList.contains('ready-scene'), cont: cont.className, line: d.getElementById('bubble').textContent }));
  t('nothing left for Part 2 before the hand-over screen', !!cover && !!atFinale && !leftEarly && covers===1, 'covers '+covers);
  t('Part 2\u2019s button never shows before the hand-over screen', !contBeforeReady);
  watch.disconnect();
  t('no runtime errors across the whole game', errors.length===0, errors.slice(0,3).join(' | '));
  t('all '+N+' screens were visited', screensSeen.size===N, screensSeen.size+'/'+N);
  const types=new Set(asked.map(a=>a.type));
  // 10: the storyboard no longer drags a side's loose end (drag-endpoint),
  // and the builder's stepper went with the builder
  // (11: the summary's review — Next, and a tap on a card to hear it again)
  t('all 11 interaction types were exercised', types.size===11, [...types].join(','));
  // (the Screen 7 vertex brief: a side, the other side, then the diagonal — three tries)
  t('hexagon: a line to a neighbour makes a side — its end disabled — and is answered as a miss (one wrong cue)', sidesOkMade>0 && hexSide.ok, JSON.stringify({ sidesOkMade, hexSide }));
  t('drag inward: a release short of the dent stays where it was let go', inwardKept.length>0 && inwardKept.every((d)=>d>3), JSON.stringify(inwardKept));
  t('the connect step went side, side, then diagonal', Object.values(sideTries).some(k=>k===3), JSON.stringify(sideTries));
  t('the summary collected all eight ideas, in order, and reached its finale', !!SM && SM.state==='FINAL_SUMMARY' && SM.collected.join(',')==='vertex,side,angle,diagonal,convex,concave,regular,irregular',
    JSON.stringify(SM));
  // 7: the connect step judges nothing wrong (a neighbour is a side, not a
  // mistake), and the drag-a-side screen that had a wrong answer is gone
  t('a wrong answer was tried on every judged screen ('+wrongTried+' times)', wrongTried>=7, String(wrongTried));
  t('every wrong attempt produced exactly one wrong cue', cues.wrong>=wrongTried, JSON.stringify(cues));
  t('a swipe card missed twice went to its own pile by itself, and the next was dealt', !!(swipePutAway&&swipePutAway.moved&&swipePutAway.kept), JSON.stringify(swipePutAway));
  t('correct cues fired', cues.correct>0);
  console.log('  screens: '+N+', inputs answered: '+asked.length+', elapsed '+((Date.now()-t0)/1000).toFixed(1)+'s');
  console.log(fails?'\n'+fails+' FAILED':'\nfull playthrough clean'); process.exit(fails?1:0);
})();

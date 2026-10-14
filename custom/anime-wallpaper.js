(() => {
  if (window.__animeWallpaper) return;
  window.__animeWallpaper = true;
  const key = 'sun-anime-wallpaper-v1';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(key) || '{}'); } catch {}
  const settings = { motion:true, interval:120, source:'hd', custom:'', franchise:'all', effects:'dreamy', ...saved };
  if (!settings.qualityUpgrade && settings.source !== 'custom') { settings.source='hd'; settings.qualityUpgrade=true; }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const topics = [['all','全部作品'],['blue-archive','碧蓝档案'],['genshin','原神'],['star-rail','崩坏：星穹铁道'],['arknights','明日方舟'],['azur-lane','碧蓝航线'],['touhou','东方Project'],['miku','初音未来'],['bocchi','孤独摇滚'],['frieren','葬送的芙莉莲'],['eva','新世纪福音战士']];
  let pool=[], remaining=[], catalogLoadedAt=0, busy=false, timer, retryTimer, failures=0, current='', active, loadSequence=0, frame=0;
  const failedUntil=new Map();
  const cachedUrl=url=>{const parsed=new URL(url,location.origin);return parsed.hostname==='w.wallhaven.cc'&&/^\/full\/[a-z0-9]{2}\/wallhaven-[a-z0-9]{6}\.(png|jpe?g|webp)$/.test(parsed.pathname)?'/wallpaper-cache'+parsed.pathname:url;};
  const style=document.createElement('style');
  style.textContent=`
    #anime-scene{position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden;background:#15243b;--px:0%;--py:0%;--strength:1}
    #anime-scene .anime-media{position:absolute;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity 2.2s ease;transform:scale(1.04)}
    #anime-scene .anime-media.ready{opacity:1}
    #anime-scene.moving .anime-media{animation:anime-pan 36s ease-in-out infinite alternate}
    #anime-scene:after{content:'';position:absolute;inset:0;z-index:5;background:linear-gradient(180deg,rgba(7,14,30,.12),rgba(7,14,30,.30))}
    body.anime-wallpaper-ready .wallpaper{opacity:0!important}
    #anime-scene .spark{position:absolute;z-index:3;bottom:-20px;width:3px;height:3px;border-radius:50%;background:#deefffb0;box-shadow:0 0 12px #aaddff;opacity:0}
    #anime-scene.moving .spark{animation:anime-float 24s linear infinite}
    #anime-scene .glow{position:absolute;z-index:2;inset:-20%;opacity:0;filter:blur(55px);transition:opacity 2s;background:radial-gradient(ellipse at 18% 35%,#78baff2c 0,transparent 38%),radial-gradient(ellipse at 85% 65%,#d5a4ff24 0,transparent 40%);mix-blend-mode:screen}
    #anime-scene.moving[data-effects=dreamy] .glow,#anime-scene.moving[data-effects=rich] .glow{opacity:1;animation:anime-breathe 16s ease-in-out infinite alternate}
    #anime-scene .ribbon{position:absolute;z-index:2;width:150%;height:30%;left:-25%;top:20%;opacity:0;background:linear-gradient(105deg,transparent 32%,#9cddff12 45%,#fff1 50%,#d5b8ff0a 55%,transparent 68%);filter:blur(28px);transform:rotate(-16deg);mix-blend-mode:screen}
    #anime-scene.moving[data-effects=rich] .ribbon{animation:anime-ribbon 32s ease-in-out infinite}
    #anime-scene .twinkle{position:absolute;z-index:3;width:2px;height:2px;border-radius:50%;background:#eff7ff;box-shadow:0 0 8px #bddbff;opacity:0}
    #anime-scene.moving[data-effects=dreamy] .twinkle,#anime-scene.moving[data-effects=rich] .twinkle{animation:anime-twinkle 9s ease-in-out infinite}
    #anime-scene[data-effects=gentle]{--strength:.55}#anime-scene[data-effects=rich]{--strength:1.35}
    @keyframes anime-pan{from{transform:scale(1.04) translate(calc(-.4% + var(--px)),calc(-.3% + var(--py)))}to{transform:scale(1.085) translate(calc(.4% + var(--px)),calc(.3% + var(--py)))}}
    @keyframes anime-float{0%{transform:translate3d(0,0,0);opacity:0}18%,72%{opacity:calc(.4 * var(--strength))}100%{transform:translate3d(45px,-108vh,0);opacity:0}}
    @keyframes anime-breathe{from{transform:translate3d(-2%,-1%,0) scale(.96);opacity:.45}to{transform:translate3d(3%,2%,0) scale(1.05);opacity:.9}}
    @keyframes anime-ribbon{0%,100%{transform:translateY(25vh) rotate(-16deg);opacity:0}35%,65%{opacity:.6}85%{transform:translateY(-45vh) rotate(-12deg);opacity:0}}
    @keyframes anime-twinkle{0%,100%{opacity:0;transform:scale(.7)}50%{opacity:calc(.45 * var(--strength));transform:scale(1.25)}}
    #anime-tools{position:fixed;left:18px;bottom:18px;z-index:1000;font:14px system-ui;color:#fff;max-width:calc(100vw - 36px)}
    #anime-tools button,#anime-tools select,#anime-tools input{font:inherit;color:inherit;border:1px solid #ffffff30;border-radius:10px;background:#17233ee8;padding:9px 12px}
    #anime-tools button{cursor:pointer}#anime-tools button:disabled{opacity:.5;cursor:wait}#anime-tools button:hover{background:#35486deb}
    #anime-tools .bar{display:flex;gap:6px}#anime-tools .panel{margin-bottom:8px;padding:16px;border:1px solid #ffffff30;border-radius:16px;background:#14213af2;box-shadow:0 10px 30px #0004;width:320px;max-width:calc(100vw - 36px);max-height:75vh;overflow:auto;box-sizing:border-box;backdrop-filter:blur(16px)}
    #anime-tools .panel[hidden]{display:none}#anime-tools label{display:block;margin:12px 0 5px}#anime-tools select,#anime-tools input[type=url]{width:100%;box-sizing:border-box}#anime-tools input[type=checkbox]{accent-color:#a9c6ff}
    #anime-tools .hint{font-size:12px;color:#c0cce0;line-height:1.6;margin:10px 0 0}#anime-status{font-size:12px;padding:6px 3px;max-width:310px;text-shadow:0 1px 3px #000}
    @media(prefers-reduced-motion:reduce){#anime-scene .anime-media,#anime-scene .spark,#anime-scene .glow,#anime-scene .ribbon,#anime-scene .twinkle{animation:none!important}#anime-scene .spark,#anime-scene .glow,#anime-scene .ribbon,#anime-scene .twinkle{display:none}#anime-scene .anime-media{transition-duration:.2s}}
    @media(max-width:600px){#anime-tools{left:12px;bottom:12px}#anime-tools button{padding:8px 10px}#anime-scene .glow{filter:blur(30px)}#anime-scene .spark:nth-of-type(n+16),#anime-scene .twinkle:nth-of-type(n+26){display:none}}
  `;
  document.head.append(style);
  const scene=document.createElement('div');scene.id='anime-scene';scene.setAttribute('aria-hidden','true');
  for(const name of ['glow','ribbon']){const effect=document.createElement('i');effect.className=name;scene.append(effect);}
  for(let i=0;i<24;i++){const spark=document.createElement('i');spark.className='spark';spark.style.left=`${i*4.2+1}%`;spark.style.animationDelay=`${-i*2.3}s`;spark.style.animationDuration=`${22+i%5*5}s`;scene.append(spark);}
  for(let i=0;i<16;i++){const point=document.createElement('i');point.className='twinkle';point.style.left=`${(i*37+11)%100}%`;point.style.top=`${(i*23+7)%92}%`;point.style.animationDelay=`${-i*1.9}s`;point.style.animationDuration=`${8+i%5*2}s`;scene.append(point);}
  document.body.prepend(scene);
  const tools=document.createElement('div');tools.id='anime-tools';
  tools.innerHTML=`<div class="panel" hidden><strong>二次元壁纸</strong><label for="anime-source">在线壁纸来源</label><select id="anime-source"><option value="hd">高清二次元 · 每日更新</option><option value="xxapi">二次元 · 小小 API</option><option value="ospyo">动漫 · OSPYO</option><option value="custom">自定义图片 / 动态视频</option></select><div id="anime-topic-field"><label for="anime-franchise">作品</label><select id="anime-franchise">${topics.map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></div><label for="anime-custom">自定义链接（HTTPS）</label><input id="anime-custom" type="url" placeholder="图片、GIF 或 MP4 / WebM 链接"><label for="anime-interval">自动更换</label><select id="anime-interval"><option value="0">关闭，手动更换</option><option value="60">每 1 分钟</option><option value="120">每 2 分钟</option><option value="300">每 5 分钟</option><option value="600">每 10 分钟</option></select><label><input id="anime-motion" type="checkbox"> 开启动效</label><label for="anime-effects">动态效果</label><select id="anime-effects"><option value="gentle">轻柔 · 运镜与微光</option><option value="dreamy">梦幻 · 视差、光晕与星尘</option><option value="rich">丰富 · 加入流光与更多层次</option></select><button id="anime-apply" type="button">应用设置</button><p class="hint">图库每天自动更新并持续扩充。支持静音循环视频；设置保存在当前浏览器。</p></div><div class="bar"><button id="anime-next" type="button">✦ 换一张</button><button id="anime-settings" type="button" aria-expanded="false">壁纸设置</button></div><div id="anime-status" role="status" aria-live="polite"></div>`;
  document.body.append(tools);
  const $=id=>document.getElementById(id),status=text=>$('anime-status').textContent=text;
  $('anime-source').value=settings.source;$('anime-custom').value=settings.custom;$('anime-interval').value=String(settings.interval);$('anime-motion').checked=settings.motion;$('anime-franchise').value=settings.franchise;$('anime-effects').value=settings.effects;
  function topicVisibility(){$('anime-topic-field').hidden=$('anime-source').value!=='hd';}
  $('anime-source').onchange=topicVisibility;topicVisibility();
  function persist(){try{localStorage.setItem(key,JSON.stringify(settings))}catch{}}
  function schedule(){clearInterval(timer);scene.classList.toggle('moving',settings.motion&&!document.hidden);scene.dataset.effects=settings.effects;scene.style.setProperty('--px','0%');scene.style.setProperty('--py','0%');if(settings.interval&&settings.source!=='custom')timer=setInterval(()=>{if(!document.hidden)change()},settings.interval*1000);}
  const shuffle=items=>{const result=items.slice();for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;};
  const matches=item=>settings.franchise==='all'||item.topics?.includes(settings.franchise);
  async function onlineUrl(){
    if(settings.source==='hd'){
      if(!pool.length||Date.now()-catalogLoadedAt>300000){
        try{const response=await fetch('/custom/hd-wallpapers.json?t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(18000)});if(!response.ok)throw new Error('壁纸目录暂时不可用');const updated=await response.json();if(!Array.isArray(updated)||!updated.length)throw new Error('壁纸目录为空');const known=new Set(pool.map(x=>x.url));remaining.push(...shuffle(updated.filter(x=>!known.has(x.url)&&matches(x))));pool=updated;catalogLoadedAt=Date.now();}catch(error){if(!pool.length)throw error;}
      }
      if(!remaining.length)remaining=shuffle(pool.filter(matches));
      remaining=remaining.filter(item=>(failedUntil.get(cachedUrl(item.url))||0)<Date.now());
      if(!remaining.length)throw new Error('这个作品暂时没有壁纸，请切换其他作品');
      // Start the refreshed collection with Blue Archive, then explore the full pool.
      if(!loadSequence&&settings.franchise==='all'){const index=remaining.findIndex(x=>x.topics?.includes('blue-archive'));if(index>=0){const [first]=remaining.splice(index,1);return cachedUrl(first.url);}}
      return cachedUrl(remaining.pop().url);
    }
    if(settings.source==='custom'){const url=new URL(settings.custom);if(url.protocol!=='https:')throw new Error('请填写 HTTPS 图片或视频链接');return url.href;}
    if(settings.source==='ospyo')return `https://wallpaper.ospyo.com/api/v2/anime?t=${Date.now()}`;
    const response=await fetch(`https://v2.xxapi.cn/api/randomAcgPic?type=${innerWidth<600?'wap':'pc'}&return=json&t=${Date.now()}`,{signal:AbortSignal.timeout(18000),credentials:'omit',referrerPolicy:'no-referrer'});
    const data=await response.json();if(Number(data.code)!==200||typeof data.data!=='string')throw new Error('在线壁纸暂时不可用');const url=new URL(data.data);if(url.protocol!=='https:')throw new Error('壁纸链接不可用');return url.href;
  }
  function load(url){return new Promise((resolve,reject)=>{
    const video=/\.(mp4|webm)(\?|$)/i.test(url),media=document.createElement(video?'video':'img');media.className='anime-media';media.referrerPolicy='no-referrer';let finished=false;
    const timeout=setTimeout(()=>finish(new Error('壁纸加载超时，请重试或更换来源')),40000);
    function finish(error){if(finished)return;finished=true;clearTimeout(timeout);media.onerror=null;media.onload=null;media.onloadeddata=null;if(error){media.remove();reject(error);}else{if(video&&!document.hidden)media.play().catch(()=>{});resolve(media);}}
    if(video){media.muted=true;media.loop=true;media.autoplay=true;media.playsInline=true;media.onloadeddata=()=>finish();}else{media.alt='';media.onload=()=>finish(settings.source==='hd'&&(media.naturalWidth<2560||media.naturalHeight<1440)?new Error('壁纸清晰度不足，正在更换'):undefined);}
    media.onerror=()=>finish(new Error('图片或视频无法加载，请换一张'));media.src=url;scene.append(media);
  });}
  async function change(){
    if(busy)return;clearTimeout(retryTimer);busy=true;$('anime-next').disabled=true;$('anime-apply').disabled=true;status('正在寻找新壁纸…');
    try{let next,url,lastError;for(let attempt=0;attempt<(settings.source==='hd'?3:1);attempt++){try{url=await onlineUrl();if(url===current&&settings.source!=='custom')url=await onlineUrl();loadSequence++;next=await load(url);break;}catch(error){if(url)failedUntil.set(url,Date.now()+600000);lastError=error;}}if(!next)throw lastError;
      const previous=active;active=next;current=url;failures=0;requestAnimationFrame(()=>next.classList.add('ready'));document.body.classList.add('anime-wallpaper-ready');setTimeout(()=>previous?.remove(),2400);status('');
    }catch(error){if(settings.source==='hd'){failures++;status(active?'暂时无法更换壁纸，已保留当前背景，将自动重试':'壁纸暂时不可用，将自动重试…');retryTimer=setTimeout(()=>{if(!document.hidden)change()},Math.min(300000,30000*2**Math.min(failures-1,4)));}else status(error?.message||'暂时无法更换，请重试');}finally{busy=false;$('anime-next').disabled=false;$('anime-apply').disabled=false;}
  }
  let targetX=0,targetY=0,x=0,y=0;
  function move(){x+=(targetX-x)*.08;y+=(targetY-y)*.08;scene.style.setProperty('--px',`${x.toFixed(3)}%`);scene.style.setProperty('--py',`${y.toFixed(3)}%`);if(Math.abs(targetX-x)+Math.abs(targetY-y)>.015)frame=requestAnimationFrame(move);else frame=0;}
  document.addEventListener('pointermove',event=>{if(!settings.motion||settings.effects==='gentle'||reduced.matches||document.hidden||event.pointerType!=='mouse')return;const amplitude=settings.effects==='rich'?.65:.35;targetX=(event.clientX/innerWidth-.5)*amplitude;targetY=(event.clientY/innerHeight-.5)*amplitude;if(!frame)frame=requestAnimationFrame(move);},{passive:true});
  document.addEventListener('pointerleave',()=>{targetX=targetY=0;if(!frame)frame=requestAnimationFrame(move);});
  $('anime-next').onclick=change;
  $('anime-settings').onclick=()=>{const panel=tools.querySelector('.panel');panel.hidden=!panel.hidden;$('anime-settings').setAttribute('aria-expanded',String(!panel.hidden));};
  $('anime-apply').onclick=()=>{settings.source=$('anime-source').value;settings.custom=$('anime-custom').value.trim();settings.interval=Number($('anime-interval').value);settings.motion=$('anime-motion').checked;settings.effects=$('anime-effects').value;settings.franchise=$('anime-franchise').value;remaining=[];targetX=targetY=x=y=0;persist();schedule();change();};
  document.addEventListener('visibilitychange',()=>{scene.classList.toggle('moving',settings.motion&&!document.hidden);scene.querySelectorAll('i').forEach(el=>{el.style.animationPlayState=document.hidden?'paused':'running';});if(document.hidden){cancelAnimationFrame(frame);frame=0;}else if(failures&&!busy)change();if(active?.tagName==='VIDEO'){if(document.hidden)active.pause();else active.play().catch(()=>{});}});
  schedule();change();
})();

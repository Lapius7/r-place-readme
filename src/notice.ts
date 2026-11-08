// 押した直後の中間ページ。画像は camo 経由で閲覧者が分からないため、個人の残り時間はここで見せる
export interface NoticeInput {
  ok: boolean;
  waitMs: number; // 次に押せるまで
  cooldownMs: number;
  hue: number; // 訪問者の色
  back: string; // 戻り先(README のあるページ)
  github: string; // リポジトリ URL
  name: string;
  cols: number;
  rows: number;
  cell: number;
  x: number; // 押したマス
  y: number;
  w: number; // 画像の幅・高さ(下の帯を除く)
  h: number;
  returnMs: number; // 自動で戻るまで
}

const FOOT = 18; // render() の下の帯と同じ値

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

export function noticeHtml(i: NoticeInput): string {
  const sec = Math.ceil(i.waitMs / 1000);
  const ret = Math.ceil(i.returnMs / 1000);
  const repo = i.github.replace(/^https?:\/\//, "");
  const img = `/board/${i.name}/${i.cols}.svg`;
  // 押したマスの位置(画像全体に対する %)
  const left = ((i.x * i.cell) / i.w) * 100, top = ((i.y * i.cell) / (i.h + FOOT)) * 100;
  const cw = (i.cell / i.w) * 100, ch = (i.cell / (i.h + FOOT)) * 100;
  const title = i.ok ? "置きました" : "まだ押せません";
  const lead = i.ok ? "このマスを切り替えました。" : "押せるのは、1 人につき 1 分に 1 回です。";

  return `<!doctype html>
<html lang="ja">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="${ret + 2};url=${esc(i.back)}">
<meta name="robots" content="noindex">
<title>${title} · r/place Readme</title>
<link rel="icon" href="data:,">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500&family=Inter:wght@400;500&family=Noto+Sans+JP:wght@400;500&display=swap">
<style>
:root{
  color-scheme:light dark;
  --background:oklch(98.4% .002 260);--surface:oklch(100% 0 0);--surface-muted:oklch(96.4% .003 260);
  --foreground:oklch(21% .01 260);--text-secondary:oklch(46% .01 260);--text-muted:oklch(56% .01 260);
  --border:oklch(91% .004 260);--on-foreground:oklch(98.4% .002 260);
  --success:oklch(58% .15 150);--warning:oklch(68% .15 75);
  --outline:rgb(0 0 0 / .1);
  --visitor:hsl(${i.hue} 75% 52%);
  --font-display:"Geist","Noto Sans JP",system-ui,sans-serif;
  --font-body:"Inter","Noto Sans JP",system-ui,sans-serif;
  --ease-out:cubic-bezier(.2,0,0,1);
}
@media (prefers-color-scheme:dark){:root{
  --background:oklch(14.5% .004 260);--surface:oklch(19% .005 260);--surface-muted:oklch(23% .006 260);
  --foreground:oklch(96% .004 260);--text-secondary:oklch(72% .008 260);--text-muted:oklch(62% .008 260);
  --border:oklch(28% .006 260);--on-foreground:oklch(17% .005 260);
  --success:oklch(72% .16 150);--warning:oklch(78% .14 80);
  --outline:rgb(255 255 255 / .1);
  --visitor:hsl(${i.hue} 75% 66%);
}}
*{box-sizing:border-box}
html,body{overflow-x:clip}
body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:24px 16px;background:var(--background);color:var(--foreground);
  font:400 14px/20px var(--font-body);letter-spacing:-.01em;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
main{width:100%;max-width:440px;min-width:0}
.card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:8px;
  box-shadow:0 1px 2px rgb(0 0 0 / .04),0 8px 24px -12px rgb(0 0 0 / .12)}
.pad{padding:12px 12px 4px}
header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:6px 8px 12px 12px}
.brand{display:flex;align-items:center;gap:10px;min-width:0}
.mark{flex:none;width:28px;height:28px;border-radius:8px;background:var(--surface-muted);border:1px solid var(--border);display:grid;grid-template-columns:repeat(2,6px);grid-template-rows:repeat(2,6px);gap:3px;place-content:center}
.mark i{border-radius:1.5px;background:var(--border)}
.mark i:nth-child(1){background:var(--visitor)}
.mark i:nth-child(4){background:var(--visitor);opacity:.55}
h1{margin:0;font:500 15px/20px var(--font-display);letter-spacing:-.02em}
.sub{margin:0;color:var(--text-muted);font-size:12px;line-height:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gh{flex:none;display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;padding:0 10px;border-radius:8px;color:var(--text-secondary);text-decoration:none;font-size:13px;line-height:20px;white-space:nowrap;
  transition-property:background-color,color,scale;transition-duration:.15s;transition-timing-function:var(--ease-out)}
.gh svg{flex:none;width:16px;height:16px}
.gh:hover{background:var(--surface-muted);color:var(--foreground)}
.gh:active{scale:.96}
.board{position:relative;border-radius:8px;overflow:hidden;background:var(--background)}
.board img{display:block;width:100%;height:auto;border-radius:8px;outline:1px solid var(--outline);outline-offset:-1px}
.ring{position:absolute;left:${left.toFixed(3)}%;top:${top.toFixed(3)}%;width:${cw.toFixed(3)}%;height:${ch.toFixed(3)}%;border-radius:3px;pointer-events:none;
  box-shadow:0 0 0 1.5px var(--foreground);animation:ring 1.4s var(--ease-out) .35s 2 both}
@keyframes ring{0%{opacity:0;scale:1.9}25%{opacity:1}100%{opacity:0;scale:1}}
.result{display:flex;gap:12px;align-items:flex-start;padding:16px 12px 4px}
.dot{flex:none;width:8px;height:8px;margin-top:6px;border-radius:50%;background:var(--${i.ok ? "success" : "warning"})}
h2{margin:0;font:500 18px/24px var(--font-display);letter-spacing:-.02em;text-wrap:balance}
.lead{margin:2px 0 0;color:var(--text-secondary);text-wrap:pretty}
.cool{margin:12px 12px 0;padding:12px;border-radius:8px;background:var(--surface-muted)}
.row{display:flex;align-items:center;justify-content:space-between;gap:12px}
.row span{color:var(--text-secondary)}
.row b{font-weight:500;font-variant-numeric:tabular-nums;white-space:nowrap}
.me{display:inline-flex;align-items:center;gap:8px}
.sw{flex:none;width:10px;height:10px;border-radius:3px;background:var(--visitor)}
.bar{margin-top:10px;height:4px;border-radius:2px;background:var(--border);overflow:hidden}
.bar i{display:block;height:100%;border-radius:2px;background:var(--visitor);transform-origin:left;transform:scaleX(${(i.waitMs / i.cooldownMs).toFixed(4)});animation:drain ${i.waitMs}ms linear forwards}
@keyframes drain{to{transform:scaleX(0)}}
.actions{display:flex;gap:8px;padding:12px}
.btn{flex:1;display:inline-flex;align-items:center;justify-content:center;height:40px;padding:0 16px;border-radius:8px;font:500 14px/20px var(--font-body);letter-spacing:-.01em;text-decoration:none;white-space:nowrap;
  transition-property:background-color,border-color,scale;transition-duration:.15s;transition-timing-function:var(--ease-out)}
.btn:active{scale:.96}
.primary{background:var(--foreground);color:var(--on-foreground)}
.primary:hover{background:color-mix(in oklch,var(--foreground) 88%,var(--background))}
.ghost{border:1px solid var(--border);color:var(--foreground)}
.ghost:hover{background:var(--surface-muted)}
.btn:focus-visible,.gh:focus-visible{outline:2px solid var(--foreground);outline-offset:2px}
.auto{margin:0;padding:0 12px 10px;color:var(--text-muted);font-size:12px;line-height:16px;font-variant-numeric:tabular-nums}
.foot{margin:14px 0 0;text-align:center;color:var(--text-muted);font-size:12px;line-height:16px}
.foot a{white-space:nowrap;color:var(--text-secondary);text-underline-offset:3px}
.foot a:hover{color:var(--foreground)}
.in{animation:in .45s var(--ease-out) both;animation-delay:calc(var(--n) * 70ms)}
@keyframes in{from{opacity:0;translate:0 8px}}
@media (prefers-reduced-motion:reduce){.in,.ring{animation:none}.ring{opacity:0}.bar i{animation:none}}
@media (max-width:380px){.actions{flex-direction:column}.btn{flex:none;width:100%}.sub{display:none}.foot .nm{display:none}}
</style>
<main>
  <div class="card in" style="--n:0">
    <header>
      <div class="brand">
        <div class="mark" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
        <div style="min-width:0"><h1>r/place Readme</h1><p class="sub">README に置く共有ピクセルキャンバス</p></div>
      </div>
      <a class="gh" href="${esc(i.github)}" aria-label="GitHub のリポジトリを開く">
        <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>
        GitHub
      </a>
    </header>
    <div class="board in" style="--n:1">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="${img}?mode=dark">
        <img src="${img}?mode=light" width="${i.w}" height="${i.h + FOOT}" alt="現在のキャンバス">
      </picture>
      <div class="ring" aria-hidden="true"></div>
    </div>
    <div class="result in" style="--n:2" role="status" aria-live="polite">
      <span class="dot" aria-hidden="true"></span>
      <div><h2>${title}</h2><p class="lead">${lead}</p></div>
    </div>
    <div class="cool in" style="--n:3">
      <div class="row"><span class="me"><i class="sw" aria-hidden="true"></i>次に押せるまで</span><b id="cd">${sec} 秒後</b></div>
      <div class="bar" aria-hidden="true"><i></i></div>
    </div>
    <div class="actions in" style="--n:4">
      <a class="btn primary" href="${esc(i.back)}">README に戻る</a>
      <a class="btn ghost" href="${esc(i.github)}">使い方を見る</a>
    </div>
    <p class="auto in" style="--n:5" id="auto">${ret} 秒後に自動で戻ります</p>
  </div>
  <p class="foot in" style="--n:6"><span class="nm">r/place Readme · </span><a href="${esc(i.github)}">${esc(repo)}</a></p>
</main>
<script>
(()=>{const t0=Date.now(),wait=${i.waitMs},ret=${i.returnMs},back=${JSON.stringify(i.back)};
const cd=document.getElementById("cd"),au=document.getElementById("auto");
const tick=()=>{const n=Date.now()-t0;
cd.textContent=Math.max(0,Math.ceil((wait-n)/1000))+" 秒後";
au.textContent=Math.max(0,Math.ceil((ret-n)/1000))+" 秒後に自動で戻ります";
if(n>=ret){location.replace(back);return}};
tick();setInterval(tick,250)})();
</script>
</html>`;
}

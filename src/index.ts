import { DurableObject } from "cloudflare:workers";
import { noticeHtml } from "./notice";

interface Env {
  CANVAS: DurableObjectNamespace<Canvas>;
  REDIRECT_URL: string;
  WIDTH: string;
  HEIGHT: string;
  DEFAULT_COLS: string;
  MIN_COLS: string;
  MAX_COLS: string;
  COOLDOWN_MS: string;
  GITHUB_URL: string;
}

const THEMES = {
  light: { bg: "#ffffff", off: "#eceff3", line: "#d8dde3", mute: "#6e7781", sat: 62, lum: 50 },
  dark: { bg: "#0d1117", off: "#161b22", line: "#2d333b", mute: "#7d8590", sat: 75, lum: 66 },
} as const;
type Theme = keyof typeof THEMES;

const NAME_RE = /^[a-z0-9][a-z0-9-]{0,38}$/;

async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// IPv6 は /64 単位でまとめる(端末ごとにアドレスが変わるため)
function visitorKey(ip: string): string {
  if (!ip.includes(":")) return ip;
  return ip.split(":").slice(0, 4).join(":");
}

// 1 キャンバス = 1 Durable Object。状態は SQLite に持つ
export class Canvas extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const sql = ctx.storage.sql;
    sql.exec("CREATE TABLE IF NOT EXISTS cells (i INTEGER PRIMARY KEY, hue INTEGER NOT NULL)");
    sql.exec("CREATE TABLE IF NOT EXISTS taps (k TEXT PRIMARY KEY, t INTEGER NOT NULL)");
    sql.exec("CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)");
    if (!sql.exec("SELECT v FROM meta WHERE k='salt'").toArray().length) {
      sql.exec("INSERT INTO meta VALUES ('salt', ?)", crypto.randomUUID());
    }
  }

  cells(): number[][] {
    return this.ctx.storage.sql.exec("SELECT i, hue FROM cells").toArray().map((r) => [r.i as number, r.hue as number]);
  }

  // 訪問者の色: IP+キャンバス固有ソルトのハッシュ。IP は保存せず、ハッシュだけを cooldown 分だけ持つ
  // wait は「次に押せるまでの ms」。押せた場合も押した直後の cooldown を返す
  async tap(i: number, ip: string): Promise<{ ok: boolean; wait: number; hue: number }> {
    const sql = this.ctx.storage.sql;
    const cd = Number(this.env.COOLDOWN_MS), now = Date.now();
    const salt = sql.exec("SELECT v FROM meta WHERE k='salt'").one().v as string;
    const h = await sha256Hex(salt + visitorKey(ip));
    const id = h.slice(0, 16);
    const hue = parseInt(h.slice(16, 24), 16) % 360;
    sql.exec("DELETE FROM taps WHERE t <= ?", now - cd);
    const last = sql.exec("SELECT t FROM taps WHERE k = ?", id).toArray()[0]?.t as number | undefined;
    if (last !== undefined) return { ok: false, wait: Math.max(0, last + cd - now), hue };

    sql.exec("INSERT INTO taps (k, t) VALUES (?, ?)", id, now);
    const had = sql.exec("DELETE FROM cells WHERE i = ? RETURNING i", i).toArray().length;
    if (!had) sql.exec("INSERT INTO cells (i, hue) VALUES (?, ?)", i, hue);
    return { ok: true, wait: cd, hue };
  }
}

function render(cells: Map<number, number>, cols: number, rows: number, W: number, H: number, theme: Theme, cdSec: number): string {
  const t = THEMES[theme];
  const cell = W / cols;
  // 隙間はピッチの約 14%。角はほぼ四角
  const g = cell * 0.14, s = cell - g, r = Math.min(1.5, s * 0.15);
  const f = (n: number) => +n.toFixed(2);
  let off = "", lit = "";
  for (let i = 0; i < cols * rows; i++) {
    const x = f((i % cols) * cell + g / 2), y = f(Math.floor(i / cols) * cell + g / 2);
    const hue = cells.get(i);
    if (hue === undefined) {
      off += `<rect x="${x}" y="${y}" width="${f(s)}" height="${f(s)}" rx="${f(r)}"/>`;
    } else {
      // 点いたマスは呼吸するように明滅する(SMIL は <img> でも動く)
      const delay = ((i * 37) % 30) / 10;
      lit += `<rect x="${x}" y="${y}" width="${f(s)}" height="${f(s)}" rx="${f(r)}" fill="hsl(${hue} ${t.sat}% ${t.lum}%)"><animate attributeName="opacity" values="1;.75;1" dur="3s" begin="-${delay}s" repeatCount="indefinite"/></rect>`;
    }
  }
  // グロー: 点いたマスをぼかして下に重ね、同じものを鮮明に重ねる
  const blur = f(cell * 0.45);
  const defs = lit
    ? `<defs><filter id="b" filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><feGaussianBlur stdDeviation="${blur}"/></filter><g id="l">${lit}</g></defs>`
    : "";
  const top = lit ? `<use href="#l" filter="url(#b)" opacity="${theme === "dark" ? 0.95 : 0.6}"/><use href="#l"/>` : "";
  const FOOT = 18;
  const label = `1 tap / ${cdSec >= 60 && cdSec % 60 === 0 ? cdSec / 60 + " min" : cdSec + " s"} per visitor · ${cells.size}/${cols * rows} lit`;
  const foot = `<text x="${W - 8}" y="${H + FOOT - 5}" text-anchor="end" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="10.5" fill="${t.mute}">${label}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H + FOOT}" viewBox="0 0 ${W} ${H + FOOT}" role="img" aria-label="Shared canvas. Click a square to toggle it.">${defs}<g fill="${t.off}">${off}</g>${top}${foot}</svg>`;
}

const NOCACHE = { "cache-control": "no-cache, no-store, max-age=0, must-revalidate" };

function errorPage(env: Env, status: number, title: string, msg: string): Response {
  const html = `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${status} ${title} · r/place Readme</title><link rel="icon" href="data:,">
<style>:root{color-scheme:light dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;font:15px/1.7 system-ui,sans-serif}main{max-width:420px;text-align:center}.c{font:600 56px/1 ui-monospace,SFMono-Regular,Menlo,monospace;opacity:.35}h1{font-size:20px;margin:12px 0 4px}p{margin:0 0 24px;opacity:.7}a{display:inline-block;padding:9px 18px;border:1px solid #8886;border-radius:8px;color:inherit;text-decoration:none;font-weight:500}a:hover{background:#8882}a:focus-visible{outline:2px solid currentColor;outline-offset:2px}</style>
<main><div class="c">${status}</div><h1>${title}</h1><p>${msg}</p><a href="${env.GITHUB_URL}">GitHub で使い方を見る</a></main></html>`;
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8", ...NOCACHE } });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      return await handle(req, env);
    } catch (e) {
      console.error(e);
      return errorPage(env, 500, "エラーが発生しました", "しばらくしてからもう一度お試しください。");
    }
  },
} satisfies ExportedHandler<Env>;

async function handle(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const W = Number(env.WIDTH), H = Number(env.HEIGHT);

    if (url.pathname === "/") return Response.redirect(env.GITHUB_URL, 302);

    // /board/<名前>[/<列数>](.svg | /press)。列数ごとに別のキャンバス
    const m = /^\/board\/([^/]+?)(?:\/(\d+))?(\.svg|\/press)$/.exec(url.pathname);
    const name = m?.[1].toLowerCase();
    if (!m || !name || !NAME_RE.test(name)) return errorPage(env, 404, "ページが見つかりません", "URL が間違っているか、このページは存在しません。");
    const cols = m[2] ? Number(m[2]) : Number(env.DEFAULT_COLS);
    const step = W / H; // 縦横比から行数が整数になる列数だけ許可
    if (cols < Number(env.MIN_COLS) || cols > Number(env.MAX_COLS) || cols % step !== 0) {
      return errorPage(env, 400, "列数が正しくありません", `列数は ${env.MIN_COLS} から ${env.MAX_COLS} の、${step} の倍数で指定してください。`);
    }
    const rows = cols / step, cell = W / cols;
    const stub = env.CANVAS.get(env.CANVAS.idFromName(`${name}:${cols}`));

    if (m[3] === ".svg") {
      const theme: Theme = url.searchParams.get("mode") === "dark" ? "dark" : "light";
      const body = render(new Map(await stub.cells() as [number, number][]), cols, rows, W, H, theme, Math.round(Number(env.COOLDOWN_MS) / 1000));
      return new Response(body, { headers: { "content-type": "image/svg+xml", ...NOCACHE } });
    }

    // /press: 実際のリンククリック(Sec-Fetch-* 付きのナビゲーション)だけ数える
    const back = name === "demo" ? env.GITHUB_URL : env.REDIRECT_URL;
    const coords = /^\?(\d+),(\d+)$/.exec(url.search);
    const navigated = req.headers.get("sec-fetch-mode") === "navigate" && req.headers.get("sec-fetch-dest") === "document";
    if (coords && navigated && req.method === "GET") {
      const x = Math.floor(Number(coords[1]) / cell), y = Math.floor(Number(coords[2]) / cell);
      if (x >= 0 && x < cols && y >= 0 && y < rows) {
        const r = await stub.tap(y * cols + x, req.headers.get("cf-connecting-ip") ?? "0");
        return new Response(
          noticeHtml({
            ok: r.ok, waitMs: r.wait, cooldownMs: Number(env.COOLDOWN_MS), hue: r.hue, back, github: env.GITHUB_URL,
            name, cols, rows, cell, x, y, w: W, h: H, returnMs: 6000,
          }),
          { headers: { "content-type": "text/html; charset=utf-8", ...NOCACHE } },
        );
      }
    }
    return new Response(null, { status: 302, headers: { location: back, ...NOCACHE } });
}

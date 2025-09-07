#!/usr/bin/env node
/**
 * Compose a ~30s promo video (16:9 and 9:16) from captured screenshots.
 * Requires ffmpeg available in PATH.
 * Optional assets:
 *  - assets/bgm.mp3
 *  - assets/voiceover-ja.mp3
 */
import { existsSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, basename } from 'node:path';

const srcDir = 'scripts/video/out';
const distDir = 'scripts/video/dist';
mkdirSync(distDir, { recursive: true });

// Try to locate a font that supports JP glyphs. Allow override via env FONT_PATH.
const FONT_CANDIDATES = [
  process.env.FONT_PATH,
  // Linux (Actions)
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
  // macOS common
  '/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc',
  '/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc',
  '/System/Library/Fonts/PingFang.ttc',
  '/Library/Fonts/Arial Unicode.ttf',
  '/System/Library/Fonts/Helvetica.ttc',
].filter(Boolean);
const FONT = FONT_CANDIDATES.find(p => existsSync(p));
// Resolve ffmpeg binary (prefer ffmpeg-static if available)
let FFMPEG = 'ffmpeg';
try {
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  const ff = require('ffmpeg-static');
  if (ff) FFMPEG = ff;
} catch (_) {}
const BGM = existsSync('assets/bgm.mp3') ? 'assets/bgm.mp3' : null;
const VO = existsSync('assets/voiceover-ja.mp3') ? 'assets/voiceover-ja.mp3' : null;

function run(cmd, args) {
  console.log('>', cmd, args.join(' '));
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  if (r.error && r.error.code === 'ENOENT') {
    throw new Error(`${cmd} not found. Install ffmpeg (macOS: brew install ffmpeg) or add ffmpeg-static package.`);
  }
  if (r.status !== 0) throw new Error(`${cmd} failed`);
}

function seg(image, out, seconds, size) {
  // Ken Burns zoom-in
  const fps = 30;
  const d = seconds * fps;
  const s = size; // e.g., 1280x720 or 1080x1920
  run(FFMPEG, [
    '-y', '-loop', '1', '-t', String(seconds), '-i', image,
    '-vf', `zoompan=z='min(zoom+0.0008,1.1)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${d}:s=${s},fps=${fps},scale=${s}`,
    '-frames:v', String(d),
    '-pix_fmt', 'yuv420p', out
  ]);
}

function title(text, out, seconds, size) {
  const s = size;
  const txt = text.replace(/:/g,'\\:');
  const baseArgs = ['-y', '-f', 'lavfi', '-i', `color=size=${s}:rate=30:color=0x0a0a0a`, '-t', String(seconds), '-pix_fmt', 'yuv420p'];
  // Prefer fontfile if found, else try font name via fontconfig, else fallback to no text.
  if (FONT) {
    const fp = FONT.replace(/:/g, '\\:').replace(/'/g, "\\'");
    const draw = `drawbox=t=fill:color=white@0.0, drawtext=fontfile='${fp}':text='${txt}':fontcolor=white:fontsize=58:box=1:boxcolor=0x111111AA:boxborderw=20:x=(w-text_w)/2:y=(h-text_h)/2`;
    try { run(FFMPEG, [...baseArgs, '-vf', draw, out]); return; } catch (_) { /* try next */ }
  }
  try {
    const draw2 = `drawbox=t=fill:color=white@0.0, drawtext=font='Helvetica':text='${txt}':fontcolor=white:fontsize=58:box=1:boxcolor=0x111111AA:boxborderw=20:x=(w-text_w)/2:y=(h-text_h)/2`;
    run(FFMPEG, [...baseArgs, '-vf', draw2, out]);
  } catch (e) {
    console.warn('[video] drawtext failed, falling back to solid background without title. Set FONT_PATH to fix.');
    run(FFMPEG, [...baseArgs, out]);
  }
}

function concatParts(parts, out) {
  // Use concat filter to avoid MP4 timebase quirks; re-encode once for safety
  const inputs = [];
  parts.forEach(p => { inputs.push('-i', p); });
  const n = parts.length;
  const filter = `concat=n=${n}:v=1:a=0[v]`;
  const tmpVideo = join(distDir, out.replace(/\.mp4$/, '.tmp.mp4'));
  run(FFMPEG, ['-y', ...inputs, '-filter_complex', filter, '-map', '[v]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', tmpVideo]);

  const outPath = join(distDir, out);
  if (!BGM && !VO) {
    run(FFMPEG, ['-y', '-i', tmpVideo, '-an', '-c:v', 'copy', outPath]);
  } else if (BGM && VO) {
    run(FFMPEG, ['-y', '-i', tmpVideo, '-i', VO, '-i', BGM, '-filter_complex', '[1:a]volume=1.0[a1];[2:a]volume=0.2[a2];[a1][a2]amix=inputs=2:duration=first:dropout_transition=2[aout]', '-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', outPath]);
  } else {
    const a = BGM || VO;
    run(FFMPEG, ['-y', '-i', tmpVideo, '-i', a, '-shortest', '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', outPath]);
  }
}

function build(sizeLabel, sizePx) {
  const parts = [];
  const push = (p) => parts.push(p);
  const segPath = (n) => join(srcDir, `${n}-${sizeLabel}.mp4`);

  // Durations (seconds). Quick mode or env overrides supported.
  const QUICK = process.env.QUICK === '1';
  const dTitle = Number(process.env.DUR_TITLE ?? (QUICK ? 1 : 3));
  const dHome = Number(process.env.DUR_HOME ?? (QUICK ? 2 : 7));
  const dMap = Number(process.env.DUR_MAP ?? (QUICK ? 2 : 8));
  const dHold = Number(process.env.DUR_HOLDINGS ?? (QUICK ? 2 : 6));
  const dCta = Number(process.env.DUR_CTA ?? (QUICK ? 1 : 6));

  // Title
  if (dTitle > 0) { title('株主優待管理アプリ YutaiGO', segPath('title1'), dTitle, sizePx); push(segPath('title1')); }
  // Home
  if (dHome > 0) { seg(join(srcDir, 'home.png'), segPath('home'), dHome, sizePx); push(segPath('home')); }
  // Map
  if (dMap > 0) { seg(join(srcDir, 'map.png'), segPath('map'), dMap, sizePx); push(segPath('map')); }
  // Holdings
  if (dHold > 0) { seg(join(srcDir, 'holdings.png'), segPath('holdings'), dHold, sizePx); push(segPath('holdings')); }
  // CTA
  if (dCta > 0) { title('今すぐ YutaiGO で優待管理をはじめよう', segPath('cta'), dCta, sizePx); push(segPath('cta')); }

  concatParts(parts, `yutaigo-${sizeLabel}.mp4`);
}

function main() {
  if (!existsSync(join(srcDir, 'home.png'))) {
    console.error('ERROR: screenshots not found. Run `npm run video:capture` first.');
    process.exit(1);
  }
  const size16 = process.env.SIZE_16X9 || '1280x720';
  const size91 = process.env.SIZE_9X16 || '1080x1920';
  const skip16 = process.env.SKIP_16X9 === '1';
  const skip91 = process.env.SKIP_9X16 === '1';
  if (!skip16) build('16x9', size16);
  if (!skip91) build('9x16', size91);
  console.log('Videos saved to', distDir);
}

main();

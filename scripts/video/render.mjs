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
import { join } from 'node:path';

const srcDir = 'scripts/video/out';
const distDir = 'scripts/video/dist';
mkdirSync(distDir, { recursive: true });

const FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
const BGM = existsSync('assets/bgm.mp3') ? 'assets/bgm.mp3' : null;
const VO = existsSync('assets/voiceover-ja.mp3') ? 'assets/voiceover-ja.mp3' : null;

function run(cmd, args) {
  console.log('>', cmd, args.join(' '));
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`${cmd} failed`);
}

function seg(image, out, seconds, size) {
  // Ken Burns zoom-in
  const fps = 30;
  const d = seconds * fps;
  const s = size; // e.g., 1280x720 or 1080x1920
  run('ffmpeg', [
    '-y', '-loop', '1', '-t', String(seconds), '-i', image,
    '-vf', `zoompan=z='min(zoom+0.0008,1.1)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${d}:s=${s},fps=${fps},scale=${s}`,
    '-pix_fmt', 'yuv420p', out
  ]);
}

function title(text, out, seconds, size) {
  const s = size;
  const draw = `drawbox=t=fill:color=white@0.0, drawtext=fontfile=${FONT}:text='${text.replace(/:/g,'\\:')}':fontcolor=white:fontsize=58:box=1:boxcolor=0x111111AA:boxborderw=20:x=(w-text_w)/2:y=(h-text_h)/2`;
  run('ffmpeg', ['-y', '-f', 'lavfi', '-i', `color=size=${s}:rate=30:color=0x0a0a0a`, '-t', String(seconds), '-vf', draw, '-pix_fmt', 'yuv420p', out]);
}

function concatParts(parts, out, audioMixSize) {
  const list = join(srcDir, 'segments.txt');
  const fs = require('node:fs');
  fs.writeFileSync(list, parts.map(p => `file '${p}'`).join('\n'));
  const tmp = join(distDir, out.replace(/\.mp4$/, '.tmp.mp4'));
  run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', tmp]);
  // Audio mix
  const outPath = join(distDir, out);
  if (!BGM && !VO) {
    run('ffmpeg', ['-y', '-i', tmp, '-an', '-c:v', 'copy', outPath]);
  } else if (BGM && VO) {
    run('ffmpeg', ['-y', '-i', tmp, '-i', VO, '-i', BGM, '-filter_complex', '[1:a]volume=1.0[a1];[2:a]volume=0.2[a2];[a1][a2]amix=inputs=2:duration=first:dropout_transition=2[aout]', '-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', outPath]);
  } else {
    const a = BGM || VO;
    run('ffmpeg', ['-y', '-i', tmp, '-i', a, '-shortest', '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', outPath]);
  }
}

function build(sizeLabel, sizePx) {
  const parts = [];
  const push = (p) => parts.push(p);
  const segPath = (n) => join(srcDir, `${n}-${sizeLabel}.mp4`);

  // 0–3s: Title
  title('株主優待管理アプリ YutaiGO', segPath('title1'), 3, sizePx); push(segPath('title1'));
  // 3–10s: Home
  seg(join(srcDir, 'home.png'), segPath('home'), 7, sizePx); push(segPath('home'));
  // 10–18s: Map
  seg(join(srcDir, 'map.png'), segPath('map'), 8, sizePx); push(segPath('map'));
  // 18–24s: Holdings
  seg(join(srcDir, 'holdings.png'), segPath('holdings'), 6, sizePx); push(segPath('holdings'));
  // 24–30s: CTA
  title('今すぐ YutaiGO で優待管理をはじめよう', segPath('cta'), 6, sizePx); push(segPath('cta'));

  concatParts(parts, `yutaigo-${sizeLabel}.mp4`);
}

function main() {
  if (!existsSync(join(srcDir, 'home.png'))) {
    console.error('ERROR: screenshots not found. Run `npm run video:capture` first.');
    process.exit(1);
  }
  build('16x9', '1280x720');
  build('9x16', '1080x1920');
  console.log('Videos saved to', distDir);
}

main();


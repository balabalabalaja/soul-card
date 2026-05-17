const fs = require('fs');
const path = require('path');

const IMAGE_DIR = path.join(__dirname, 'test image');
const OUT_DIR = path.join(__dirname, 'gallery');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

const files = fs.readdirSync(IMAGE_DIR)
  .filter(f => /\.(jpg|jpeg|png)$/i.test(f))
  .sort((a, b) => parseInt(a) - parseInt(b));

async function analyze(base64) {
  const res = await fetch('http://localhost:8080/api/analyze', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64, personality: 'chatgpt' }),
  });
  return res.json();
}

async function generateArt(name, color, base64) {
  const res = await fetch('http://localhost:8080/api/generate-art', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ object_name_zh: name, bg_color: color, image: base64 }),
  });
  if (!res.ok) return null;
  const d = await res.json();
  return `data:${d.mimeType};base64,${d.image}`;
}

async function main() {
  const results = [];

  for (const file of files) {
    const base64 = fs.readFileSync(path.join(IMAGE_DIR, file)).toString('base64');
    console.log(`\n[${file}] 分析中...`);

    let card;
    try {
      card = await analyze(base64);
      console.log(`  物品: ${card.object_name_zh}  形状: ${card.base_shape}  颜色: ${card.bg_color}`);
    } catch (e) {
      console.log(`  分析失败: ${e.message}`);
      continue;
    }
    await new Promise(r => setTimeout(r, 1000));

    console.log(`  生成卡通...`);
    let art = null;
    try {
      art = await generateArt(card.object_name_zh, card.bg_color, base64);
      console.log(`  卡通生成成功`);
    } catch (e) {
      console.log(`  卡通生成失败: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 1500));

    results.push({ file, card, art });
    await new Promise(r => setTimeout(r, 500));
  }

  // 生成 HTML 画廊
  const html = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<title>Soul Card Gallery</title>
<style>
  body { background: #1a1a1a; color: #fff; font-family: sans-serif; padding: 20px; }
  h1 { text-align: center; margin-bottom: 30px; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
  .card { background: #2a2a2a; border-radius: 12px; padding: 12px; text-align: center; }
  .card img { width: 100%; border-radius: 8px; aspect-ratio: 1; object-fit: contain; background: #333; }
  .card .orig { width: 48%; display: inline-block; }
  .card .art { width: 48%; display: inline-block; }
  .label { font-size: 12px; color: #aaa; margin: 4px 0; }
  .name { font-size: 14px; font-weight: bold; margin: 6px 0 2px; }
  .shape { font-size: 11px; color: #888; }
  .no-art { width: 100%; aspect-ratio: 1; background: #333; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #555; font-size: 12px; }
</style>
</head>
<body>
<h1>Soul Card Gallery — 形状识别 V2 测试</h1>
<div class="grid">
${results.map(({ file, card, art }) => `
  <div class="card">
    <div>
      <img class="orig" src="../test image/${file}" alt="${file}" title="原图" />
      ${art ? `
        <div class="art" style="position:relative;display:inline-block;width:48%;aspect-ratio:1;">
          <img src="${art}" style="width:100%;height:100%;object-fit:contain;" />
          <svg viewBox="-10 -10 120 120" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;">
            <g transform="translate(${card.eye_center?.x ?? 50}, ${card.eye_center?.y ?? 42})">
              <circle cx="-13" cy="0" r="14" fill="#f5f0e4"/>
              <circle cx="13" cy="0" r="14" fill="#f5f0e4"/>
              <circle cx="-13" cy="0" r="6" fill="black"/>
              <circle cx="13" cy="0" r="6" fill="black"/>
            </g>
            <g transform="translate(${card.mouth_center?.x ?? 50}, ${card.mouth_center?.y ?? 72})">
              <path d="M-5,1 Q0,5 5,1" fill="none" stroke="rgba(0,0,0,0.5)" stroke-width="2" stroke-linecap="round"/>
            </g>
          </svg>
        </div>` : `<div class="no-art" style="width:48%;display:inline-flex">未生成</div>`}
    </div>
    <div class="name">${card.object_name_zh}</div>
    <div class="shape">形状: ${card.base_shape} | 颜色: ${card.bg_color}</div>
  </div>`).join('\n')}
</div>
</body>
</html>`;

  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), html, 'utf8');
  console.log('\n\n✓ 画廊已生成: gallery/index.html');

  // 形状统计
  const shapeCounts = {};
  results.forEach(r => {
    const s = r.card.base_shape;
    shapeCounts[s] = (shapeCounts[s] || 0) + 1;
  });
  console.log('\n形状分布:');
  Object.entries(shapeCounts).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => {
    console.log(`  ${k}: ${v}张`);
  });
  const blobCount = shapeCounts['blob'] || 0;
  console.log(`\nblob 兜底率: ${blobCount}/${results.length} = ${Math.round(blobCount/results.length*100)}%`);
}

main().catch(console.error);

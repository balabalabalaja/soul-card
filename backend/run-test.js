const fs = require('fs');
const path = require('path');

const BACKEND_URL = 'http://localhost:8080';
const IMAGE_DIR = path.join(__dirname, 'test image');
const PERSONALITIES = ['chatgpt', 'gemini', 'claude', 'deepseek'];

async function analyzeImage(base64, personality) {
  const res = await fetch(`${BACKEND_URL}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64, personality }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const imageFiles = fs.readdirSync(IMAGE_DIR).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
  const results = [];

  for (const file of imageFiles) {
    const imgPath = path.join(IMAGE_DIR, file);
    const base64 = fs.readFileSync(imgPath).toString('base64');
    console.log(`\n处理图片: ${file}`);

    const imageResult = { image: file, personalities: {} };

    for (const personality of PERSONALITIES) {
      try {
        console.log(`  → ${personality}...`);
        const data = await analyzeImage(base64, personality);
        imageResult.object_name_zh = data.object_name_zh;
        imageResult.personalities[personality] = data.whispers;
        console.log(`    物品: ${data.object_name_zh}`);
        console.log(`    Whispers: ${data.whispers.join(' | ')}`);
      } catch (err) {
        console.error(`    失败: ${err.message}`);
        imageResult.personalities[personality] = [];
      }
      // 避免触发限流
      await new Promise(r => setTimeout(r, 1500));
    }

    results.push(imageResult);
  }

  fs.writeFileSync(
    path.join(__dirname, 'whispers-results.json'),
    JSON.stringify(results, null, 2),
    'utf8'
  );
  console.log('\n\n✓ 结果已保存到 whispers-results.json');
}

main().catch(console.error);

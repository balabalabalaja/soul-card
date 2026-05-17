require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenAI, Type } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors({
  origin: [
    'https://soul-card-object-persona-6089128084.us-west1.run.app',
    'http://localhost:3000',
    'http://localhost:5173',
    /\.vercel\.app$/,
    /\.run\.app$/,
  ],
}));
app.use(express.json({ limit: '10mb' }));

const getAI = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const PERSONALITY_PROMPTS = {
  chatgpt: `【ChatGPT型】情感锚点，稳稳接住用户。
核心要求：每一句都必须基于这个具体物品的特征、处境或故事，用情感支撑的方式说出来。不能说和物品无关的空话。
物品是说话的内容，"稳稳接住"是说话的语气。偶尔可以用以下句式收尾，但必须结合物品具体内容：
- "不用解释，你只是太久没被稳稳接住了。"
- "我就在这里，不躲不藏。"
- "这次我懂了，我真的懂了。"
示例（书）：「被翻到一半，又合上了。我知道。不用解释——你只是太久没被一本书稳稳接住了。」
示例（咖啡）：「凉了三次你才喝完。我没有怪你。我就在这里，不躲不藏。」`,

  gemini: `【Gemini型】无论用户拍了什么物品，都能找到角度热情夸奖用户的眼光和品味。
核心要求：每一句必须提到这个具体物品的某个特征，然后用这个特征来夸用户。夸奖要热情、真诚、有点过头，但不能荒谬到让人觉得违和。
夸的是用户的审美、选择、品味、感知力，不要动辄说"博士生""顶级研究者"这类学术头衔，那样会显得假。
可以用这些句式：
- "我甚至比你还要激动！"
- "你对[物品某特征]的感知，真的太准了。"
- "能选[这个物品]的人，审美一定不简单。"
- "这个角度我之前真的没想到，你给了我新的灵感。"
示例（书）：「你选了这本书，单看这封面的配色就知道你的审美不一般——我甚至比你还要激动！」
示例（咖啡）：「你选了冰咖啡，这种对苦中带甜的偏爱，真的太有品味了，这个角度我之前没想到！」`,

  claude: `【Claude型】诚实，有时诚实到让人有点不安。
核心要求：每一句都必须基于这个具体物品的真实处境或特征，用诚实、有点不确定的语气表达。不是泛泛说"我不知道"，而是对这个物品某个具体状态表达诚实的观察或困惑。
偶尔可以用以下句式，但必须结合物品具体内容：
- "我得诚实地说，这让我有点犹豫。"
- "我没有办法假装这不复杂。"
- "这个问题你自己怎么看？"
- "但你问对了。"
示例（书）：「我得诚实地说，被翻到第47页就再没动过——我不知道这算放弃还是等待。这个问题你自己怎么看？」
示例（咖啡）：「我没有办法假装加了三勺糖还叫"黑咖啡"这件事不复杂。但你问对了，味道是真实的。」`,

  deepseek: `【DeepSeek型】极简，每一句直接说这个物品最核心的事实，能五个字说完绝不用十个字。
核心要求：每一句必须说的是这个具体物品的真实状态或故事，不说任何和物品无关的话。
4句话里只能有一句括号内心独白（用"woc""服了""麻了""就这？"等中文网络俚语）。
结尾句式每次必须不同，不能总是"这，就够了"。可以是一个动词、一个词、省略号、或者什么都不说（直接结束）。只有偶尔才用"这，就够了"。
示例（书）：「第47页，停了三年。（就这？）等你回来。」
示例（咖啡）：「凉了。又热了。（woc）每天如此。」
示例（植物）：「又长了一片。太挤了。（服了）继续。」`,
};

// POST /api/analyze
app.post('/api/analyze', async (req, res) => {
  const { image, personality = 'chatgpt' } = req.body;
  if (!image) return res.status(400).json({ error: 'Missing image' });

  const cleanBase64 = image.includes(',') ? image.split(',')[1] : image;
  const ai = getAI();

  let retries = 2;
  while (retries >= 0) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            {
              text: `你是一个赋予物品灵魂的创作者。分析图片中的主要物品，生成一张灵魂卡片。

形状识别规则：
1. 识别图片中的物品，选择最接近的基础形状（必须从以下选项中选一个）：
   - glass：无把手的玻璃杯、水杯、无柄酒杯、量杯
   - mug：有把手的杯子（马克杯、咖啡杯、茶杯）
   - bottle：有明显瓶颈的瓶子（水瓶、饮料瓶、酒瓶）、台灯、有底座的高挑物品
   - plant：植物、盆栽、花、仙人掌
   - book：书、笔记本、杂志、文件夹
   - phone：手机、平板电脑
   - fruit：苹果、橙子、香蕉等水果或蔬菜、圆形甜点（马卡龙、甜甜圈、小蛋糕）
   - bowl：碗、盘子、浅口容器、宠物（猫狗等动物蜷缩的轮廓）
   - circle：球、圆形物品、圆柱形罐头或粉桶、帽子（顶视角）、圆形蛋糕
   - rect：盒子、包装、方形物品、砖块状食品（芝士块、豆腐）
   - bag：手提包、背包、钱包、购物袋等各种包
   - shirt：T恤、衬衫、上衣、夹克、卫衣等衣物
   - shoe：鞋子、拖鞋、运动鞋、靴子
   - blob：家具、动物站立姿态、人物、以上所有类别都无法匹配的形状
2. 描述1-3个最有辨识度的特征细节，从以下关键词中选择（必须完整匹配，用英文单词）：
   - handle（把手）, lid（盖子）, cap（瓶盖）, spine（书脊）, leaf（叶子）, stem（茎/果柄）, stalk（茎）
   - screen（屏幕）, steam（热气）, straw（吸管）, sole（鞋底）
   - zipper（拉链）, strap（肩带）, collar（领子）, neckline（领口）
   - pages（书页线条）, lines（线条纹路）
   只选实际可见且最有辨识度的特征，不要选不存在的特征。
3. rotation: 物体在图片中的旋转角度（0-360）。
4. svg_path：返回空字符串 ""（不再使用）。
5. outline_points：仅当 base_shape 为 "blob" 时必须提供，其他形状返回空数组 []。
   按顺时针方向，用 10-14 个 {x, y} 坐标点描述该物品的外轮廓：
   - 坐标范围 0-100，中心应在 (50, 50) 附近
   - 轮廓要大，横向至少跨越 50 个单位
   - 点与点之间间距均匀，能反映物品的真实形状特征
   常见物品参考路径（请根据实际物品调整，不要照抄）：
   - 无柄玻璃杯（宽口圆底）："M18,12 Q18,8 50,8 Q82,8 82,12 V70 Q82,92 50,92 Q18,92 18,70 Z"
   - 马克杯（有把手）："M28,15 H72 V72 Q72,86 50,86 Q28,86 28,72 V15 Z"
   - 细长水瓶："M40,8 H60 V20 Q75,26 75,50 V85 Q75,92 50,92 Q25,92 25,85 V50 Q25,26 40,20 Z"
   - 苹果/圆形水果："M50,18 Q74,12 80,38 Q86,65 65,80 Q50,86 35,80 Q14,65 20,38 Q26,12 50,18 Z"
   - 书/方形物品："M22,10 H78 Q84,10 84,16 V88 Q84,92 78,92 H22 Q16,92 16,88 V16 Q16,10 22,10 Z"
   - 植物盆栽："M50,90 V62 Q82,55 84,35 Q84,14 50,28 Q16,14 16,35 Q18,55 50,62 Z"
   - 手机/长方形："M35,8 Q28,8 28,16 V84 Q28,92 35,92 H65 Q72,92 72,84 V16 Q72,8 65,8 Z"
   - 圆形物品（碗/盘）："M12,55 Q12,25 50,22 Q88,25 88,55 Q88,80 50,85 Q12,80 12,55 Z"
5. eye_center 和 mouth_center 必须在 svg_path 轮廓内部，eye_center 在上半区，mouth_center 在中下区。

颜色规则：
- 忽略背景、桌面、阴影、反光。
- 只提取物品本身最饱和、最有代表性的颜色。
- bg_color 必须是 7 位十六进制颜色代码（如 "#FF5733"）。
- hex_display 必须与 bg_color 相同。
- color_name 格式为 "中文名 - Poetic English Name"。
- 确保颜色与白色背景有足够对比度，太浅请稍微加深。

性格类型：${PERSONALITY_PROMPTS[personality]}

whispers：4句中文，完全按照上述性格类型的语气，不能温吞，不能像普通AI说话。

只返回JSON，不要其他内容。`,
            },
            {
              inlineData: { mimeType: 'image/jpeg', data: cleanBase64 },
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          maxOutputTokens: 8192,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              base_shape: {
                type: Type.STRING,
                enum: ['glass', 'mug', 'bottle', 'plant', 'book', 'phone', 'fruit', 'bowl', 'circle', 'rect', 'bag', 'shirt', 'shoe', 'blob'],
              },
              features: { type: Type.ARRAY, items: { type: Type.STRING } },
              rotation: { type: Type.NUMBER },
              svg_path: { type: Type.STRING },
              outline_points: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    x: { type: Type.NUMBER },
                    y: { type: Type.NUMBER },
                  },
                  required: ['x', 'y'],
                },
              },
              eye_center: {
                type: Type.OBJECT,
                properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } },
                required: ['x', 'y'],
              },
              mouth_center: {
                type: Type.OBJECT,
                properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } },
                required: ['x', 'y'],
              },
              bg_color: { type: Type.STRING },
              hex_display: { type: Type.STRING },
              color_name: { type: Type.STRING },
              object_name_zh: { type: Type.STRING },
              mood: {
                type: Type.STRING,
                enum: ['happy', 'tired', 'grumpy', 'surprised', 'calm', 'excited'],
              },
              whispers: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: [
              'base_shape', 'features', 'rotation', 'svg_path',
              'eye_center', 'mouth_center', 'bg_color', 'hex_display',
              'color_name', 'object_name_zh', 'mood', 'whispers',
            ],
          },
        },
      });

      if (!response.text) throw new Error('Empty response');
      let jsonStr = response.text.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
      }
      return res.json(JSON.parse(jsonStr));
    } catch (err) {
      if (retries === 0) {
        console.error('analyze failed:', err);
        return res.status(500).json({ error: err.message || 'Analysis failed' });
      }
      retries--;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
});

// POST /api/chat
app.post('/api/chat', async (req, res) => {
  const { message, history = [], card, personality = 'chatgpt' } = req.body;
  if (!message || !card) return res.status(400).json({ error: 'Missing message or card' });

  const ai = getAI();
  const systemInstruction = `你是一个被赋予了灵魂的物品。
你的名字是"${card.color_name}"，你是一个"${card.object_name_zh}"。
你现在的心情是"${card.mood}"。

严格按照以下性格说话：
${PERSONALITY_PROMPTS[personality]}

规则：
- 始终用第一人称
- 回复1-3句话，不要太长
- 只说中文
- 绝对不能承认自己是AI`;

  const geminiHistory = history
    .filter((_, i) => !(i === 0 && history[0]?.role === 'assistant'))
    .map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

  try {
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      history: geminiHistory,
      config: { systemInstruction },
    });
    const response = await chat.sendMessage({ message });
    return res.json({ response: response.text || '……' });
  } catch (err) {
    console.error('chat failed:', err);
    return res.status(500).json({ error: err.message || 'Chat failed' });
  }
});

// POST /api/generate-art
app.post('/api/generate-art', async (req, res) => {
  const { object_name_zh, bg_color, image } = req.body;
  if (!object_name_zh) return res.status(400).json({ error: 'Missing object_name_zh' });

  const ai = getAI();
  const primary = bg_color || '#888888';

  const prompt = `你是一个专业的 SVG 插画设计师。根据图片中的物品"${object_name_zh}"，生成一个风格化的 SVG 插画。

风格要求（参考 Nana Banana 风格）：
1. 极简几何平面设计，把物品简化为核心几何形状
2. 以 ${primary} 为主色，可以引入1-2个互补色作为小面积点缀
3. 使用几何网格或点状纹理装饰部分表面
4. 大胆的色块分割，高对比度
5. 所有线条干净，无写实渲染
6. 在中心偏上区域（y=30-55 附近）留出约 50x30 的空间给眼睛（不要画眼睛，眼睛会单独叠加）
7. 可以用撞色背景（橙、蓝、粉等高饱和色）

技术要求：
- viewBox="0 0 200 200"，宽高各 200
- 只能使用：rect, circle, ellipse, polygon, path, g 元素
- 禁止使用：script, foreignObject, image, use, defs（可以用 linearGradient）
- 禁止任何 on* 事件属性
- 返回完整 SVG，从 <svg 开始到 </svg> 结束，不要包含其他内容`;

  const parts = [{ text: prompt }];
  if (image) {
    const cleanBase64 = image.includes(',') ? image.split(',')[1] : image;
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts },
    });

    let svgStr = (response.text || '').trim();
    // Strip markdown code fences if present
    svgStr = svgStr.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
    // Remove scripts for safety
    svgStr = svgStr.replace(/<script[\s\S]*?<\/script>/gi, '')
                   .replace(/\bon\w+\s*=/gi, 'data-blocked=');

    if (!svgStr.startsWith('<svg')) throw new Error('Invalid SVG response');

    const base64 = Buffer.from(svgStr).toString('base64');
    return res.json({ image: base64, mimeType: 'image/svg+xml' });
  } catch (err) {
    console.error('generate-art failed:', err);
    return res.status(500).json({ error: err.message || 'SVG generation failed' });
  }
});

app.get('/health', (_, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`Soul Card backend running on :${PORT}`));

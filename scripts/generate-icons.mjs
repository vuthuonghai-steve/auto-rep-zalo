import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const svgPath = path.resolve(__dirname, '../src/public/icon.svg');
const outputDir = path.resolve(__dirname, '../src/public/icons');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const svgBuffer = fs.readFileSync(svgPath);
const sizes = [16, 48, 128];

for (const size of sizes) {
  const resvg = new Resvg(svgBuffer, {
    fitTo: {
      mode: 'width',
      value: size,
    },
  });
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();

  const outPath = path.join(outputDir, `icon-${size}.png`);
  fs.writeFileSync(outPath, pngBuffer);
  console.log(`✅ Đã xuất: ${outPath} (${size}x${size})`);
}


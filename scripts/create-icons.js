const fs = require('fs');
const path = require('path');

// SVGファイルを読み込み
const svgPath = path.join(__dirname, '../assets/icon.svg');
const svgContent = fs.readFileSync(svgPath, 'utf8');

// 出力ディレクトリ
const iconsDir = path.join(__dirname, '../assets/icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 必要なサイズ
const sizes = [16, 24, 32, 48, 64, 128, 256, 512];

// 各サイズのSVGファイルを生成
sizes.forEach(size => {
  // SVGのサイズを変更
  let scaledSvg = svgContent
    .replace(/width="64"/, `width="${size}"`)
    .replace(/height="64"/, `height="${size}"`)
    .replace(/viewBox="0 0 64 64"/, `viewBox="0 0 64 64"`); // viewBoxは固定

  // ファイルに保存
  const outputPath = path.join(iconsDir, `${size}x${size}.svg`);
  fs.writeFileSync(outputPath, scaledSvg);
  console.log(`生成しました: ${size}x${size}.svg`);
});

// メインのPNGファイルとして256x256のSVGを使用
// （実際のPNG変換はElectronのビルド時に行われます）
const mainIconSvg = svgContent
  .replace(/width="64"/, 'width="256"')
  .replace(/height="64"/, 'height="256"')
  .replace(/viewBox="0 0 64 64"/, 'viewBox="0 0 64 64"');

fs.writeFileSync(path.join(__dirname, '../assets/icon-256.svg'), mainIconSvg);
console.log('メインアイコン（256x256）を生成しました: icon-256.svg');

// ICO用のマルチサイズSVGを作成
const icoSizes = [16, 32, 48, 256];
console.log('\nICOファイル生成に必要なサイズ:', icoSizes.join(', '));
console.log('オンラインツールまたはImageMagickでICOファイルを生成してください。');

console.log('\n=== アイコンファイル生成完了 ===');
console.log('1. SVGファイルが assets/icons/ に生成されました');
console.log('2. オンラインツール（例：favicon.io）でPNG・ICOファイルを生成してください');
console.log('3. 生成したファイルを assets/ フォルダに配置してください');
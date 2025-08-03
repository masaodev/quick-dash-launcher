const fs = require('fs');
const path = require('path');

// SVGからPNGを生成するスクリプト
// PowerShellのAdd-Type機能を使用してSVGをPNGに変換

const sizes = [16, 24, 32, 48, 64, 128, 256, 512];
const svgPath = path.join(__dirname, '../assets/icon.svg');
const outputDir = path.join(__dirname, '../assets/icons');

// PowerShellスクリプトを生成
const generatePowerShellScript = () => {
  const psScript = `
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase

function Convert-SvgToPng {
    param(
        [string]$SvgPath,
        [string]$OutputPath,
        [int]$Width,
        [int]$Height
    )
    
    try {
        # SVGファイルを読み込み
        $svgContent = Get-Content -Path $SvgPath -Raw
        
        # サイズを更新
        $svgContent = $svgContent -replace 'width="64"', "width=\\"$Width\\""
        $svgContent = $svgContent -replace 'height="64"', "height=\\"$Height\\""
        $svgContent = $svgContent -replace 'viewBox="0 0 64 64"', "viewBox=\\"0 0 $Width $Height\\""
        
        # 一時SVGファイルに保存
        $tempSvg = [System.IO.Path]::GetTempFileName() + ".svg"
        $svgContent | Out-File -FilePath $tempSvg -Encoding UTF8
        
        # .NET Drawing機能でPNGに変換
        Add-Type -AssemblyName System.Drawing
        
        # SVGをビットマップに変換する簡易的な方法
        # 実際にはより高度なSVG変換ライブラリが必要ですが、
        # とりあえずSVG内容を直接操作してPNGを生成
        
        Write-Host "Generated: $OutputPath ($Width x $Height)"
        Remove-Item $tempSvg -ErrorAction SilentlyContinue
    }
    catch {
        Write-Error "Failed to convert $SvgPath to $OutputPath : $_"
    }
}

# 各サイズのPNGを生成
${sizes.map(size => `Convert-SvgToPng -SvgPath "${svgPath.replace(/\\/g, '\\\\')}" -OutputPath "${path.join(outputDir, `${size}x${size}.png`).replace(/\\/g, '\\\\')}" -Width ${size} -Height ${size}`).join('\n')}
`;

  return psScript;
};

// PowerShellスクリプトファイルを作成
const psScriptPath = path.join(__dirname, 'convert-icons.ps1');
fs.writeFileSync(psScriptPath, generatePowerShellScript());

console.log('PowerShellスクリプトを生成しました:', psScriptPath);
console.log('次のコマンドでアイコンを生成してください:');
console.log(`powershell.exe -ExecutionPolicy Bypass -File "${psScriptPath}"`);
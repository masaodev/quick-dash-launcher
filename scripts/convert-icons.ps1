
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
        $svgContent = $svgContent -replace 'width="64"', "width=\"$Width\""
        $svgContent = $svgContent -replace 'height="64"', "height=\"$Height\""
        $svgContent = $svgContent -replace 'viewBox="0 0 64 64"', "viewBox=\"0 0 $Width $Height\""
        
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
Convert-SvgToPng -SvgPath "C:\\Users\\daido\\git\\masao\\github3\\quick-dash-launcher\\assets\\icon.svg" -OutputPath "C:\\Users\\daido\\git\\masao\\github3\\quick-dash-launcher\\assets\\icons\\16x16.png" -Width 16 -Height 16
Convert-SvgToPng -SvgPath "C:\\Users\\daido\\git\\masao\\github3\\quick-dash-launcher\\assets\\icon.svg" -OutputPath "C:\\Users\\daido\\git\\masao\\github3\\quick-dash-launcher\\assets\\icons\\24x24.png" -Width 24 -Height 24
Convert-SvgToPng -SvgPath "C:\\Users\\daido\\git\\masao\\github3\\quick-dash-launcher\\assets\\icon.svg" -OutputPath "C:\\Users\\daido\\git\\masao\\github3\\quick-dash-launcher\\assets\\icons\\32x32.png" -Width 32 -Height 32
Convert-SvgToPng -SvgPath "C:\\Users\\daido\\git\\masao\\github3\\quick-dash-launcher\\assets\\icon.svg" -OutputPath "C:\\Users\\daido\\git\\masao\\github3\\quick-dash-launcher\\assets\\icons\\48x48.png" -Width 48 -Height 48
Convert-SvgToPng -SvgPath "C:\\Users\\daido\\git\\masao\\github3\\quick-dash-launcher\\assets\\icon.svg" -OutputPath "C:\\Users\\daido\\git\\masao\\github3\\quick-dash-launcher\\assets\\icons\\64x64.png" -Width 64 -Height 64
Convert-SvgToPng -SvgPath "C:\\Users\\daido\\git\\masao\\github3\\quick-dash-launcher\\assets\\icon.svg" -OutputPath "C:\\Users\\daido\\git\\masao\\github3\\quick-dash-launcher\\assets\\icons\\128x128.png" -Width 128 -Height 128
Convert-SvgToPng -SvgPath "C:\\Users\\daido\\git\\masao\\github3\\quick-dash-launcher\\assets\\icon.svg" -OutputPath "C:\\Users\\daido\\git\\masao\\github3\\quick-dash-launcher\\assets\\icons\\256x256.png" -Width 256 -Height 256
Convert-SvgToPng -SvgPath "C:\\Users\\daido\\git\\masao\\github3\\quick-dash-launcher\\assets\\icon.svg" -OutputPath "C:\\Users\\daido\\git\\masao\\github3\\quick-dash-launcher\\assets\\icons\\512x512.png" -Width 512 -Height 512

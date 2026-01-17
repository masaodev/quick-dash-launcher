# Development mode icon generation script
# Adds "DEV" text overlay to icon.png and generates icon-dev.png and icon-dev.ico

param(
    [string]$InputIcon = "assets/icon.png",
    [string]$OutputPng = "assets/icon-dev.png",
    [string]$OutputIco = "assets/icon-dev.ico"
)

Add-Type -AssemblyName System.Drawing

try {
    $sourceImage = [System.Drawing.Image]::FromFile((Resolve-Path $InputIcon))
    $bitmap = New-Object System.Drawing.Bitmap($sourceImage.Width, $sourceImage.Height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

    $graphics.DrawImage($sourceImage, 0, 0, $sourceImage.Width, $sourceImage.Height)

    $overlayBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(100, 255, 0, 0))
    $graphics.FillRectangle($overlayBrush, 0, 0, $sourceImage.Width, $sourceImage.Height)

    $fontSize = [int]($sourceImage.Height * 0.25)
    $font = New-Object System.Drawing.Font("Arial", $fontSize, [System.Drawing.FontStyle]::Bold)
    $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)

    $text = "DEV"
    $textSize = $graphics.MeasureString($text, $font)
    $x = ($sourceImage.Width - $textSize.Width) / 2
    $y = ($sourceImage.Height - $textSize.Height) / 2

    $outlineBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::Black)
    $outlineWidth = 2
    for ($dx = -$outlineWidth; $dx -le $outlineWidth; $dx++) {
        for ($dy = -$outlineWidth; $dy -le $outlineWidth; $dy++) {
            if ($dx -ne 0 -or $dy -ne 0) {
                $graphics.DrawString($text, $font, $outlineBrush, $x + $dx, $y + $dy)
            }
        }
    }

    $graphics.DrawString($text, $font, $textBrush, $x, $y)

    if (Test-Path $OutputPng) {
        Remove-Item $OutputPng -Force
    }
    $bitmap.Save($OutputPng, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host "PNG icon created: $OutputPng" -ForegroundColor Green

    $iconStream = New-Object System.IO.MemoryStream
    $bitmap.Save($iconStream, [System.Drawing.Imaging.ImageFormat]::Png)
    $iconBytes = $iconStream.ToArray()

    $icoHeader = [byte[]](0, 0, 1, 0, 1, 0)

    $width = [byte]($bitmap.Width -band 0xFF)
    $height = [byte]($bitmap.Height -band 0xFF)

    $icoDir = [byte[]](
        $width, $height, 0, 0, 1, 0, 32, 0,
        0, 0, 0, 0, 22, 0, 0, 0
    )

    $imageSize = $iconBytes.Length
    $icoDir[8] = $imageSize -band 0xFF
    $icoDir[9] = ($imageSize -shr 8) -band 0xFF
    $icoDir[10] = ($imageSize -shr 16) -band 0xFF
    $icoDir[11] = ($imageSize -shr 24) -band 0xFF

    if (Test-Path $OutputIco) {
        Remove-Item $OutputIco -Force
    }

    $fileStream = [System.IO.File]::Create($OutputIco)
    $fileStream.Write($icoHeader, 0, $icoHeader.Length)
    $fileStream.Write($icoDir, 0, $icoDir.Length)
    $fileStream.Write($iconBytes, 0, $iconBytes.Length)
    $fileStream.Close()

    Write-Host "ICO icon created: $OutputIco" -ForegroundColor Green

    $graphics.Dispose()
    $bitmap.Dispose()
    $sourceImage.Dispose()
    $overlayBrush.Dispose()
    $textBrush.Dispose()
    $outlineBrush.Dispose()
    $font.Dispose()
    $iconStream.Dispose()

    Write-Host "Development mode icon generation completed" -ForegroundColor Green
    exit 0
}
catch {
    Write-Host "Error occurred: $_" -ForegroundColor Red
    Write-Host $_.ScriptStackTrace -ForegroundColor Red
    exit 1
}

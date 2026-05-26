Add-Type -AssemblyName System.Drawing

function Resize-Image {
    param (
        [string]$inPath,
        [string]$outPath,
        [int]$width,
        [int]$height
    )
    Write-Host "Resizing $inPath -> $outPath ($width x $height)"
    try {
        $img = [System.Drawing.Image]::FromFile($inPath)
        $bmp = New-Object System.Drawing.Bitmap($width, $height)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        
        $g.DrawImage($img, 0, 0, $width, $height)
        $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Jpeg)
        
        $g.Dispose()
        $bmp.Dispose()
        $img.Dispose()
    } catch {
        Write-Host "Failed: $_"
    }
}

$dir = "C:\Users\harshraj\.gemini\antigravity\brain\b86175bb-e334-4df8-b138-98471bc21f7e"

Resize-Image "$dir\promptflow_screenshot_1779788824410.png" "$dir\final_screenshot_1.jpg" 1280 800
Resize-Image "$dir\pf_screenshot_palette_1779788950853.png" "$dir\final_screenshot_2.jpg" 1280 800
Resize-Image "$dir\pf_screenshot_enhance_1779788970293.png" "$dir\final_screenshot_3.jpg" 1280 800
Resize-Image "$dir\pf_screenshot_analytics_1779788989352.png" "$dir\final_screenshot_4.jpg" 1280 800
Resize-Image "$dir\pf_screenshot_import_1779789008343.png" "$dir\final_screenshot_5.jpg" 1280 800

Resize-Image "$dir\promptflow_small_promo_1779788462758.png" "$dir\final_small_promo.jpg" 440 280
Resize-Image "$dir\promptflow_marquee_promo_1779788480150.png" "$dir\final_marquee_promo.jpg" 1400 560

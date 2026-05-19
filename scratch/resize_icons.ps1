# # Load .NET Assembly for Image Processing
# Add-Type -AssemblyName System.Drawing

# function Resize-Image {
#     param (
#         [string]$source,
#         [string]$destination,
#         [int]$width,
#         [int]$height
#     )
#     try {
#         $srcBitmap = New-Object System.Drawing.Bitmap($source)
#         $destBitmap = New-Object System.Drawing.Bitmap($width, $height)
#         $graph = [System.Drawing.Graphics]::FromImage($destBitmap)
        
#         # Set high-quality scaling algorithms
#         $graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
#         $graph.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
#         $graph.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        
#         $graph.DrawImage($srcBitmap, 0, 0, $width, $height)
        
#         # Save as PNG
#         $destBitmap.Save($destination, [System.Drawing.Imaging.ImageFormat]::Png)
        
#         # Clean up
#         $graph.Dispose()
#         $srcBitmap.Dispose()
#         $destBitmap.Dispose()
#         Write-Host "Successfully resized $source to $destination ($width x $height)"
#     } catch {
#         Write-Error "Failed to resize $source: $_"
#     }
# }

# $masterImage = "C:\Users\ASUS\.gemini\antigravity\brain\5933fced-d21f-40ca-bed5-6e609dae4eb5\neurality_logo_1779170918089.png"
# $publicDir = "d:\santagram\frontend\public"

# # Resize into optimized files
# Resize-Image -source $masterImage -destination "$publicDir\icon-192.png" -width 192 -height 192
# Resize-Image -source $masterImage -destination "$publicDir\icon-512.png" -width 512 -height 512
# Resize-Image -source $masterImage -destination "$publicDir\favicon.ico" -width 48 -height 48

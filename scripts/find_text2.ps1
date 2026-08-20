$path = Resolve-Path "src/modules/product/product.service.ts"
$bytes = [System.IO.File]::ReadAllBytes($path)
$content = [System.Text.Encoding]::UTF8.GetString($bytes)

$idx = 22000
Write-Host "---CONTEXT FROM 22000 (400 chars)---"
Write-Host $content.Substring($idx, [Math]::Min(400, $content.Length - $idx))
Write-Host "---END---"
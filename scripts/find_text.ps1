$path = Resolve-Path "src/modules/product/product.service.ts"
$bytes = [System.IO.File]::ReadAllBytes($path)
$content = [System.Text.Encoding]::UTF8.GetString($bytes)

# Find the exact text around the admin function
$needle = "                approved_at:"
$idx = $content.IndexOf($needle)
if ($idx -ge 0) {
    Write-Host "First approved_at at $idx"
    Write-Host "---CONTEXT (200 chars)---"
    Write-Host $content.Substring($idx, [Math]::Min(200, $content.Length - $idx))
    Write-Host "---END---"
    
    # Find second occurrence
    $idx2 = $content.IndexOf($needle, $idx + 1)
    if ($idx2 -ge 0) {
        Write-Host "Second approved_at at $idx2"
        Write-Host "---CONTEXT (200 chars)---"
        Write-Host $content.Substring($idx2, [Math]::Min(200, $content.Length - $idx2))
        Write-Host "---END---"
    }
}
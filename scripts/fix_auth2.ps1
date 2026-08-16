$path = Resolve-Path "src/modules/product/product.service.ts"
$bytes = [System.IO.File]::ReadAllBytes($path)
$content = [System.Text.Encoding]::UTF8.GetString($bytes)

$old = "                approved_at:
                    status === AuthenticationStatus.VERIFIED
                        ? now
                        : status === AuthenticationStatus.PENDING
                          ? null
                          : product.approved_at,
                rejected_at:
                    status === AuthenticationStatus.NOT_VERIFIED
                        ? now
                        : status === AuthenticationStatus.PENDING
                          ? null
                          : product.rejected_at,"

$new = "                approved_at:
                    status === AuthenticationStatus.VERIFIED
                        ? now
                        : status === AuthenticationStatus.PENDING || status === AuthenticationStatus.NOT_SUBMITTED
                          ? null
                          : product.approved_at,
                rejected_at:
                    status === AuthenticationStatus.NOT_VERIFIED
                        ? now
                        : status === AuthenticationStatus.PENDING || status === AuthenticationStatus.NOT_SUBMITTED
                          ? null
                          : product.rejected_at,"

$idx = $content.IndexOf($old)
if ($idx -ge 0) {
    Write-Host "FOUND at index $idx"
    $content = $content.Substring(0, $idx) + $new + $content.Substring($idx + $old.Length)
    [System.IO.File]::WriteAllBytes($path, [System.Text.Encoding]::UTF8.GetBytes($content))
    Write-Host "REPLACED"
} else {
    Write-Host "NOT_FOUND"
    # Debug: look for partial
    $partial = "status === AuthenticationStatus.PENDING"
    $idx2 = $content.IndexOf($partial)
    if ($idx2 -ge 0) {
        Write-Host "Partial found at $idx2, context:"
        Write-Host $content.Substring([Math]::Max(0, $idx2-80), 160)
    }
}
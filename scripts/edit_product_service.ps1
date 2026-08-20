$path = "src/modules/product/product.service.ts"
$content = [System.IO.File]::ReadAllText((Resolve-Path $path))
$old = @"
                approved_at:
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
                          : product.rejected_at,
"@
$new = @"
                approved_at:
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
                          : product.rejected_at,
"@
if ($content -match [regex]::Escape($old)) {
    $content = $content -replace [regex]::Escape($old), $new
    [System.IO.File]::WriteAllText((Resolve-Path $path), $content)
    Write-Host "REPLACED"
} else {
    Write-Host "NOT_FOUND"
}
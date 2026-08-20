$path = Resolve-Path "src/modules/product/product.service.ts"
$bytes = [System.IO.File]::ReadAllBytes($path)
$content = [System.Text.Encoding]::UTF8.GetString($bytes)

$old = "        if (approval && approval !== AdminProductApprovalFilter.ALL) {
            const approvalMap: Record<Exclude<AdminProductApprovalFilter, AdminProductApprovalFilter.ALL>, AuthenticationStatus> = {
                [AdminProductApprovalFilter.APPROVED]: AuthenticationStatus.VERIFIED,
                [AdminProductApprovalFilter.REJECTED]: AuthenticationStatus.NOT_VERIFIED,
                [AdminProductApprovalFilter.PENDING]: AuthenticationStatus.PENDING,
            };

            whereClause.authentication_status = approvalMap[approval];
        }"

$new = "        if (approval && approval !== AdminProductApprovalFilter.ALL) {
            if (approval === AdminProductApprovalFilter.PENDING) {
                whereClause.authentication_status = {
                    in: [AuthenticationStatus.NOT_SUBMITTED, AuthenticationStatus.PENDING],
                };
            } else {
                const approvalMap: Record<
                    Exclude<AdminProductApprovalFilter, AdminProductApprovalFilter.ALL | AdminProductApprovalFilter.PENDING>,
                    AuthenticationStatus
                > = {
                    [AdminProductApprovalFilter.APPROVED]: AuthenticationStatus.VERIFIED,
                    [AdminProductApprovalFilter.REJECTED]: AuthenticationStatus.NOT_VERIFIED,
                };

                whereClause.authentication_status = approvalMap[approval];
            }
        }"

$idx = $content.IndexOf($old)
if ($idx -ge 0) {
    Write-Host "FOUND at index $idx"
    $content = $content.Substring(0, $idx) + $new + $content.Substring($idx + $old.Length)
    [System.IO.File]::WriteAllBytes($path, [System.Text.Encoding]::UTF8.GetBytes($content))
    Write-Host "REPLACED"
} else {
    Write-Host "NOT_FOUND"
    # Debug
    $i = $content.IndexOf("AdminProductApprovalFilter.ALL")
    if ($i -ge 0) {
        Write-Host "Found at $i, context:"
        Write-Host $content.Substring($i, 400)
    }
}
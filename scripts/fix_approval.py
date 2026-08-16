path = "src/modules/product/product.service.ts"
with open(path, "r", encoding="utf-8", newline="") as f:
    content = f.read()

old_lines = [
    '        if (approval && approval !== AdminProductApprovalFilter.ALL) {',
    '            const approvalMap: Record<Exclude<AdminProductApprovalFilter, AdminProductApprovalFilter.ALL>, AuthenticationStatus> = {',
    '                [AdminProductApprovalFilter.APPROVED]: AuthenticationStatus.VERIFIED,',
    '                [AdminProductApprovalFilter.REJECTED]: AuthenticationStatus.NOT_VERIFIED,',
    '                [AdminProductApprovalFilter.PENDING]: AuthenticationStatus.PENDING,',
    '            };',
    '',
    '            whereClause.authentication_status = approvalMap[approval];',
    '        }',
]
old = "\r\n".join(old_lines)

new_lines = [
    '        if (approval && approval !== AdminProductApprovalFilter.ALL) {',
    '            if (approval === AdminProductApprovalFilter.PENDING) {',
    '                whereClause.authentication_status = {',
    '                    in: [AuthenticationStatus.NOT_SUBMITTED, AuthenticationStatus.PENDING],',
    '                };',
    '            } else {',
    '                const approvalMap: Record<',
    '                    Exclude<AdminProductApprovalFilter, AdminProductApprovalFilter.ALL | AdminProductApprovalFilter.PENDING>,',
    '                    AuthenticationStatus',
    '                > = {',
    '                    [AdminProductApprovalFilter.APPROVED]: AuthenticationStatus.VERIFIED,',
    '                    [AdminProductApprovalFilter.REJECTED]: AuthenticationStatus.NOT_VERIFIED,',
    '                };',
    '',
    '                whereClause.authentication_status = approvalMap[approval];',
    '            }',
    '        }',
]
new = "\r\n".join(new_lines)

if old in content:
    content = content.replace(old, new)
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(content)
    print("REPLACED")
else:
    print("NOT_FOUND")
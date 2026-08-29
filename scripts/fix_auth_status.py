path = "src/modules/product/product.service.ts"
with open(path, "r", encoding="utf-8", newline="") as f:
    lines = f.readlines()

target_start = -1
target_end = -1

for i, line in enumerate(lines):
    if "status === AuthenticationStatus.PENDING" in line and target_start == -1:
        target_start = i

for i, line in enumerate(lines):
    if "product.rejected_at," in line.strip() and i >= target_start and target_end == -1:
        target_end = i + 1
        break

if target_start >= 0 and target_end >= 0:
    old_text = "status === AuthenticationStatus.PENDING"
    new_text = "status === AuthenticationStatus.PENDING || status === AuthenticationStatus.NOT_SUBMITTED"
    count = 0
    for i in range(target_start, target_end):
        if old_text in lines[i]:
            lines[i] = lines[i].replace(old_text, new_text)
            count += 1
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.writelines(lines)
    print(f"Replaced {count} occurrences in lines {target_start+1}-{target_end}")
else:
    print(f"NOT_FOUND: start={target_start} end={target_end}")
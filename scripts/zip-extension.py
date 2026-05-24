import os
import sys
import zipfile

dist_dir = "dist"
output_zip = "extension.zip"

if not os.path.isdir(dist_dir):
    print(f'Error: "{dist_dir}" folder not found. Run npm run build first.')
    sys.exit(1)

if os.path.exists(output_zip):
    os.remove(output_zip)

with zipfile.ZipFile(output_zip, "w", zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk(dist_dir):
        for file in files:
            full_path = os.path.join(root, file)
            arcname = os.path.relpath(full_path, dist_dir)
            zf.write(full_path, arcname)

size_kb = round(os.path.getsize(output_zip) / 1024, 1)
print(f"✓ extension.zip created ({size_kb} KB)")
print(f"  Contents:")
with zipfile.ZipFile(output_zip, "r") as zf:
    for name in sorted(zf.namelist()):
        info = zf.getinfo(name)
        print(f"    {name:<30} {round(info.file_size / 1024, 1)} KB")

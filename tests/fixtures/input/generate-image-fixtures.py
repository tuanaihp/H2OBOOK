from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).parent
root.mkdir(parents=True, exist_ok=True)

png = Image.new("RGBA", (640, 420), (0, 0, 0, 0))
draw = ImageDraw.Draw(png)
draw.rectangle((40, 40, 600, 380), fill=(245, 250, 255, 230), outline=(30, 90, 130, 255), width=4)
draw.text((90, 170), "H2OBOOK PNG TRANSPARENCY", fill=(20, 30, 40, 255))
png.save(root / "image-transparent.png", dpi=(300, 300))

jpeg = Image.new("RGB", (1200, 800), "white")
draw = ImageDraw.Draw(jpeg)
draw.text((120, 180), "H2OBOOK OCR TEST", fill="black")
draw.text((120, 300), "No AI API - Tesseract", fill="black")
exif = jpeg.getexif(); exif[274] = 6
jpeg.save(root / "image-exif-rotation.jpe", quality=94, dpi=(300, 300), exif=exif)

ocr = Image.new("RGB", (1400, 700), "white")
draw = ImageDraw.Draw(ocr)
draw.text((100, 120), "H2OBOOK IMAGE SMART IMPORT", fill="black")
draw.text((100, 260), "OCR REGION TEST 2026", fill="black")
ocr.save(root / "image-ocr.png", dpi=(200, 200))

(root / "image-corrupt.jpe").write_bytes(b"%PDF-not-an-image")
print("Generated image fixtures in", root)

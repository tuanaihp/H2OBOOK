"""Generate deterministic PDF Dual Import fixtures locally.

Run: python tests/fixtures/input/generate-pdf-fixtures.py
Outputs are intentionally ignored unless a test runner explicitly keeps them.
"""
from pathlib import Path
import fitz
from PIL import Image, ImageDraw, ImageFont

OUTPUT = Path(__file__).parent / "generated-pdf"
OUTPUT.mkdir(parents=True, exist_ok=True)


def font(path: str, size: int):
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


def native_pdf(path: Path):
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text((50, 75), "H2OBOOK PDF DUAL IMPORT", fontsize=24)
    page.insert_text((50, 125), "Native text layer paragraph for editable reconstruction.", fontsize=12)
    page.insert_text((50, 180), "Name", fontsize=12)
    page.insert_text((220, 180), "Score", fontsize=12)
    page.insert_text((50, 205), "Lan", fontsize=12)
    page.insert_text((220, 205), "9", fontsize=12)
    doc.save(path)
    doc.close()


def scan_image(path: Path):
    image = Image.new("RGB", (1400, 900), "white")
    draw = ImageDraw.Draw(image)
    draw.text((70, 70), "H2OBOOK SCANNED PDF", fill="black", font=font("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 68))
    draw.text((70, 190), "OCR layout fixture with bounding boxes.", fill="black", font=font("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 42))
    image.save(path)


def scanned_pdf(image_path: Path, pdf_path: Path):
    image_doc = fitz.open(image_path)
    pdf = image_doc.convert_to_pdf()
    target = fitz.open("pdf", pdf)
    target.save(pdf_path)
    target.close(); image_doc.close()


native_pdf(OUTPUT / "native-text.pdf")
scan_image(OUTPUT / "scan.png")
scanned_pdf(OUTPUT / "scan.png", OUTPUT / "scanned.pdf")

mixed = fitz.open(OUTPUT / "native-text.pdf")
scan = fitz.open(OUTPUT / "scanned.pdf")
mixed.insert_pdf(scan)
mixed.save(OUTPUT / "mixed-native-scan.pdf")
mixed.close(); scan.close()

encrypted = fitz.open(OUTPUT / "native-text.pdf")
encrypted.save(OUTPUT / "password-protected.pdf", encryption=fitz.PDF_ENCRYPT_AES_256, owner_pw="owner", user_pw="h2obook")
encrypted.close()
print(f"Generated PDF fixtures in {OUTPUT}")

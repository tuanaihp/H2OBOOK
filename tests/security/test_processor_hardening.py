import tempfile
import zipfile
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "services" / "document-processor"))
from app.processors import _basic_validation  # noqa: E402

DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

with tempfile.TemporaryDirectory(prefix="h2obook-hardening-") as temp:
    root = Path(temp)
    valid = root / "valid.docx"
    with zipfile.ZipFile(valid, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", "<Types/>")
        z.writestr("word/document.xml", "<w:document xmlns:w='x'/>")
    assert _basic_validation(valid, DOCX)[0]

    traversal = root / "traversal.docx"
    with zipfile.ZipFile(traversal, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", "<Types/>")
        z.writestr("word/document.xml", "<w:document xmlns:w='x'/>")
        z.writestr("../escape.txt", "blocked")
    assert _basic_validation(traversal, DOCX) == (False, "ZIP_PATH_TRAVERSAL")

    invalid = root / "invalid.docx"
    with zipfile.ZipFile(invalid, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("hello.txt", "not a docx")
    assert _basic_validation(invalid, DOCX) == (False, "DOCX_STRUCTURE_INVALID")

    bomb = root / "bomb.docx"
    with zipfile.ZipFile(bomb, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", "<Types/>")
        z.writestr("word/document.xml", "0" * (8 * 1024 * 1024))
    ok, reason = _basic_validation(bomb, DOCX)
    assert not ok and reason == "ZIP_BOMB_RISK", (ok, reason)

print("Processor hardening runtime passed: valid DOCX, traversal rejection, structure validation and ZIP bomb rejection.")

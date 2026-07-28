import os
from pathlib import Path
import boto3


def _client():
    account_id = os.environ["R2_ACCOUNT_ID"]
    return boto3.client(
        "s3",
        endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
    )


def bucket() -> str:
    return os.environ["R2_BUCKET"]


def validate_scope(organization_id: str, key: str) -> None:
    if not key.startswith(f"{organization_id}/") or ".." in key:
        raise ValueError("INVALID_STORAGE_SCOPE")


def download(key: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    _client().download_file(bucket(), key, str(destination))


def upload(source: Path, key: str, content_type: str) -> dict:
    _client().upload_file(str(source), bucket(), key, ExtraArgs={"ContentType": content_type, "Metadata": {"source": "h2obook-document-processor"}})
    return {"key": key, "sizeBytes": source.stat().st_size, "contentType": content_type}

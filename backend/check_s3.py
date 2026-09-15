"""Check that the S3 credentials in .env actually work against the real bucket.

Run this before touching the API. It answers one question only: can this
machine put, read and delete an object in the photos bucket? If it fails, the
problem is credentials or the bucket policy, not our code.

    python check_s3.py
"""

import sys

import storage


def main() -> int:
    if not storage.is_configured():
        print("FAIL  S3_BUCKET is not set in .env")
        return 1

    print(f"Bucket : {storage.BUCKET}")
    print(f"Region : {storage.REGION}")

    try:
        import boto3  # noqa: F401
    except ImportError:
        print("FAIL  boto3 is not installed. Run: pip install -r requirements.txt")
        return 1

    client = storage._client()

    # Who are we? This fails loudly if the keys are wrong or mistyped.
    try:
        ident = boto3.client("sts", region_name=storage.REGION).get_caller_identity()
        print(f"IAM    : {ident['Arn']}")
    except Exception as exc:
        print(f"FAIL  the access key is not valid: {exc}")
        return 1

    key = "healthcheck/connection-test.txt"
    steps = [
        ("write an object", lambda: client.put_object(
            Bucket=storage.BUCKET, Key=key, Body=b"kete connectivity test",
            ContentType="text/plain")),
        ("read it back", lambda: client.get_object(Bucket=storage.BUCKET, Key=key)),
        ("sign a temporary link", lambda: storage.link_for(key)),
        ("delete it again", lambda: client.delete_object(Bucket=storage.BUCKET, Key=key)),
    ]

    for label, action in steps:
        try:
            result = action()
        except Exception as exc:
            print(f"FAIL  {label}: {type(exc).__name__}: {exc}")
            print("\nThe IAM user is missing a permission, or it is scoped to a "
                  "different bucket. Send Kyle the line above.")
            return 1
        if label.startswith("sign") and not result:
            print("FAIL  sign a temporary link: got nothing back")
            return 1
        print(f"OK    {label}")

    print("\nAll good. The backend can use the bucket.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""VERTEX_SA_JSON(서비스 계정 JSON)으로 Vertex AI 액세스 토큰을 받는다. 키는 출력하지 않는다."""
import base64, json, os, time
import requests
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding


def _b64(b):
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def get_token():
    sa = json.loads(os.environ["VERTEX_SA_JSON"])
    now = int(time.time())
    header = {"alg": "RS256", "typ": "JWT", "kid": sa.get("private_key_id")}
    claim = {"iss": sa["client_email"], "scope": "https://www.googleapis.com/auth/cloud-platform",
             "aud": "https://oauth2.googleapis.com/token", "iat": now, "exp": now + 3600}
    msg = _b64(json.dumps(header).encode()) + "." + _b64(json.dumps(claim).encode())
    key = serialization.load_pem_private_key(sa["private_key"].encode(), password=None)
    sig = key.sign(msg.encode(), padding.PKCS1v15(), hashes.SHA256())
    r = requests.post("https://oauth2.googleapis.com/token", data={
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": msg + "." + _b64(sig)}, timeout=30)
    r.raise_for_status()
    return r.json()["access_token"], sa["project_id"]


if __name__ == "__main__":
    tok, proj = get_token()
    print("token ok", len(tok), "project", proj)

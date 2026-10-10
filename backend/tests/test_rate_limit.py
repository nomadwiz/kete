"""
B30 (nomadwiz/kete#399): /login and /register are rate-limited by nginx.

The limit lives in backend/deploy/kete-nginx.conf, not in Python, so nothing
here can send an eleventh request and watch it refused; the deployed check is a
recorded curl loop on the issue. What these tests hold is the agreement
between the two halves: the contract declares the 429 the proxy answers, in the
same shape as every other error, and the proxy limits the paths and the numbers
the contract describes. Change one without the other and a test fails.

No database: these run anywhere, as test_contract.py does.
"""

import re
from pathlib import Path

import pytest

import main

CONF = (Path(__file__).resolve().parent.parent / "deploy" / "kete-nginx.conf").read_text(encoding="utf-8")


@pytest.mark.parametrize("path", ["/login", "/register"])
def test_the_contract_declares_the_429(path):
    responses = main.app.openapi()["paths"][path]["post"]["responses"]
    schema = responses["429"]["content"]["application/json"]["schema"]
    assert schema == {"$ref": "#/components/schemas/ErrorDetail"}


def test_no_other_route_declares_a_429():
    """Only the two limited paths may promise one."""
    declared = [p for p, ops in main.app.openapi()["paths"].items()
                for op in ops.values() if "429" in op["responses"]]
    assert sorted(declared) == ["/login", "/register"]


def test_nginx_limits_exactly_those_two_paths():
    limited = re.search(r"location ~ \^/\((.+?)\)\$ \{(.*?)\n    \}", CONF, re.S)
    assert limited, "no location for the limited paths"
    assert sorted(limited.group(1).split("|")) == ["login", "register"]
    assert "limit_req zone=kete_auth_viewer burst=9 nodelay;" in limited.group(2)
    assert "limit_req_status 429;" in limited.group(2)


def test_the_eleventh_attempt_in_a_minute_is_refused():
    """rate=10r/m with burst=9 and nodelay lets ten through at once and refuses
    the eleventh, which is the issue's Done when."""
    assert re.search(r"limit_req_zone \$kete_auth_viewer zone=kete_auth_viewer:\S+ rate=10r/m;", CONF)


def test_only_post_counts():
    """The preflight OPTIONS that precedes each POST must not use up the limit."""
    viewer = re.search(r"map \$request_method \$kete_auth_viewer \{(.*?)\}", CONF, re.S).group(1)
    assert re.search(r"^\s*POST\s+\$kete_viewer_addr;", viewer, re.M)
    assert re.search(r'^\s*default\s+"";', viewer, re.M)


def test_the_429_body_has_the_api_error_shape():
    body = re.search(r"return 429 '(.+)';", CONF).group(1)
    import json
    assert set(json.loads(body)) == {"detail"}

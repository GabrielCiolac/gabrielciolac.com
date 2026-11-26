import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location("deploy_hook", pathlib.Path(__file__).parent.parent / "ops" / "deploy-hook.py")
hook = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hook)

SECRET = b"test-secret"
NOW = 1_800_000_000
BODY = b'{"sha":"abc123"}'


def signed(ts=NOW, body=BODY, secret=SECRET):
    return str(ts), hook.sign(secret, str(ts), body)


class CheckTests(unittest.TestCase):
    def test_valid_request_is_accepted(self):
        ts, sig = signed()
        self.assertEqual(hook.check(SECRET, ts, sig, BODY, NOW, {}), (202, "redeploy queued"))

    def test_missing_signature_is_rejected(self):
        self.assertEqual(hook.check(SECRET, str(NOW), "", BODY, NOW, {})[0], 401)

    def test_wrong_secret_is_rejected(self):
        ts, sig = signed(secret=b"someone-else")
        self.assertEqual(hook.check(SECRET, ts, sig, BODY, NOW, {}), (401, "bad signature"))

    def test_tampered_body_is_rejected(self):
        ts, sig = signed()
        self.assertEqual(hook.check(SECRET, ts, sig, b'{"sha":"evil"}', NOW, {}), (401, "bad signature"))

    def test_stale_and_future_timestamps_are_rejected(self):
        for ts_value in (NOW - 301, NOW + 301):
            ts, sig = signed(ts=ts_value)
            self.assertEqual(hook.check(SECRET, ts, sig, BODY, NOW, {}), (401, "bad timestamp"))

    def test_timestamp_at_the_edge_of_the_window_is_accepted(self):
        ts, sig = signed(ts=NOW - 300)
        self.assertEqual(hook.check(SECRET, ts, sig, BODY, NOW, {})[0], 202)

    def test_non_numeric_timestamp_is_rejected(self):
        self.assertEqual(hook.check(SECRET, "abc", "sha256=00", BODY, NOW, {}), (401, "bad timestamp"))

    def test_replay_is_rejected(self):
        seen = {}
        ts, sig = signed()
        self.assertEqual(hook.check(SECRET, ts, sig, BODY, NOW, seen)[0], 202)
        self.assertEqual(hook.check(SECRET, ts, sig, BODY, NOW + 1, seen), (409, "replay"))

    def test_old_signatures_are_forgotten(self):
        seen = {"sha256=old": NOW - 1000}
        ts, sig = signed()
        hook.check(SECRET, ts, sig, BODY, NOW, seen)
        self.assertNotIn("sha256=old", seen)

    def test_oversized_body_is_rejected(self):
        body = b"x" * (hook.MAX_BODY + 1)
        ts, sig = signed(body=body)
        self.assertEqual(hook.check(SECRET, ts, sig, body, NOW, {}), (413, "too large"))

    def test_signature_matches_the_ci_openssl_recipe(self):
        # Runs the same shell pipeline as the "Tell the NAS to redeploy" step in deploy.yml.
        import shutil, subprocess
        if not shutil.which("openssl"):
            self.skipTest("openssl not installed")
        out = subprocess.run(
            ["bash", "-c", "printf '%s.%s' \"$TS\" \"$BODY\" | openssl dgst -sha256 -hmac \"$SECRET\" -hex | sed 's/^.* //'"],
            env={"TS": str(NOW), "BODY": BODY.decode(), "SECRET": SECRET.decode(), "PATH": "/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin"},
            capture_output=True, text=True, check=True).stdout.strip()
        self.assertEqual("sha256=" + out, hook.sign(SECRET, str(NOW), BODY))


if __name__ == "__main__":
    unittest.main()

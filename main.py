import asyncio
import json
import os
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request

import decky

API_URL = "https://api.gg.deals/v1/prices/by-steam-app-id/"
SETTINGS_FILE = os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, "settings.json")
CACHE_TTL = 30 * 60
DEFAULT_SETTINGS = {"api_key": "", "region": "us", "include_keyshops": True}


def _ssl_context() -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    # Decky's bundled Python doesn't always find SteamOS's CA store on its own.
    system_bundle = "/etc/ssl/certs/ca-certificates.crt"
    if os.path.exists(system_bundle):
        ctx.load_verify_locations(system_bundle)
    return ctx


def _to_float(value):
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None


class Plugin:
    settings: dict = dict(DEFAULT_SETTINGS)
    cache: dict = {}

    def _load_settings(self):
        try:
            with open(SETTINGS_FILE) as f:
                self.settings = {**DEFAULT_SETTINGS, **json.load(f)}
        except FileNotFoundError:
            self.settings = dict(DEFAULT_SETTINGS)
        except Exception as e:
            decky.logger.error(f"Failed to read settings: {e}")
            self.settings = dict(DEFAULT_SETTINGS)

    def _save_settings(self):
        os.makedirs(os.path.dirname(SETTINGS_FILE), exist_ok=True)
        with open(SETTINGS_FILE, "w") as f:
            json.dump(self.settings, f)

    async def get_settings(self) -> dict:
        return self.settings

    async def set_settings(self, api_key: str, region: str, include_keyshops: bool) -> dict:
        self.settings = {
            "api_key": api_key.strip(),
            "region": region,
            "include_keyshops": bool(include_keyshops),
        }
        self._save_settings()
        self.cache.clear()
        return self.settings

    def _fetch(self, app_id: str) -> dict:
        query = urllib.parse.urlencode({
            "ids": app_id,
            "key": self.settings["api_key"],
            "region": self.settings["region"],
        })
        req = urllib.request.Request(
            f"{API_URL}?{query}", headers={"User-Agent": "decky-gg-deals"}
        )
        try:
            with urllib.request.urlopen(req, timeout=10, context=_ssl_context()) as resp:
                return json.load(resp)
        except urllib.error.HTTPError as e:
            # gg.deals returns a JSON error body on 4xx (bad key, rate limit, ...)
            try:
                return json.load(e)
            except Exception:
                return {"success": False, "data": {"message": f"HTTP {e.code}"}}

    async def get_price(self, app_id: str) -> dict:
        if not self.settings["api_key"]:
            return {"status": "no_key"}

        cache_key = (app_id, self.settings["region"], self.settings["include_keyshops"])
        cached = self.cache.get(cache_key)
        if cached and time.time() - cached[0] < CACHE_TTL:
            return cached[1]

        try:
            body = await asyncio.to_thread(self._fetch, app_id)
        except Exception as e:
            decky.logger.error(f"gg.deals request failed for {app_id}: {e}")
            return {"status": "error", "message": str(e)}

        if not body.get("success"):
            message = (body.get("data") or {}).get("message", "Unknown error")
            decky.logger.error(f"gg.deals error for {app_id}: {message}")
            return {"status": "error", "message": message}

        game = (body.get("data") or {}).get(app_id)
        if not game:
            result = {"status": "not_found"}
        else:
            prices = game.get("prices") or {}
            retail = _to_float(prices.get("currentRetail"))
            keyshops = _to_float(prices.get("currentKeyshops"))
            candidates = [(retail, "Official stores")]
            if self.settings["include_keyshops"]:
                candidates.append((keyshops, "Keyshops"))
            candidates = [c for c in candidates if c[0] is not None]

            if not candidates:
                result = {"status": "not_found"}
            else:
                lowest, source = min(candidates, key=lambda c: c[0])
                result = {
                    "status": "ok",
                    "lowest": lowest,
                    "source": source,
                    "retail": retail,
                    "keyshops": keyshops,
                    "currency": prices.get("currency") or "USD",
                    "url": game.get("url"),
                }

        self.cache[cache_key] = (time.time(), result)
        return result

    async def _main(self):
        self._load_settings()
        decky.logger.info("gg.deals plugin loaded")

    async def _unload(self):
        pass

    async def _uninstall(self):
        pass

import re
import requests

session = requests.Session()
session.cookies.set("user", "dynep_data&niRgOIw1eJmilFUYUleb0et2ylnCKltY", domain="news.ycombinator.com")
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Referer": "https://news.ycombinator.com/user?id=dynep_data"
})

resp = session.get("https://news.ycombinator.com/user?id=dynep_data")
hmac_match = re.search(r'name="hmac"\s+value="([^"]+)"', resp.text)
if not hmac_match:
    print("Could not find hmac")
    exit(1)

hmac = hmac_match.group(1)

data = {
    "id": "dynep_data",
    "hmac": hmac,
    "about": "Dynep (https://data.dynep.com) – Micro-DaaS tracking AI Cloud GPU spot prices and cluster arbitrage across 31 cloud providers.",
    "email": "contact@dynep.com",
    "showd": "no",
    "nopro": "no",
    "maxv": "20",
    "mina": "180",
    "delay": "0"
}

update_resp = session.post("https://news.ycombinator.com/xuser", data=data)
print(f"Profile update status: {update_resp.status_code}")

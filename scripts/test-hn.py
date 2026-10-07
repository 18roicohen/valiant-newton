import re
import requests

session = requests.Session()
session.cookies.set("user", "dynep_data&niRgOIw1eJmilFUYUleb0et2ylnCKltY", domain="news.ycombinator.com")
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Referer": "https://news.ycombinator.com/submit"
})

resp = session.get("https://news.ycombinator.com/submit", timeout=15)
fnid_match = re.search(r'name="fnid"\s+value="([^"]+)"', resp.text)
if not fnid_match:
    print("No fnid found")
    exit(1)

fnid = fnid_match.group(1)
print(f"fnid: {fnid}")

# Test submitting standard title without 'Show HN:' prefix
title = "Dynep: Real-time GPU spot market across 31 cloud providers"
url = "https://data.dynep.com"

submit_data = {
    "fnid": fnid,
    "fnop": "submit-page",
    "title": title,
    "url": url,
    "text": ""
}

sub_resp = session.post("https://news.ycombinator.com/r", data=submit_data, timeout=15, allow_redirects=False)
print(f"Status: {sub_resp.status_code}")
print(f"Location: {sub_resp.headers.get('Location')}")
if sub_resp.status_code == 200:
    print("Content preview:", sub_resp.text[:400])

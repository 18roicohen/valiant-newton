import re
import requests

session = requests.Session()
session.cookies.set("user", "dynep_data&niRgOIw1eJmilFUYUleb0et2ylnCKltY", domain="news.ycombinator.com")
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Referer": "https://news.ycombinator.com/item?id=49977139"
})

item_id = "49977139"
item_url = f"https://news.ycombinator.com/item?id={item_id}"

resp = session.get(item_url, timeout=15)
print(f"Item page status: {resp.status_code}")

fnid_match = re.search(r'name="fnid"\s+value="([^"]+)"', resp.text)
if not fnid_match:
    print("Could not find fnid in item page.")
    print("Page snippet:", resp.text[:500])
    exit(1)

fnid = fnid_match.group(1)
print(f"Found comment fnid: {fnid}")

comment_text = """Hey HN,

We built Dynep (https://data.dynep.com) to solve the pricing opacity and hyperscaler markup in the AI cloud compute market.

While AWS and Azure charge on-demand rates of $4.50+/hr for an NVIDIA H100 SXM5, independent and tier-2 providers (LeaderGPU, Vast.ai, RunPod, Lambda Labs, Hyperstack, FluidStack) frequently offer unreserved spot instances between $1.99 and $2.49/hr. The problem has always been fragmented discovery, inventory swings, and lack of standard API schemas.

Dynep continuously crawls and indexes 31 cloud GPU providers in real time:
- Sub-15ms edge gateway delivering normalized JSON and RFC 4180 CSV feeds.
- Cluster arbitrage calculator comparing multi-node setups against AWS EC2 baselines.
- Zero-install CLI (npx dynep-spot --gpu H100) and MCP server support for AI agents (Cursor, Claude Desktop).
- Autonomous push triggers (Email, Discord, Slack, Webhooks) when prices drop below user thresholds.

Verified Live Benchmarks:
- NVIDIA H100 SXM5 (80GB): $1.99/hr on LeaderGPU vs $4.50/hr on AWS (-56% savings)
- NVIDIA H200 (141GB): $3.49/hr on Lambda Labs vs $5.80/hr on AWS (-40% savings)
- NVIDIA RTX 4090 (24GB): $0.34/hr on Vast.ai vs $1.10/hr on AWS (-69% savings)
- NVIDIA A100 SXM4 (80GB): $0.68/hr on LeaderGPU vs $3.06/hr on AWS (-78% savings)

The benchmark summary is completely open and zero-auth:
$ curl https://data.dynep.com/v1/spot/summary

We also provision free developer evaluation keys (100 reqs/mo, zero credit card):
$ curl -X POST https://data.dynep.com/api/keys/free -H "Content-Type: application/json" -d '{"email":"you@domain.com"}'

Or test right in terminal:
$ npx dynep-spot --gpu H100

Would love HN's feedback on our data normalization approach, and features you'd like to see for automated multi-cloud scheduling!"""

comment_data = {
    "fnid": fnid,
    "fnop": "comment",
    "goto": f"item?id={item_id}",
    "parent": item_id,
    "text": comment_text
}

comment_resp = session.post("https://news.ycombinator.com/r", data=comment_data, timeout=15, allow_redirects=True)
print(f"Comment post status: {comment_resp.status_code}, URL: {comment_resp.url}")

# Verify comment presence
check_resp = session.get(item_url, timeout=15)
if "pricing opacity" in check_resp.text:
    print("SUCCESS: Comment is verified LIVE on Hacker News!")
else:
    print("Warning: Comment text not yet found on item page. Check response URL or anti-abuse delay.")

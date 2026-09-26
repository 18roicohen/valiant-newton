from typing import List, Optional, Dict, Any
from dataclasses import dataclass
import requests

@dataclass
class GpuSpotQuote:
    gpu_model: str
    spot_rate_hourly_usd: float
    best_provider: str
    aws_equivalent_rate_usd: float
    cost_savings_vs_aws_percent: str

class DynepClient:
    """
    Official Python Client for Dynep Cloud GPU Spot Market Engine.
    Tracks real-time spot rates across 31 providers.
    """

    def __init__(self, api_key: Optional[str] = None, base_url: str = "https://data.dynep.com"):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        if self.api_key:
            self.session.headers.update({"Authorization": f"Bearer {self.api_key}"})

    def get_spot_summary(self) -> List[GpuSpotQuote]:
        """
        Fetches the public zero-auth DGX-31 benchmark summary across monitored clouds.
        """
        url = f"{self.base_url}/v1/spot/summary"
        response = self.session.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        quotes = []
        for item in data.get("benchmark_summary", []):
            quotes.append(GpuSpotQuote(
                gpu_model=item.get("gpu_model", ""),
                spot_rate_hourly_usd=float(item.get("spot_rate_hourly_usd", 0.0)),
                best_provider=item.get("best_provider", ""),
                aws_equivalent_rate_usd=float(item.get("aws_equivalent_rate_usd", 0.0)),
                cost_savings_vs_aws_percent=item.get("cost_savings_vs_aws_percent", "0%"),
            ))
        return quotes

    def get_cheapest_spot(self, gpu_filter: str = "H100") -> Optional[GpuSpotQuote]:
        """
        Returns the single lowest spot quote for a given GPU family (e.g. 'H100', '4090', 'A100').
        """
        quotes = self.get_spot_summary()
        matching = [q for q in quotes if gpu_filter.lower() in q.gpu_model.lower()]
        if not matching:
            return None
        return min(matching, key=lambda q: q.spot_rate_hourly_usd)

    def query_live_instances(self, search: Optional[str] = None, limit: int = 50, page: int = 1) -> Dict[str, Any]:
        """
        Queries the full structured real-time feed (Requires API Key).
        """
        if not self.api_key:
            raise ValueError("An API key is required to query the full instance feed. Obtain one via client.claim_free_key(email) or at https://data.dynep.com")

        params: Dict[str, Any] = {"limit": limit, "page": page}
        if search:
            params["search"] = search

        url = f"{self.base_url}/v1/data"
        response = self.session.get(url, params=params, timeout=15)
        response.raise_for_status()
        return response.json()

    @staticmethod
    def claim_free_key(email: str, base_url: str = "https://data.dynep.com") -> Dict[str, Any]:
        """
        Claims a complimentary 100 req/mo Developer API Key.
        """
        url = f"{base_url.rstrip('/')}/api/keys/free"
        response = requests.post(url, json={"email": email}, timeout=10)
        response.raise_for_status()
        return response.json()

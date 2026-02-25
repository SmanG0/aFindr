"""
Convex JWT token validator.

Fetches JWKS from the Convex deployment's well-known endpoint and uses
it to verify RS256-signed JWT tokens issued by Convex Auth.
"""

import os
import time

import jwt
import httpx

CONVEX_URL = os.getenv("CONVEX_DEPLOYMENT_URL", "")


class ConvexJWTValidator:
    """Validates JWT tokens issued by Convex Auth using JWKS discovery."""

    def __init__(self):
        self._jwks: dict | None = None
        self._jwks_fetched_at: float = 0
        self._jwks_ttl: int = 300  # 5 minutes

    async def _get_jwks(self) -> dict:
        """Fetch and cache JWKS keys from the Convex deployment."""
        now = time.time()
        if self._jwks is not None and (now - self._jwks_fetched_at) < self._jwks_ttl:
            return self._jwks

        if not CONVEX_URL:
            raise ValueError(
                "CONVEX_DEPLOYMENT_URL environment variable is not set"
            )

        jwks_url = f"{CONVEX_URL.rstrip('/')}/.well-known/jwks.json"

        async with httpx.AsyncClient() as client:
            response = await client.get(jwks_url, timeout=10.0)
            response.raise_for_status()
            self._jwks = response.json()
            self._jwks_fetched_at = now

        return self._jwks

    async def validate_token(self, token: str) -> str:
        """
        Validate a JWT token and return the user ID (sub claim).

        Args:
            token: The raw JWT token string.

        Returns:
            The user ID from the token's ``sub`` claim.

        Raises:
            jwt.InvalidTokenError: If the token is invalid or expired.
            ValueError: If the CONVEX_DEPLOYMENT_URL is not configured.
            httpx.HTTPStatusError: If JWKS endpoint is unreachable.
        """
        jwks_data = await self._get_jwks()

        # Build a PyJWT JWKSet from the fetched keys
        signing_keys = jwt.PyJWKSet.from_dict(jwks_data)

        # Decode the token header to find the correct key
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")

        signing_key = None
        for key in signing_keys.keys:
            if key.key_id == kid:
                signing_key = key
                break

        if signing_key is None:
            raise jwt.InvalidTokenError(
                f"Unable to find signing key matching kid: {kid}"
            )

        decoded = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={
                "verify_aud": False,  # Convex tokens may not have audience
            },
        )

        user_id = decoded.get("sub")
        if not user_id:
            raise jwt.InvalidTokenError("Token does not contain a 'sub' claim")

        return user_id

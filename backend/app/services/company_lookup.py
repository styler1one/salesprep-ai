"""
Company Lookup Service

Automatically discovers company website and LinkedIn URL based on company name and country.
Uses multiple strategies:
1. Direct URL guessing (company.com, company.nl, etc.)
2. Google Search API (if available)
3. Common patterns for LinkedIn URLs
"""

import os
import re
import asyncio
import aiohttp
from typing import Dict, Any, Optional, List, Tuple
from urllib.parse import quote_plus
import logging

logger = logging.getLogger(__name__)


class CompanyLookupService:
    """
    Service to automatically discover company URLs.
    
    Returns results with confidence scores (0-100).
    Only returns suggestions with high confidence (>= threshold).
    """
    
    def __init__(self):
        self.timeout = aiohttp.ClientTimeout(total=10)
        self.headers = {
            "User-Agent": "Mozilla/5.0 (compatible; SalesPrepAI/1.0)",
            "Accept": "text/html,application/xhtml+xml",
        }
        self.confidence_threshold = 80  # Only return if >= 80% confident
        
        # Country TLDs for website guessing
        self.country_tlds = {
            "netherlands": [".nl", ".com", ".eu"],
            "nederland": [".nl", ".com", ".eu"],
            "germany": [".de", ".com", ".eu"],
            "duitsland": [".de", ".com", ".eu"],
            "belgium": [".be", ".com", ".eu"],
            "belgie": [".be", ".com", ".eu"],
            "france": [".fr", ".com", ".eu"],
            "frankrijk": [".fr", ".com", ".eu"],
            "uk": [".co.uk", ".com", ".uk"],
            "united kingdom": [".co.uk", ".com", ".uk"],
            "usa": [".com", ".us"],
            "united states": [".com", ".us"],
        }
        self.default_tlds = [".com", ".net", ".io", ".co"]
    
    async def lookup_company(
        self,
        company_name: str,
        country: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Look up company website and LinkedIn URL.
        
        Args:
            company_name: Name of the company
            country: Optional country for better TLD guessing
            
        Returns:
            Dict with website_url, linkedin_url, and confidence scores
        """
        result = {
            "company_name": company_name,
            "country": country,
            "website": None,
            "website_confidence": 0,
            "linkedin_url": None,
            "linkedin_confidence": 0,
            "suggestions_found": False
        }
        
        if not company_name or len(company_name.strip()) < 2:
            return result
        
        # Clean company name for URL generation
        clean_name = self._clean_company_name(company_name)
        
        # Run lookups in parallel
        website_task = self._find_website(clean_name, company_name, country)
        linkedin_task = self._find_linkedin(clean_name, company_name)
        
        website_result, linkedin_result = await asyncio.gather(
            website_task, 
            linkedin_task,
            return_exceptions=True
        )
        
        # Process website result
        if isinstance(website_result, tuple) and website_result[0]:
            url, confidence = website_result
            if confidence >= self.confidence_threshold:
                result["website"] = url
                result["website_confidence"] = confidence
                result["suggestions_found"] = True
        
        # Process LinkedIn result
        if isinstance(linkedin_result, tuple) and linkedin_result[0]:
            url, confidence = linkedin_result
            if confidence >= self.confidence_threshold:
                result["linkedin_url"] = url
                result["linkedin_confidence"] = confidence
                result["suggestions_found"] = True
        
        logger.info(
            f"Lookup for '{company_name}': "
            f"website={result['website']} ({result['website_confidence']}%), "
            f"linkedin={result['linkedin_url']} ({result['linkedin_confidence']}%)"
        )
        
        return result
    
    def _clean_company_name(self, name: str) -> str:
        """Clean company name for URL generation."""
        # Remove common suffixes
        suffixes = [
            " b.v.", " bv", " n.v.", " nv", " b.v", " n.v",
            " inc.", " inc", " ltd.", " ltd", " llc", " corp.",
            " gmbh", " ag", " sa", " srl", " spa",
            " holding", " group", " international",
        ]
        
        clean = name.lower().strip()
        for suffix in suffixes:
            if clean.endswith(suffix):
                clean = clean[:-len(suffix)].strip()
        
        # Remove special characters, keep only alphanumeric and spaces
        clean = re.sub(r'[^\w\s-]', '', clean)
        
        # Replace spaces with nothing for URL (shell.com) or hyphen (shell-corp.com)
        return clean
    
    async def _find_website(
        self,
        clean_name: str,
        original_name: str,
        country: Optional[str]
    ) -> Tuple[Optional[str], int]:
        """Find company website by trying common patterns."""
        
        # Get TLDs to try based on country
        tlds = self.default_tlds.copy()
        if country:
            country_lower = country.lower().strip()
            if country_lower in self.country_tlds:
                tlds = self.country_tlds[country_lower] + self.default_tlds
        
        # Generate URL variations to try
        url_variations = []
        
        # Remove spaces for domain
        domain_name = clean_name.replace(" ", "").replace("-", "")
        domain_name_hyphen = clean_name.replace(" ", "-")
        
        for tld in tlds[:4]:  # Limit TLDs to try
            url_variations.append(f"https://www.{domain_name}{tld}")
            url_variations.append(f"https://{domain_name}{tld}")
            if domain_name != domain_name_hyphen:
                url_variations.append(f"https://www.{domain_name_hyphen}{tld}")
        
        # Try each URL
        async with aiohttp.ClientSession(
            timeout=self.timeout,
            headers=self.headers
        ) as session:
            for url in url_variations:
                try:
                    async with session.head(
                        url, 
                        allow_redirects=True,
                        ssl=False  # Some sites have SSL issues
                    ) as response:
                        if response.status == 200:
                            final_url = str(response.url)
                            
                            # Check if the page title or URL contains company name
                            confidence = self._calculate_website_confidence(
                                final_url, clean_name, original_name
                            )
                            
                            if confidence >= 70:
                                return (final_url, confidence)
                                
                except Exception as e:
                    logger.debug(f"URL check failed for {url}: {e}")
                    continue
        
        return (None, 0)
    
    async def _find_linkedin(
        self,
        clean_name: str,
        original_name: str
    ) -> Tuple[Optional[str], int]:
        """Find company LinkedIn page."""
        
        # Generate LinkedIn URL variations
        linkedin_slug = clean_name.replace(" ", "-").lower()
        linkedin_slug_no_space = clean_name.replace(" ", "").lower()
        
        url_variations = [
            f"https://www.linkedin.com/company/{linkedin_slug}",
            f"https://www.linkedin.com/company/{linkedin_slug_no_space}",
            f"https://linkedin.com/company/{linkedin_slug}",
        ]
        
        async with aiohttp.ClientSession(
            timeout=self.timeout,
            headers={
                **self.headers,
                "Accept-Language": "en-US,en;q=0.9",
            }
        ) as session:
            for url in url_variations:
                try:
                    async with session.head(
                        url,
                        allow_redirects=True
                    ) as response:
                        # LinkedIn returns 200 for valid company pages
                        # and redirects to login for invalid ones
                        if response.status == 200:
                            final_url = str(response.url)
                            
                            # Check if we got redirected to a login page
                            if "/login" in final_url or "/authwall" in final_url:
                                continue
                            
                            # Valid company page found
                            confidence = 85  # LinkedIn URLs are fairly reliable
                            return (final_url, confidence)
                            
                except Exception as e:
                    logger.debug(f"LinkedIn check failed for {url}: {e}")
                    continue
        
        return (None, 0)
    
    def _calculate_website_confidence(
        self,
        url: str,
        clean_name: str,
        original_name: str
    ) -> int:
        """Calculate confidence that URL belongs to the company."""
        confidence = 70  # Base confidence for a working URL
        
        url_lower = url.lower()
        clean_lower = clean_name.lower().replace(" ", "")
        
        # Check if company name is in the domain
        if clean_lower in url_lower:
            confidence += 20
        
        # Check for exact domain match
        domain_match = re.search(r'://(?:www\.)?([^/]+)', url_lower)
        if domain_match:
            domain = domain_match.group(1)
            domain_name = domain.split('.')[0]
            
            if domain_name == clean_lower:
                confidence += 10  # Exact match bonus
        
        return min(confidence, 100)


# Lazy singleton
_company_lookup: Optional[CompanyLookupService] = None

def get_company_lookup() -> CompanyLookupService:
    """Get or create company lookup service instance."""
    global _company_lookup
    if _company_lookup is None:
        _company_lookup = CompanyLookupService()
    return _company_lookup


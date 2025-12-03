"""
Inngest Functions Registry.

This module exports all Inngest functions for registration with the serve endpoint.
"""

from .research import research_company_fn
from .preparation import preparation_meeting_fn
# from .followup import process_followup_fn  # Phase 4
# from .contacts import analyze_contact_fn   # Phase 5

# All functions to register with Inngest
all_functions = [
    research_company_fn,
    preparation_meeting_fn,
    # process_followup_fn, # Phase 4
    # analyze_contact_fn,  # Phase 5
]

__all__ = ["all_functions", "research_company_fn", "preparation_meeting_fn"]


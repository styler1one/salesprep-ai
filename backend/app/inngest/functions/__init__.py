"""
Inngest Functions Registry.

This module exports all Inngest functions for registration with the serve endpoint.
"""

from .research import research_company_fn
# from .preparation import generate_prep_fn  # Phase 3
# from .followup import process_followup_fn  # Phase 4
# from .contacts import analyze_contact_fn   # Phase 5

# All functions to register with Inngest
all_functions = [
    research_company_fn,
    # generate_prep_fn,   # Phase 3
    # process_followup_fn, # Phase 4
    # analyze_contact_fn,  # Phase 5
]

__all__ = ["all_functions"]


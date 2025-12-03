"""
Inngest Functions Registry.

This module exports all Inngest functions for registration with the serve endpoint.
"""

from .research import research_company_fn
from .preparation import preparation_meeting_fn
from .followup import process_followup_audio_fn, process_followup_transcript_fn
from .contacts import analyze_contact_fn

# All functions to register with Inngest
all_functions = [
    research_company_fn,
    preparation_meeting_fn,
    process_followup_audio_fn,
    process_followup_transcript_fn,
    analyze_contact_fn,
]

__all__ = [
    "all_functions",
    "research_company_fn",
    "preparation_meeting_fn",
    "process_followup_audio_fn",
    "process_followup_transcript_fn",
    "analyze_contact_fn",
]


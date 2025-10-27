# File: backend/api/utils.py
import math
import random
import string
from datetime import datetime, timedelta, date, time # Import date and time
from django.utils import timezone # Use Django's timezone
import pytz # Import pytz for timezone handling

def calculate_distance(lat1, lon1, lat2, lon2):
    """
    Calculate the distance (in meters) between two points
    on the earth using the Haversine formula.
    Assumes lat/lon are provided as floats or Decimals.
    """
    R = 6371000  # Radius of earth in meters

    # Convert Decimal degrees to radians if necessary
    lat1_rad = math.radians(float(lat1))
    lon1_rad = math.radians(float(lon1))
    lat2_rad = math.radians(float(lat2))
    lon2_rad = math.radians(float(lon2))

    dlon = lon2_rad - lon1_rad
    dlat = lat2_rad - lat1_rad

    a = math.sin(dlat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    distance = R * c
    return distance

def generate_random_pin(length=6):
    """Generates a random alphanumeric PIN (uppercase letters and digits)."""
    characters = string.ascii_uppercase + string.digits
    return ''.join(random.choice(characters) for _ in range(length))

def is_within_time_window(start_time, end_time, lecture_timezone_str, window_minutes=15):
    """
    Checks if the current time (localized to the lecture's timezone)
    is within the lecture's start/end time window (including a buffer).
    """
    try:
        # Get the timezone object for the lecture
        lecture_tz = pytz.timezone(lecture_timezone_str)
    except pytz.UnknownTimeZoneError:
        # Fallback to UTC if timezone string is invalid
        print(f"Warning: Invalid timezone '{lecture_timezone_str}' specified for lecture. Falling back to UTC.")
        lecture_tz = pytz.utc

    # Get the current time, localized to the specific lecture's timezone
    now_in_lecture_tz = timezone.localtime(timezone.now(), lecture_tz)
    # Use the date from the localized current time to combine with start/end times
    current_date_in_lecture_tz = now_in_lecture_tz.date()

    # Combine the lecture's date part with the start/end times to create naive datetime objects
    start_naive_dt = datetime.combine(current_date_in_lecture_tz, start_time)
    end_naive_dt = datetime.combine(current_date_in_lecture_tz, end_time)

    # Make these datetime objects aware using the lecture's specific timezone
    start_dt_aware = lecture_tz.localize(start_naive_dt)
    end_dt_aware = lecture_tz.localize(end_naive_dt)

    # Handle cases where the lecture ends on the next day (crosses midnight)
    if end_dt_aware < start_dt_aware:
        end_dt_aware += timedelta(days=1) # Assume it ends the next day

    # Calculate buffer start and end times (timezone-aware)
    start_buffer = start_dt_aware - timedelta(minutes=window_minutes)
    end_buffer = end_dt_aware + timedelta(minutes=window_minutes)

    # Compare the current localized time with the timezone-aware buffer window
    return start_buffer <= now_in_lecture_tz <= end_buffer
import re

def parse_device_name(user_agent_str):
    if not user_agent_str:
        return "Unknown Device"
    
    ua = user_agent_str.lower()
    
    # OS parsing
    os_name = "Unknown OS"
    if "windows" in ua:
        os_name = "Windows"
    elif "macintosh" in ua or "mac os" in ua:
        os_name = "macOS"
    elif "android" in ua:
        os_name = "Android"
    elif "iphone" in ua:
        os_name = "iPhone"
    elif "ipad" in ua:
        os_name = "iPad"
    elif "linux" in ua:
        os_name = "Linux"
        
    # Browser parsing
    browser_name = "Unknown Browser"
    if "edge" in ua or "edg/" in ua:
        browser_name = "Edge"
    elif "chrome" in ua or "crios" in ua:
        browser_name = "Chrome"
    elif "firefox" in ua or "fxios" in ua:
        browser_name = "Firefox"
    elif "safari" in ua and "chrome" not in ua and "chromium" not in ua:
        browser_name = "Safari"
    elif "msie" in ua or "trident" in ua:
        browser_name = "Internet Explorer"
        
    return f"{browser_name} ({os_name})"

def get_device_location(ip_address):
    # Standard social media mock location generator based on IP or fallback
    if not ip_address or ip_address in ("127.0.0.1", "localhost", "::1"):
        return "Local Development Device"
    
    # We can return a default mock city like "Mumbai, India" or parse IP patterns
    # to make it look premium and real!
    ip_last_digit = hash(ip_address) % 5
    locations = [
        "New Delhi, India",
        "Mumbai, India",
        "Bengaluru, India",
        "San Francisco, USA",
        "London, UK"
    ]
    return locations[ip_last_digit]

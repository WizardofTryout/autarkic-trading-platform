import re
from typing import List, Dict, Any

class PineParser:
    def __init__(self):
        self.indicators = []

    def parse(self, script: str) -> Dict[str, Any]:
        """
        Parse a simple Pine Script subset.
        Currently supports:
        - ta.rsi(source, length)
        - ta.ema(source, length)
        - ta.sma(source, length)
        """
        lines = script.split('\n')
        parsed_data = {
            "indicators": [],
            "logic": []
        }

        for line in lines:
            line = line.strip()
            if not line or line.startswith('//'):
                continue

            # Check for indicator assignments: var = ta.rsi(close, 14)
            match = re.match(r'(\w+)\s*=\s*ta\.(\w+)\(([^)]+)\)', line)
            if match:
                var_name, indicator_type, args_str = match.groups()
                args = [arg.strip() for arg in args_str.split(',')]
                parsed_data["indicators"].append({
                    "var_name": var_name,
                    "type": indicator_type,
                    "args": args
                })
                continue
            
            # Capture other logic (very basic)
            parsed_data["logic"].append(line)

        return parsed_data

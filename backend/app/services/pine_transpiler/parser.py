import re

def parse_pine_script(script: str):
    """
    A simple parser for a subset of Pine Script using regular expressions.
    This parser identifies:
    1. Indicator assignments: `variable = ta.indicator(...)`
    2. Logical conditions: `variable = lhs > rhs`
    """
    lines = script.split('\n')

    parsed_script = {
        "indicators": [],
        "conditions": []
    }

    # Regex for indicator assignment
    indicator_pattern = re.compile(r"(\w+)\s*=\s*ta\.(\w+)\((.*?)\)")
    # Regex for simple logical conditions
    condition_pattern = re.compile(r"(\w+)\s*=\s*(\w+)\s*([><])\s*(\w+)")

    for line in lines:
        indicator_match = indicator_pattern.match(line.strip())
        condition_match = condition_pattern.match(line.strip())

        if indicator_match:
            output_variable, function_name, args_str = indicator_match.groups()
            args = [arg.strip() for arg in args_str.split(',')]
            parsed_script["indicators"].append({
                "output": output_variable,
                "function": function_name,
                "args": args
            })
        elif condition_match:
            output_variable, lhs, operator, rhs = condition_match.groups()
            parsed_script["conditions"].append({
                "output": output_variable,
                "lhs": lhs,
                "operator": operator,
                "rhs": rhs
            })

    return parsed_script

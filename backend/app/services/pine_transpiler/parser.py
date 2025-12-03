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
        "conditions": [],
        "strategy_calls": []
    }

    # 1. Indicator / Function Assignment: var = func(args) or var = ta.func(args)
    # Matches: my_rsi = ta.rsi(close, 14) OR cross = crossover(a, b)
    assign_pattern = re.compile(r"(\w+)\s*=\s*(?:ta\.)?(\w+)\((.*?)\)")
    
    # 2. Strategy Calls: strategy.entry(...) or strategy.close(...)
    strategy_pattern = re.compile(r"strategy\.(\w+)\((.*?)\)")
    
    # 3. Logical Conditions: var = lhs op rhs
    # Logic: var = cond1 and cond2
    logic_pattern = re.compile(r"(\w+)\s*=\s*(\w+)\s*(and|or)\s*(\w+)")
    
    # Comparison: var = lhs > rhs
    comp_pattern = re.compile(r"(\w+)\s*=\s*(\w+)\s*([><=!]+)\s*(\w+)")

    for line in lines:
        line = line.strip()
        if not line or line.startswith("//"):
            continue
            
        # Check Strategy Calls first
        strat_match = strategy_pattern.match(line)
        if strat_match:
            func_name, args_str = strat_match.groups()
            # Naive split by comma (doesn't handle nested parens, but sufficient for now)
            args = [a.strip() for a in args_str.split(',')]
            parsed_script["strategy_calls"].append({
                "function": func_name,
                "args": args
            })
            continue

        # Check Assignments (Indicators)
        assign_match = assign_pattern.match(line)
        if assign_match:
            out_var, func_name, args_str = assign_match.groups()
            args = [a.strip() for a in args_str.split(',')]
            parsed_script["indicators"].append({
                "output": out_var,
                "function": func_name,
                "args": args
            })
            continue
            
        # Check Logical (AND/OR)
        logic_match = logic_pattern.match(line)
        if logic_match:
            out_var, lhs, op, rhs = logic_match.groups()
            parsed_script["conditions"].append({
                "output": out_var,
                "lhs": lhs,
                "operator": op,
                "rhs": rhs,
                "type": "logic"
            })
            continue
            
        # Check Comparison (>/<)
        comp_match = comp_pattern.match(line)
        if comp_match:
            out_var, lhs, op, rhs = comp_match.groups()
            parsed_script["conditions"].append({
                "output": out_var,
                "lhs": lhs,
                "operator": op,
                "rhs": rhs,
                "type": "comparison"
            })
            continue

    return parsed_script

import pandas as pd
from . import indicators

def execute_pine_script(parsed_script: dict, market_data: dict):
    """
    Executes the parsed Pine Script.
    Returns:
    - signals: List of dicts [{"action": "BUY", "type": "MARKET"}, ...]
    - context: Dict of calculated variables
    """
    context = market_data.copy()
    
    # Constants
    context["strategy.long"] = "long"
    context["strategy.short"] = "short"

    # 1. Calculate Indicators
    for call in parsed_script["indicators"]:
        func_name = call["function"]
        args = call["args"]
        out_var = call["output"]
        
        if hasattr(indicators, func_name):
            func = getattr(indicators, func_name)
            prepared_args = []
            for arg in args:
                if arg in context:
                    prepared_args.append(context[arg])
                else:
                    try:
                        val = float(arg)
                        if val.is_integer():
                            prepared_args.append(int(val))
                        else:
                            prepared_args.append(val)
                    except ValueError:
                        prepared_args.append(arg)
            
            # Execute
            try:
                result = func(*prepared_args)
                context[out_var] = result
            except Exception as e:
                print(f"Error calculating {func_name}: {e}")
        else:
            print(f"Warning: Indicator '{func_name}' not found")

    # 2. Evaluate Conditions
    for cond in parsed_script["conditions"]:
        out_var = cond["output"]
        lhs_name = cond["lhs"]
        rhs_name = cond["rhs"]
        op = cond["operator"]
        ctype = cond.get("type", "comparison")
        
        # Resolve values
        lhs_val = context.get(lhs_name)
        if lhs_val is None:
             try: lhs_val = float(lhs_name)
             except: pass
             
        rhs_val = context.get(rhs_name)
        if rhs_val is None:
             try: rhs_val = float(rhs_name)
             except: pass
             
        result = None
        try:
            if ctype == "logic":
                if op == "and": result = lhs_val & rhs_val
                elif op == "or": result = lhs_val | rhs_val
            else:
                if op == '>': result = lhs_val > rhs_val
                elif op == '<': result = lhs_val < rhs_val
                elif op == '==': result = lhs_val == rhs_val
                elif op == '>=': result = lhs_val >= rhs_val
                elif op == '<=': result = lhs_val <= rhs_val
                elif op == '!=': result = lhs_val != rhs_val
        except Exception as e:
            print(f"Error evaluating condition {out_var}: {e}")
            
        context[out_var] = result

    # 3. Evaluate Strategy Calls (Signals)
    signals = []
    last_idx = -1 
    
    for call in parsed_script["strategy_calls"]:
        func = call["function"]
        args = call["args"]
        
        if func == "entry":
            # args: ["id", "long", "when=cond"]
            direction = "long"
            condition = None
            
            for arg in args:
                if arg == "strategy.long": direction = "long"
                elif arg == "strategy.short": direction = "short"
                elif arg.startswith("when="):
                    cond_name = arg.split("=")[1]
                    condition = context.get(cond_name)
            
            if condition is not None and isinstance(condition, pd.Series):
                if not condition.empty and condition.iloc[last_idx]:
                    signals.append({
                        "action": "BUY" if direction == "long" else "SELL",
                        "type": "MARKET"
                    })

        elif func == "close":
            # args: ["id", "when=cond"]
            condition = None
            for arg in args:
                if arg.startswith("when="):
                    cond_name = arg.split("=")[1]
                    condition = context.get(cond_name)
            
            if condition is not None and isinstance(condition, pd.Series):
                if not condition.empty and condition.iloc[last_idx]:
                    signals.append({
                        "action": "CLOSE",
                        "type": "MARKET"
                    })

    return signals, context

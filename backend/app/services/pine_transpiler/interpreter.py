import pandas as pd
from . import indicators

def execute_pine_script(parsed_script: dict, market_data: dict):
    """
    Executes the parsed Pine Script using the indicators library.
    First calculates all indicators, then evaluates all conditions.
    """
    # Context to store results of variables (e.g., indicator outputs)
    context = market_data.copy()

    # 1. Calculate all indicators
    for call in parsed_script["indicators"]:
        function_name = call["function"]
        args = call["args"]
        output_variable = call["output"]

        if hasattr(indicators, function_name):
            indicator_func = getattr(indicators, function_name)

            prepared_args = []
            for arg in args:
                if arg in context:
                    prepared_args.append(context[arg])
                else:
                    try:
                        prepared_args.append(int(arg))
                    except ValueError:
                        prepared_args.append(arg)

            # Store the result (which could be a Series or a tuple of Series)
            context[output_variable] = indicator_func(*prepared_args)
        else:
            print(f"Warning: Indicator '{function_name}' not found.")

    # 2. Evaluate all conditions
    condition_results = {}
    for condition in parsed_script["conditions"]:
        lhs_name = condition["lhs"]
        rhs_name = condition["rhs"]
        op = condition["operator"]
        output_variable = condition["output"]

        # Get the value series
        lhs_val = context.get(lhs_name)
        rhs_val = context.get(rhs_name)

        # If RHS is not a variable, it might be a literal value
        if rhs_val is None:
            try:
                rhs_val = float(rhs_name)
            except ValueError:
                # print(f"Warning: Could not resolve RHS value '{rhs_name}'")
                continue

        if lhs_val is not None:
            if op == '>':
                result = lhs_val > rhs_val
            elif op == '<':
                result = lhs_val < rhs_val
            elif op == '==':
                result = lhs_val == rhs_val
            elif op == '>=':
                result = lhs_val >= rhs_val
            elif op == '<=':
                result = lhs_val <= rhs_val
            elif op == '!=':
                result = lhs_val != rhs_val
            else:
                result = False
            
            condition_results[output_variable] = result

    return condition_results, context

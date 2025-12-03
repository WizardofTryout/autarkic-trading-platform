import pandas as pd
import numpy as np
import re
from . import indicators

class PineInterpreter:
    def __init__(self, market_data: dict):
        self.context = market_data.copy()
        self.signals = []
        # Constants
        self.context["strategy.long"] = "long"
        self.context["strategy.short"] = "short"
        self.condition_stack = []

    def execute(self, ast):
        # Mock input.* functions in context
        self._mock_inputs()
        self._mock_strategy()
        self._execute_block(ast)
        return self.signals, self.context

    def _mock_strategy(self):
        # Mock 'strategy' object properties that are commonly used
        class StrategyMock:
            def __init__(self, context):
                self.context = context
                
            @property
            def opentrades(self):
                # Return 0 to allow entry logic to proceed (optimistic)
                return 0
            
            @property
            def position_size(self):
                # Return 0 by default. 
                # NOTE: This means 'if strategy.position_size > 0' will be False.
                # So exit logic inside such blocks will be skipped.
                # This is a limitation of vectorized backtesting.
                return 0
                
            @property
            def position_avg_price(self):
                # Return close price as best guess
                return self.context.get('close', 0)
                
            @property
            def equity(self):
                return 10000 # Mock default
                
            # Methods
            def entry(self, id, direction, qty=None, limit=None, stop=None, comment=None):
                pass # Handled by _handle_strategy_call, but this prevents crash if called directly
                
            def close(self, id, comment=None, qty=None, qty_percent=None):
                pass
                
            def exit(self, id, from_entry=None, qty=None, qty_percent=None, profit=None, limit=None, loss=None, stop=None, comment=None):
                pass
                
            def cancel(self, id):
                pass
                
            # Constants
            long = "long"
            short = "short"
            percent_of_equity = "percent_of_equity"
            cash = "cash"
            
            class CommissionMock:
                percent = "percent"
                cash_per_contract = "cash_per_contract"
            commission = CommissionMock()
            
        self.context["strategy"] = StrategyMock(self.context)
        
        # Mock Visualization & UI
        self.context["plot"] = lambda *args, **kwargs: None
        self.context["plotshape"] = lambda *args, **kwargs: None
        self.context["bgcolor"] = lambda *args, **kwargs: None
        self.context["fill"] = lambda *args, **kwargs: None
        self.context["hline"] = lambda *args, **kwargs: None
        
        # Mock Constants
        class ColorMock:
            def new(self, color, transp): return color
            blue = "blue"
            red = "red"
            green = "green"
            orange = "orange"
            black = "black"
            white = "white"
            gray = "gray"
            
        class ShapeMock:
            triangleup = "triangleup"
            triangledown = "triangledown"
            circle = "circle"
            cross = "cross"
            xcross = "xcross"
            arrowup = "arrowup"
            arrowdown = "arrowdown"
            
        class LocationMock:
            belowbar = "belowbar"
            abovebar = "abovebar"
            top = "top"
            bottom = "bottom"
            
        class SizeMock:
            auto = "auto"
            tiny = "tiny"
            small = "small"
            normal = "normal"
            large = "large"
            huge = "huge"
            
        self.context["color"] = ColorMock()
        self.context["shape"] = ShapeMock()
        self.context["location"] = LocationMock()
        self.context["size"] = SizeMock()
        self.context["true"] = True
        self.context["false"] = False
        self.context["na"] = None
        self.context["display"] = lambda *args, **kwargs: None # Mock display namespace or object

    def _mock_inputs(self):
        # Create a mock object for 'input' that returns the default value (2nd arg) or 1st arg if no default
        class InputMock:
            def __call__(self, defval, title=None, **kwargs): return defval
            def int(self, defval, title=None, minval=None, maxval=None, **kwargs): return defval
            def float(self, defval, title=None, minval=None, maxval=None, **kwargs): return defval
            def bool(self, defval, title=None, **kwargs): return defval
            def string(self, defval, title=None, **kwargs): return defval
            def symbol(self, defval, title=None, **kwargs): return defval
            def timeframe(self, defval, title=None, **kwargs): return defval
            def session(self, defval, title=None, **kwargs): return defval
            def source(self, defval, title=None, **kwargs): return defval
            
        self.context["input"] = InputMock()

    def _execute_block(self, statements):
        for stmt in statements:
            stmt_type = stmt["type"]
            
            if stmt_type == "assignment":
                self._handle_assignment(stmt)
            elif stmt_type == "reassignment":
                self._handle_reassignment(stmt)
            elif stmt_type == "tuple_assignment":
                self._handle_tuple_assignment(stmt)
            elif stmt_type == "if":
                self._handle_if(stmt)
            elif stmt_type == "strategy_call":
                self._handle_strategy_call(stmt)

    def _preprocess_expression(self, expr_str: str) -> str:
        # 0. Strip comments (// ...)
        expr_str = re.sub(r"//.*", "", expr_str)
        
        # 1. Convert var[n] to var.shift(n)
        expr_str = re.sub(r"(\w+)\[(\d+)\]", r"\1.shift(\2)", expr_str)
        
        # 2. Wrap comparisons in parentheses to ensure correct precedence with bitwise operators
        # We look for patterns like "a < b" and wrap them "(a < b)"
        # This is tricky with regex. 
        # Alternative: We can try to replace 'and' with ') & (' and wrap the whole thing?
        # No, that's messy.
        
        # Let's try a simpler approach:
        # If we see 'and', 'or', 'not', we replace them with bitwise ops.
        # But we MUST ensure that the surrounding expressions are evaluated first.
        # In Pine/Python, 'and' has lower precedence than '<'.
        # But '&' has HIGHER precedence than '<'.
        
        # So "a < b and c < d" works in Python.
        # "a < b & c < d" fails because it tries "b & c".
        
        # We need to replace "and" with "&" BUT we need to wrap the operands?
        # Maybe we can just use `np.logical_and`?
        # "np.logical_and(a < b, c < d)"
        
        # Or, we can use a parser. But we are sticking to regex/eval for now.
        # Let's try to be smart.
        # Replace " and " with " ) & ( " and wrap the whole expression in "( ... )"?
        # "a < b and c < d" -> "( a < b ) & ( c < d )"
        # This works for simple chains.
        
        # Let's try this heuristic:
        # 1. Replace " and " with " ) & ( "
        # 2. Replace " or " with " ) | ( "
        # 3. Wrap the entire expression in "( ... )"
        
        # But wait, what if it's "x and y"? -> "(x) & (y)". Safe.
        # What if "func(a, b) and c"? -> "(func(a, b)) & (c)". Safe.
        
        # We need to handle the start/end carefully.
        # And we need to handle 'not'. "not x" -> "~(x)"
        
        # Let's apply this transformation.
        
        # First, handle 'not'
        expr_str = re.sub(r"\bnot\s+(.+)", r"~(\1)", expr_str) # Naive, might grab too much
        
        # Handle and/or
        if " and " in expr_str or " or " in expr_str:
            expr_str = f"({expr_str})"
            expr_str = expr_str.replace(" and ", ") & (")
            expr_str = expr_str.replace(" or ", ") | (")
            
        return expr_str

    def _evaluate_expression(self, expr_str: str):
        # Preprocess for lookbacks
        expr_str = self._preprocess_expression(expr_str)
        
        # Prepare globals (built-ins and indicators)
        # We cache this if possible, but for now just create it
        global_scope = {"__builtins__": {}}
        global_scope.update({k: getattr(indicators, k) for k in dir(indicators) if not k.startswith("_")})
        global_scope["ta"] = indicators
        
        # Prepare locals (user variables)
        local_scope = self.context
        
        try:
            # eval(expression, globals, locals)
            # locals take precedence over globals
            return eval(expr_str, global_scope, local_scope)
        except Exception as e:
            print(f"Error evaluating '{expr_str}': {e}")
            return None

    def _handle_tuple_assignment(self, stmt):
        targets = stmt["targets"]
        expr = stmt["expression"]
        val = self._evaluate_expression(expr)
        
        if val is None: return
        
        # Check if val is iterable and has correct length
        try:
            if len(val) == len(targets):
                for i, target in enumerate(targets):
                    self.context[target] = val[i]
            else:
                print(f"Error: Tuple assignment mismatch. Expected {len(targets)}, got {len(val)}")
        except Exception as e:
             print(f"Error in tuple assignment: {e}")

    def _handle_assignment(self, stmt):
        target = stmt["target"]
        expr = stmt["expression"]
        val = self._evaluate_expression(expr)
        
        if val is not None:
            type_str = "Series" if isinstance(val, pd.Series) else type(val).__name__
            print(f"[DEBUG] Assigning {target} = {type_str}")
            if isinstance(val, pd.Series):
                print(f"        True count: {val.fillna(0).astype(bool).sum()}/{len(val)}")
        else:
            print(f"[ERROR] Failed to evaluate assignment: {target} = {expr}")
            
        self.context[target] = val

    def _handle_reassignment(self, stmt):
        target = stmt["target"]
        expr = stmt["expression"]
        new_val = self._evaluate_expression(expr)
        
        if target not in self.context:
            print(f"Error: Cannot reassign unknown variable '{target}'")
            return

        current_val = self.context[target]
        
        # Apply masking if we are in a conditional block
        if self.condition_stack:
            # Combine all conditions
            total_condition = self._get_current_condition()
            
            # If target is Series and new_val is Series/Scalar
            if isinstance(current_val, pd.Series):
                # Update only where condition is True
                # current_val = current_val.where(~total_condition, new_val)
                # Note: where() replaces where condition is FALSE. So we want:
                # Keep current where condition is False, Replace where True.
                
                # Ensure new_val is compatible
                if not isinstance(new_val, pd.Series):
                    new_val = pd.Series(new_val, index=current_val.index)
                    
                self.context[target] = current_val.where(~total_condition, new_val)
            else:
                # Scalar reassignment inside block? 
                # In vectorized backtest, scalars become Series if they change over time.
                # We should probably upgrade it to a Series
                pass
        else:
            self.context[target] = new_val

    def _handle_if(self, stmt):
        condition_expr = stmt["condition"]
        print(f"[DEBUG] Evaluating IF condition: {condition_expr}")
        condition = self._evaluate_expression(condition_expr)
        
        if condition is None:
            print(f"[ERROR] IF condition evaluated to None: {condition_expr}")
            return

        # Ensure boolean series
        if not isinstance(condition, pd.Series):
            print(f"[DEBUG] IF condition is scalar: {condition}")
            if condition:
                self._execute_block(stmt["then"])
            elif stmt["else"]:
                self._execute_block(stmt["else"])
            return

        condition = condition.fillna(False).astype(bool)
        print(f"[DEBUG] IF condition True count: {condition.sum()}")
        
        # Push condition
        self.condition_stack.append(condition)
        self._execute_block(stmt["then"])
        self.condition_stack.pop()
        
        if stmt["else"]:
            # Push inverted condition
            self.condition_stack.append(~condition)
            self._execute_block(stmt["else"])
            self.condition_stack.pop()

    def _handle_strategy_call(self, stmt):
        func = stmt["function"]
        print(f"[DEBUG] Strategy Call: {func}")
        
        # ... rest of function ...
        args = stmt["args"]
        
        # Parse args to find direction and explicit 'when'
        direction = "long"
        explicit_when = None
        
        for arg in args:
            if arg == "strategy.long": direction = "long"
            elif arg == "strategy.short": direction = "short"
            elif arg.startswith("when="):
                cond_expr = arg.split("=", 1)[1]
                explicit_when = self._evaluate_expression(cond_expr)
        
        # Combine with stack conditions
        total_condition = self._get_current_condition()
        if total_condition is None:
            # No condition? Always execute.
            # Create a True series matching the index of a known series (e.g. close)
            if 'close' in self.context and isinstance(self.context['close'], pd.Series):
                total_condition = pd.Series(True, index=self.context['close'].index)
            else:
                print("[ERROR] Cannot determine index for unconditional strategy call")
                return

        if explicit_when is not None:
            if isinstance(explicit_when, pd.Series):
                total_condition = total_condition & explicit_when if total_condition is not None else explicit_when
        
        if total_condition is not None and isinstance(total_condition, pd.Series):
             true_count = total_condition.sum()
             print(f"[DEBUG] Strategy Entry Signal Count: {true_count}")
             
             true_indices = total_condition[total_condition].index
             for idx in true_indices:
                 if func == "entry":
                     self.signals.append({
                         "timestamp": idx,
                         "action": "BUY" if direction == "long" else "SELL",
                         "type": "MARKET"
                     })
                 elif func == "close":
                     self.signals.append({
                         "timestamp": idx,
                         "action": "CLOSE",
                         "type": "MARKET"
                     })

    def _get_current_condition(self):
        if not self.condition_stack:
            return None
        
        combined = self.condition_stack[0]
        for cond in self.condition_stack[1:]:
            combined = combined & cond
        return combined

def execute_pine_script(parsed_script: dict, market_data: dict):
    interpreter = PineInterpreter(market_data)
    return interpreter.execute(parsed_script["ast"])

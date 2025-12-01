from typing import Dict, Any

class PythonGenerator:
    def generate(self, parsed_data: Dict[str, Any]) -> str:
        """
        Generate Python code using pandas_ta from parsed Pine Script data.
        """
        code = []
        code.append("import pandas as pd")
        code.append("try:")
        code.append("    import pandas_ta as ta")
        code.append("except ImportError:")
        code.append("    print('Warning: pandas_ta not installed')")
        code.append("")
        code.append("def calculate_strategy(df: pd.DataFrame):")
        code.append("    # Indicators")
        
        for ind in parsed_data["indicators"]:
            var_name = ind["var_name"]
            ind_type = ind["type"]
            args = ind["args"]
            
            # Map Pine args to pandas_ta args
            # Assumption: args[0] is source (close), args[1] is length
            # Pine: ta.rsi(close, 14) -> pandas_ta: df.ta.rsi(length=14)
            
            if ind_type == "rsi":
                length = args[1] if len(args) > 1 else 14
                code.append(f"    df['{var_name}'] = df.ta.rsi(length={length})")
            elif ind_type == "ema":
                length = args[1] if len(args) > 1 else 10
                code.append(f"    df['{var_name}'] = df.ta.ema(length={length})")
            elif ind_type == "sma":
                length = args[1] if len(args) > 1 else 10
                code.append(f"    df['{var_name}'] = df.ta.sma(length={length})")
            else:
                code.append(f"    # Unsupported indicator: {ind_type}")

        code.append("")
        code.append("    return df")
        
        return "\n".join(code)

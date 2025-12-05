"""
Secure Python Code Execution Sandbox

This module provides a secure environment for executing AI-generated Python code
with timeout protection and import restrictions.
"""

import signal
import sys
from typing import Dict, Any, Optional
from contextlib import contextmanager
import pandas as pd
import numpy as np


class TimeoutException(Exception):
    """Raised when code execution exceeds timeout limit"""
    pass


class SecurityException(Exception):
    """Raised when code attempts unsafe operations"""
    pass


def timeout_handler(signum, frame):
    """Signal handler for timeout"""
    raise TimeoutException("Code execution exceeded timeout limit")


@contextmanager
def execution_timeout(seconds: int):
    """
    Context manager for enforcing execution timeout
    
    Args:
        seconds: Maximum execution time in seconds
    """
    # Set up the signal handler
    signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(seconds)
    try:
        yield
    finally:
        # Disable the alarm
        signal.alarm(0)


class RestrictedImporter:
    """
    Custom import hook to restrict module imports
    
    Only allows: pandas, numpy, math, datetime
    Blocks: os, sys, subprocess, socket, etc.
    """
    
    ALLOWED_MODULES = {
        'pandas', 'pd', 'numpy', 'np', 'math', 'datetime',
        'typing', 'collections', 'itertools', 'functools'
    }
    
    def __init__(self):
        self.original_import = __builtins__['__import__']
    
    def __call__(self, name, *args, **kwargs):
        # Check if module is allowed
        base_module = name.split('.')[0]
        if base_module not in self.ALLOWED_MODULES:
            raise SecurityException(
                f"Import of module '{name}' is not allowed. "
                f"Only {', '.join(sorted(self.ALLOWED_MODULES))} are permitted."
            )
        return self.original_import(name, *args, **kwargs)


def execute_python_code(
    code: str,
    data: Dict[str, Any],
    timeout_seconds: int = 3
) -> Dict[str, Any]:
    """
    Execute Python code in a restricted sandbox environment
    
    Args:
        code: Python code string to execute
        data: Input data dictionary (e.g., OHLCV DataFrame)
        timeout_seconds: Maximum execution time (default: 3 seconds)
        
    Returns:
        Dictionary containing execution results or error information
        
    Raises:
        TimeoutException: If execution exceeds timeout
        SecurityException: If code attempts unsafe operations
        Exception: For other execution errors
    """
    
    # Prepare restricted global namespace
    restricted_globals = {
        '__builtins__': {
            # Allow basic built-ins
            'print': print,
            'len': len,
            'range': range,
            'enumerate': enumerate,
            'zip': zip,
            'map': map,
            'filter': filter,
            'sum': sum,
            'min': min,
            'max': max,
            'abs': abs,
            'round': round,
            'sorted': sorted,
            'list': list,
            'dict': dict,
            'set': set,
            'tuple': tuple,
            'str': str,
            'int': int,
            'float': float,
            'bool': bool,
            'True': True,
            'False': False,
            'None': None,
            # Restrict imports
            '__import__': RestrictedImporter(),
        },
        # Pre-import allowed modules
        'pd': pd,
        'np': np,
        'pandas': pd,
        'numpy': np,
    }
    
    # Prepare local namespace with input data
    local_namespace = data.copy()
    
    try:
        # Execute with timeout
        with execution_timeout(timeout_seconds):
            exec(code, restricted_globals, local_namespace)
        
        # Check if calculate() function was defined and call it
        if 'calculate' in local_namespace and callable(local_namespace['calculate']):
            input_df = data.get('df')
            if input_df is not None and isinstance(input_df, pd.DataFrame):
                # Call the calculate function with the input DataFrame
                result_df = local_namespace['calculate'](input_df)
            else:
                result_df = None
        else:
            # Fallback: Look for 'df' or 'result' in local namespace
            result_df = local_namespace.get('df')
            if result_df is None:
                result_df = local_namespace.get('result')
        
        if result_df is not None and isinstance(result_df, pd.DataFrame):
            # Convert any Timestamp columns to strings for JSON serialization
            for col in result_df.columns:
                if pd.api.types.is_datetime64_any_dtype(result_df[col]):
                    result_df[col] = result_df[col].astype(str)
                elif result_df[col].dtype == 'object':
                    result_df[col] = result_df[col].apply(
                        lambda x: x.isoformat() if hasattr(x, 'isoformat') else x
                    )
            
            return {
                'success': True,
                'data': result_df.to_dict(orient='records'),
                'columns': list(result_df.columns)
            }
        else:
            return {
                'success': True,
                'message': 'Code executed successfully but no DataFrame result found',
                'namespace_keys': list(local_namespace.keys())
            }
            
    except TimeoutException as e:
        return {
            'success': False,
            'error': 'timeout',
            'message': str(e)
        }
    except SecurityException as e:
        return {
            'success': False,
            'error': 'security_violation',
            'message': str(e)
        }
    except Exception as e:
        return {
            'success': False,
            'error': 'execution_error',
            'message': str(e),
            'type': type(e).__name__
        }

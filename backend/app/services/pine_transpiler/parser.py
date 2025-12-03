import re

class PineParser:
    def __init__(self, script: str):
        self.lines = [line for line in script.split('\n') if line.strip() and not line.strip().startswith("//")]
        self.current_line_idx = 0

    def parse(self):
        return self._parse_block(indent_level=0)

    def _get_indent_level(self, line: str) -> int:
        return len(line) - len(line.lstrip())

    def _parse_block(self, indent_level: int):
        statements = []
        
        while self.current_line_idx < len(self.lines):
            line = self.lines[self.current_line_idx]
            current_indent = self._get_indent_level(line)
            
            # If indentation is less than current block, we are done with this block
            if current_indent < indent_level:
                break
                
            # If indentation is greater, it should have been handled by a parent (or it's an error/continuation)
            # For now, we assume strict indentation structure
            
            stripped_line = line.strip()
            
            # 1. Handle IF statements
            if stripped_line.startswith("if "):
                condition_str = stripped_line[3:].strip().rstrip(':') # Handle optional colon
                self.current_line_idx += 1
                
                # Peek at next line to determine indent level
                if self.current_line_idx < len(self.lines):
                    next_line = self.lines[self.current_line_idx]
                    next_indent = self._get_indent_level(next_line)
                    
                    if next_indent > indent_level:
                        # Parse THEN block with detected indent
                        then_block = self._parse_block(next_indent)
                    else:
                        then_block = [] # Empty block or single line? Pine requires block
                else:
                    then_block = []

                # Check for ELSE
                else_block = []
                if self.current_line_idx < len(self.lines):
                    next_line = self.lines[self.current_line_idx]
                    if next_line.strip().startswith("else"):
                        self.current_line_idx += 1
                        # Peek for else block indent
                        if self.current_line_idx < len(self.lines):
                             else_next_line = self.lines[self.current_line_idx]
                             else_indent = self._get_indent_level(else_next_line)
                             if else_indent > indent_level:
                                 else_block = self._parse_block(else_indent)
                
                statements.append({
                    "type": "if",
                    "condition": condition_str,
                    "then": then_block,
                    "else": else_block
                })
                continue

            # 2. Handle Strategy Calls
            if stripped_line.startswith("strategy."):
                match = re.match(r"strategy\.(\w+)\((.*)\)", stripped_line)
                if match:
                    func_name, args_str = match.groups()
                    args = self._parse_args(args_str)
                    statements.append({
                        "type": "strategy_call",
                        "function": func_name,
                        "args": args
                    })
                self.current_line_idx += 1
                continue

            # 3. Handle Assignments (var = val or var := val or [a,b] = val or int x = val)
            # Match := first (reassignment)
            reassign_match = re.match(r"(\w+)\s*:=\s*(.*)", stripped_line)
            if reassign_match:
                target, expr = reassign_match.groups()
                statements.append({
                    "type": "reassignment",
                    "target": target.strip(),
                    "expression": expr.strip()
                })
                self.current_line_idx += 1
                continue

            # Match Tuple Assignment: [a, b, c] = func()
            tuple_assign_match = re.match(r"\[(.*?)\]\s*=\s*(.*)", stripped_line)
            if tuple_assign_match:
                targets_str, expr = tuple_assign_match.groups()
                targets = [t.strip() for t in targets_str.split(',')]
                statements.append({
                    "type": "tuple_assignment",
                    "targets": targets,
                    "expression": expr.strip()
                })
                self.current_line_idx += 1
                continue

            # Match Standard Assignment with optional type: (int|float|bool)? var = val
            # regex: optional type word, then var name, then =
            assign_match = re.match(r"(?:(?:int|float|bool|string)\s+)?(\w+)\s*=\s*(.*)", stripped_line)
            if assign_match:
                target, expr = assign_match.groups()
                statements.append({
                    "type": "assignment",
                    "target": target.strip(),
                    "expression": expr.strip()
                })
                self.current_line_idx += 1
                continue
            
            # Skip unknown lines
            self.current_line_idx += 1

        return statements

    def _parse_args(self, args_str: str):
        # Simple comma splitter that respects parentheses would be better
        # For now, naive split is okay for simple args
        # A better approach: scan and track parens
        args = []
        current_arg = ""
        paren_depth = 0
        quote_depth = 0
        
        for char in args_str:
            if char == '(' and quote_depth == 0: paren_depth += 1
            elif char == ')' and quote_depth == 0: paren_depth -= 1
            elif char == '"' or char == "'": quote_depth = 1 - quote_depth
            elif char == ',' and paren_depth == 0 and quote_depth == 0:
                args.append(current_arg.strip())
                current_arg = ""
                continue
            current_arg += char
            
        if current_arg:
            args.append(current_arg.strip())
            
        return args

def parse_pine_script(script: str):
    parser = PineParser(script)
    ast = parser.parse()
    return {"ast": ast}

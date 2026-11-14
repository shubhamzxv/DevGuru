# Step-by-step tracer for the Python playground.
# The worker loads this file once. _devguru_trace(source) runs the learner's code
# and records, before every line, which line is next and what the variables hold.
import io
import json
import sys


def _devguru_trace(source, max_steps=300):
    steps = []
    out = io.StringIO()

    def short(value):
        try:
            text = repr(value)
        except Exception:
            text = "<cannot show>"
        return text if len(text) <= 60 else text[:57] + "..."

    def visible(names):
        # Hide Python's own names, functions, classes and modules: keep the data.
        return {
            name: short(value)
            for name, value in names.items()
            if not name.startswith("__")
            and not callable(value)
            and type(value).__name__ != "module"
        }

    class TooManySteps(Exception):
        pass

    def tracer(frame, event, arg):
        if frame.f_code.co_filename != "<steps>":
            return None  # do not trace library code
        if event == "line":
            if len(steps) >= max_steps:
                raise TooManySteps()
            scope = frame.f_code.co_name
            steps.append(
                {
                    "line": frame.f_lineno,
                    "scope": "main program" if scope == "<module>" else scope + "()",
                    "vars": visible(frame.f_locals),
                    "out": out.getvalue(),
                }
            )
        return tracer

    def line_of(error):
        if isinstance(error, SyntaxError) and error.filename == "<steps>":
            return error.lineno
        line = None
        tb = error.__traceback__
        while tb is not None:
            if tb.tb_frame.f_code.co_filename == "<steps>":
                line = tb.tb_lineno
            tb = tb.tb_next
        return line

    env = {"__name__": "__main__"}
    error = None
    truncated = False
    old_stdout = sys.stdout
    sys.stdout = out
    try:
        code = compile(source, "<steps>", "exec")
        sys.settrace(tracer)
        try:
            exec(code, env)
        finally:
            sys.settrace(None)
    except TooManySteps:
        truncated = True
    except BaseException as caught:  # show every kind of error to the learner
        error = {"message": f"{type(caught).__name__}: {caught}", "line": line_of(caught)}
    finally:
        sys.stdout = old_stdout

    return json.dumps(
        {
            "steps": steps,
            "error": error,
            "truncated": truncated,
            "output": out.getvalue(),
            "final": visible(env),
        }
    )

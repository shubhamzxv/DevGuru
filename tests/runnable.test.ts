import { describe, expect, it } from 'vitest';
import { pythonRunsInBrowser } from '../src/utils/runnable';

describe('Try it button', () => {
  it('is offered for plain Python', () => {
    expect(pythonRunsInBrowser('import math\nprint(math.pi)')).toBe(true);
    expect(pythonRunsInBrowser('from collections import Counter')).toBe(true);
    expect(pythonRunsInBrowser('flask = 1  # a variable, not an import')).toBe(true);
  });

  it('is hidden for code that needs a server-side package', () => {
    expect(pythonRunsInBrowser('from flask import Flask')).toBe(false);
    expect(pythonRunsInBrowser('import asyncio\nfrom mcp import Client')).toBe(false);
    expect(pythonRunsInBrowser('    from fastapi import FastAPI')).toBe(false);
    expect(pythonRunsInBrowser('from flask_sqlalchemy import SQLAlchemy')).toBe(false);
    expect(pythonRunsInBrowser('import django')).toBe(false);
  });
});

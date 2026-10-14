export function countNonEmptyLines(source) {
  return source
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .length;
}

function countMatches(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

export function analyzeModuleStructure(source) {
  return {
    nonEmptyLines: countNonEmptyLines(source),
    functionDeclarations: countMatches(source, /\b(?:async\s+)?function\s+\w+\s*\(/gu),
    topLevelFunctionDeclarations: countMatches(
      source,
      /^(?:export\s+)?(?:async\s+)?function\s+\w+\s*\(/gmu,
    ),
    classDeclarations: countMatches(source, /\bclass\s+\w+/gu),
    controlFlowTokens: countMatches(source, /\b(?:if|for|while|switch|catch)\b/gu),
    localHelperImports: countMatches(source, /from\s+['"]\.\//gu),
  };
}

export function enforceSoftModuleBudget({
  file,
  source,
  softLines,
  maxFunctionDeclarations = Number.POSITIVE_INFINITY,
  maxTopLevelFunctionDeclarations = Number.POSITIVE_INFINITY,
  maxClassDeclarations = Number.POSITIVE_INFINITY,
  maxControlFlowTokens = Number.POSITIVE_INFINITY,
  minLocalHelperImportsWhenOverSoft = 0,
  fail,
  label,
} = {}) {
  const analysis = analyzeModuleStructure(source);
  if (analysis.nonEmptyLines <= softLines) return;

  const violations = [];
  if (analysis.functionDeclarations > maxFunctionDeclarations) {
    violations.push(`function declarations ${analysis.functionDeclarations}/${maxFunctionDeclarations}`);
  }
  if (analysis.topLevelFunctionDeclarations > maxTopLevelFunctionDeclarations) {
    violations.push(`top-level functions ${analysis.topLevelFunctionDeclarations}/${maxTopLevelFunctionDeclarations}`);
  }
  if (analysis.classDeclarations > maxClassDeclarations) {
    violations.push(`classes ${analysis.classDeclarations}/${maxClassDeclarations}`);
  }
  if (analysis.controlFlowTokens > maxControlFlowTokens) {
    violations.push(`control-flow tokens ${analysis.controlFlowTokens}/${maxControlFlowTokens}`);
  }
  if (analysis.localHelperImports < minLocalHelperImportsWhenOverSoft) {
    violations.push(`local helper imports ${analysis.localHelperImports}/${minLocalHelperImportsWhenOverSoft}`);
  }

  if (violations.length > 0) {
    fail(`${file} exceeds its soft size budget (${analysis.nonEmptyLines}/${softLines} non-empty lines) and shows ownership risk: ${violations.join(', ')}.`);
  }

  console.warn(
    `[${label}] WARN: ${file} is over its soft size budget (${analysis.nonEmptyLines}/${softLines}) `
    + 'but structural ownership signals remain within guardrails.',
  );
}

import type { Pool, PoolClient, QueryResultRow } from 'pg';
import { getDbPool } from '@/lib/db';

export interface DbError {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}

export interface DbResponse<T = any> {
  data: T;
  error: DbError | null;
  count?: number | null;
}

export interface DbClientContext {
  userId?: string | null;
  role?: 'authenticated' | 'service_role' | 'anon';
}

interface ForeignKeyMeta {
  constraintName: string;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
}

interface ColumnTypeMeta {
  udtName: string;
}

interface ProcParamMeta {
  argNames: string[];
  argTypes: string[];
  returnsSet: boolean;
  returnType: string;
}

interface SchemaCache {
  fks: ForeignKeyMeta[];
  columns: Map<string, Map<string, ColumnTypeMeta>>;
  procs: Map<string, ProcParamMeta>;
  loadedAt: number;
}

const IDENT_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const JSON_PATH_RE = /^([a-zA-Z_][a-zA-Z0-9_]*)((?:->>|->)[a-zA-Z0-9_.\-']+)+$/;

let schemaCache: SchemaCache | null = null;
const SCHEMA_CACHE_TTL_MS = 5 * 60_000;

export function clearPgQuerySchemaCache(): void {
  schemaCache = null;
}

function assertIdent(name: string, label = 'identifier'): string {
  const clean = name.trim();
  if (!IDENT_RE.test(clean)) {
    throw new Error(`Invalid SQL ${label}: "${clean}"`);
  }
  return `"${clean}"`;
}

function singularize(name: string): string {
  if (name.endsWith('ies')) return `${name.slice(0, -3)}y`;
  if (name.endsWith('s') && !name.endsWith('ss')) return name.slice(0, -1);
  return name;
}

function splitTopLevelCommas(input: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"' && input[i - 1] !== '\\') {
      inQuotes = !inQuotes;
      current += ch;
      continue;
    }
    if (!inQuotes) {
      if (ch === '(') depth++;
      else if (ch === ')' && depth > 0) depth--;
      else if (ch === ',' && depth === 0) {
        if (current.trim()) parts.push(current.trim());
        current = '';
        continue;
      }
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function compileColumnExpr(
  rawCol: string,
  baseAlias: string,
  joinAliases: Map<string, string>,
): string {
  const col = rawCol.trim();

  // Relation dot notation e.g. conversations.workspace_id -> _rel_0."workspace_id"
  if (col.includes('.') && !col.includes('->')) {
    const [prefix, field, ...rest] = col.split('.');
    if (rest.length === 0 && IDENT_RE.test(prefix) && IDENT_RE.test(field)) {
      const alias = joinAliases.get(prefix);
      if (alias) {
        return `${alias}.${assertIdent(field, 'column')}`;
      }
    }
  }

  // JSON arrow expression e.g. metadata->>answered_message_id or metadata->a->>b
  if (col.includes('->')) {
    const match = col.match(JSON_PATH_RE);
    if (!match) {
      // Fallback parser for validated root column and simple key path segments
      const parts = col.split(/(->| ->>|->>)/).filter(Boolean);
      if (parts.length >= 3 && IDENT_RE.test(parts[0].trim())) {
        let sql = `${baseAlias}.${assertIdent(parts[0].trim(), 'json column')}`;
        for (let i = 1; i + 1 < parts.length; i += 2) {
          const op = parts[i];
          const key = parts[i + 1].trim().replace(/^'+|'+$/g, '');
          if (!/^[a-zA-Z0-9_.\-]+$/.test(key)) {
            throw new Error(`Invalid JSON path key: "${key}"`);
          }
          sql += `${op}'${key}'`;
        }
        return sql;
      }
      throw new Error(`Invalid JSON path expression: "${col}"`);
    }
    const rootEnd = col.search(/->|->>/);
    const root = col.slice(0, rootEnd).trim();
    const rest = col.slice(rootEnd);
    let sql = `${baseAlias}.${assertIdent(root, 'json column')}`;
    const segRe = /(->>|->)([a-zA-Z0-9_.\-']+)/g;
    let m: RegExpExecArray | null;
    while ((m = segRe.exec(rest)) !== null) {
      const key = m[2].replace(/^'+|'+$/g, '');
      sql += `${m[1]}'${key}'`;
    }
    return sql;
  }

  return `${baseAlias}.${assertIdent(col, 'column')}`;
}

interface ParsedEmbed {
  alias: string;
  targetTable: string;
  fkHint: string | null;
  isInner: boolean;
  columnsSpec: string;
}

interface ParsedSelect {
  selectAllBase: boolean;
  baseColumns: Array<{ alias?: string; rawExpr: string }>;
  embeds: ParsedEmbed[];
}

function parseSelectSpec(spec?: string): ParsedSelect {
  const clean = (spec || '*').trim() || '*';
  const items = splitTopLevelCommas(clean);
  const result: ParsedSelect = {
    selectAllBase: false,
    baseColumns: [],
    embeds: [],
  };

  for (const item of items) {
    // Embed syntax: [alias:]table[!mod1][!mod2](innerCols)
    const embedMatch = item.match(
      /^(?:([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*)?([a-zA-Z_][a-zA-Z0-9_]*)((?:![a-zA-Z0-9_]+)*)\s*\(([\s\S]*)\)$/,
    );
    if (embedMatch) {
      const alias = embedMatch[1] || embedMatch[2];
      const targetTable = embedMatch[2];
      const modRaw = embedMatch[3] || '';
      const mods = modRaw.split('!').filter(Boolean);
      const isInner = mods.includes('inner');
      const fkHint = mods.find((m) => m !== 'inner') || null;
      result.embeds.push({
        alias,
        targetTable,
        fkHint,
        isInner,
        columnsSpec: embedMatch[4].trim() || '*',
      });
      continue;
    }

    if (item === '*') {
      result.selectAllBase = true;
      continue;
    }

    // Alias syntax without embed: e.g. sub_agent:metadata->>sub_agent
    const colonIdx = item.indexOf(':');
    if (colonIdx !== -1 && !item.includes('(')) {
      const alias = item.slice(0, colonIdx).trim();
      const rawExpr = item.slice(colonIdx + 1).trim();
      result.baseColumns.push({ alias, rawExpr });
      continue;
    }

    result.baseColumns.push({ rawExpr: item });
  }

  return result;
}

async function ensureSchemaCache(pool: Pool): Promise<SchemaCache> {
  if (schemaCache && Date.now() - schemaCache.loadedAt < SCHEMA_CACHE_TTL_MS) {
    return schemaCache;
  }

  const fks: ForeignKeyMeta[] = [];
  const columns = new Map<string, Map<string, ColumnTypeMeta>>();
  const procs = new Map<string, ProcParamMeta>();

  try {
    const fkRes = await pool.query<{
      constraint_name: string;
      source_table: string;
      source_column: string;
      target_table: string;
      target_column: string;
    }>(`
      SELECT
        c.conname AS constraint_name,
        src.relname AS source_table,
        a_src.attname AS source_column,
        tgt.relname AS target_table,
        a_tgt.attname AS target_column
      FROM pg_constraint c
      JOIN pg_class src ON src.oid = c.conrelid
      JOIN pg_namespace nsrc ON nsrc.oid = src.relnamespace AND nsrc.nspname = 'public'
      JOIN pg_class tgt ON tgt.oid = c.confrelid
      JOIN pg_namespace ntgt ON ntgt.oid = tgt.relnamespace AND ntgt.nspname = 'public'
      JOIN pg_attribute a_src ON a_src.attrelid = src.oid AND a_src.attnum = c.conkey[1]
      JOIN pg_attribute a_tgt ON a_tgt.attrelid = tgt.oid AND a_tgt.attnum = c.confkey[1]
      WHERE c.contype = 'f' AND array_length(c.conkey, 1) = 1
    `);
    for (const r of fkRes.rows || []) {
      fks.push({
        constraintName: r.constraint_name,
        sourceTable: r.source_table,
        sourceColumn: r.source_column,
        targetTable: r.target_table,
        targetColumn: r.target_column,
      });
    }
  } catch {
    // Graceful fallback when running against mock pools in unit tests
  }

  try {
    const colRes = await pool.query<{
      table_name: string;
      column_name: string;
      udt_name: string;
    }>(`
      SELECT table_name, column_name, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
    `);
    for (const r of colRes.rows || []) {
      let map = columns.get(r.table_name);
      if (!map) {
        map = new Map();
        columns.set(r.table_name, map);
      }
      map.set(r.column_name, { udtName: r.udt_name });
    }
  } catch {
    // Graceful fallback in tests
  }

  try {
    const procRes = await pool.query<{
      proname: string;
      arg_names: string[] | null;
      arg_types: string[] | null;
      proretset: boolean;
      ret_type: string;
    }>(`
      SELECT
        p.proname,
        p.proargnames AS arg_names,
        ARRAY(
          SELECT format_type(t, NULL)
          FROM unnest(p.proargtypes) WITH ORDINALITY AS u(t, ord)
          ORDER BY ord
        ) AS arg_types,
        p.proretset,
        format_type(p.prorettype, NULL) AS ret_type
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p')
    `);
    for (const r of procRes.rows || []) {
      procs.set(r.proname, {
        argNames: r.arg_names || [],
        argTypes: r.arg_types || [],
        returnsSet: Boolean(r.proretset),
        returnType: r.ret_type || 'jsonb',
      });
    }
  } catch {
    // Graceful fallback in tests
  }

  schemaCache = { fks, columns, procs, loadedAt: Date.now() };
  return schemaCache;
}

function resolveJoinMeta(
  cache: SchemaCache,
  baseTable: string,
  embed: ParsedEmbed,
): { sourceCol: string; targetCol: string; cardinality: 'many_to_one' | 'one_to_many' } {
  const effectiveBase = baseTable === 'public_workspaces' ? 'workspaces' : baseTable;
  const effectiveTarget = embed.targetTable === 'public_workspaces' ? 'workspaces' : embed.targetTable;

  if (embed.fkHint) {
    const exactHint = cache.fks.find(
      (fk) =>
        fk.constraintName === embed.fkHint &&
        ((fk.sourceTable === effectiveBase && fk.targetTable === effectiveTarget) ||
          (fk.sourceTable === effectiveTarget && fk.targetTable === effectiveBase)),
    );
    if (exactHint) {
      if (exactHint.sourceTable === effectiveBase) {
        return {
          sourceCol: exactHint.sourceColumn,
          targetCol: exactHint.targetColumn,
          cardinality: 'many_to_one',
        };
      }
      return {
        sourceCol: exactHint.targetColumn,
        targetCol: exactHint.sourceColumn,
        cardinality: 'one_to_many',
      };
    }

    // Hint might reference conventional constraint name even before schema cache loads
    if (embed.fkHint === 'conversations_agent_id_fkey') {
      return { sourceCol: 'assigned_agent_id', targetCol: 'id', cardinality: 'many_to_one' };
    }
  }

  const m2o = cache.fks.filter(
    (fk) => fk.sourceTable === effectiveBase && fk.targetTable === effectiveTarget,
  );
  if (m2o.length > 0) {
    // Prefer column matching alias_id if multiple FKs exist (e.g. author_id vs assigned_agent_id)
    const aliasPref = m2o.find((fk) => fk.sourceColumn === `${embed.alias}_id`);
    const chosen = aliasPref || m2o[0];
    return {
      sourceCol: chosen.sourceColumn,
      targetCol: chosen.targetColumn,
      cardinality: 'many_to_one',
    };
  }

  const o2m = cache.fks.filter(
    (fk) => fk.sourceTable === effectiveTarget && fk.targetTable === effectiveBase,
  );
  if (o2m.length > 0) {
    return {
      sourceCol: o2m[0].targetColumn,
      targetCol: o2m[0].sourceColumn,
      cardinality: 'one_to_many',
    };
  }

  // Deterministic naming fallback (e.g. articles.author_id -> agents.id)
  const tableCols = cache.columns.get(effectiveBase);
  const candidates = [
    `${embed.alias}_id`,
    `${singularize(embed.targetTable)}_id`,
    embed.alias === 'agent' ? 'assigned_agent_id' : '',
  ].filter(Boolean);

  for (const cand of candidates) {
    if (!tableCols || tableCols.has(cand)) {
      return { sourceCol: cand, targetCol: 'id', cardinality: 'many_to_one' };
    }
  }

  return {
    sourceCol: `${singularize(embed.targetTable)}_id`,
    targetCol: 'id',
    cardinality: 'many_to_one',
  };
}

function normalizeColumnWriteValue(
  tableCols: Map<string, ColumnTypeMeta> | undefined,
  col: string,
  val: unknown,
): unknown {
  if (val === undefined) return null;
  if (val === null) return null;
  const meta = tableCols?.get(col);
  if (meta && (meta.udtName === 'jsonb' || meta.udtName === 'json')) {
    if (typeof val === 'object') {
      return JSON.stringify(val);
    }
    return val;
  }
  return val;
}

type FilterFn = (
  params: unknown[],
  baseAlias: string,
  joinAliases: Map<string, string>,
) => string;

function parseOrValue(raw: string): unknown {
  const trimmed = raw.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === 'null') return null;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  return trimmed;
}

function parseOrList(raw: string): unknown[] {
  let inner = raw.trim();
  if (inner.startsWith('(') && inner.endsWith(')')) {
    inner = inner.slice(1, -1);
  }
  if (!inner.trim()) return [];
  return splitTopLevelCommas(inner).map(parseOrValue);
}

function compileFilterCondition(
  col: string,
  operator: string,
  value: unknown,
  negate: boolean,
  params: unknown[],
  baseAlias: string,
  joinAliases: Map<string, string>,
): string {
  const colSql = compileColumnExpr(col, baseAlias, joinAliases);
  const op = operator.trim().toLowerCase();
  let clause = '';

  switch (op) {
    case 'eq':
      params.push(value);
      clause = `${colSql} = $${params.length}`;
      break;
    case 'neq':
      params.push(value);
      clause = `${colSql} <> $${params.length}`;
      break;
    case 'gt':
      params.push(value);
      clause = `${colSql} > $${params.length}`;
      break;
    case 'gte':
      params.push(value);
      clause = `${colSql} >= $${params.length}`;
      break;
    case 'lt':
      params.push(value);
      clause = `${colSql} < $${params.length}`;
      break;
    case 'lte':
      params.push(value);
      clause = `${colSql} <= $${params.length}`;
      break;
    case 'like':
      params.push(value);
      clause = `${colSql} LIKE $${params.length}`;
      break;
    case 'ilike':
      params.push(value);
      clause = `${colSql} ILIKE $${params.length}`;
      break;
    case 'is':
      if (value === null || value === 'null') {
        clause = `${colSql} IS NULL`;
      } else if (value === true || value === 'true') {
        clause = `${colSql} IS TRUE`;
      } else if (value === false || value === 'false') {
        clause = `${colSql} IS FALSE`;
      } else {
        throw new Error(`Unsupported IS value: ${String(value)}`);
      }
      break;
    case 'in': {
      const list = Array.isArray(value) ? value : parseOrList(String(value ?? ''));
      if (list.length === 0) {
        clause = '1 = 0';
      } else {
        const placeholders = list.map((item) => {
          params.push(item);
          return `$${params.length}`;
        });
        clause = `${colSql} IN (${placeholders.join(', ')})`;
      }
      break;
    }
    case 'cs':
    case 'contains':
      params.push(Array.isArray(value) ? JSON.stringify(value) : value);
      clause = `${colSql} @> $${params.length}::jsonb`;
      break;
    case 'ov':
    case 'overlaps':
      params.push(Array.isArray(value) ? value : [value]);
      clause = `${colSql} && $${params.length}`;
      break;
    default:
      throw new Error(`Unsupported filter operator: "${operator}"`);
  }

  return negate ? `NOT (${clause})` : clause;
}

function compileOrExpr(
  expr: string,
  params: unknown[],
  baseAlias: string,
  joinAliases: Map<string, string>,
): string {
  const tokens = splitTopLevelCommas(expr.trim());
  const clauses: string[] = [];

  for (const token of tokens) {
    // Nested and(...) / or(...) inside .or(...)
    const groupMatch = token.match(/^(and|or)\(([\s\S]+)\)$/i);
    if (groupMatch) {
      const combinator = groupMatch[1].toUpperCase() === 'AND' ? ' AND ' : ' OR ';
      const innerTokens = splitTopLevelCommas(groupMatch[2]);
      const innerSql = innerTokens
        .map((t) => compileOrExpr(t, params, baseAlias, joinAliases))
        .join(combinator);
      clauses.push(`(${innerSql})`);
      continue;
    }

    // Format: column[.not].op.value (column may include ->/->> or dot relation prefix)
    const parts = token.split('.');
    if (parts.length < 3) {
      throw new Error(`Invalid OR filter token: "${token}"`);
    }

    let opIdx = -1;
    let negate = false;
    const knownOps = new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in', 'cs']);
    for (let i = 1; i < parts.length; i++) {
      if (parts[i] === 'not' && i + 1 < parts.length && knownOps.has(parts[i + 1])) {
        negate = true;
        opIdx = i + 1;
        break;
      }
      if (knownOps.has(parts[i])) {
        opIdx = i;
        break;
      }
    }
    if (opIdx === -1) {
      throw new Error(`Could not locate operator in OR token: "${token}"`);
    }

    const col = parts.slice(0, negate ? opIdx - 1 : opIdx).join('.');
    const op = parts[opIdx];
    const rawVal = parts.slice(opIdx + 1).join('.');
    const parsedVal = op === 'in' ? parseOrList(rawVal) : parseOrValue(rawVal);

    clauses.push(compileFilterCondition(col, op, parsedVal, negate, params, baseAlias, joinAliases));
  }

  if (clauses.length === 0) return 'TRUE';
  return clauses.length === 1 ? clauses[0] : `(${clauses.join(' OR ')})`;
}

function mapPgErrorToDbError(err: any): DbError {
  return {
    message: String(err?.message || 'Database query failed'),
    code: err?.code ? String(err.code) : undefined,
    details: err?.detail ? String(err.detail) : null,
    hint: err?.hint ? String(err.hint) : null,
  };
}

async function runWithContext<T>(
  pool: Pool,
  ctx: DbClientContext | undefined,
  fn: (runner: Pool | PoolClient) => Promise<T>,
): Promise<T> {
  if (!ctx?.userId && !ctx?.role) {
    return fn(pool);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (ctx.userId) {
      await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [ctx.userId]);
    }
    if (ctx.role) {
      await client.query(`SELECT set_config('request.jwt.claim.role', $1, true)`, [ctx.role]);
    }
    const res = await fn(client);
    await client.query('COMMIT');
    return res;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export class PgQueryBuilder<T = any[]> implements PromiseLike<DbResponse<T>> {
  private op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private selectSpec = '*';
  private returnSelect = false;
  private countMode: 'exact' | 'planned' | 'estimated' | null = null;
  private headOnly = false;
  private payload: any = null;
  private upsertOnConflict?: string;
  private ignoreDuplicates = false;
  private filters: FilterFn[] = [];
  private orders: Array<{ column: string; ascending: boolean; nullsFirst?: boolean }> = [];
  private limitVal: number | null = null;
  private offsetVal: number | null = null;
  private rowMode: 'many' | 'single' | 'maybeSingle' = 'many';

  constructor(
    private readonly pool: Pool,
    private readonly table: string,
    private readonly ctx?: DbClientContext,
  ) {
    assertIdent(table, 'table');
  }

  select(columns = '*', opts?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }): this {
    if (this.op === 'insert' || this.op === 'update' || this.op === 'upsert' || this.op === 'delete') {
      this.returnSelect = true;
      this.selectSpec = columns || '*';
    } else {
      this.op = 'select';
      this.selectSpec = columns || '*';
    }
    if (opts?.count) this.countMode = opts.count;
    if (opts?.head) this.headOnly = true;
    return this;
  }

  insert(values: object | Array<object>, opts?: { count?: 'exact' }): this {
    this.op = 'insert';
    this.payload = values;
    if (opts?.count) this.countMode = opts.count;
    return this;
  }

  upsert(
    values: object | Array<object>,
    opts?: { onConflict?: string; ignoreDuplicates?: boolean; count?: 'exact' },
  ): this {
    this.op = 'upsert';
    this.payload = values;
    this.upsertOnConflict = opts?.onConflict;
    this.ignoreDuplicates = Boolean(opts?.ignoreDuplicates);
    if (opts?.count) this.countMode = opts.count;
    return this;
  }

  update(values: object, opts?: { count?: 'exact' }): this {
    this.op = 'update';
    this.payload = values;
    if (opts?.count) this.countMode = opts.count;
    return this;
  }

  delete(opts?: { count?: 'exact' }): this {
    this.op = 'delete';
    if (opts?.count) this.countMode = opts.count;
    return this;
  }

  eq(col: string, val: unknown): this {
    this.filters.push((p, b, j) => compileFilterCondition(col, 'eq', val, false, p, b, j));
    return this;
  }

  neq(col: string, val: unknown): this {
    this.filters.push((p, b, j) => compileFilterCondition(col, 'neq', val, false, p, b, j));
    return this;
  }

  gt(col: string, val: unknown): this {
    this.filters.push((p, b, j) => compileFilterCondition(col, 'gt', val, false, p, b, j));
    return this;
  }

  gte(col: string, val: unknown): this {
    this.filters.push((p, b, j) => compileFilterCondition(col, 'gte', val, false, p, b, j));
    return this;
  }

  lt(col: string, val: unknown): this {
    this.filters.push((p, b, j) => compileFilterCondition(col, 'lt', val, false, p, b, j));
    return this;
  }

  lte(col: string, val: unknown): this {
    this.filters.push((p, b, j) => compileFilterCondition(col, 'lte', val, false, p, b, j));
    return this;
  }

  like(col: string, val: string): this {
    this.filters.push((p, b, j) => compileFilterCondition(col, 'like', val, false, p, b, j));
    return this;
  }

  ilike(col: string, val: string): this {
    this.filters.push((p, b, j) => compileFilterCondition(col, 'ilike', val, false, p, b, j));
    return this;
  }

  is(col: string, val: null | boolean): this {
    this.filters.push((p, b, j) => compileFilterCondition(col, 'is', val, false, p, b, j));
    return this;
  }

  in(col: string, vals: unknown[]): this {
    this.filters.push((p, b, j) => compileFilterCondition(col, 'in', vals, false, p, b, j));
    return this;
  }

  contains(col: string, val: unknown): this {
    this.filters.push((p, b, j) => compileFilterCondition(col, 'cs', val, false, p, b, j));
    return this;
  }

  overlaps(col: string, vals: unknown[]): this {
    this.filters.push((p, b, j) => compileFilterCondition(col, 'ov', vals, false, p, b, j));
    return this;
  }

  not(col: string, operator: string, val: unknown): this {
    this.filters.push((p, b, j) => compileFilterCondition(col, operator, val, true, p, b, j));
    return this;
  }

  filter(col: string, operator: string, val: unknown): this {
    const cleanOp = operator.startsWith('not.') ? operator.slice(4) : operator;
    const negate = operator.startsWith('not.');
    this.filters.push((p, b, j) => compileFilterCondition(col, cleanOp, val, negate, p, b, j));
    return this;
  }

  match(query: Record<string, unknown>): this {
    for (const [k, v] of Object.entries(query)) {
      if (v === null) this.is(k, null);
      else this.eq(k, v);
    }
    return this;
  }

  or(expr: string): this {
    this.filters.push((p, b, j) => compileOrExpr(expr, p, b, j));
    return this;
  }

  order(column: string, opts?: { ascending?: boolean; nullsFirst?: boolean }): this {
    this.orders.push({
      column,
      ascending: opts?.ascending !== false,
      nullsFirst: opts?.nullsFirst,
    });
    return this;
  }

  limit(n: number): this {
    this.limitVal = Math.max(0, Math.trunc(n));
    return this;
  }

  range(from: number, to: number): this {
    const start = Math.max(0, Math.trunc(from));
    const end = Math.max(start, Math.trunc(to));
    this.offsetVal = start;
    this.limitVal = end - start + 1;
    return this;
  }

  single<R = any>(): PgQueryBuilder<R> {
    this.rowMode = 'single';
    return this as unknown as PgQueryBuilder<R>;
  }

  maybeSingle<R = any>(): PgQueryBuilder<R> {
    this.rowMode = 'maybeSingle';
    return this as unknown as PgQueryBuilder<R>;
  }

  then<TResult1 = DbResponse<T>, TResult2 = never>(
    onfulfilled?: ((value: DbResponse<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private compileNestedObjectExpr(
    cache: SchemaCache,
    tableName: string,
    rowAlias: string,
    columnsSpec: string,
    depth = 0,
  ): string {
    const parsedInner = parseSelectSpec(columnsSpec);
    if (
      parsedInner.selectAllBase &&
      parsedInner.baseColumns.length === 0 &&
      parsedInner.embeds.length === 0
    ) {
      return `to_jsonb(${rowAlias})`;
    }

    const emptyMap = new Map<string, string>();
    const pairs: string[] = [];

    for (const col of parsedInner.baseColumns) {
      const key = (col.alias || col.rawExpr).replace(/'/g, "''");
      const exprSql = compileColumnExpr(col.rawExpr, rowAlias, emptyMap);
      pairs.push(`'${key}', ${exprSql}`);
    }

    parsedInner.embeds.forEach((subEmbed, subIdx) => {
      const subFk = resolveJoinMeta(cache, tableName, subEmbed);
      const subAlias = `_n${depth}_${subIdx}`;
      const subTargetIdent = assertIdent(subEmbed.targetTable, 'relation table');
      const subInnerExpr = this.compileNestedObjectExpr(
        cache,
        subEmbed.targetTable,
        subAlias,
        subEmbed.columnsSpec,
        depth + 1,
      );
      const key = subEmbed.alias.replace(/'/g, "''");

      if (subFk.cardinality === 'many_to_one') {
        pairs.push(
          `'${key}', (SELECT ${subInnerExpr} FROM public.${subTargetIdent} AS ${subAlias} WHERE ${subAlias}.${assertIdent(
            subFk.targetCol,
            'fk target',
          )} = ${rowAlias}.${assertIdent(subFk.sourceCol, 'fk source')} LIMIT 1)`,
        );
      } else {
        pairs.push(
          `'${key}', COALESCE((SELECT jsonb_agg(${subInnerExpr}) FROM public.${subTargetIdent} AS ${subAlias} WHERE ${subAlias}.${assertIdent(
            subFk.targetCol,
            'fk child',
          )} = ${rowAlias}.${assertIdent(subFk.sourceCol, 'fk parent')}), '[]'::jsonb)`,
        );
      }
    });

    const builtObj = `jsonb_build_object(${pairs.join(', ')})`;
    return parsedInner.selectAllBase ? `(to_jsonb(${rowAlias}) || ${builtObj})` : builtObj;
  }

  private buildSelectClause(
    cache: SchemaCache,
    parsed: ParsedSelect,
    baseAlias: string,
  ): { selectSql: string; joinsSql: string; joinAliases: Map<string, string> } {
    const projections: string[] = [];
    const joins: string[] = [];
    const joinAliases = new Map<string, string>();

    if (parsed.selectAllBase) {
      projections.push(`${baseAlias}.*`);
    }

    for (const item of parsed.baseColumns) {
      const exprSql = compileColumnExpr(item.rawExpr, baseAlias, joinAliases);
      if (item.alias) {
        projections.push(`${exprSql} AS ${assertIdent(item.alias, 'alias')}`);
      } else {
        projections.push(exprSql);
      }
    }

    parsed.embeds.forEach((embed, idx) => {
      const relAlias = `_rel_${idx}`;
      const targetIdent = assertIdent(embed.targetTable, 'relation table');
      const fk = resolveJoinMeta(cache, this.table, embed);

      if (fk.cardinality === 'many_to_one') {
        joinAliases.set(embed.alias, relAlias);
        joinAliases.set(embed.targetTable, relAlias);

        const joinType = embed.isInner ? 'INNER JOIN' : 'LEFT JOIN';
        joins.push(
          `${joinType} public.${targetIdent} AS ${relAlias} ON ${baseAlias}.${assertIdent(
            fk.sourceCol,
            'fk source',
          )} = ${relAlias}.${assertIdent(fk.targetCol, 'fk target')}`,
        );

        const aliasIdent = assertIdent(embed.alias, 'embed alias');
        const objExpr = this.compileNestedObjectExpr(cache, embed.targetTable, relAlias, embed.columnsSpec);
        projections.push(
          `CASE WHEN ${relAlias}.${assertIdent(
            fk.targetCol,
            'fk pk',
          )} IS NULL THEN NULL ELSE ${objExpr} END AS ${aliasIdent}`,
        );
      } else {
        const subAlias = `_sub_${idx}`;
        const aliasIdent = assertIdent(embed.alias, 'embed alias');
        const subObj = this.compileNestedObjectExpr(cache, embed.targetTable, subAlias, embed.columnsSpec);

        projections.push(
          `COALESCE((SELECT jsonb_agg(${subObj}) FROM public.${targetIdent} AS ${subAlias} WHERE ${subAlias}.${assertIdent(
            fk.targetCol,
            'fk child',
          )} = ${baseAlias}.${assertIdent(fk.sourceCol, 'fk parent')}), '[]'::jsonb) AS ${aliasIdent}`,
        );
      }
    });

    if (projections.length === 0) {
      projections.push(`${baseAlias}.*`);
    }

    return {
      selectSql: projections.join(', '),
      joinsSql: joins.length > 0 ? ` ${joins.join(' ')}` : '',
      joinAliases,
    };
  }

  private async execute(): Promise<DbResponse<T>> {
    try {
      const cache = await ensureSchemaCache(this.pool);
      const tableIdent = assertIdent(this.table, 'table');
      const tableCols = cache.columns.get(this.table === 'public_workspaces' ? 'workspaces' : this.table);

      return await runWithContext(this.pool, this.ctx, async (runner) => {
        if (this.op === 'select') {
          const parsed = parseSelectSpec(this.selectSpec);
          const baseAlias = '_b';
          const { selectSql, joinsSql, joinAliases } = this.buildSelectClause(cache, parsed, baseAlias);

          const params: unknown[] = [];
          const whereClauses = this.filters.map((fn) => fn(params, baseAlias, joinAliases));
          const whereSql = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : '';

          let exactCount: number | null = null;
          if (this.countMode) {
            const countSql = `SELECT COUNT(*)::int AS total FROM public.${tableIdent} AS ${baseAlias}${joinsSql}${whereSql}`;
            const countRes = await runner.query<{ total: number }>(countSql, params);
            exactCount = countRes.rows[0]?.total ?? 0;
          }

          if (this.headOnly) {
            return { data: null as unknown as T, error: null, count: exactCount };
          }

          let sql = `SELECT ${selectSql} FROM public.${tableIdent} AS ${baseAlias}${joinsSql}${whereSql}`;
          if (this.orders.length > 0) {
            const orderParts = this.orders.map((o) => {
              const expr = compileColumnExpr(o.column, baseAlias, joinAliases);
              const dir = o.ascending ? 'ASC' : 'DESC';
              const nulls =
                o.nullsFirst === undefined ? '' : o.nullsFirst ? ' NULLS FIRST' : ' NULLS LAST';
              return `${expr} ${dir}${nulls}`;
            });
            sql += ` ORDER BY ${orderParts.join(', ')}`;
          }
          if (this.limitVal !== null) {
            params.push(this.limitVal);
            sql += ` LIMIT $${params.length}`;
          }
          if (this.offsetVal !== null) {
            params.push(this.offsetVal);
            sql += ` OFFSET $${params.length}`;
          }

          const res = await runner.query<QueryResultRow>(sql, params);
          return this.shapeRowsResponse(res.rows, exactCount);
        }

        if (this.op === 'insert' || this.op === 'upsert') {
          const rowsInput: Array<Record<string, unknown>> = Array.isArray(this.payload)
            ? this.payload
            : [this.payload];
          if (rowsInput.length === 0) {
            return this.shapeRowsResponse([], 0);
          }

          const colSet = new Set<string>();
          for (const row of rowsInput) {
            for (const [k, v] of Object.entries(row)) {
              if (v !== undefined) colSet.add(k);
            }
          }
          const cols = Array.from(colSet);
          if (cols.length === 0) {
            throw new Error(`No columns provided for ${this.op} on public.${this.table}`);
          }

          const colIdents = cols.map((c) => assertIdent(c, 'column'));
          const params: unknown[] = [];
          const valueTuples = rowsInput.map((row) => {
            const tuple = cols.map((c) => {
              if (row[c] === undefined) return 'DEFAULT';
              params.push(normalizeColumnWriteValue(tableCols, c, row[c]));
              return `$${params.length}`;
            });
            return `(${tuple.join(', ')})`;
          });

          let sql = `INSERT INTO public.${tableIdent} (${colIdents.join(', ')}) VALUES ${valueTuples.join(', ')}`;

          if (this.op === 'upsert') {
            const conflictCols = (this.upsertOnConflict || 'id')
              .split(',')
              .map((c) => c.trim())
              .filter(Boolean);
            const conflictIdents = conflictCols.map((c) => assertIdent(c, 'conflict column'));
            if (this.ignoreDuplicates) {
              sql += ` ON CONFLICT (${conflictIdents.join(', ')}) DO NOTHING`;
            } else {
              const updateCols = cols.filter((c) => !conflictCols.includes(c));
              if (updateCols.length === 0) {
                sql += ` ON CONFLICT (${conflictIdents.join(', ')}) DO NOTHING`;
              } else {
                const assignments = updateCols.map((c) => {
                  const id = assertIdent(c, 'update column');
                  return `${id} = EXCLUDED.${id}`;
                });
                sql += ` ON CONFLICT (${conflictIdents.join(', ')}) DO UPDATE SET ${assignments.join(', ')}`;
              }
            }
          }

          return await this.runMutation(runner, cache, sql, params);
        }

        if (this.op === 'update') {
          const entries = Object.entries(this.payload || {}).filter(([, v]) => v !== undefined);
          if (entries.length === 0) {
            return this.shapeRowsResponse([], 0);
          }

          const params: unknown[] = [];
          const setClauses = entries.map(([k, v]) => {
            const colIdent = assertIdent(k, 'column');
            params.push(normalizeColumnWriteValue(tableCols, k, v));
            return `${colIdent} = $${params.length}`;
          });

          const joinAliases = new Map<string, string>();
          const whereClauses = this.filters.map((fn) => fn(params, '_b', joinAliases));
          const whereSql = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : '';

          const sql = `UPDATE public.${tableIdent} AS _b SET ${setClauses.join(', ')}${whereSql}`;
          return await this.runMutation(runner, cache, sql, params);
        }

        if (this.op === 'delete') {
          const params: unknown[] = [];
          const joinAliases = new Map<string, string>();
          const whereClauses = this.filters.map((fn) => fn(params, '_b', joinAliases));
          const whereSql = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : '';
          const sql = `DELETE FROM public.${tableIdent} AS _b${whereSql}`;
          return await this.runMutation(runner, cache, sql, params);
        }

        throw new Error(`Unsupported query operation: ${this.op}`);
      });
    } catch (err: any) {
      return {
        data: (this.rowMode === 'many' && !this.headOnly ? null : null) as unknown as T,
        error: mapPgErrorToDbError(err),
        count: null,
      };
    }
  }

  private async runMutation(
    runner: Pool | PoolClient,
    cache: SchemaCache,
    mutationSql: string,
    params: unknown[],
  ): Promise<DbResponse<T>> {
    if (!this.returnSelect) {
      const res = await runner.query(mutationSql, params);
      const count = this.countMode ? (res.rowCount ?? 0) : null;
      return { data: null as unknown as T, error: null, count };
    }

    const parsed = parseSelectSpec(this.selectSpec);
    if (parsed.embeds.length === 0 && parsed.selectAllBase && parsed.baseColumns.length === 0) {
      const res = await runner.query<QueryResultRow>(`${mutationSql} RETURNING *`, params);
      return this.shapeRowsResponse(res.rows, this.countMode ? (res.rowCount ?? res.rows.length) : null);
    }

    const baseAlias = '_b';
    const { selectSql, joinsSql } = this.buildSelectClause(cache, parsed, baseAlias);
    const wrappedSql = `WITH ${baseAlias} AS (${mutationSql} RETURNING *) SELECT ${selectSql} FROM ${baseAlias}${joinsSql}`;
    const res = await runner.query<QueryResultRow>(wrappedSql, params);
    return this.shapeRowsResponse(res.rows, this.countMode ? res.rows.length : null);
  }

  private shapeRowsResponse(rows: QueryResultRow[], count: number | null): DbResponse<T> {
    if (this.rowMode === 'single') {
      if (rows.length === 0) {
        return {
          data: null as unknown as T,
          error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: 'The result contains 0 rows', hint: null },
          count,
        };
      }
      if (rows.length > 1) {
        return {
          data: null as unknown as T,
          error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${rows.length} rows`, hint: null },
          count,
        };
      }
      return { data: rows[0] as unknown as T, error: null, count };
    }

    if (this.rowMode === 'maybeSingle') {
      if (rows.length > 1) {
        return {
          data: null as unknown as T,
          error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${rows.length} rows`, hint: null },
          count,
        };
      }
      return { data: (rows[0] ?? null) as unknown as T, error: null, count };
    }

    return { data: rows as unknown as T, error: null, count };
  }
}

export class PgCompatClient {
  constructor(
    private readonly pool: Pool,
    private readonly ctx?: DbClientContext,
  ) {}

  from<T = any[]>(table: string): PgQueryBuilder<T> {
    return new PgQueryBuilder<T>(this.pool, table, this.ctx);
  }

  async rpc<T = any>(
    fnName: string,
    args?: Record<string, unknown>,
  ): Promise<DbResponse<T>> {
    try {
      const fnIdent = assertIdent(fnName, 'function');
      const cache = await ensureSchemaCache(this.pool);
      const proc = cache.procs.get(fnName);

      const entries = Object.entries(args || {}).filter(([, v]) => v !== undefined);
      const params: unknown[] = [];
      const argClauses = entries.map(([key, val]) => {
        assertIdent(key, 'rpc argument');
        let cast = '';
        let boundVal = val;

        if (proc) {
          const idx = proc.argNames.indexOf(key);
          if (idx !== -1 && proc.argTypes[idx]) {
            const pgType = proc.argTypes[idx];
            cast = `::${pgType}`;
            if ((pgType === 'jsonb' || pgType === 'json') && boundVal !== null && typeof boundVal === 'object') {
              boundVal = JSON.stringify(boundVal);
            }
          }
        } else if (boundVal !== null && typeof boundVal === 'object' && !Array.isArray(boundVal)) {
          boundVal = JSON.stringify(boundVal);
        }

        params.push(boundVal);
        return `${key} => $${params.length}${cast}`;
      });

      const callExpr = `public.${fnIdent}(${argClauses.join(', ')})`;

      return await runWithContext(this.pool, this.ctx, async (runner) => {
        if (proc?.returnsSet) {
          const res = await runner.query<{ row: any }>(
            `SELECT to_jsonb(r) AS row FROM ${callExpr} AS r`,
            params,
          );
          return { data: res.rows.map((r) => r.row) as unknown as T, error: null };
        }

        if (proc?.returnType === 'void') {
          await runner.query(`SELECT ${callExpr}`, params);
          return { data: null as unknown as T, error: null };
        }

        const res = await runner.query<{ result: any }>(
          `SELECT ${callExpr} AS result`,
          params,
        );
        const val = res.rows[0]?.result ?? null;
        return { data: val as T, error: null };
      });
    } catch (err: any) {
      return {
        data: null as unknown as T,
        error: mapPgErrorToDbError(err),
      };
    }
  }
}

export function createPgCompatClient(
  ctx?: DbClientContext,
  poolOverride?: Pool,
): PgCompatClient {
  return new PgCompatClient(poolOverride || getDbPool(), ctx);
}

/**
 * Sinh docs/api-contract.md từ mã nguồn backend.
 * Nguồn: routes.ts, controller.ts, schema.ts, service.ts của từng module trong backend/src/modules + backend/src/app.ts
 * Chạy từ thư mục gốc dự án: node scripts/gen-api-contract.js
 */
const fs = require('fs');
const path = require('path');

const MODULES_DIR = path.join('backend', 'src', 'modules');
const OUT_FILE = path.join('docs', 'api-contract.md');

const ROLE_LABEL = {
  ADMIN: 'Quản trị nền tảng',
  LANDLORD: 'Chủ nhà trọ',
  RENTER: 'Người thuê',
};

function read(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

/** Lấy nội dung trong ngoặc cân bằng bắt đầu từ vị trí mở ngoặc. */
function readBalanced(text, openIndex) {
  const pairs = { '(': ')', '[': ']', '{': '}' };
  const stack = [];
  for (let i = openIndex; i < text.length; i += 1) {
    const ch = text[i];
    if (pairs[ch]) {
      stack.push(pairs[ch]);
      continue;
    }
    if (ch === ')' || ch === ']' || ch === '}') {
      if (stack[stack.length - 1] === ch) {
        stack.pop();
        if (stack.length === 0) return text.slice(openIndex + 1, i);
      } else {
        return text.slice(openIndex + 1, i);
      }
    }
  }
  return '';
}

/** Tách các tham số cấp cao nhất theo dấu phẩy. */
function splitArgs(text) {
  const args = [];
  let depth = 0;
  let current = '';
  let quote = null;
  for (const ch of text) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      current += ch;
      continue;
    }
    if ('([{'.includes(ch)) depth += 1;
    if (')]}'.includes(ch)) depth -= 1;
    if (ch === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) args.push(current.trim());
  return args.filter((a) => a.length > 0);
}

/** Tách các thuộc tính cấp cao nhất của object literal. */
function splitObjectEntries(text) {
  const entries = [];
  let depth = 0;
  let current = '';
  let quote = null;
  for (const ch of text) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      current += ch;
      continue;
    }
    if ('([{'.includes(ch)) depth += 1;
    if (')]}'.includes(ch)) depth -= 1;
    if (ch === ',' && depth === 0) {
      entries.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) entries.push(current.trim());
  return entries.filter((e) => e.length > 0);
}

function matchAll(text, regex) {
  const out = [];
  let m = regex.exec(text);
  while (m) {
    out.push(m);
    m = regex.exec(text);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* routes.ts                                                          */
/* ------------------------------------------------------------------ */

function parseRoutes(routesSrc) {
  const roleVars = {};
  for (const m of matchAll(routesSrc, /const\s+(\w+)\s*=\s*requireRole\(([^)]*)\)/g)) {
    roleVars[m[1]] = m[2]
      .split(',')
      .map((r) => r.trim().replace(/^UserRole\./, ''))
      .filter(Boolean);
  }

  // Router-level: router.use(authenticateJwt, requireRole(...)) áp dụng cho mọi route của module.
  let moduleRoles = [];
  const useMatch = routesSrc.match(/router\.use\(([\s\S]*?)\);/);
  if (useMatch) {
    for (const arg of splitArgs(useMatch[1])) {
      const inline = arg.match(/requireRole\(([^)]*)\)/);
      if (inline) {
        moduleRoles.push(
          ...inline[1]
            .split(',')
            .map((r) => r.trim().replace(/^UserRole\./, ''))
            .filter(Boolean)
        );
      } else if (roleVars[arg]) {
        moduleRoles.push(...roleVars[arg]);
      }
    }
  }

  const routes = [];
  for (const m of matchAll(routesSrc, /router\.(get|post|put|patch|delete)\s*\(/g)) {
    const method = m[1].toUpperCase();
    const openIndex = routesSrc.indexOf('(', m.index);
    const args = splitArgs(readBalanced(routesSrc, openIndex));
    if (args.length === 0) continue;

    const rawPath = args[0].replace(/^['"`]|['"`]$/g, '');
    const controller = args[args.length - 1];
    const middle = args.slice(1, -1);

    const roles = [];
    let needsSubscription = false;
    for (const arg of middle) {
      const inline = arg.match(/requireRole\(([^)]*)\)/);
      if (inline) {
        roles.push(
          ...inline[1]
            .split(',')
            .map((r) => r.trim().replace(/^UserRole\./, ''))
            .filter(Boolean)
        );
        continue;
      }
      if (roleVars[arg]) {
        roles.push(...roleVars[arg]);
        continue;
      }
      if (arg.includes('requireActiveSubscription')) needsSubscription = true;
    }

    routes.push({
      method,
      path: rawPath,
      controller: controller.replace(/^.*\./, ''),
      roles: [...new Set(roles)],
      needsSubscription,
    });
  }
  return { routes, moduleRoles };
}

/* ------------------------------------------------------------------ */
/* controller.ts                                                      */
/* ------------------------------------------------------------------ */

function parseController(controllerSrc) {
  const controllers = {};
  for (const m of matchAll(
    controllerSrc,
    /export const (\w+)\s*=\s*asyncHandler\(async \([^)]*\)\s*=>\s*\{/g
  )) {
    const name = m[1];
    const body = readBalanced(controllerSrc, controllerSrc.indexOf('{', m.index));
    const status = body.match(/res\.status\((\d+)\)/);
    const serviceCall = body.match(/(\w+Service)\.(\w+)\(/);

    const bodySchema = body.match(/(\w+Schema)\.parse\(req\.body/);
    const querySchema = body.match(/(\w+Schema)\.parse\(req\.query/);
    const paramsSchema = body.match(/(\w+Schema)\.parse\(req\.params/);

    controllers[name] = {
      status: status ? Number(status[1]) : 200,
      serviceFn: serviceCall ? serviceCall[2] : null,
      bodySchema: bodySchema ? bodySchema[1] : null,
      querySchema: querySchema ? querySchema[1] : null,
      paramsSchema: paramsSchema ? paramsSchema[1] : null,
    };
  }
  return controllers;
}

/* ------------------------------------------------------------------ */
/* schema.ts                                                          */
/* ------------------------------------------------------------------ */

function parseSchemas(schemaSrc) {
  const schemas = {};
  for (const m of matchAll(schemaSrc, /export const (\w+)\s*=\s*z\.(object|enum)\(/g)) {
    const name = m[1];
    const openIndex = schemaSrc.indexOf('(', m.index + m[0].length - 1);
    let body = readBalanced(schemaSrc, openIndex);
    // Bỏ ngoặc ngoài của z.object({ ... }) để tách từng thuộc tính.
    if (body.trim().startsWith('{') && body.trim().endsWith('}')) {
      body = body.trim().slice(1, -1);
    }

    if (m[2] === 'enum') {
      const values = [...body.matchAll(/'([^']+)'/g)].map((v) => v[1]);
      schemas[name] = { kind: 'enum', values };
      continue;
    }

    const fields = [];
    for (const entry of splitObjectEntries(body)) {
      const field = entry.match(/^(\w+)\s*:\s*(.+)$/s);
      if (!field) continue;
      const [, fieldName, rawType] = field;
      let type = (rawType.match(/z\.(\w+)/) || [])[1] || 'custom';
      if (type === 'coerce') {
        type = (rawType.match(/z\.coerce\.(\w+)/) || [])[1] || 'custom';
      }
      const optional = rawType.includes('.optional()');
      const hasDefault = rawType.includes('.default(');
      const enumMatch = rawType.match(/z\.enum\(\[([^\]]*)\]/);
      const enumValues = enumMatch
        ? [...enumMatch[1].matchAll(/'([^']+)'/g)].map((v) => v[1])
        : null;
      const literals = [...rawType.matchAll(/'([^']{4,120})'/g)].map((d) => d[1]);
      const description =
        literals.find((text) => !enumValues || !enumValues.includes(text)) || null;
      fields.push({
        name: fieldName,
        type,
        optional,
        hasDefault,
        enumValues,
        description,
      });
    }
    schemas[name] = { kind: 'object', fields };
  }
  return schemas;
}

/* ------------------------------------------------------------------ */
/* service.ts (mã lỗi + kiểu phản hồi)                                */
/* ------------------------------------------------------------------ */

function parseService(serviceSrc) {
  const errors = new Map();
  const functions = {};

  for (const m of matchAll(serviceSrc, /export async function (\w+)\s*\(/g)) {
    const name = m[1];
    const body = readBalanced(serviceSrc, serviceSrc.indexOf('{', m.index));
    const codes = new Set();
    for (const e of matchAll(body, /ApiError\.\w+\(\s*'([A-Z0-9_]+)'/g)) {
      codes.add(e[1]);
      if (!errors.has(e[1])) {
        const msg = body.match(new RegExp(`ApiError\\.\\w+\\(\\s*'${e[1]}'\\s*,\\s*'([^']*)'`));
        errors.set(e[1], msg ? msg[1] : null);
      }
    }
    functions[name] = {
      hasPagination: body.includes('pagination:'),
      hasMessage: /return\s*\{\s*message:/.test(body),
      codes: [...codes],
    };
  }

  for (const m of matchAll(serviceSrc, /ApiError\.\w+\(\s*'([A-Z0-9_]+)'\s*\)/g)) {
    if (!errors.has(m[1])) errors.set(m[1], null);
  }

  return { errors, functions };
}

/* ------------------------------------------------------------------ */
/* Render                                                             */
/* ------------------------------------------------------------------ */

function formatFields(schema) {
  if (!schema) return null;
  if (schema.kind === 'enum') return schema.values.map((v) => `\`${v}\``).join(' | ');
  if (!schema.fields.length) return null;
  return schema.fields
    .map((f) => {
      const type = f.enumValues ? f.enumValues.join('|') : f.type;
      const note = f.optional ? 'tùy chọn' : f.hasDefault ? 'có mặc định' : 'bắt buộc';
      const desc = f.description ? ` — ${f.description}` : '';
      return `- \`${f.name}\` (${type}, ${note})${desc}`;
    })
    .join('\n');
}

function responseShape(controller, service) {
  if (!controller) return '—';
  const fn = controller.serviceFn ? service.functions[controller.serviceFn] : null;
  if (fn && fn.hasPagination) return `\`{ data, pagination: { page, pageSize, total } }\``;
  if (controller.status === 201) return '`{ message, data }`';
  if (fn && fn.hasMessage) return '`{ message }`';
  return '`{ data }`';
}

function main() {
  const appSrc = read(path.join('backend', 'src', 'app.ts'));
  const mounts = {};
  for (const m of matchAll(appSrc, /app\.use\('(\/api\/[^']*)',\s*(\w+)Routes\)/g)) {
    mounts[m[2]] = m[1];
  }

  const moduleDirs = fs
    .readdirSync(MODULES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const out = [];
  out.push('# Hợp đồng API — Quản lý nhà trọ SaaS');
  out.push('');
  out.push('> Sinh tự động từ `backend/src/modules/*/{routes,controller,schema,service}.ts` và `backend/src/app.ts`.');
  out.push('> Khi đổi route, middleware hoặc thân yêu cầu: chạy lại `node scripts/gen-api-contract.js` và cập nhật file này.');
  out.push('');
  out.push('## Quy ước chung');
  out.push('');
  out.push('- Base URL: `/api`. Mọi route dưới đây đã gồm tiền tố `/api`.');
  out.push('- Xác thực: header `Authorization: Bearer <token>` (JWT do `POST /api/auth/login` trả về).');
  out.push('- Định dạng lỗi: `{ "error": { "code": "TENANT_SUSPENDED", "message": "...", "details": ... } }`.');
  out.push('- Thành công: `{ "data": ... }`, hoặc `{ "message": "...", "data": ... }` với route tạo mới.');
  out.push('- Danh sách có phân trang: `?page=1&pageSize=20` → `{ data, pagination: { page, pageSize, total } }`.');
  out.push('- Tiền tệ (Decimal) trả về dạng **chuỗi**, ví dụ `"3000000.00"`.');
  out.push('- Ngày: `YYYY-MM-DD`; kỳ hóa đơn: `YYYY-MM`; thời gian: ISO 8601 (`2026-10-22T03:12:00.000Z`).');
  out.push('- Vai trò: `ADMIN` (quản trị nền tảng), `LANDLORD` (chủ nhà trọ), `RENTER` (người thuê).');
  out.push('- Cột "Gói còn hạn": `Có` nghĩa là route tạo mới dữ liệu nghiệp vụ, bị chặn khi gói dịch vụ đã hết hạn (Luật 12).');
  out.push('- Mã lỗi chung: `400 VALIDATION_ERROR`, `401 UNAUTHORIZED` / `INVALID_TOKEN`, `403 FORBIDDEN` / `NO_TENANT` / `TENANT_SUSPENDED` / `SUBSCRIPTION_EXPIRED`, `404 *_NOT_FOUND`, `409 CONFLICT`, `429 TOO_MANY_REQUESTS`, `500 INTERNAL_ERROR`.');
  out.push('');

  out.push('## Ngoài module (khai báo trực tiếp trong app.ts)');
  out.push('');
  out.push('### GET /api/health');
  out.push('');
  out.push('- Vai trò: Mọi vai trò đã xác thực');
  out.push('- Gói còn hạn: Không');
  out.push('- Phản hồi thành công: 200 `{ status, timestamp }`');
  out.push('');
  out.push('### POST /api/webhooks/payos');
  out.push('');
  out.push('- Vai trò: Không dùng Bearer token — xác thực bằng chữ ký webhook payOS (SDK `@payos/node`).');
  out.push('- Gói còn hạn: Không');
  out.push('- Thân yêu cầu: body JSON của payOS (`orderCode`, `amount`, `code`, ...), tối đa 16kb.');
  out.push('- Phản hồi thành công: 200 `{ data, code }` (idempotent: gọi lại không ghi trùng).');
  out.push('- Mã lỗi riêng: `INVALID_SIGNATURE`, `ORDER_NOT_FOUND`, `AMOUNT_MISMATCH`');
  out.push('');

  for (const moduleName of moduleDirs) {
    const dir = path.join(MODULES_DIR, moduleName);
    const routesSrc = read(path.join(dir, 'routes.ts'));
    if (!routesSrc) continue;

    const controllerSrc = read(path.join(dir, 'controller.ts'));
    const schemaSrc = read(path.join(dir, 'schema.ts'));
    const serviceSrc = read(path.join(dir, 'service.ts'));

    const { routes, moduleRoles } = parseRoutes(routesSrc);
    const controllers = parseController(controllerSrc);
    const schemas = parseSchemas(schemaSrc);
    const service = parseService(serviceSrc);

    const mount = mounts[moduleName];
    const prefix = mount || `/api/${moduleName}`;

    out.push(`## Module: ${moduleName}`);
    out.push('');
    out.push(`Tiền tố đường dẫn: \`${prefix}\``);
    if (moduleRoles.length) {
      out.push(
        `- Vai trò mặc định của module: ${moduleRoles
          .map((r) => `${r} (${ROLE_LABEL[r] || r})`)
          .join(', ')}`
      );
    }
    out.push('');

    for (const route of routes) {
      const controller = controllers[route.controller];
      const fullPath = `${prefix === '/' ? '' : prefix}${route.path === '/' ? '' : route.path}` || prefix;
      const roles = route.roles.length ? route.roles : moduleRoles.length ? moduleRoles : ['*'];
      const roleText = roles
        .map((r) => (r === '*' ? 'Mọi vai trò đã xác thực' : `${r} (${ROLE_LABEL[r] || r})`))
        .join(', ');

      out.push(`### ${route.method} ${fullPath}`);
      out.push('');
      out.push(`- Vai trò: ${roleText}`);
      out.push(`- Gói còn hạn: ${route.needsSubscription ? 'Có' : 'Không'}`);

      if (controller && controller.paramsSchema && schemas[controller.paramsSchema]) {
        const fields = formatFields(schemas[controller.paramsSchema]);
        if (fields) {
          out.push('- Tham số đường dẫn:');
          out.push(fields);
        }
      }
      if (controller && controller.querySchema && schemas[controller.querySchema]) {
        const fields = formatFields(schemas[controller.querySchema]);
        if (fields) {
          out.push('- Query:');
          out.push(fields);
        }
      }
      if (controller && controller.bodySchema && schemas[controller.bodySchema]) {
        const fields = formatFields(schemas[controller.bodySchema]);
        if (fields) {
          out.push('- Thân yêu cầu:');
          out.push(fields);
        }
      }

      out.push(`- Phản hồi thành công: ${controller ? controller.status : 200} ${responseShape(controller, service)}`);

      const fn = controller && controller.serviceFn ? service.functions[controller.serviceFn] : null;
      const codes = fn && fn.codes.length ? fn.codes : [];
      if (codes.length) {
        out.push('- Mã lỗi riêng: ' + codes.map((c) => `\`${c}\``).join(', '));
      }
      out.push('');
    }
  }

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, `${out.join('\n')}\n`, 'utf8');
  console.log(`Đã sinh ${OUT_FILE} (${out.length} dòng)`);
}

if (require.main === module) main();

module.exports = { parseRoutes, parseController, parseSchemas, parseService };

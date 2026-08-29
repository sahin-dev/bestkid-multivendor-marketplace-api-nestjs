import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import ts from "typescript";
import type { OpenAPIObject } from "@nestjs/swagger";
import * as responseExampleExports from "../src/common/swagger/response-examples";

type HttpMethod = "get" | "post" | "put" | "patch" | "delete" | "options" | "head";

type Route = {
  tag: string;
  summary: string;
  description?: string;
  method: HttpMethod;
  path: string;
  protected: boolean;
  query: QueryParameter[];
  bodyType?: string;
  consumes?: string;
};

type QueryParameter = {
  name: string;
  required: boolean;
  type?: string;
  enum?: string[];
};

const HTTP_DECORATORS: Record<string, HttpMethod> = {
  Get: "get",
  Post: "post",
  Put: "put",
  Patch: "patch",
  Delete: "delete",
  Options: "options",
  Head: "head",
};

const statusNames: Record<string, string> = {
  "200": "OK",
  "201": "Created",
  "204": "No Content",
  "400": "Bad Request",
  "401": "Unauthorized",
  "403": "Forbidden",
  "404": "Not Found",
  "409": "Conflict",
  "500": "Internal Server Error",
};

const knownEnums: Record<string, string[]> = {
  AdminProductApprovalFilter: ["ALL", "APPROVED", "REJECTED", "PENDING"],
  AuthenticationStatus: ["NOT_SUBMITTED", "PENDING", "VERIFIED", "NOT_VERIFIED"],
  Condition: ["NEW", "USED", "REFURBISHED"],
  ProductStatus: ["ACTIVE", "INACTIVE", "SOLD"],
};

const applySwaggerResponseExamples =
  (responseExampleExports as any).applySwaggerResponseExamples
  ?? (responseExampleExports as any).default?.applySwaggerResponseExamples;

async function main() {
  const root = process.cwd();
  const srcRoot = join(root, "src");
  const controllerFiles = (await listFiles(srcRoot)).filter((file) => file.endsWith(".controller.ts"));
  const dtoFiles = (await listFiles(srcRoot)).filter((file) => file.endsWith(".dto.ts") || file.endsWith("Dto.ts"));

  const schemas = await buildDtoSchemas(dtoFiles);
  const routes = (await Promise.all(controllerFiles.map(readRoutes))).flat();
  const document = buildSyntheticOpenApi(routes, schemas);
  applySwaggerResponseExamples(document);

  const collection = buildCollection(document);
  const outputPath = join(root, "bestkid-multivendor-marketplace.postman_collection.json");
  await writeFile(outputPath, `${JSON.stringify(collection, null, 2)}\n`);

  console.log(`Postman collection written to ${outputPath} (${countRequests(collection)} requests).`);
}

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(dir, entry.name);
      return entry.isDirectory() ? listFiles(path) : Promise.resolve([path]);
    }),
  );
  return nested.flat();
}

async function readRoutes(file: string): Promise<Route[]> {
  const text = await readFile(file, "utf8");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const routes: Route[] = [];

  for (const statement of source.statements) {
    if (!ts.isClassDeclaration(statement)) {
      continue;
    }

    const classDecorators = decorators(statement);
    const controller = classDecorators.find((decorator) => decorator.name === "Controller");
    if (!controller) {
      continue;
    }

    const basePath = normalizePath(stringArg(controller.text) ?? "");
    const tag = stringArg(classDecorators.find((decorator) => decorator.name === "ApiTags")?.text) ?? "Ungrouped";
    const classHasBearer = classDecorators.some((decorator) => decorator.name === "ApiBearerAuth");

    for (const member of statement.members) {
      if (!ts.isMethodDeclaration(member)) {
        continue;
      }

      const methodDecorators = decorators(member);
      const httpDecorator = methodDecorators.find((decorator) => HTTP_DECORATORS[decorator.name]);
      if (!httpDecorator) {
        continue;
      }

      const methodPath = normalizePath(stringArg(httpDecorator.text) ?? "");
      const operation = methodDecorators.find((decorator) => decorator.name === "ApiOperation");
      const body = methodDecorators.find((decorator) => decorator.name === "ApiBody");
      const consumes = methodDecorators.find((decorator) => decorator.name === "ApiConsumes");
      const publicRoute = methodDecorators.some((decorator) => decorator.name === "Public")
        || classDecorators.some((decorator) => decorator.name === "Public");

      routes.push({
        tag,
        method: HTTP_DECORATORS[httpDecorator.name],
        path: toOpenApiPath(joinPaths(basePath, methodPath)),
        summary: objectStringValue(operation?.text, "summary") ?? `${httpDecorator.name.toUpperCase()} ${joinPaths(basePath, methodPath)}`,
        description: objectStringValue(operation?.text, "description"),
        protected: !publicRoute && (classHasBearer || methodDecorators.some((decorator) => decorator.name === "ApiBearerAuth")),
        query: methodDecorators.filter((decorator) => decorator.name === "ApiQuery").map(parseApiQuery),
        bodyType: body ? objectTypeValue(body.text, "type") : undefined,
        consumes: consumes ? stringArg(consumes.text) : undefined,
      });
    }
  }

  return routes;
}

function decorators(node: ts.Node) {
  const nodeDecorators = ts.canHaveDecorators(node) ? ts.getDecorators(node) ?? [] : [];
  return nodeDecorators.map((decorator) => {
    const expression = decorator.expression;
    const call = ts.isCallExpression(expression) ? expression : undefined;
    const name = call ? call.expression.getText() : expression.getText();
    return {
      name: name.split(".").pop() ?? name,
      text: decorator.getText(),
    };
  });
}

function buildSyntheticOpenApi(routes: Route[], schemas: Record<string, any>): OpenAPIObject {
  const document: any = {
    openapi: "3.0.0",
    info: {
      title: "BestKid Api",
      description:
        "Backend API for the BestKid multivendor marketplace. Use the Bearer auth control with a JWT returned from /auth/login or /auth/admin/login for protected endpoints.",
      version: "1.0",
    },
    servers: [{ url: "{{baseUrl}}" }],
    components: {
      securitySchemes: {
        "access-token": {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas,
    },
    paths: {},
  };

  for (const route of routes.sort((a, b) => `${a.tag} ${a.path} ${a.method}`.localeCompare(`${b.tag} ${b.path} ${b.method}`))) {
    document.paths[route.path] ??= {};
    document.paths[route.path][route.method] = {
      tags: [route.tag],
      summary: route.summary,
      description: route.description,
      parameters: [
        ...pathParameters(route.path),
        ...route.query.map((parameter) => ({
          name: parameter.name,
          in: "query",
          required: parameter.required,
          schema: schemaForQueryParameter(parameter),
        })),
      ],
      requestBody: route.bodyType ? requestBody(route, schemas) : undefined,
      responses: {},
      security: route.protected ? [{ "access-token": [] }] : [],
    };
  }

  return document;
}

function requestBody(route: Route, schemas: Record<string, any>) {
  const contentType = route.consumes ?? "application/json";
  const schema = schemas[route.bodyType ?? ""]
    ? { $ref: `#/components/schemas/${route.bodyType}` }
    : { type: "object", additionalProperties: true };

  return {
    required: true,
    content: {
      [contentType]: { schema },
    },
  };
}

async function buildDtoSchemas(files: string[]) {
  const schemas: Record<string, any> = {};

  for (const file of files) {
    const text = await readFile(file, "utf8");
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);

    for (const statement of source.statements) {
      if (!ts.isClassDeclaration(statement) || !statement.name) {
        continue;
      }

      const properties: Record<string, any> = {};
      const required: string[] = [];

      for (const member of statement.members) {
        if (!ts.isPropertyDeclaration(member) || !member.name || !ts.isIdentifier(member.name)) {
          continue;
        }

        const apiDecorator = decorators(member).find((decorator) =>
          ["ApiProperty", "ApiPropertyOptional"].includes(decorator.name),
        );
        if (!apiDecorator) {
          continue;
        }

        const propertyName = member.name.text;
        const schema = schemaForDtoProperty(member, apiDecorator.text);
        properties[propertyName] = schema;

        const optional = apiDecorator.name === "ApiPropertyOptional"
          || member.questionToken
          || /required\s*:\s*false/.test(apiDecorator.text);
        if (!optional) {
          required.push(propertyName);
        }
      }

      schemas[statement.name.text] = {
        type: "object",
        properties,
        ...(required.length ? { required } : {}),
      };
    }
  }

  return schemas;
}

function schemaForDtoProperty(member: ts.PropertyDeclaration, decoratorText: string) {
  const example = objectLiteralValue(decoratorText, "example");
  const defaultValue = objectLiteralValue(decoratorText, "default");
  const enumValues = enumArrayFromDecorator(decoratorText);
  const explicitType = objectTypeValue(decoratorText, "type");
  const typeText = member.type?.getText() ?? explicitType ?? "string";

  const schema: any = schemaFromTypeText(typeText, explicitType);
  if (enumValues?.length) {
    schema.enum = enumValues;
  }
  if (example !== undefined) {
    schema.example = example;
  }
  if (defaultValue !== undefined) {
    schema.default = defaultValue;
  }

  return schema;
}

function schemaFromTypeText(typeText: string, explicitType?: string): any {
  if (/\[\]$/.test(typeText) && explicitType && /^[A-Z]\w+$/.test(explicitType)) {
    return explicitType === "String"
      ? { type: "array", items: { type: "string" } }
      : explicitType === "Number"
        ? { type: "array", items: { type: "number" } }
        : { type: "array", items: { $ref: `#/components/schemas/${explicitType}` } };
  }

  const normalized = explicitType ?? typeText;

  if (/\[String\]|string\[\]|Array<string>/i.test(normalized)) {
    return { type: "array", items: { type: "string" } };
  }
  if (/\[Number\]|number\[\]|Array<number>/i.test(normalized)) {
    return { type: "array", items: { type: "number" } };
  }
  if (/boolean/i.test(normalized)) {
    return { type: "boolean" };
  }
  if (/number/i.test(normalized)) {
    return { type: "number" };
  }
  if (/Date/i.test(normalized)) {
    return { type: "string", format: "date-time" };
  }
  if (/\[([A-Z]\w+)\]/.test(normalized)) {
    const ref = normalized.match(/\[([A-Z]\w+)\]/)?.[1];
    return { type: "array", items: { $ref: `#/components/schemas/${ref}` } };
  }
  if (/^[A-Z]\w+$/.test(normalized)) {
    return { $ref: `#/components/schemas/${normalized}` };
  }

  return { type: "string" };
}

function buildCollection(document: OpenAPIObject) {
  const folders = new Map<string, any>();

  const collection = {
    info: {
      name: "BestKid Multivendor Marketplace API",
      description: document.info.description,
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      version: document.info.version,
    },
    auth: {
      type: "bearer",
      bearer: [{ key: "token", value: "{{accessToken}}", type: "string" }],
    },
    variable: [
      { key: "baseUrl", value: "http://localhost:3000", type: "string" },
      { key: "accessToken", value: "", type: "string" },
    ],
    item: [] as any[],
  };

  for (const [path, pathItem] of Object.entries(document.paths)) {
    for (const method of Object.keys(pathItem ?? {}) as HttpMethod[]) {
      const operation = (pathItem as any)[method];
      const folderName = operation.tags?.[0] ?? "Ungrouped";
      if (!folders.has(folderName)) {
        const folder = { name: folderName, item: [] as any[] };
        folders.set(folderName, folder);
        collection.item.push(folder);
      }

      folders.get(folderName).item.push(buildItem(document, method, path, operation));
    }
  }

  return collection;
}

function buildItem(document: OpenAPIObject, method: HttpMethod, path: string, operation: any) {
  const queryParameters = (operation.parameters ?? []).filter((parameter: any) => parameter.in === "query");
  const contentType = preferredRequestContentType(operation.requestBody?.content);
  const body = buildRequestBody(document, operation.requestBody?.content, contentType);

  const item: any = {
    name: operation.summary ?? `${method.toUpperCase()} ${path}`,
    request: {
      method: method.toUpperCase(),
      header: buildHeaders(contentType),
      url: {
        raw: buildRawUrl(path, queryParameters),
        host: ["{{baseUrl}}"],
        path: postmanPath(path),
        query: queryParameters.map((parameter: any) => ({
          key: parameter.name,
          value: String(sampleForSchema(parameter.schema)),
          disabled: parameter.required !== true,
        })),
        variable: pathVariables(path).map((key) => ({ key, value: sampleForPathVariable(key) })),
      },
      description: operation.description,
    },
    response: buildResponses(method, path, operation),
  };

  if (body) {
    item.request.body = body;
  }

  if (!operation.security || operation.security.length === 0) {
    item.request.auth = { type: "noauth" };
  }

  return item;
}

function buildResponses(method: HttpMethod, path: string, operation: any) {
  const responses = Object.keys(operation.responses ?? {}).length
    ? operation.responses
    : { 200: { description: "OK" } };

  return Object.entries(responses).map(([code, response]: [string, any]) => {
    const content = response.content ?? {};
    const contentType = preferredResponseContentType(content);
    const mediaType = contentType ? content[contentType] : undefined;
    const body = mediaType ? firstExampleValue(mediaType.examples) ?? mediaType.example : fallbackBody(method, path, code);

    return {
      name: `${code} ${statusNames[code] ?? response.description ?? ""}`.trim(),
      originalRequest: {
        method: method.toUpperCase(),
        header: [{ key: "Accept", value: contentType ?? "application/json" }],
        url: {
          raw: `{{baseUrl}}${toPostmanPath(path)}`,
          host: ["{{baseUrl}}"],
          path: postmanPath(path),
        },
      },
      status: statusNames[code] ?? response.description ?? "",
      code: Number(code),
      _postman_previewlanguage: contentType === "text/html" ? "html" : "json",
      header: [{ key: "Content-Type", value: contentType ?? "application/json" }],
      body: typeof body === "string" ? body : JSON.stringify(body ?? {}, null, 2),
    };
  });
}

function buildRequestBody(document: OpenAPIObject, content: any, contentType?: string) {
  if (!contentType || !content?.[contentType]) {
    return undefined;
  }

  const schema = content[contentType].schema;
  const sample = sampleFromSchema(document, schema);

  if (contentType === "multipart/form-data") {
    return {
      mode: "formdata",
      formdata: Object.entries(schemaProperties(document, schema)).map(([key, value]: [string, any]) => ({
        key,
        type: value.format === "binary" ? "file" : "text",
        src: value.format === "binary" ? [] : undefined,
        value: value.format === "binary" ? undefined : String(sample?.[key] ?? sampleFromSchema(document, value)),
      })),
    };
  }

  return {
    mode: "raw",
    raw: JSON.stringify(sample, null, 2),
    options: { raw: { language: "json" } },
  };
}

function sampleFromSchema(document: OpenAPIObject, schema: any): any {
  if (!schema) return {};
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.$ref) return sampleFromSchema(document, resolveRef(document, schema.$ref));
  if (schema.enum?.length) return schema.enum[0];
  if (schema.type === "array") return [sampleFromSchema(document, schema.items)];
  if (schema.type === "object" || schema.properties) {
    return Object.fromEntries(Object.entries(schemaProperties(document, schema)).map(([key, value]) => [key, sampleFromSchema(document, value)]));
  }
  return sampleForSchema(schema);
}

function sampleForSchema(schema: any) {
  if (schema?.enum?.length) return schema.enum[0];
  if (schema?.type === "number" || schema?.type === "integer") return 1;
  if (schema?.type === "boolean") return true;
  if (schema?.format === "date-time") return "2026-07-09T10:15:30.000Z";
  return "string";
}

function schemaProperties(document: OpenAPIObject, schema: any): Record<string, any> {
  if (!schema) return {};
  if (schema.$ref) return schemaProperties(document, resolveRef(document, schema.$ref));
  return schema.properties ?? {};
}

function resolveRef(document: OpenAPIObject, ref: string) {
  return ref.replace(/^#\//, "").split("/").reduce((value: any, key) => value?.[key], document);
}

function parseApiQuery(decorator: { text: string }): QueryParameter {
  const enumMatch = decorator.text.match(/enum\s*:\s*\[([^\]]+)\]/s);
  const enumName = decorator.text.match(/enum\s*:\s*([A-Za-z_][A-Za-z0-9_]*)/)?.[1];
  return {
    name: objectStringValue(decorator.text, "name") ?? "query",
    required: !/required\s*:\s*false/.test(decorator.text),
    type: objectTypeValue(decorator.text, "type"),
    enum: enumMatch
      ? enumMatch[1].split(",").map((value) => value.trim().replace(/^["']|["']$/g, ""))
      : enumName
        ? knownEnums[enumName]
        : undefined,
  };
}

function schemaForQueryParameter(parameter: QueryParameter) {
  if (parameter.enum?.length) return { type: "string", enum: parameter.enum };
  if (/Number/.test(parameter.type ?? "")) return { type: "number" };
  if (/Boolean/.test(parameter.type ?? "")) return { type: "boolean" };
  return { type: "string" };
}

function pathParameters(path: string) {
  return pathVariables(path).map((name) => ({
    name,
    in: "path",
    required: true,
    schema: { type: "string" },
  }));
}

function pathVariables(path: string) {
  return [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
}

function stringArg(text?: string) {
  return text?.match(/\(\s*["'`]([^"'`]*)["'`]/s)?.[1];
}

function objectStringValue(text: string | undefined, key: string) {
  return text?.match(new RegExp(`${key}\\s*:\\s*["'\`]([^"'\`]*)["'\`]`, "s"))?.[1];
}

function objectTypeValue(text: string | undefined, key: string) {
  return text?.match(new RegExp(`${key}\\s*:\\s*(?:\\[\\s*)?([A-Za-z_][A-Za-z0-9_]*)`, "s"))?.[1];
}

function objectLiteralValue(text: string | undefined, key: string) {
  const match = extractObjectValue(text, key);
  if (!match) return undefined;
  if (/^["'`]/.test(match)) return match.replace(/^["'`]|["'`]$/g, "");
  if (/^(true|false)$/.test(match)) return match === "true";
  if (/^\d+(\.\d+)?$/.test(match)) return Number(match);
  if (/^[A-Za-z_][A-Za-z0-9_]*\.[A-Z0-9_]+$/.test(match)) return match.split(".").pop();
  if (/^[\[{]/.test(match)) {
    try {
      return Function(`"use strict"; return (${match});`)();
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function enumArrayFromDecorator(text: string | undefined) {
  const match = text?.match(/enum\s*:\s*\[([^\]]+)\]/s)?.[1];
  if (match) {
    return match.split(",").map((value) => value.trim().replace(/^["']|["']$/g, ""));
  }

  const enumName = text?.match(/enum\s*:\s*([A-Za-z_][A-Za-z0-9_]*)/)?.[1];
  return enumName ? knownEnums[enumName] : undefined;
}

function extractObjectValue(text: string | undefined, key: string) {
  const start = text?.search(new RegExp(`${key}\\s*:`));
  if (start === undefined || start < 0 || !text) return undefined;

  let index = text.indexOf(":", start) + 1;
  while (/\s/.test(text[index] ?? "")) index += 1;

  const opening = text[index];
  const closing = opening === "[" ? "]" : opening === "{" ? "}" : undefined;
  if (!closing) {
    return text.slice(index).match(/^[^,}\n]+/)?.[0]?.trim();
  }

  let depth = 0;
  let quote: string | undefined;
  for (let cursor = index; cursor < text.length; cursor += 1) {
    const char = text[cursor];
    const previous = text[cursor - 1];
    if (quote) {
      if (char === quote && previous !== "\\") quote = undefined;
      continue;
    }
    if (["\"", "'", "`"].includes(char)) {
      quote = char;
      continue;
    }
    if (char === opening) depth += 1;
    if (char === closing) depth -= 1;
    if (depth === 0) return text.slice(index, cursor + 1).trim();
  }

  return undefined;
}

function joinPaths(base: string, method: string) {
  return `/${[base, method].map((part) => part.replace(/^\/|\/$/g, "")).filter(Boolean).join("/")}`;
}

function normalizePath(path: string) {
  return path.replace(/^\/|\/$/g, "");
}

function toOpenApiPath(path: string) {
  return path.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, "{$1}");
}

function toPostmanPath(path: string) {
  return path.replace(/\{([^}]+)\}/g, ":$1");
}

function postmanPath(path: string) {
  return toPostmanPath(path).replace(/^\//, "").split("/").filter(Boolean);
}

function buildRawUrl(path: string, queryParameters: any[]) {
  const query = queryParameters
    .map((parameter) => `${parameter.name}=${encodeURIComponent(String(sampleForSchema(parameter.schema)))}`)
    .join("&");
  return `{{baseUrl}}${toPostmanPath(path)}${query ? `?${query}` : ""}`;
}

function buildHeaders(contentType?: string) {
  const headers = [{ key: "Accept", value: "application/json" }];
  if (contentType && contentType !== "multipart/form-data") {
    headers.push({ key: "Content-Type", value: contentType });
  }
  return headers;
}

function preferredRequestContentType(content?: Record<string, any>) {
  if (!content) return undefined;
  return ["application/json", "multipart/form-data", "application/x-www-form-urlencoded"].find((type) => content[type]) ?? Object.keys(content)[0];
}

function preferredResponseContentType(content?: Record<string, any>) {
  if (!content) return undefined;
  return ["application/json", "text/html"].find((type) => content[type]) ?? Object.keys(content)[0];
}

function firstExampleValue(examples?: Record<string, any>) {
  const first = examples ? Object.values(examples)[0] : undefined;
  return first && typeof first === "object" && "value" in first ? first.value : first;
}

function fallbackBody(method: HttpMethod, path: string, code: string) {
  if (path === "/" && method === "get") {
    return "BestKid API Server";
  }

  return {
    success: Number(code) < 400,
    statusCode: Number(code),
    message: Number(code) < 400 ? "Request successful" : statusNames[code] ?? "Error",
    data: Number(code) < 400 ? null : undefined,
  };
}

function sampleForPathVariable(key: string) {
  if (/id$/i.test(key)) return "1";
  if (/type/i.test(key)) return "TERMS";
  return `{{${key}}}`;
}

function countRequests(collection: any) {
  return collection.item.reduce((total: number, folder: any) => total + folder.item.length, 0);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import isPathInside from 'is-path-inside';
import AliOSS from 'ali-oss';
import getPath from '@/utils/getPath';
import db from '@/utils/db';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const MIME_TYPES: Record<string, string> = {
  '.bmp': 'image/bmp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.webp': 'image/webp',
};

// 规范化路径：去除前导斜杠，并将路径分隔符统一转换为系统分隔符
function normalizeUserPath(userPath: string): string {
  // 去除前导的 / 或 \
  const trimmedPath = userPath.replace(/^[/\\]+/, '');
  // 将所有 / 替换为系统路径分隔符（path.sep）
  // 这样在 Windows 上会转为 \，在 Unix 上保持 /
  return trimmedPath.split('/').join(path.sep);
}

function normalizeObjectKey(userPath: string): string {
  const trimmedPath = userPath.replace(/^[/\\]+/, '').replaceAll('\\', '/');
  const normalized = path.posix.normalize(trimmedPath);
  if (normalized === '.') return '';
  if (normalized === '..' || normalized.startsWith('../')) {
    throw new Error(`${userPath} 不在 OSS 根目录内`);
  }
  return normalized;
}

// 校验路径
function resolveSafeLocalPath(userPath: string, rootDir: string): string {
  const safePath = normalizeUserPath(userPath);
  const absPath = path.join(rootDir, safePath);
  if (!isPathInside(absPath, rootDir)) {
    throw new Error(`${userPath} 不在 OSS 根目录内`);
  }
  return absPath;
}

function getMimeType(userPath: string): string | undefined {
  return MIME_TYPES[path.extname(userPath).toLowerCase()];
}

function decodeBase64Data(data: Buffer | string): Buffer {
  // 如果 data 是 string，则视为 base64 编码，先解码再写入
  // 自动去除可能存在的 Data URL 前缀（如 "data:image/png;base64,"）
  return typeof data === 'string'
    ? Buffer.from(data.replace(/^data:[^;]+;base64,/, ''), 'base64')
    : data;
}

function isTruthyEnv(value: string | undefined, defaultValue = false): boolean {
  if (value === undefined || value === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function decodeXml(value: string): string {
  return value
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanUrl(value: unknown): string {
  return cleanText(value).replace(/\/+$/, '');
}

function normalizeRootPrefix(value: unknown): string {
  const prefix = normalizeObjectKey(cleanText(value)).replace(/\/+$/, '');
  return prefix === '.' ? '' : prefix;
}

function isRemoteNotFoundError(error: unknown): boolean {
  if (error instanceof MinioRequestError && error.status === 404) return true;
  const status = Number((error as { status?: number })?.status);
  const code = String((error as { code?: string })?.code ?? '');
  return status === 404 || code === 'NoSuchKey';
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string' || value.trim() === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function toDateString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return typeof value === 'string' ? value : '';
}

function normalizeStorageProvider(value: unknown): OssStorageProvider | undefined {
  if (typeof value !== 'string') return undefined;
  const provider = value.trim().toLowerCase();
  if (provider === 'aliyun' || provider === 'minio' || provider === 'local') {
    return provider;
  }
  return undefined;
}

type MinioConfig = {
  accessKey: string;
  bucket: string;
  endpoint: URL;
  forcePathStyle: boolean;
  region: string;
  secretKey: string;
};

type RemoteStorageProvider = 'aliyun' | 'minio';
export type OssStorageProvider = RemoteStorageProvider | 'local';

type RemoteStorage = {
  readonly description: string;
  deleteDirectory(userRelPath: string): Promise<void>;
  deleteFile(userRelPath: string): Promise<void>;
  fileExists(userRelPath: string): Promise<boolean>;
  getFile(userRelPath: string): Promise<Buffer>;
  listDirectory(userRelPath: string): Promise<OssEntry[]>;
  writeFile(userRelPath: string, data: Buffer): Promise<void>;
};

export type StoredOssConfig = {
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
  enabled: boolean;
  endpoint: string;
  provider: 'aliyun';
  publicBaseUrl: string;
  region: string;
  rootPrefix: string;
  secure: boolean;
};

export type AdminOssConfig = Omit<StoredOssConfig, 'accessKeySecret'> & {
  accessKeySecret: string;
  secretConfigured: boolean;
};

export type OssRuntimeInfo = {
  description: string;
  provider: OssStorageProvider;
  remoteEnabled: boolean;
};

const OSS_CONFIG_SETTING_KEY = 'ossConfig';
const STORAGE_PROVIDER_QUERY_KEY = 'storageProvider';
const STORAGE_PROVIDER_TABLES = ['o_image', 'o_storyboard', 'o_video'] as const;

const DEFAULT_ADMIN_OSS_CONFIG: AdminOssConfig = {
  accessKeyId: '',
  accessKeySecret: '',
  bucket: '',
  enabled: false,
  endpoint: '',
  provider: 'aliyun',
  publicBaseUrl: '',
  region: 'oss-cn-hangzhou',
  rootPrefix: '',
  secretConfigured: false,
  secure: true,
};

function parseStoredOssConfig(value: unknown): StoredOssConfig | null {
  if (!value) return null;

  try {
    const raw =
      typeof value === 'string' ? (JSON.parse(value) as Record<string, unknown>) : (value as Record<string, unknown>);

    if (!raw || typeof raw !== 'object') return null;
    return {
      accessKeyId: cleanText(raw.accessKeyId),
      accessKeySecret: cleanText(raw.accessKeySecret),
      bucket: cleanText(raw.bucket),
      enabled: toBoolean(raw.enabled),
      endpoint: cleanUrl(raw.endpoint),
      provider: 'aliyun',
      publicBaseUrl: cleanUrl(raw.publicBaseUrl),
      region: cleanText(raw.region) || DEFAULT_ADMIN_OSS_CONFIG.region,
      rootPrefix: normalizeRootPrefix(raw.rootPrefix),
      secure: toBoolean(raw.secure, true),
    };
  } catch (error) {
    console.warn('[OSS] 解析 OSS 配置失败:', error);
    return null;
  }
}

function toAdminOssConfig(config: StoredOssConfig | null): AdminOssConfig {
  if (!config) return { ...DEFAULT_ADMIN_OSS_CONFIG };
  return {
    ...config,
    accessKeySecret: '',
    secretConfigured: Boolean(config.accessKeySecret),
  };
}

function normalizeAdminOssConfigInput(input: Record<string, unknown>, existing?: StoredOssConfig | null): StoredOssConfig {
  const enabled = toBoolean(input.enabled);
  const accessKeySecret = cleanText(input.accessKeySecret) || existing?.accessKeySecret || '';
  const config: StoredOssConfig = {
    accessKeyId: cleanText(input.accessKeyId),
    accessKeySecret,
    bucket: cleanText(input.bucket),
    enabled,
    endpoint: cleanUrl(input.endpoint),
    provider: 'aliyun',
    publicBaseUrl: cleanUrl(input.publicBaseUrl),
    region: cleanText(input.region) || DEFAULT_ADMIN_OSS_CONFIG.region,
    rootPrefix: normalizeRootPrefix(input.rootPrefix),
    secure: toBoolean(input.secure, true),
  };

  if (enabled) {
    const missingFields: string[] = [];
    if (!config.region) missingFields.push('Region');
    if (!config.bucket) missingFields.push('Bucket');
    if (!config.accessKeyId) missingFields.push('AccessKey ID');
    if (!config.accessKeySecret) missingFields.push('AccessKey Secret');
    if (missingFields.length) throw new Error(`请补全 OSS 配置：${missingFields.join('、')}`);
  }

  return config;
}

class MinioRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'MinioRequestError';
    this.status = status;
  }
}

type MinioRequestOptions = {
  body?: Buffer;
  headers?: Record<string, string | undefined>;
  query?: Record<string, string | undefined>;
};

export type OssEntry = {
  key: string;
  lastModified: string;
  size: number | null;
  type: 'directory' | 'file';
};

function parseXmlTag(source: string, tag: string): string | null {
  const match = source.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return match ? decodeXml(match[1]) : null;
}

class MinioStorage implements RemoteStorage {
  private bucketReady?: Promise<void>;

  constructor(private readonly config: MinioConfig) {}

  get description(): string {
    return `${this.config.endpoint.origin}/${this.config.bucket}`;
  }

  private buildHost(): string {
    if (this.config.forcePathStyle) return this.config.endpoint.host;
    const port = this.config.endpoint.port
      ? `:${this.config.endpoint.port}`
      : '';
    return `${this.config.bucket}.${this.config.endpoint.hostname}${port}`;
  }

  private buildCanonicalUri(key: string): string {
    const segments = this.config.endpoint.pathname.split('/').filter(Boolean);

    if (this.config.forcePathStyle) segments.push(this.config.bucket);
    if (key) segments.push(...key.split('/').filter(Boolean));

    return `/${segments.map(encodeRfc3986).join('/')}`;
  }

  private buildRequestUrl(
    canonicalUri: string,
    canonicalQuery: string,
  ): string {
    const host = this.buildHost();
    return `${this.config.endpoint.protocol}//${host}${canonicalUri}${canonicalQuery ? `?${canonicalQuery}` : ''}`;
  }

  private buildCanonicalQuery(
    query: Record<string, string | undefined> = {},
  ): string {
    return Object.entries(query)
      .filter((entry): entry is [string, string] => entry[1] !== undefined)
      .map(
        ([key, value]) => [encodeRfc3986(key), encodeRfc3986(value)] as const,
      )
      .sort(
        ([leftKey, leftValue], [rightKey, rightValue]) =>
          leftKey.localeCompare(rightKey) ||
          leftValue.localeCompare(rightValue),
      )
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
  }

  private sha256(data: Buffer | string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private hmac(key: Buffer | string, data: string): Buffer {
    return crypto.createHmac('sha256', key).update(data).digest();
  }

  private signingKey(dateStamp: string): Buffer {
    const dateKey = this.hmac(`AWS4${this.config.secretKey}`, dateStamp);
    const dateRegionKey = this.hmac(dateKey, this.config.region);
    const dateRegionServiceKey = this.hmac(dateRegionKey, 's3');
    return this.hmac(dateRegionServiceKey, 'aws4_request');
  }

  private toAmzDates(date: Date): { amzDate: string; dateStamp: string } {
    const iso = date
      .toISOString()
      .replaceAll('-', '')
      .replaceAll(':', '')
      .replace(/\.\d{3}Z$/, 'Z');
    return {
      amzDate: iso,
      dateStamp: iso.slice(0, 8),
    };
  }

  private async request(
    method: string,
    userRelPath: string,
    options: MinioRequestOptions = {},
  ): Promise<Response> {
    const key = normalizeObjectKey(userRelPath);
    const body = options.body;
    const payloadHash = this.sha256(body ?? Buffer.alloc(0));
    const canonicalUri = this.buildCanonicalUri(key);
    const canonicalQuery = this.buildCanonicalQuery(options.query);
    const host = this.buildHost();
    const { amzDate, dateStamp } = this.toAmzDates(new Date());

    const headers: Record<string, string> = {
      host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    };

    for (const [name, value] of Object.entries(options.headers ?? {})) {
      if (value !== undefined && value !== '')
        headers[name.toLowerCase()] = value;
    }

    const sortedHeaderNames = Object.keys(headers).sort();
    const canonicalHeaders = sortedHeaderNames
      .map((name) => `${name}:${headers[name].trim().replace(/\s+/g, ' ')}\n`)
      .join('');
    const signedHeaders = sortedHeaderNames.join(';');
    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQuery,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');
    const credentialScope = `${dateStamp}/${this.config.region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      this.sha256(canonicalRequest),
    ].join('\n');
    const signature = crypto
      .createHmac('sha256', this.signingKey(dateStamp))
      .update(stringToSign)
      .digest('hex');

    headers.authorization = [
      `AWS4-HMAC-SHA256 Credential=${this.config.accessKey}/${credentialScope}`,
      `SignedHeaders=${signedHeaders}`,
      `Signature=${signature}`,
    ].join(', ');

    const response = await fetch(
      this.buildRequestUrl(canonicalUri, canonicalQuery),
      {
        body: body && body.length > 0 ? body : undefined,
        headers,
        method,
      },
    );

    if (!response.ok) {
      const detail =
        method === 'HEAD'
          ? response.statusText
          : await response.text().catch(() => response.statusText);
      throw new MinioRequestError(
        response.status,
        detail || response.statusText,
      );
    }

    return response;
  }

  private async ensureBucket(): Promise<void> {
    if (!this.bucketReady) {
      this.bucketReady = (async () => {
        try {
          await this.request('HEAD', '');
        } catch (error) {
          if (!(error instanceof MinioRequestError) || error.status !== 404)
            throw error;
          await this.request('PUT', '');
        }
      })();
    }
    await this.bucketReady;
  }

  async deleteDirectory(userRelPath: string): Promise<void> {
    await this.ensureBucket();
    const directory = normalizeObjectKey(userRelPath);
    if (!directory) throw new Error('禁止删除 OSS 根目录');
    const prefix = directory.endsWith('/') ? directory : `${directory}/`;

    let continuationToken: string | undefined;
    do {
      const response = await this.request('GET', '', {
        query: {
          'continuation-token': continuationToken,
          'list-type': '2',
          prefix,
        },
      });
      const xml = await response.text();
      const keys = [...xml.matchAll(/<Key>([\s\S]*?)<\/Key>/g)].map((match) =>
        decodeXml(match[1]),
      );
      await Promise.all(keys.map((key) => this.deleteFile(key)));

      const tokenMatch = xml.match(
        /<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/,
      );
      continuationToken = tokenMatch ? decodeXml(tokenMatch[1]) : undefined;
    } while (continuationToken);
  }

  async deleteFile(userRelPath: string): Promise<void> {
    await this.ensureBucket();
    try {
      await this.request('DELETE', userRelPath);
    } catch (error) {
      if (!(error instanceof MinioRequestError) || error.status !== 404)
        throw error;
    }
  }

  async fileExists(userRelPath: string): Promise<boolean> {
    try {
      await this.request('HEAD', userRelPath);
      return true;
    } catch (error) {
      if (error instanceof MinioRequestError && error.status === 404)
        return false;
      throw error;
    }
  }

  async getFile(userRelPath: string): Promise<Buffer> {
    const response = await this.request('GET', userRelPath);
    return Buffer.from(await response.arrayBuffer());
  }

  async listDirectory(userRelPath: string): Promise<OssEntry[]> {
    await this.ensureBucket();
    const directory = normalizeObjectKey(userRelPath);
    const prefix = directory ? `${directory.replace(/\/+$/, '')}/` : '';
    const entries = new Map<string, OssEntry>();

    let continuationToken: string | undefined;
    do {
      const response = await this.request('GET', '', {
        query: {
          delimiter: '/',
          'continuation-token': continuationToken,
          'list-type': '2',
          prefix,
        },
      });
      const xml = await response.text();

      for (const match of xml.matchAll(
        /<CommonPrefixes>[\s\S]*?<Prefix>([\s\S]*?)<\/Prefix>[\s\S]*?<\/CommonPrefixes>/g,
      )) {
        const key = decodeXml(match[1]).replace(/\/+$/, '');
        if (key && key !== directory) {
          entries.set(key, {
            key,
            lastModified: '',
            size: null,
            type: 'directory',
          });
        }
      }

      for (const match of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
        const block = match[1];
        const key = parseXmlTag(block, 'Key');
        if (!key || key === prefix || key.endsWith('/.keep')) continue;
        entries.set(key, {
          key,
          lastModified: parseXmlTag(block, 'LastModified') ?? '',
          size: Number(parseXmlTag(block, 'Size') ?? 0),
          type: 'file',
        });
      }

      const tokenMatch = xml.match(
        /<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/,
      );
      continuationToken = tokenMatch ? decodeXml(tokenMatch[1]) : undefined;
    } while (continuationToken);

    return [...entries.values()].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.key.localeCompare(b.key, 'zh-Hans-CN');
    });
  }

  async writeFile(userRelPath: string, data: Buffer): Promise<void> {
    await this.ensureBucket();
    await this.request('PUT', userRelPath, {
      body: data,
      headers: {
        'content-type': getMimeType(userRelPath) ?? 'application/octet-stream',
      },
    });
  }
}

class AliyunOssStorage implements RemoteStorage {
  private readonly client: any;
  private readonly rootPrefix: string;

  constructor(private readonly config: StoredOssConfig) {
    this.rootPrefix = normalizeRootPrefix(config.rootPrefix);
    this.client = new AliOSS({
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
      authorizationV4: true,
      bucket: config.bucket,
      ...(config.endpoint ? { endpoint: config.endpoint } : {}),
      region: config.region,
      secure: config.secure,
    });
  }

  get description(): string {
    const endpoint = this.config.endpoint || this.config.region;
    const prefix = this.rootPrefix ? `/${this.rootPrefix}` : '';
    return `Aliyun OSS ${this.config.bucket}@${endpoint}${prefix}`;
  }

  private toRemoteKey(userRelPath: string): string {
    const key = normalizeObjectKey(userRelPath);
    if (!this.rootPrefix) return key;
    return key ? `${this.rootPrefix}/${key}` : this.rootPrefix;
  }

  private toListPrefix(userRelPath: string): string {
    const key = this.toRemoteKey(userRelPath).replace(/\/+$/, '');
    return key ? `${key}/` : '';
  }

  private stripRootPrefix(remoteKey: string): string {
    const normalizedKey = normalizeObjectKey(remoteKey);
    if (!this.rootPrefix) return normalizedKey;
    if (normalizedKey === this.rootPrefix) return '';
    const prefix = `${this.rootPrefix}/`;
    return normalizedKey.startsWith(prefix) ? normalizedKey.slice(prefix.length) : normalizedKey;
  }

  async deleteDirectory(userRelPath: string): Promise<void> {
    const directory = normalizeObjectKey(userRelPath);
    if (!directory) throw new Error('禁止删除 OSS 根目录');

    const prefix = this.toListPrefix(directory);
    let continuationToken: string | undefined;
    do {
      const result = await this.client.listV2({
        'continuation-token': continuationToken,
        'max-keys': 1000,
        prefix,
      });
      const objects = (result?.objects ?? []) as Array<{ name?: string }>;
      for (const item of objects) {
        if (item.name) await this.client.delete(item.name);
      }
      continuationToken = result?.nextContinuationToken;
    } while (continuationToken);
  }

  async deleteFile(userRelPath: string): Promise<void> {
    try {
      await this.client.delete(this.toRemoteKey(userRelPath));
    } catch (error) {
      if (!isRemoteNotFoundError(error)) throw error;
    }
  }

  async fileExists(userRelPath: string): Promise<boolean> {
    try {
      await this.client.head(this.toRemoteKey(userRelPath));
      return true;
    } catch (error) {
      if (isRemoteNotFoundError(error)) return false;
      throw error;
    }
  }

  async getFile(userRelPath: string): Promise<Buffer> {
    const result = await this.client.get(this.toRemoteKey(userRelPath));
    const content = result?.content;
    if (Buffer.isBuffer(content)) return content;
    if (content instanceof Uint8Array) return Buffer.from(content);
    if (typeof content === 'string') return Buffer.from(content);
    return Buffer.from(content ?? []);
  }

  async listDirectory(userRelPath: string): Promise<OssEntry[]> {
    const directory = normalizeObjectKey(userRelPath);
    const prefix = directory ? this.toListPrefix(directory) : this.rootPrefix ? `${this.rootPrefix}/` : '';
    const entries = new Map<string, OssEntry>();

    let continuationToken: string | undefined;
    do {
      const result = await this.client.listV2({
        delimiter: '/',
        'continuation-token': continuationToken,
        'max-keys': 1000,
        prefix,
      });

      const prefixes = (result?.prefixes ?? []) as string[];
      for (const remotePrefix of prefixes) {
        const key = this.stripRootPrefix(remotePrefix).replace(/\/+$/, '');
        if (key && key !== directory) {
          entries.set(key, {
            key,
            lastModified: '',
            size: null,
            type: 'directory',
          });
        }
      }

      const objects = (result?.objects ?? []) as Array<{
        lastModified?: Date | string;
        name?: string;
        size?: number | string;
      }>;
      for (const item of objects) {
        if (!item.name) continue;
        const key = this.stripRootPrefix(item.name);
        if (!key || key === directory || key.endsWith('/.keep')) continue;
        entries.set(key, {
          key,
          lastModified: toDateString(item.lastModified),
          size: Number(item.size ?? 0),
          type: 'file',
        });
      }

      continuationToken = result?.nextContinuationToken;
    } while (continuationToken);

    return [...entries.values()].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.key.localeCompare(b.key, 'zh-Hans-CN');
    });
  }

  async writeFile(userRelPath: string, data: Buffer): Promise<void> {
    await this.client.put(this.toRemoteKey(userRelPath), data, {
      headers: {
        'Content-Type': getMimeType(userRelPath) ?? 'application/octet-stream',
      },
    });
  }
}

function resolveMinioConfig(): MinioConfig | null {
  const endpoint = process.env.MINIO_ENDPOINT;
  const bucket = process.env.MINIO_BUCKET;
  const accessKey = process.env.MINIO_ACCESS_KEY;
  const secretKey = process.env.MINIO_SECRET_KEY;

  if (!endpoint || !bucket || !accessKey || !secretKey) return null;

  return {
    accessKey,
    bucket,
    endpoint: new URL(endpoint),
    forcePathStyle: isTruthyEnv(process.env.MINIO_FORCE_PATH_STYLE, true),
    region: process.env.MINIO_REGION || 'us-east-1',
    secretKey,
  };
}

function createRemoteStorageFromStoredConfig(config: StoredOssConfig | null): { provider: RemoteStorageProvider; storage: RemoteStorage } | null {
  if (!config?.enabled) return null;
  return {
    provider: 'aliyun',
    storage: new AliyunOssStorage(config),
  };
}

function createRemoteStorageFromEnv(): { provider: RemoteStorageProvider; storage: RemoteStorage } | null {
  const minioConfig = resolveMinioConfig();
  if (!minioConfig) return null;
  return {
    provider: 'minio',
    storage: new MinioStorage(minioConfig),
  };
}

class OSS {
  private provider: OssStorageProvider;
  private publicBaseUrl: string;
  private remote: RemoteStorage | null;
  private storages: Partial<Record<RemoteStorageProvider, RemoteStorage>>;
  private storageProviderCache: Map<string, OssStorageProvider>;
  private rootDir: string;
  private initPromise: Promise<void>;

  constructor() {
    this.rootDir = getPath('oss');
    const envStorage = createRemoteStorageFromEnv();
    this.provider = envStorage?.provider ?? 'local';
    this.publicBaseUrl = '';
    this.remote = envStorage?.storage ?? null;
    this.storages = envStorage ? { [envStorage.provider]: envStorage.storage } : {};
    this.storageProviderCache = new Map();
    // 初始化时自动创建根目录
    this.initPromise = fs
      .mkdir(this.rootDir, { recursive: true })
      .then(() => {});
  }

  isRemoteEnabled(): boolean {
    return Boolean(this.remote);
  }

  getRuntimeInfo(): OssRuntimeInfo {
    return {
      description: this.getStorageDescription(),
      provider: this.provider,
      remoteEnabled: this.isRemoteEnabled(),
    };
  }

  getStorageDescription(): string {
    return this.remote ? this.remote.description : `local ${this.rootDir}`;
  }

  getStorageProvider(): OssStorageProvider {
    return this.provider;
  }

  getStorageProviderFromUrl(url: string): OssStorageProvider | undefined {
    if (typeof url !== 'string' || !url.trim()) return undefined;
    try {
      const parsed = new URL(url, `http://localhost:${process.env.PORT || 10588}`);
      return normalizeStorageProvider(parsed.searchParams.get(STORAGE_PROVIDER_QUERY_KEY));
    } catch {
      return undefined;
    }
  }

  private rememberStorageProvider(userRelPath: string, provider: OssStorageProvider): void {
    const key = normalizeObjectKey(userRelPath);
    if (!key) return;
    this.storageProviderCache.set(key, provider);
  }

  private async lookupStorageProvider(userRelPath: string): Promise<OssStorageProvider | undefined> {
    const key = normalizeObjectKey(userRelPath);
    const originalKey = key.startsWith('smallImage/') ? key.slice('smallImage/'.length) : key;
    const cached = this.storageProviderCache.get(key) ?? this.storageProviderCache.get(originalKey);
    if (cached) return cached;

    for (const table of STORAGE_PROVIDER_TABLES) {
      try {
        const row = await db(table)
          .where('filePath', originalKey)
          .whereNotNull('storageProvider')
          .select('storageProvider')
          .first();
        const provider = normalizeStorageProvider(row?.storageProvider);
        if (provider) {
          this.storageProviderCache.set(originalKey, provider);
          this.storageProviderCache.set(key, provider);
          return provider;
        }
      } catch {
        return undefined;
      }
    }

    return undefined;
  }

  private async resolveStorageProvider(
    userRelPath: string,
    provider?: unknown,
  ): Promise<OssStorageProvider> {
    const explicitProvider = normalizeStorageProvider(provider);
    if (explicitProvider) return explicitProvider;
    const storedProvider = await this.lookupStorageProvider(userRelPath);
    return storedProvider ?? this.provider;
  }

  private getRemoteStorage(provider: OssStorageProvider): RemoteStorage | null {
    if (provider === 'local') return null;
    return this.storages[provider] ?? null;
  }

  private appendStorageProviderQuery(url: string, provider: OssStorageProvider): string {
    if (provider === 'local') return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}${STORAGE_PROVIDER_QUERY_KEY}=${provider}`;
  }

  private async getStoredConfig(): Promise<StoredOssConfig | null> {
    const setting = await db('o_setting').where('key', OSS_CONFIG_SETTING_KEY).first();
    return parseStoredOssConfig(setting?.value);
  }

  private async upsertStoredConfig(config: StoredOssConfig): Promise<void> {
    const value = JSON.stringify(config);
    const exists = await db('o_setting').where('key', OSS_CONFIG_SETTING_KEY).first();
    if (exists) {
      await db('o_setting').where('key', OSS_CONFIG_SETTING_KEY).update({ value });
    } else {
      await db('o_setting').insert({ key: OSS_CONFIG_SETTING_KEY, value });
    }
  }

  async getAdminConfig(): Promise<{ config: AdminOssConfig; runtime: OssRuntimeInfo }> {
    const storedConfig = await this.getStoredConfig();
    return {
      config: toAdminOssConfig(storedConfig),
      runtime: this.getRuntimeInfo(),
    };
  }

  async reloadConfig(): Promise<void> {
    const storedConfig = await this.getStoredConfig();
    const envStorage = createRemoteStorageFromEnv();
    const configuredStorage =
      storedConfig === null
        ? envStorage
        : createRemoteStorageFromStoredConfig(storedConfig);

    this.storages = {};
    if (envStorage) this.storages[envStorage.provider] = envStorage.storage;
    const storedRemote = createRemoteStorageFromStoredConfig(storedConfig);
    if (storedRemote) this.storages[storedRemote.provider] = storedRemote.storage;

    this.provider = configuredStorage?.provider ?? 'local';
    this.remote = configuredStorage?.storage ?? null;
    this.publicBaseUrl = storedConfig?.enabled ? storedConfig.publicBaseUrl : '';
  }

  async saveAdminConfig(input: Record<string, unknown>): Promise<{ config: AdminOssConfig; runtime: OssRuntimeInfo }> {
    const existing = await this.getStoredConfig();
    const nextConfig = normalizeAdminOssConfigInput(input, existing);
    await this.upsertStoredConfig(nextConfig);
    await this.reloadConfig();
    return this.getAdminConfig();
  }

  async testAdminConfig(input: Record<string, unknown>): Promise<OssRuntimeInfo> {
    const existing = await this.getStoredConfig();
    const config = normalizeAdminOssConfigInput(input, existing);
    const configuredStorage = createRemoteStorageFromStoredConfig(config);
    if (!configuredStorage) throw new Error('未启用远程 OSS');
    await configuredStorage.storage.listDirectory('');
    return {
      description: configuredStorage.storage.description,
      provider: configuredStorage.provider,
      remoteEnabled: true,
    };
  }

  /**
   * 等待根目录初始化完成。用于保证所有文件操作在目录已创建后执行。
   * @private
   */
  private async ensureInit() {
    await this.initPromise;
  }

  private async deleteLocalFile(userRelPath: string): Promise<void> {
    await this.ensureInit();
    await fs.unlink(resolveSafeLocalPath(userRelPath, this.rootDir));
  }

  private async deleteLocalDirectory(userRelPath: string): Promise<void> {
    await this.ensureInit();
    const absPath = resolveSafeLocalPath(userRelPath, this.rootDir);
    const stat = await fs.stat(absPath);
    if (!stat.isDirectory()) {
      throw new Error(`${userRelPath} 不是文件夹`);
    }
    await fs.rm(absPath, { recursive: true, force: true });
  }

  private async localFileExists(userRelPath: string): Promise<boolean> {
    await this.ensureInit();
    try {
      const stat = await fs.stat(
        resolveSafeLocalPath(userRelPath, this.rootDir),
      );
      return stat.isFile();
    } catch {
      return false;
    }
  }

  private async readLocalFile(userRelPath: string): Promise<Buffer> {
    await this.ensureInit();
    return fs.readFile(resolveSafeLocalPath(userRelPath, this.rootDir));
  }

  private async writeLocalFile(
    userRelPath: string,
    data: Buffer,
  ): Promise<void> {
    await this.ensureInit();
    const absPath = resolveSafeLocalPath(userRelPath, this.rootDir);
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, data);
  }

  /**
   * 获取指定相对路径文件的访问 URL。
   * @param userRelPath 用户传入的相对文件路径（使用 / 作为分隔符）
   * @returns 文件的 http 链接（本地服务地址）
   */
  async getFileUrl(userRelPath: string, prefix?: string, provider?: OssStorageProvider): Promise<string> {
    if (!prefix) prefix = 'oss';
    await this.ensureInit();
    const safePath = normalizeObjectKey(userRelPath);
    const storageProvider = prefix === 'oss' ? await this.resolveStorageProvider(safePath, provider) : undefined;
    // URL 始终使用 /，所以这里需要将系统分隔符转回 /
    let url = `/${prefix}/`;
    const canUseConfiguredBaseUrl = !storageProvider || storageProvider === this.provider;
    const configuredBaseUrl = canUseConfiguredBaseUrl ? process.env.OSSURL || process.env.ossURL || this.publicBaseUrl : '';
    if (configuredBaseUrl && configuredBaseUrl !== '')
      url = `${configuredBaseUrl.replace(/\/+$/, '')}/${prefix}/`;
    if (process.env.NODE_ENV == 'dev')
      url = `http://localhost:${process.env.PORT || 10588}/${prefix}/`;
    const result = `${url}${safePath}`;
    return storageProvider ? this.appendStorageProviderQuery(result, storageProvider) : result;
  }

  /**
   * 读取指定路径的文件内容为 Buffer。
   * @param userRelPath 用户传入的相对文件路径（使用 / 作为分隔符）
   * @returns 文件内容的 Buffer
   * @throws 路径不在 OSS 根目录内、文件不存在等错误
   */
  async getFile(userRelPath: string, provider?: OssStorageProvider): Promise<Buffer> {
    const storageProvider = await this.resolveStorageProvider(userRelPath, provider);
    const remote = this.getRemoteStorage(storageProvider);
    if (remote) {
      try {
        return await remote.getFile(userRelPath);
      } catch (error) {
        if (!isRemoteNotFoundError(error)) throw error;
      }
    }

    return this.readLocalFile(userRelPath);
  }

  async listDirectory(userRelPath: string): Promise<OssEntry[]> {
    if (!this.remote) throw new Error('当前未启用远程 OSS');
    return this.remote.listDirectory(userRelPath);
  }

  /**
   * 读取图片文件并转换为 base64 编码的 Data URL。
   * @param userRelPath 用户传入的相对文件路径（使用 / 作为分隔符）
   * @returns base64 编码的 Data URL (例如: data:image/png;base64,iVBORw0KGgo...)
   * @throws 路径不在 OSS 根目录内、文件不存在、不是图片文件等错误
   */
  async getImageBase64(userRelPath: string, provider?: OssStorageProvider): Promise<string> {
    const mimeType = getMimeType(userRelPath);
    if (!mimeType) {
      throw new Error(
        `不支持的图片格式: ${path.extname(userRelPath).toLowerCase()}。支持的格式: ${Object.keys(MIME_TYPES).join(', ')}`,
      );
    }

    // 读取文件并转换为 base64
    const data = await this.getFile(userRelPath, provider);
    const base64 = data.toString('base64');

    // 返回完整的 Data URL
    return `data:${mimeType};base64,${base64}`;
  }
  /**
   * 删除指定路径的文件。
   * @param userRelPath 用户传入的相对文件路径（使用 / 作为分隔符）
   * @throws 路径不在 OSS 根目录内、文件不存在等错误
   */
  async deleteFile(userRelPath: string, provider?: OssStorageProvider): Promise<void> {
    const storageProvider = await this.resolveStorageProvider(userRelPath, provider);
    const remote = this.getRemoteStorage(storageProvider);
    if (remote) {
      await remote.deleteFile(userRelPath);
      if (await this.localFileExists(userRelPath))
        await this.deleteLocalFile(userRelPath);
      return;
    }

    await this.deleteLocalFile(userRelPath);
  }

  /**
   * 删除指定路径的文件夹及其所有内容。
   * @param userRelPath 用户传入的相对文件夹路径（使用 / 作为分隔符）
   * @throws 路径不在 OSS 根目录内、文件夹不存在、目标是文件而非文件夹等错误
   */
  async deleteDirectory(userRelPath: string): Promise<void> {
    if (this.remote) {
      await this.remote.deleteDirectory(userRelPath);
      try {
        await this.deleteLocalDirectory(userRelPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      return;
    }

    await this.deleteLocalDirectory(userRelPath);
  }

  /**
   * 将数据写入指定路径的新文件或覆盖已有文件。
   * 写入前自动创建所需的父文件夹。
   * @param userRelPath 用户传入的相对文件路径（使用 / 作为分隔符）
   * @param data 要写入的数据，可以为 Buffer 或字符串
   * @throws 路径不在 OSS 根目录内等错误
   */
  async writeFile(userRelPath: string, data: Buffer | string, provider?: OssStorageProvider): Promise<OssStorageProvider> {
    const buffer = decodeBase64Data(data);
    const storageProvider = normalizeStorageProvider(provider) ?? this.provider;
    const remote = this.getRemoteStorage(storageProvider);

    if (remote) {
      await remote.writeFile(userRelPath, buffer);
      this.rememberStorageProvider(userRelPath, storageProvider);
      return storageProvider;
    }

    await this.writeLocalFile(userRelPath, buffer);
    this.rememberStorageProvider(userRelPath, 'local');
    return 'local';
  }

  /**
   * 检查指定路径文件是否存在。
   * @param userRelPath 用户传入的相对文件路径（使用 / 作为分隔符）
   * @returns 文件存在返回 true，否则 false
   */
  async fileExists(userRelPath: string, provider?: OssStorageProvider): Promise<boolean> {
    const storageProvider = await this.resolveStorageProvider(userRelPath, provider);
    const remote = this.getRemoteStorage(storageProvider);
    if (remote && (await remote.fileExists(userRelPath))) return true;
    return this.localFileExists(userRelPath);
  }

  /**
   * 获取图片的缩略图 URL（最长边不超过 512px，等比缩放）。
   * 缩略图保存在原路径同目录下的 smallImage 子文件夹中。
   * 若缩略图已存在则直接返回其 URL；若不存在则同步生成并保存后返回缩略图 URL，
   * 生成失败时返回原图 URL。
   * @param userRelPath 用户传入的相对文件路径（使用 / 作为分隔符）
   * @returns 缩略图 URL（已存在或生成成功）或原图 URL（生成失败时）
   */
  async getSmallImageUrl(userRelPath: string, provider?: OssStorageProvider): Promise<string> {
    const storageProvider = await this.resolveStorageProvider(userRelPath, provider);
    // 构造缩略图相对路径：在原路径的目录层级前插入 smallImage 目录
    // 例如：123/abc.jpg => smallImage/123/abc.jpg
    const smallImageRelPath = `smallImage/${userRelPath.replace(/^[/\\]+/, '')}`;

    if (await this.fileExists(smallImageRelPath, storageProvider)) {
      return this.getFileUrl(smallImageRelPath, 'oss', storageProvider);
    }

    // 缩略图不存在：同步生成，生成失败则返回原图 URL
    const originalUrl = await this.getFileUrl(userRelPath, 'oss', storageProvider);

    try {
      const source = this.getRemoteStorage(storageProvider)
        ? await this.getFile(userRelPath, storageProvider)
        : resolveSafeLocalPath(userRelPath, this.rootDir);
      const output = await sharp(source)
        .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
        .toBuffer();
      await this.writeFile(smallImageRelPath, output, storageProvider);
      console.info(`[${smallImageRelPath}]小图写入成功`);
      return this.getFileUrl(smallImageRelPath, 'oss', storageProvider);
    } catch (e) {
      // 生成失败返回原图
      console.warn('[OSS] 生成缩略图失败:', e);
      return originalUrl;
    }
  }
}

export default new OSS();

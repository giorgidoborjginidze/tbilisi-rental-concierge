// Where the owner's files live. In production: a private Vercel Blob store
// (BLOB_READ_WRITE_TOKEN, set when the store is connected to the project) —
// nothing in it has a public address; the app reads each file with the
// store token and hands it only to its owner (app/api/files/[id]).
// On a developer machine without the token, FILES_LOCAL_DIR keeps them in
// a folder instead. With neither, uploads are "not configured" and the
// page says so.

import { promises as fs } from "node:fs";
import path from "node:path";
import { del, get, list, put } from "@vercel/blob";

export interface StoredFile {
  stream: ReadableStream<Uint8Array>;
  contentType: string;
  size: number;
}

export interface FileStore {
  put(pathname: string, body: Buffer, contentType: string): Promise<void>;
  get(pathname: string): Promise<StoredFile | null>;
  del(pathnames: string[]): Promise<void>;
  /** Every pathname under the prefix. */
  list(prefix: string): Promise<{ pathname: string; uploadedAt: Date }[]>;
}

const blobStore: FileStore = {
  async put(pathname, body, contentType) {
    await put(pathname, body, { access: "private", contentType, addRandomSuffix: false, allowOverwrite: false });
  },
  async get(pathname) {
    const result = await get(pathname, { access: "private" });
    if (!result || result.statusCode !== 200) return null;
    return { stream: result.stream, contentType: result.blob.contentType, size: result.blob.size };
  },
  async del(pathnames) {
    if (pathnames.length) await del(pathnames);
  },
  async list(prefix) {
    const out: { pathname: string; uploadedAt: Date }[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix, cursor, limit: 1000 });
      out.push(...page.blobs.map((blob) => ({ pathname: blob.pathname, uploadedAt: blob.uploadedAt })));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return out;
  },
};

function diskStore(root: string): FileStore {
  const full = (pathname: string) => {
    const target = path.resolve(root, pathname);
    if (!target.startsWith(path.resolve(root) + path.sep)) throw new Error("bad path");
    return target;
  };
  return {
    async put(pathname, body, contentType) {
      const target = full(pathname);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, body, { flag: "wx" });
      await fs.writeFile(`${target}.type`, contentType);
    },
    async get(pathname) {
      const target = full(pathname);
      const body = await fs.readFile(target).catch(() => null);
      if (!body) return null;
      const contentType = await fs.readFile(`${target}.type`, "utf8").catch(() => "application/octet-stream");
      return { stream: new Blob([new Uint8Array(body)]).stream(), contentType, size: body.length };
    },
    async del(pathnames) {
      for (const pathname of pathnames) {
        await fs.rm(full(pathname), { force: true });
        await fs.rm(`${full(pathname)}.type`, { force: true });
      }
    },
    async list(prefix) {
      const out: { pathname: string; uploadedAt: Date }[] = [];
      const walk = async (dir: string) => {
        for (const entry of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
          const target = path.join(dir, entry.name);
          if (entry.isDirectory()) await walk(target);
          else if (!entry.name.endsWith(".type")) {
            const pathname = path.relative(root, target).split(path.sep).join("/");
            if (pathname.startsWith(prefix)) out.push({ pathname, uploadedAt: (await fs.stat(target)).mtime });
          }
        }
      };
      await walk(root);
      return out;
    },
  };
}

/** The configured store, or null when files cannot be kept here. */
export function fileStore(): FileStore | null {
  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) return blobStore;
  const local = process.env.FILES_LOCAL_DIR?.trim();
  return local ? diskStore(path.resolve(local)) : null;
}

export const filesConfigured = (): boolean => fileStore() != null;

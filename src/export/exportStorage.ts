/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BufferTarget, StreamTarget, type StreamTargetChunk } from "mediabunny";

export const EXPORT_FILE_PREFIX = "coachclip-export-";

export type ExportSink = {
  kind: "opfs" | "memory";
  target: StreamTarget | BufferTarget;
  fastStart: false | "in-memory";
  getFile: (fileName: string) => Promise<File>;
  discard: () => Promise<void>;
};

type DirectoryWithKeys = FileSystemDirectoryHandle & { keys(): AsyncIterable<string> };

const supportsOpfsWritable = () =>
  typeof navigator !== "undefined" &&
  !!navigator.storage?.getDirectory &&
  typeof FileSystemFileHandle !== "undefined" &&
  "createWritable" in FileSystemFileHandle.prototype;

function createMemorySink(): ExportSink {
  const target = new BufferTarget();
  return {
    kind: "memory",
    target,
    fastStart: "in-memory",
    getFile: async (fileName) => {
      if (!target.buffer) throw new Error("Export buffer is empty");
      return new File([target.buffer], fileName, { type: "video/mp4" });
    },
    discard: async () => {},
  };
}

export async function createExportSink(options: { forceMemory?: boolean } = {}): Promise<ExportSink> {
  if (options.forceMemory || !supportsOpfsWritable()) return createMemorySink();

  const root = await navigator.storage.getDirectory();
  const name = `${EXPORT_FILE_PREFIX}${crypto.randomUUID()}.mp4`;
  const handle = await root.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  let closed = false;

  const stream = new WritableStream<StreamTargetChunk>({
    write: (chunk) => writable.write({ type: "write", position: chunk.position, data: chunk.data }),
    close: async () => {
      closed = true;
      await writable.close();
    },
    abort: async () => {
      closed = true;
      await writable.abort();
    },
  });

  return {
    kind: "opfs",
    target: new StreamTarget(stream, { chunked: true }),
    fastStart: false,
    getFile: async (fileName) => new File([await handle.getFile()], fileName, { type: "video/mp4" }),
    discard: async () => {
      if (!closed) await writable.abort().catch(() => {});
      await root.removeEntry(name).catch(() => {});
    },
  };
}

export async function listExportFiles(): Promise<string[]> {
  if (!supportsOpfsWritable()) return [];
  const root = (await navigator.storage.getDirectory()) as DirectoryWithKeys;
  const names: string[] = [];
  for await (const name of root.keys()) {
    if (name.startsWith(EXPORT_FILE_PREFIX)) names.push(name);
  }
  return names;
}

export async function clearExportFiles(): Promise<void> {
  if (!supportsOpfsWritable()) return;
  const root = await navigator.storage.getDirectory();
  for (const name of await listExportFiles()) {
    await root.removeEntry(name).catch(() => {});
  }
}

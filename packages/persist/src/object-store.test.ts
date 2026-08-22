import { describe, expect, it } from "vitest";
import { MemoryObjectStore, UnboundObjectStore } from "./object-store.js";

describe("object store port", () => {
  it("stores bytes, returns a checksum, and can erase", async () => {
    const store = new MemoryObjectStore();
    const put = await store.put({
      key: "demo/unbox.mp4",
      bytes: new TextEncoder().encode("not-a-real-video"),
      contentType: "video/mp4",
    });
    expect(put.uri).toBe("s3://example-refund-artifacts/demo/unbox.mp4");
    expect(put.sha256).toHaveLength(64);
    expect((await store.head(put.uri)).exists).toBe(true);
    await store.erase(put.uri);
    expect((await store.head(put.uri)).exists).toBe(false);
  });

  it("leaves put unbound until a bucket is configured", async () => {
    await expect(
      new UnboundObjectStore().put({
        key: "x",
        bytes: new Uint8Array(),
        contentType: "application/octet-stream",
      }),
    ).rejects.toThrow(/not bound/);
  });
});

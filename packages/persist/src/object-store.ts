import { createHash } from "node:crypto";
import { ValidationError } from "@refund/domain";

export interface StoredObject {
  uri: string;
  sha256: string;
  contentType: string;
  bytes: Uint8Array;
}

export interface ObjectStore {
  put(input: { key: string; bytes: Uint8Array; contentType: string }): Promise<{
    uri: string;
    sha256: string;
  }>;
  head(uri: string): Promise<{ exists: boolean; sha256?: string }>;
  erase(uri: string): Promise<void>;
}

export class MemoryObjectStore implements ObjectStore {
  private readonly objects = new Map<string, StoredObject>();

  constructor(private readonly bucket = "s3://example-refund-artifacts") {}

  async put(input: { key: string; bytes: Uint8Array; contentType: string }) {
    if (!input.key || input.key.includes("..")) {
      throw new ValidationError("object key is invalid");
    }
    const uri = `${this.bucket.replace(/\/$/, "")}/${input.key.replace(/^\//, "")}`;
    const sha256 = createHash("sha256").update(input.bytes).digest("hex");
    this.objects.set(uri, { uri, sha256, contentType: input.contentType, bytes: input.bytes });
    return { uri, sha256 };
  }

  async head(uri: string) {
    const found = this.objects.get(uri);
    return found ? { exists: true, sha256: found.sha256 } : { exists: false };
  }

  async erase(uri: string) {
    this.objects.delete(uri);
  }
}

export class UnboundObjectStore implements ObjectStore {
  async put(_input: { key: string; bytes: Uint8Array; contentType: string }): Promise<{
    uri: string;
    sha256: string;
  }> {
    throw new Error("object store is not bound; set OBJECT_STORE_BUCKET via secret manager");
  }

  async head(_uri: string): Promise<{ exists: boolean; sha256?: string }> {
    return { exists: false };
  }

  async erase(_uri: string): Promise<void> {
    return;
  }
}

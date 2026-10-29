import { describe, expect, it } from "vitest";
import { inspectMarketGlb, marketPrivateReference, MAX_MARKET_GLB_BYTES } from "./glb-validation";
function glb(document:unknown):Uint8Array {
  const json=JSON.stringify(document);
  const encoded=new TextEncoder().encode(json);
  const padded=(encoded.length+3)&~3;
  const bytes=new Uint8Array(20+padded);
  const v=new DataView(bytes.buffer);
  v.setUint32(0,0x46546c67,true);
  v.setUint32(4,2,true);
  v.setUint32(8,bytes.length,true);
  v.setUint32(12,padded,true);
  v.setUint32(16,0x4e4f534a,true);
  bytes.fill(0x20,20);bytes.set(encoded,20);
  return bytes;
}
describe("private marketplace GLB ingestion contract",()=>{
  it("accepts complete self-contained glTF2 binary",()=>{
    expect(inspectMarketGlb(glb({asset:{version:"2.0"},scenes:[{}],nodes:[{},{}]})))
      .toEqual({byteSize:80,sceneCount:1,nodeCount:2});
  });
  it("rejects corrupt header, truncated chunk and mismatched total length",()=>{
    const bytes=glb({asset:{version:"2.0"}});
    bytes[0]=0;
    expect(()=>inspectMarketGlb(bytes)).toThrow(/version 2/);
    const bad=glb({asset:{version:"2.0"}});
    new DataView(bad.buffer).setUint32(8,1000,true);
    expect(()=>inspectMarketGlb(bad)).toThrow(/header length/);
    const chunk=glb({asset:{version:"2.0"}});
    new DataView(chunk.buffer).setUint32(12,1000,true);
    expect(()=>inspectMarketGlb(chunk)).toThrow(/chunk size/);
  });
  it("rejects external model resources and invalid glTF declared version",()=>{
    expect(()=>inspectMarketGlb(glb({asset:{version:"2.0"},images:[{uri:"https://evil.example/track.png"}]})))
      .toThrow(/external resources/);
    expect(()=>inspectMarketGlb(glb({asset:{version:"1.0"}}))).toThrow(/glTF 2/);
    expect(MAX_MARKET_GLB_BYTES).toBe(20*1024*1024);
  });
  it("only creates internal private file references from safe ids",()=>{
    expect(marketPrivateReference("12345678abcdef")).toBe("/api/marketplace/files/12345678abcdef");
    expect(()=>marketPrivateReference("../secrets")).toThrow();
  });
});

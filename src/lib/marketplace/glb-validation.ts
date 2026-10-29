/**
 * Small, self-contained GLB v2 validation gate for the private-file pilot.
 * Format validation is not malware scanning, rendering certification, or proof
 * of intellectual-property ownership. Production ingestion needs all three.
 */
export const MAX_MARKET_GLB_BYTES = 20 * 1024 * 1024;

export function inspectMarketGlb(bytes: Uint8Array): {byteSize:number;sceneCount:number;nodeCount:number} {
  if(bytes.length<20 || bytes.length>MAX_MARKET_GLB_BYTES) throw new Error("Choose a GLB file between 20 bytes and 20 MB.");
  const view = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(view.getUint32(0,true)!==0x46546c67 || view.getUint32(4,true)!==2)
    throw new Error("Only GLB version 2 files are supported.");
  if(view.getUint32(8,true)!==bytes.byteLength)
    throw new Error("GLB header length does not match the supplied file.");
  let offset=12;
  let json:unknown=null;
  let binChunks=0;
  while(offset<bytes.length){
    if(offset+8>bytes.length)throw new Error("Incomplete GLB chunk header.");
    const length=view.getUint32(offset,true);
    const type=view.getUint32(offset+4,true);
    if(length%4!==0 || offset+8+length>bytes.length)throw new Error("Invalid GLB chunk size.");
    if(type===0x4e4f534a){
      if(json!==null || offset!==12)throw new Error("GLB must begin with one JSON chunk.");
      try{json=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes.subarray(offset+8,offset+8+length)).trim());}
      catch{throw new Error("Invalid GLB JSON chunk.");}
    }else if(type===0x004e4942){binChunks++;}
    offset+=8+length;
  }
  if(!json || typeof json!=="object" || Array.isArray(json))throw new Error("Missing GLB JSON scene.");
  const doc=json as Record<string,unknown>;
  const asset=doc.asset;
  if(!asset || typeof asset!=="object" || (asset as Record<string,unknown>).version!=="2.0")
    throw new Error("GLB asset must declare glTF 2.0.");
  // Prevent models from auto-fetching arbitrary external textures, buffers or scripts.
  for(const section of ["buffers","images"]){
    const entries=doc[section];
    if(entries!==undefined && !Array.isArray(entries))throw new Error("Invalid "+section+" section.");
    for(const value of Array.isArray(entries)?entries:[]){
      if(!value || typeof value!=="object")throw new Error("Invalid "+section+" entry.");
      if(typeof (value as Record<string,unknown>).uri==="string")
        throw new Error("Pack all images and buffers inside the GLB; external resources are not allowed.");
    }
  }
  if(binChunks>1)throw new Error("Only a single GLB binary chunk is supported.");
  const nodes=Array.isArray(doc.nodes)?doc.nodes:[];
  const scenes=Array.isArray(doc.scenes)?doc.scenes:[];
  if(nodes.length>10000 || scenes.length>200)throw new Error("The model is too complex for the pilot viewer.");
  return {byteSize:bytes.length,sceneCount:scenes.length,nodeCount:nodes.length};
}

export function marketPrivateReference(fileId:string):string{
  if(!/^[a-z0-9_-]{8,80}$/i.test(fileId))throw new Error("Invalid file identifier.");
  return "/api/marketplace/files/"+fileId;
}

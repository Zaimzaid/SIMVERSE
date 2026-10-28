import {describe,expect,it} from "vitest";
import {saveAnimationSchema,STARTER_ANIMATION} from "./editor";
describe("V2 Avatar / camera / dialogue schema",()=>{
 const base=()=>({...structuredClone(STARTER_ANIMATION),
    scene:{...structuredClone(STARTER_ANIMATION.scene),mode:"3D" as const,
      avatar:{skin:"#c08b6d",outfit:"#04bbaa",hair:"#141414",height:1,hairstyle:"SHORT" as const},
      cameraFrames:[{t:0,yaw:0,pitch:10,distance:6},{t:5000,yaw:50,pitch:20,distance:5}],
      dialogue:{text:"Hello SIMVERSE",startMs:500,endMs:4500}}});
 it("allows old V1 scenes alongside camera-directed V2 scenes",()=>{
   expect(saveAnimationSchema.safeParse(STARTER_ANIMATION).success).toBe(true);
   expect(saveAnimationSchema.safeParse(base()).success).toBe(true);
 });
 it("rejects camera keys out of order or dialogue outside duration",()=>{
   const bad=base();bad.scene.cameraFrames[1]!.t=0;
   expect(saveAnimationSchema.safeParse(bad).success).toBe(false);
   const badDialogue=base();badDialogue.scene.dialogue.endMs=5001;
   expect(saveAnimationSchema.safeParse(badDialogue).success).toBe(false);
 });
});
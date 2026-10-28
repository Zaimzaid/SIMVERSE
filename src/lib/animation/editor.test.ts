import { describe,expect,it } from "vitest";
import { saveAnimationSchema, STARTER_ANIMATION, sampleAnimation } from "./editor";
describe("Animation Studio keyframes",()=>{
  it("interpolates positions, rotation and scale precisely",()=>{
    const f=STARTER_ANIMATION.scene.actors[0]!.frames;
    expect(sampleAnimation(f,2500)).toEqual({t:2500,x:50,y:54,rotation:180,scale:1.125});
    expect(sampleAnimation(f,0).x).toBe(16);
    expect(sampleAnimation(f,7000).x).toBe(84);
  });
  it("rejects non-monotonic, malformed or out-of-duration keyframes",()=>{
    expect(saveAnimationSchema.safeParse(STARTER_ANIMATION).success).toBe(true);
    const bad=structuredClone(STARTER_ANIMATION);
    bad.scene.actors[0]!.frames[1]!.t=0;
    expect(saveAnimationSchema.safeParse(bad).success).toBe(false);
    const invalid=structuredClone(STARTER_ANIMATION);
    invalid.scene.actors[0]!.frames[1]!.x=200;
    expect(saveAnimationSchema.safeParse(invalid).success).toBe(false);
  });
});
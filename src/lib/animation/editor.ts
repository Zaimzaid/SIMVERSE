import { z } from "zod";

export const frameSchema = z.object({
  t: z.number().int().min(0).max(60000),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  rotation: z.number().min(-360).max(360),
  scale: z.number().min(0.2).max(3),
}).strict();
export const actorSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{0,30}$/),
  name: z.string().trim().min(1).max(50),
  shape: z.enum(["CIRCLE", "SQUARE", "TRIANGLE"]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  frames: z.array(frameSchema).min(2).max(32),
}).strict();
export const animationSceneSchema = z.object({
  version: z.literal(1),
  background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  actors: z.array(actorSchema).min(1).max(6),
}).strict();
export const saveAnimationSchema = z.object({
  title: z.string().trim().min(2).max(100),
  durationMs: z.number().int().min(1000).max(60000),
  scene: animationSceneSchema,
}).strict().superRefine(({ durationMs, scene }, context) => {
  const ids = new Set<string>();
  scene.actors.forEach((actor, i) => {
    if (ids.has(actor.id)) context.addIssue({ code: "custom", path: ["scene","actors",i,"id"], message:"Actor identifiers must be unique." });
    ids.add(actor.id);
    for (let j=0;j<actor.frames.length;j++) {
      const frame=actor.frames[j]!;
      if (frame.t>durationMs) context.addIssue({code:"custom",path:["scene","actors",i,"frames",j,"t"],message:"Keyframe exceeds duration."});
      if (j && frame.t<=actor.frames[j-1]!.t) context.addIssue({code:"custom",path:["scene","actors",i,"frames",j,"t"],message:"Keyframe times must increase."});
    }
  });
});

export type AnimationScene = z.infer<typeof animationSceneSchema>;
export type AnimationActor = AnimationScene["actors"][number];
export type AnimationFrame = AnimationActor["frames"][number];
export type AnimationDraft = z.infer<typeof saveAnimationSchema>;

export const STARTER_ANIMATION: AnimationDraft = {
  title: "My first animated scene",
  durationMs: 5000,
  scene: { version: 1, background: "#13263d", actors: [
    { id: "hero", name: "Hero", shape: "CIRCLE", color: "#35d3c1",
      frames: [{t:0,x:16,y:54,rotation:0,scale:1},{t:5000,x:84,y:54,rotation:360,scale:1.25}] },
  ] },
};
export function sampleAnimation(frames: readonly AnimationFrame[], milliseconds: number): AnimationFrame {
  const first=frames[0]!;
  if (milliseconds<=first.t) return {...first};
  const last=frames[frames.length-1]!;
  if(milliseconds>=last.t) return {...last};
  const i=frames.findIndex(f=>f.t>=milliseconds);
  const before=frames[i-1]!,after=frames[i]!;
  const alpha=(milliseconds-before.t)/(after.t-before.t);
  return {
    t: milliseconds,
    x: before.x+(after.x-before.x)*alpha,
    y: before.y+(after.y-before.y)*alpha,
    rotation: before.rotation+(after.rotation-before.rotation)*alpha,
    scale: before.scale+(after.scale-before.scale)*alpha,
  };
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Mic, MicOff, Phone, PhoneOff, Video, X } from "lucide-react";
import { apiFetch } from "@/lib/client/api";
import { Button } from "@/components/ui/button";

type Friend = { id: string; name: string };
type Signal = {
  id: string; senderId: string; callId: string;
  kind: "OFFER" | "ANSWER" | "ICE" | "HANGUP"; payload: string; createdAt: string;
};
type Incoming = { peer: string; callId: string; offer: RTCSessionDescriptionInit; video: boolean };
type Mode = "VOICE" | "VIDEO";
type CallRequest = { peerId: string; mode: Mode; nonce: number } | null;

/** One persistent signaling listener for the Community page. Only the remote
 * participant is presented in the call window; own camera stays hidden.
 * WebRTC remains STUN-only and needs two active browsers on compatible networks.
 */
export function PeerCallDock({
  userId, friends, request,
}: { userId: string; friends: Friend[]; request?: CallRequest }) {
  const [mode, setMode] = useState<Mode>("VOICE");
  const [status, setStatus] = useState("Idle");
  const [incoming, setIncoming] = useState<Incoming | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const remoteVideo = useRef<HTMLVideoElement | null>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const call = useRef<{ callId: string; peer: string } | null>(null);
  const pending = useRef<RTCIceCandidateInit[]>([]);
  const after = useRef(new Date(Date.now() - 12000).toISOString());
  const seen = useRef(new Set<string>());
  const busy = useRef(false);
  const name = (id: string) => friends.find(f => f.id === id)?.name ?? "SIMVERSE friend";

  async function post(receiverId: string, callId: string, kind: Signal["kind"], payload: unknown) {
    const r = await apiFetch("/api/social/calls", {
      method: "POST", body: JSON.stringify({ receiverId, callId, kind, payload: JSON.stringify(payload) }),
    });
    if (r.error) throw new Error(r.error.message);
  }
  function release() {
    pc.current?.close(); pc.current = null;
    localStream.current?.getTracks().forEach(track => track.stop()); localStream.current = null;
    if (remoteVideo.current) remoteVideo.current.srcObject = null;
    call.current = null; pending.current = [];
    setActive(false); setIncoming(null); setStatus("Idle"); busy.current = false;
    setMuted(false); setCameraOn(false);
  }
  async function hangup() {
    const current = call.current;
    if (current) await post(current.peer, current.callId, "HANGUP", {}).catch(() => undefined);
    release();
  }
  useEffect(() => () => {
    pc.current?.close(); localStream.current?.getTracks().forEach(track => track.stop());
  }, []);

  async function configure(peerId: string, callId: string, useVideo: boolean) {
    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection)
      throw new Error("Calls require microphone/camera permission and WebRTC on HTTPS or localhost.");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: useVideo });
    localStream.current = stream;
    const connection = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    pc.current = connection; call.current = { peer: peerId, callId };
    setMode(useVideo ? "VIDEO" : "VOICE"); setCameraOn(useVideo); setMuted(false);
    stream.getTracks().forEach(track => connection.addTrack(track, stream));
    connection.ontrack = event => {
      const remote = event.streams[0];
      if (remoteVideo.current && remote) {
        remoteVideo.current.srcObject = remote;
        void remoteVideo.current.play().catch(() => setStatus("Tap the call window if remote playback is blocked."));
      }
    };
    connection.onicecandidate = event => {
      if (event.candidate)
        void post(peerId, callId, "ICE", event.candidate.toJSON()).catch(e => setError(String(e)));
    };
    connection.onconnectionstatechange = () => {
      if (connection.connectionState === "connected") setStatus("Connected");
      if (["failed", "closed", "disconnected"].includes(connection.connectionState))
        setStatus("Connection interrupted");
    };
    setActive(true);
    return connection;
  }

  async function startCall(peerId: string, callMode: Mode) {
    if (busy.current || !peerId || pc.current || incoming) return;
    if (!friends.some(f => f.id === peerId)) { setError("Select an accepted friend before calling."); return; }
    busy.current = true; setError(""); setStatus("Requesting microphone/camera access");
    const id = crypto.randomUUID();
    try {
      const connection = await configure(peerId, id, callMode === "VIDEO");
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      await post(peerId, id, "OFFER", { description: offer, video: callMode === "VIDEO" });
      setStatus("Ringing — waiting for your friend to answer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Call setup failed"); release();
    } finally { busy.current = false; }
  }
  const startRef = useRef(startCall);
  startRef.current = startCall;
  useEffect(() => {
    if (request) void startRef.current(request.peerId, request.mode);
  }, [request]);

  async function accept() {
    if (!incoming || busy.current) return;
    busy.current = true; setError("");
    try {
      const connection = await configure(incoming.peer, incoming.callId, incoming.video);
      await connection.setRemoteDescription(incoming.offer);
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      await post(incoming.peer, incoming.callId, "ANSWER", answer);
      setIncoming(null); setStatus("Connecting");
      for (const ice of pending.current) await connection.addIceCandidate(ice).catch(() => undefined);
      pending.current = [];
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not answer call"); release();
    } finally { busy.current = false; }
  }
  async function decline() {
    if (!incoming) return;
    const current = incoming;
    await post(current.peer, current.callId, "HANGUP", {}).catch(() => undefined);
    release();
  }
  async function receive(signal: Signal) {
    if (!friends.some(f => f.id === signal.senderId) || seen.current.has(signal.id)) return;
    seen.current.add(signal.id);
    try {
      if (signal.kind === "OFFER") {
        if (pc.current || call.current || incoming) return;
        const value = JSON.parse(signal.payload) as { description: RTCSessionDescriptionInit; video: boolean };
        if (value.description?.type !== "offer") return;
        setMode(value.video ? "VIDEO" : "VOICE");
        setIncoming({ peer: signal.senderId, callId: signal.callId, offer: value.description, video: Boolean(value.video) });
        setStatus("Incoming call"); return;
      }
      if (signal.kind === "HANGUP") {
        if (call.current?.callId === signal.callId || incoming?.callId === signal.callId) release();
        return;
      }
      if (call.current?.callId !== signal.callId || call.current.peer !== signal.senderId) return;
      if (signal.kind === "ANSWER" && pc.current) {
        const description = JSON.parse(signal.payload) as RTCSessionDescriptionInit;
        if (description.type !== "answer") return;
        await pc.current.setRemoteDescription(description);
        for (const ice of pending.current) await pc.current.addIceCandidate(ice).catch(() => undefined);
        pending.current = []; setStatus("Connecting");
      }
      if (signal.kind === "ICE") {
        const ice = JSON.parse(signal.payload) as RTCIceCandidateInit;
        if (pc.current?.remoteDescription) await pc.current.addIceCandidate(ice).catch(() => undefined);
        else pending.current.push(ice);
      }
    } catch { setError("A call signaling message could not be processed."); }
  }
  const receiveRef = useRef(receive);
  receiveRef.current = receive;
  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      const r = await apiFetch<{ signals: Signal[] }>(`/api/social/calls?after=${encodeURIComponent(after.current)}`);
      if (!mounted || !r.data) return;
      for (const signal of r.data.signals) {
        if (signal.createdAt > after.current) after.current = signal.createdAt;
        await receiveRef.current(signal);
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 2500);
    return () => { mounted = false; window.clearInterval(timer); };
  }, []);

  function toggleMute() {
    const next = !muted;
    localStream.current?.getAudioTracks().forEach(track => { track.enabled = !next; });
    setMuted(next);
  }
  function toggleCamera() {
    const next = !cameraOn;
    localStream.current?.getVideoTracks().forEach(track => { track.enabled = next; });
    setCameraOn(next);
  }
  const peerId = incoming?.peer ?? call.current?.peer;
  const peerName = peerId ? name(peerId) : "SIMVERSE friend";
  const visible = active || Boolean(incoming);

  return <>
    {error && !visible && <div role="alert" className="fixed bottom-4 right-4 z-[90] max-w-sm rounded-xl border border-red-500/50 bg-surface p-4 text-sm shadow-xl">
      <div className="flex items-start gap-3"><span className="flex-1">{error}</span>
        <button aria-label="Dismiss call error" onClick={() => setError("")}><X className="size-4" /></button></div>
    </div>}
    <div className={`fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6 ${visible ? "" : "pointer-events-none invisible"}`}
      aria-hidden={!visible}>
      <div className="absolute inset-0 bg-[#020917]/90 backdrop-blur-xl" />
      <section role="dialog" aria-modal={visible} aria-label="SIMVERSE call"
        className="relative flex h-[min(90dvh,820px)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-700 bg-[#0b1524] text-white shadow-2xl">
        <header className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <span className="grid size-10 place-items-center rounded-full bg-cyan-700/30"><Video className="size-5 text-cyan-300" /></span>
          <div className="min-w-0 flex-1"><h2 className="truncate text-lg font-bold">{peerName}</h2>
            <p role="status" className="text-xs text-slate-300">{incoming ? `Incoming ${incoming.video ? "video" : "voice"} call` : status}</p>
          </div>
          {!incoming && active && <span className="rounded-full bg-cyan-950 px-3 py-1 text-xs text-cyan-200">{mode === "VIDEO" ? "Video" : "Voice"} call</span>}
        </header>
        <div className="relative grid min-h-0 flex-1 place-items-center overflow-hidden bg-gradient-to-br from-[#0b1d32] to-[#020611]">
          <video ref={remoteVideo} playsInline autoPlay
            className={`absolute inset-0 size-full object-contain ${active && mode === "VIDEO" ? "" : "invisible"}`}
            aria-label="Remote participant video" />
          {(incoming || mode === "VOICE") && <div className="z-10 text-center">
            <div className="mx-auto mb-5 grid size-28 place-items-center rounded-full bg-cyan-900 text-5xl font-semibold text-cyan-100">{peerName.slice(0, 1).toUpperCase()}</div>
            <p className="text-lg font-semibold">{peerName}</p>
            <p className="mt-2 text-sm text-slate-300">{incoming ? "Calling you…" : status}</p>
          </div>}
          {active && mode === "VIDEO" && <p className="pointer-events-none absolute bottom-4 left-4 rounded-lg bg-black/40 px-3 py-2 text-xs text-white/80">
            Other participant’s camera · Your camera preview is hidden
          </p>}
        </div>
        {error && <p role="alert" className="bg-red-950 px-5 py-2 text-sm text-red-200">{error}</p>}
        <footer className="flex flex-wrap items-center justify-center gap-3 border-t border-white/10 p-4">
          {incoming ? <>
            <Button onClick={() => void accept()}><Phone className="size-4" /> Answer</Button>
            <Button variant="danger" onClick={() => void decline()}><PhoneOff className="size-4" /> Decline</Button>
          </> : active ? <>
            <button type="button" onClick={toggleMute} aria-label={muted ? "Unmute microphone" : "Mute microphone"}
              className="flex flex-col items-center gap-1 rounded-xl bg-white/10 px-5 py-3 text-xs hover:bg-white/20">
              {muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}{muted ? "Unmute" : "Mute"}
            </button>
            {mode === "VIDEO" && <button type="button" onClick={toggleCamera} aria-label={cameraOn ? "Turn camera off" : "Turn camera on"}
              className="flex flex-col items-center gap-1 rounded-xl bg-white/10 px-5 py-3 text-xs hover:bg-white/20">
              {cameraOn ? <Camera className="size-5" /> : <CameraOff className="size-5" />}{cameraOn ? "Camera off" : "Camera on"}
            </button>}
            <Button variant="danger" onClick={() => void hangup()}><PhoneOff className="size-4" /> End call</Button>
          </> : null}
        </footer>
        <p className="px-4 pb-3 text-center text-[11px] text-slate-400">Pilot calling requires both participants online. STUN-only connectivity may fail across some networks.</p>
      </section>
    </div>
  </>;
}

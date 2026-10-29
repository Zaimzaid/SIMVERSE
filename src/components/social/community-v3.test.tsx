import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CommunityV3 } from "./community-v3";

vi.mock("./peer-call-dock", () => ({ PeerCallDock: () => null }));

const empty = {
  friends: [],
  incoming: [],
  outgoing: [],
  blockedIds: [],
  blocked: [],
};

describe("SIMVERSE welcoming messaging layout", () => {
  it("offers a clear inbox, compact navigation, search and friendly first-use guidance", () => {
    const html = renderToStaticMarkup(<CommunityV3 initial={empty} userId="player-1" />);
    expect(html).toContain("Friends &amp; Messages");
    expect(html).toContain('aria-label="Messaging navigation and conversations"');
    expect(html).toContain('aria-label="Messaging workspace"');
    expect(html).toContain('aria-label="Messaging sections"');
    expect(html).toContain('placeholder="Search your conversations"');
    expect(html).toContain("All chats");
    expect(html).toContain("Unread");
    expect(html).toContain("Your conversations start here");
    expect(html).toContain("A little hello goes a long way");
    expect(html).toContain("Find a player");
    expect(html).toContain("md:grid-cols-");
  });

  it("opens deep-linked accepted friends in the chat pane with mobile back navigation", () => {
    const accepted = {
      ...empty,
      friends: [{
        id: "friendship-1",
        other: {
          id: "player-2",
          displayName: "Alex Example",
          avatarUrl: null,
          playerIdentity: { username: "alex_example" },
        },
      }],
    };
    const html = renderToStaticMarkup(
      <CommunityV3 initial={accepted} userId="player-1" initialPeerId="player-2" />,
    );
    expect(html).toContain('aria-label="Conversation"');
    expect(html).toContain('aria-label="Back to recent conversations"');
    expect(html).toContain('aria-label="Write a message"');
    expect(html).toContain('aria-label="Voice call Alex Example"');
    expect(html).toContain('aria-label="Video call Alex Example"');
    expect(html).toContain("Say hello to Alex Example");
  });
});

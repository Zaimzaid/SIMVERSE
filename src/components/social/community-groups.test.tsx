import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CommunityGroups } from "./community-groups";

describe("SIMVERSE private groups layout", () => {
  it("gives new players clear creation and invitation guidance", () => {
    const html = renderToStaticMarkup(<CommunityGroups userId="player-1" friends={[]} />);
    expect(html).toContain('aria-label="SIMVERSE group conversations"');
    expect(html).toContain("Your groups");
    expect(html).toContain("Create a group");
    expect(html).toContain("Welcome to Groups");
    expect(html).toContain("Invite accepted friends");
    expect(html).toContain('placeholder="Search groups"');
    expect(html).toContain("Conversations");
  });

  it("offers a compact create action and preserves invite-only boundaries", () => {
    const html = renderToStaticMarkup(<CommunityGroups userId="player-1" friends={[
      {id:"friend-1",other:{id:"player-2",displayName:"Friendly Player"}},
    ]}/>);
    expect(html).toContain('aria-label="Create a group"');
    expect(html).toContain("Private");
    expect(html).toContain("Start a private space");
    expect(html).not.toContain("Public group directory");
  });
});

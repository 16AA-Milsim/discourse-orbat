# frozen_string_literal: true

describe "ORBAT cache invalidation events" do
  fab!(:user) { Fabricate(:user) }
  fab!(:badge) { Fabricate(:badge) }
  fab!(:user_badge) { Fabricate(:user_badge, user: user, badge: badge) }

  before do
    enable_current_plugin
  end

  it "clears ORBAT cache when a badge is granted" do
    expect(::Orbat::Service).to receive(:clear_cache).at_least(:once)
    DiscourseEvent.trigger(:user_badge_granted, badge.id, user.id)
  end

  it "clears ORBAT cache when a badge is revoked" do
    expect(::Orbat::Service).to receive(:clear_cache).at_least(:once)
    DiscourseEvent.trigger(:user_badge_revoked, user_badge: user_badge)
  end
end

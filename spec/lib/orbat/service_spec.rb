# frozen_string_literal: true

describe "Orbat::Service" do
  fab!(:public_group_user) { Fabricate(:user) }
  fab!(:members_only_user) { Fabricate(:user) }
  fab!(:public_group) do
    Fabricate(
      :group,
      name: "orbat_public_group",
      visibility_level: Group.visibility_levels[:public],
      members_visibility_level: Group.visibility_levels[:public],
    )
  end
  fab!(:members_only_group) do
    Fabricate(
      :group,
      name: "orbat_members_only_group",
      visibility_level: Group.visibility_levels[:public],
      members_visibility_level: Group.visibility_levels[:members],
    )
  end

  fab!(:limited_group_user_one) { Fabricate(:user) }
  fab!(:limited_group_user_two) { Fabricate(:user) }
  fab!(:limited_group) do
    Fabricate(
      :group,
      name: "orbat_limit_group",
      visibility_level: Group.visibility_levels[:public],
      members_visibility_level: Group.visibility_levels[:public],
    )
  end

  def service
    ::Orbat::Service
  end

  before do
    enable_current_plugin

    public_group.add(public_group_user)
    members_only_group.add(members_only_user)
    limited_group.add(limited_group_user_one)
    limited_group.add(limited_group_user_two)

    SiteSetting.orbat_hide_hidden_groups = false
    SiteSetting.orbat_exclusive_groups = ""
    SiteSetting.orbat_exclusive_groups_passthrough = ""

    service.clear_cache
  end

  after { service.clear_cache }

  def preview_tree(config)
    service.preview(config.to_json)
  end

  describe "group membership in tree output" do
    let(:visibility_config) do
      {
        "title" => "ORBAT",
        "display" => {
          "showEmpty" => true,
        },
        "nodes" => [
          {
            "id" => "public-node",
            "label" => "Public",
            "select" => {
              "any" => [public_group.name],
            },
          },
          {
            "id" => "restricted-node",
            "label" => "Restricted",
            "select" => {
              "any" => [members_only_group.name],
            },
          },
        ],
      }
    end

    it "includes selected memberships in public payloads regardless of group visibility" do
      payload = preview_tree(visibility_config)

      public_node = payload["nodes"].find { |node| node["id"] == "public-node" }
      restricted_node = payload["nodes"].find { |node| node["id"] == "restricted-node" }
      public_user = public_node["users"].find { |entry| entry["id"] == public_group_user.id }
      restricted_user = restricted_node["users"].find { |entry| entry["id"] == members_only_user.id }

      expect(public_node["users"].map { |user| user["id"] }).to include(public_group_user.id)
      expect(restricted_node["users"].map { |user| user["id"] }).to include(members_only_user.id)
      expect(public_user).to have_key("uniformCacheKey")
      expect(public_user).to have_key("uniform_cache_key")
      expect(public_user).to have_key("isRecruit")
      expect(public_user).to have_key("is_recruit")
      expect(restricted_user).to have_key("uniformCacheKey")
      expect(restricted_user).to have_key("uniform_cache_key")
      expect(restricted_user).to have_key("isRecruit")
      expect(restricted_user).to have_key("is_recruit")
    end
  end

  describe "limit parsing" do
    let(:node_config) do
      {
        "display" => {
          "showEmpty" => true,
        },
        "nodes" => [
          {
            "id" => "limit-node",
            "label" => "Limit",
            "select" => {
              "any" => [limited_group.name],
            },
          },
        ],
      }
    end

    it "accepts string limit values" do
      config = node_config.deep_dup
      config["nodes"][0]["select"]["limit"] = "1"

      payload = preview_tree(config)
      users = payload["nodes"][0]["users"]

      expect(payload["errors"]).to eq([])
      expect(users.length).to eq(1)
    end

    it "ignores invalid limit values without failing" do
      config = node_config.deep_dup
      config["nodes"][0]["select"]["limit"] = "not-a-number"

      payload = preview_tree(config)
      users = payload["nodes"][0]["users"]

      expect(payload["errors"]).to eq([])
      expect(users.length).to eq(2)
    end
  end

  describe "client settings" do
    it "does not expose orbat_json to the client payload" do
      settings = JSON.parse(SiteSetting.client_settings_json_uncached)

      expect(settings).to include("orbat_enabled")
      expect(settings).not_to include("orbat_json")
    end
  end
end

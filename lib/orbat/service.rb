# frozen_string_literal: true

require "set" # rubocop:disable Lint/RedundantRequireStatement

class ::Orbat::Service
  CACHE_KEY = "orbat:tree"

  SETTING_DEFAULTS = {
    orbat_cache_ttl: 60,
    orbat_json: "{}",
    orbat_hide_hidden_groups: true,
  }.freeze

  DEFAULT_DISPLAY = {
    "showEmpty" => false,
    "hideGroupLinks" => false,
    "maxPerColumn" => 8,
    "rootLayout" => "row",
    "rootColumns" => nil,
    "gap" => "lg",
    "showAvatars" => false,
    "emptyLabel" => "-",
  }.freeze

  class << self
    def cached_tree
      ttl = positive_ttl(setting(:orbat_cache_ttl))
      Discourse.cache.fetch(CACHE_KEY, expires_in: ttl.seconds) { build_from_setting }
    end

    def preview(raw_json)
      build(raw_json: raw_json, skip_cache: true)
    end

    def clear_cache
      Discourse.cache.delete(CACHE_KEY)
    end

    def build(raw_json: nil, skip_cache: false)
      config = parse_config(raw_json || setting(:orbat_json))
      context = build_context(config)

      nodes = build_nodes(config.fetch("nodes", []), context, parent_code: nil)
      nodes = prune_empty(nodes, context) unless context[:display]["showEmpty"]

      {
        "title" => config["title"],
        "subtitle" => config["subtitle"],
        "banner" => normalize_banner(config["banner"]),
        "display" => context[:display],
        "nodes" => nodes,
        "generatedAt" => Time.zone.now.to_i,
        "errors" => context[:errors].uniq,
      }
    rescue JSON::ParserError => e
      error_payload(I18n.t("orbat.errors.invalid_json", message: e.message))
    rescue => e
      Rails.logger.error("[orbat] #{e.class}: #{e.message}\n#{e.backtrace.join("\n")}")
      error_payload(e.message)
    end

    private

    def build_from_setting
      build(skip_cache: false)
    end

    def error_payload(message)
      {
        "title" => nil,
        "subtitle" => nil,
        "banner" => nil,
        "display" => DEFAULT_DISPLAY.merge("emptyLabel" => default_empty_label),
        "nodes" => [],
        "generatedAt" => Time.zone.now.to_i,
        "errors" => Array(message),
      }
    end

    def parse_config(raw_json)
      json = raw_json.presence || "{}"
      JSON.parse(json)
    end

    def build_context(config)
      rank_priority = Array(config["rankPriority"]).map(&:to_s)

      group_names = collect_group_names(config.fetch("nodes", []))
      group_names.concat(rank_priority)
      group_names = group_names.compact.uniq

      groups =
        if group_names.empty?
          {}
        else
          Group.where(name: group_names).index_by(&:name)
        end

      member_records =
        if groups.present?
          GroupUser.where(group_id: groups.values.map(&:id)).includes(:user, :group)
        else
          []
        end

      members = Hash.new { |hash, key| hash[key] = [] }
      user_groups = Hash.new { |hash, key| hash[key] = [] }

      member_records.each do |record|
        name = record.group.name
        members[name] << record
        user_groups[record.user_id] << name
      end

      display =
        DEFAULT_DISPLAY.merge(config.fetch("display", {})).merge(
          "emptyLabel" => config.dig("display", "emptyLabel").presence || default_empty_label,
        )

      {
        groups: groups,
        members: members,
        user_groups: user_groups,
        rank_priority: rank_priority,
        rank_index: build_rank_index(rank_priority),
        display: display,
        hide_hidden_groups: setting(:orbat_hide_hidden_groups) ? true : false,
        errors: [],
        missing_groups: Set.new,
      }
    end

    def build_rank_index(priority)
      priority.each_with_index.each_with_object({}) { |(name, index), result| result[name] = index }
    end

    def collect_group_names(nodes)
      names = []
      nodes.each do |node|
        select = node["select"] || {}
        names.concat(Array(select["any"]))
        names.concat(Array(select["all"]))
        names.concat(Array(select["not"]))
        names.concat(collect_group_names(node["children"] || []))
      end
      names
    end

    def build_nodes(definitions, context, parent_code:)
      definitions.filter_map do |definition|
        node = build_node(definition, context, parent_code: parent_code)
        node if node
      end
    end

    def build_node(definition, context, parent_code:)
      label = definition["label"].to_s
      node_id = definition["id"].presence || label.parameterize(separator: "-")
      code = definition["code"].presence || node_id
      level = code.to_s.split(".").size

      select = definition["select"]
      users = select ? resolve(select, context) : []
      users = sort_and_limit(users, select, context) if select

      placeholder =
        (select && select["placeholder"].presence) ||
        context[:display]["emptyLabel"]

      children = build_nodes(definition.fetch("children", []), context, parent_code: code)

      meta_groups = select ? extract_group_meta(select) : {}

      {
        "id" => node_id,
        "label" => label,
        "description" => definition["description"],
        "theme" => definition["theme"] || "neutral",
        "badge" => definition["badge"],
        "badgeWidth" => definition["badgeWidth"] || definition["badge_width"],
        "icon" => definition["icon"],
        "labelFontSize" => definition["labelFontSize"] || definition["label_font_size"],
        "layout" => normalize_layout(definition["layout"]),
        "users" => users,
        "placeholder" => placeholder,
        "children" => children,
        "code" => code,
        "level" => level,
        "parentCode" => parent_code,
        "meta" => {
          "sourceGroups" => meta_groups,
          "alwaysShow" => !!definition["alwaysShow"],
          "hideNode" => !!definition["hideNode"],
        },
      }
    end

    def extract_group_meta(select)
      {
        "any" => Array(select["any"]),
        "all" => Array(select["all"]),
        "not" => Array(select["not"]),
      }
    end

    def normalize_layout(layout)
      layout = layout.is_a?(Hash) ? layout : {}

      type = layout["type"].presence || layout["mode"].presence || "column"

      {
        "type" => type,
        "columns" => layout["columns"] || layout["cols"],
        "gap" => layout["gap"] || layout["spacing"],
        "align" => layout["align"],
        "justify" => layout["justify"],
        "wrap" => layout.key?("wrap") ? layout["wrap"] : type == "row",
      }.compact
    end

    def prune_empty(nodes, context)
      nodes.each_with_object([]) do |node, pruned|
        children = prune_empty(node["children"] || [], context)
        keep =
          node.fetch("users", []).present? || children.present? || node["placeholder"].present? ||
            node.dig("meta", "alwaysShow")

        next unless keep

        pruned << node.merge("children" => children)
      end
    end

    def resolve(select, context)
      include_hidden = select["includeHidden"] ? true : false

      any =
        Array(select["any"])
          .flat_map do |group_name|
            members_for(group_name, context, include_hidden: include_hidden)
          end
          .map(&:user)

      all =
        Array(select["all"])
          .map do |group_name|
            members_for(group_name, context, include_hidden: include_hidden).map(&:user)
          end
          .reduce(nil) do |accumulator, collection|
            accumulator ? accumulator & collection : collection
          end || []

      base = select["all"] ? all : any

      exclusions =
        Array(select["not"]).flat_map do |group_name|
          members_for(group_name, context, include_hidden: true).map(&:user_id)
        end

      base.uniq { |user| user.id }.reject { |user| exclusions.include?(user.id) }
    end

    def members_for(group_name, context, include_hidden:)
      return [] if group_name.blank?

      group = context[:groups][group_name]
      unless group
        register_missing_group(group_name, context)
        return []
      end

      if context[:hide_hidden_groups] && !include_hidden && group_hidden?(group)
        register_hidden_group(group_name, context)
        return []
      end

      context[:members][group_name] || []
    end

    def group_hidden?(group)
      group.visibility_level >= Group.visibility_levels[:staff]
    end

    def register_missing_group(group_name, context)
      return if context[:missing_groups].include?(group_name)

      context[:missing_groups] << group_name
    end

    def register_hidden_group(group_name, context)
      key = "hidden:#{group_name}"
      return if context[:missing_groups].include?(key)

      context[:missing_groups] << key
      context[:errors] << I18n.t("orbat.errors.hidden_group", group: group_name)
    end

    def sort_and_limit(users, select, context)
      sort = select && select["sort"] || "alpha"
      limit = select && select["limit"]

      sorted =
        case sort
        when "joined"
          users.sort_by(&:created_at)
        when "rankPriority"
          users.sort_by do |user|
            rank_index =
              context[:user_groups][user.id]
                .map { |name| context[:rank_index][name] }
                .compact
                .min || Float::INFINITY
            [rank_index, user.username_lower]
          end
        else
          users.sort_by(&:username_lower)
        end

      sorted = sorted.first(limit) if limit.present?

      sorted.map { |user| serialize_user(user, context) }
    end

    def serialize_user(user, context)
      summary_path = "#{Discourse.base_path}/u/#{user.encoded_username}/summary"
      profile_path = "#{Discourse.base_path}/u/#{user.encoded_username}"

      rank_prefix =
        if defined?(::DiscourseRankOnNames) && ::DiscourseRankOnNames.respond_to?(:prefix_for_user)
          ::DiscourseRankOnNames.prefix_for_user(user)
        end

      {
        "id" => user.id,
        "username" => user.username,
        "name" => user.name,
        "displayName" => user.display_name,
        "title" => user.title,
        "avatar" => user.avatar_template,
        "path" => summary_path,
        "summaryPath" => summary_path,
        "profilePath" => profile_path,
        "rankPrefix" => rank_prefix,
        "groups" => context[:user_groups][user.id] || [],
      }
    end

    def normalize_banner(banner)
      return nil unless banner.is_a?(Hash)

      {
        "logo" => banner["logo"],
        "title" => banner["title"],
        "subtitle" => banner["subtitle"],
        "background" => banner["background"],
        "accent" => banner["accent"],
      }.compact
    end

    def setting(name)
      SiteSetting.public_send(name)
    rescue NoMethodError, Discourse::InvalidParameters
      SETTING_DEFAULTS.fetch(name) { nil }
    end

    def positive_ttl(value)
      ttl = value.to_i
      ttl.positive? ? ttl : SETTING_DEFAULTS[:orbat_cache_ttl]
    end

    def default_empty_label
      "-"
    end
  end
end

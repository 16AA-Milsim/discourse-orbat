# frozen_string_literal: true

require "set" # rubocop:disable Lint/RedundantRequireStatement

class ::Orbat::Service
  CACHE_KEY = "orbat:tree"

  DEFAULT_CONFIGURATION = <<~JSON.freeze
    {
      "title": "ORBAT",
      "subtitle": "16 Air Assault Brigade",
      "banner": null,
      "display": {
        "showEmpty": true,
        "hideGroupLinks": true,
        "showAvatars": false,
        "maxPerColumn": 12,
        "rootLayout": "row",
        "gap": "sm",
        "emptyLabel": "-",
        "rootSections": [
          {
            "prefixes": ["1"],
            "title": ""
          },
          {
            "prefixes": ["2"],
            "title": "Community Support Arms"
          }
        ]
      },
      "rankPriority": [
        "Major",
        "Squadron_Leader",
        "Captain",
        "Flight_Lieutenant",
        "Lieutenant",
        "Flying_Officer",
        "Second_Lieutenant",
        "Pilot_Officer",
        "Acting_Second_Lieutenant",
        "Warrant_Officer_Class_2",
        "Colour_Sergeant",
        "Staff_Sergeant",
        "Flight_Sergeant_Aircrew",
        "Sergeant",
        "Sergeant_Aircrew",
        "Acting_Sergeant",
        "Corporal",
        "Bombardier",
        "Acting_Corporal",
        "Acting_Bombardier",
        "Lance_Corporal",
        "Lance_Bombardier",
        "Acting_Lance_Corporal",
        "Acting_Lance_Bombardier",
        "Private",
        "Gunner",
        "Recruit"
      ],
      "groupPriority": [
        "Coy_IC",
        "Coy_2IC",
        "CSM",
        "1_Platoon_IC",
        "1_Platoon_2IC",
        "2_Platoon_IC",
        "2_Platoon_2IC",
        "1-1_Section_IC",
        "1-1_Section_2IC",
        "1-1_Section",
        "1-2_Section_IC",
        "1-2_Section_2IC",
        "1-2_Section",
        "1-3_Section_IC",
        "1-3_Section_2IC",
        "1-3_Section",
        "Fire_Support_Group_IC",
        "Fire_Support_Group_2IC",
        "Fire_Support_Group",
        "Force_Protection_IC",
        "Force_Protection_2IC",
        "Force_Protection",
        "13AASR_IC",
        "13AASR_2IC",
        "13AASR",
        "16CSMR_IC",
        "16CSMR_2IC",
        "16CSMR",
        "Reserves"
      ],
      "nodes": [
        {
          "id": "coy-hq",
          "code": "1",
          "label": "A Company HQ",
          "theme": "company",
          "badge": "ab_inf_coy.svg",
          "badgeWidth": "46",
          "icon": "hq.png",
          "labelFontSize": "9",
          "select": {
            "any": ["Coy_IC", "Coy_2IC", "CSM"],
            "sort": "rankPriority"
          },
          "layout": {
            "type": "row",
            "align": "center"
          },
          "alwaysShow": true,
          "children": [
            {
              "id": "platoon-1-hq",
              "code": "1.1",
              "label": "1 Platoon HQ",
              "theme": "platoon",
              "badge": "ab_inf_pl.svg",
              "icon": "red_hq.png",
              "select": {
                "any": ["1_Platoon_IC", "1_Platoon_2IC"],
                "sort": "rankPriority"
              },
              "layout": {
                "type": "column",
                "align": "center"
              },
              "alwaysShow": true,
              "children": [
                {
                  "id": "1-1-section",
                  "code": "1.1.1",
                  "label": "1/1 Section",
                  "theme": "section",
                  "badge": "ab_inf_sec.svg",
                  "icon": "red_1.png",
                  "select": {
                    "any": ["1-1_Section_IC", "1-1_Section_2IC", "1-1_Section"],
                    "sort": "rankPriority"
                  },
                  "layout": {
                    "type": "column",
                    "align": "center"
                  },
                  "alwaysShow": true
                },
                {
                  "id": "1-2-section",
                  "code": "1.1.2",
                  "label": "1/2 Section",
                  "theme": "section",
                  "badge": "ab_inf_sec.svg",
                  "icon": "red_2.png",
                  "select": {
                    "any": ["1-2_Section_IC", "1-2_Section_2IC", "1-2_Section"],
                    "sort": "rankPriority"
                  },
                  "layout": {
                    "type": "column",
                    "align": "center"
                  },
                  "alwaysShow": true
                },
                {
                  "id": "1-3-section",
                  "code": "1.1.3",
                  "label": "1/3 Section",
                  "theme": "section",
                  "badge": "ab_inf_sec.svg",
                  "icon": "red_3.png",
                  "select": {
                    "any": ["1-3_Section_IC", "1-3_Section_2IC", "1-3_Section"],
                    "sort": "rankPriority"
                  },
                  "layout": {
                    "type": "column",
                    "align": "center"
                  },
                  "alwaysShow": true
                }
              ]
            },
            {
              "id": "platoon-4-hq",
              "code": "1.4",
              "label": "4 Platoon HQ",
              "theme": "platoon",
              "badge": "ab_inf_css_pl.svg",
              "icon": "black_hq.png",
              "select": {
                "any": ["4_Platoon_IC", "4_Platoon_2IC"],
                "sort": "rankPriority"
              },
              "layout": {
                "type": "column",
                "align": "center"
              },
              "alwaysShow": true,
              "children": [
                {
                  "id": "fire-support-group",
                  "code": "1.4.1",
                  "label": "Fire Support Group",
                  "theme": "section",
                  "badge": "ab_inf_ms_sec.svg",
                  "icon": "black_1.png",
                  "select": {
                    "any": ["Fire_Support_Group_IC", "Fire_Support_Group_2IC", "Fire_Support_Group"],
                    "sort": "rankPriority"
                  },
                  "layout": {
                    "type": "column",
                    "align": "center"
                  },
                  "alwaysShow": true
                },
                {
                  "id": "force-protection",
                  "code": "1.4.2",
                  "label": "Force Protection",
                  "theme": "section",
                  "badge": "ab_inf_sec.svg",
                  "icon": "black_2.png",
                  "select": {
                    "any": ["Force_Protection_IC", "Force_Protection_2IC", "Force_Protection"],
                    "sort": "rankPriority"
                  },
                  "layout": {
                    "type": "column",
                    "align": "center"
                  },
                  "alwaysShow": true
                },
                {
                  "id": "13-air-assault-support-regiment",
                  "code": "1.4.3",
                  "label": "13 Air Assault Support Regiment",
                  "theme": "section",
                  "badge": "ab_inf_logi_eod_sec.svg",
                  "icon": "black_3.png",
                  "select": {
                    "any": ["13AASR_IC", "13AASR_2IC", "13AASR"],
                    "sort": "rankPriority"
                  },
                  "layout": {
                    "type": "column",
                    "align": "center"
                  },
                  "alwaysShow": true
                },
                {
                  "id": "16-close-support-medical-regiment",
                  "code": "1.4.4",
                  "label": "16 Close Support Medical Regiment",
                  "theme": "section",
                  "badge": "ab_inf_mdcl_sec.svg",
                  "icon": "black_4.png",
                  "select": {
                    "any": ["16CSMR_IC", "16CSMR_2IC", "16CSMR"],
                    "sort": "rankPriority"
                  },
                  "layout": {
                    "type": "column",
                    "align": "center"
                  },
                  "alwaysShow": true
                },
                {
                  "id": "reserves",
                  "code": "1.4.5",
                  "label": "Reserves",
                  "theme": "section",
                  "badge": "ab_inf_sup_sec.svg",
                  "icon": "",
                  "select": {
                    "any": ["Reserves"],
                    "sort": "rankPriority"
                  },
                  "layout": {
                    "type": "column",
                    "align": "center"
                  },
                  "alwaysShow": true
                }
              ]
            },
            {
              "id": "attachments",
              "code": "1.5",
              "label": "Attachments",
              "theme": "platoon",
              "badge": "atts_coy.svg",
              "icon": "",
              "select": {
                "any": ["Attachments_IC", "Attachments_2IC"],
                "sort": "rankPriority"
              },
              "layout": {
                "type": "column",
                "align": "center"
              },
              "alwaysShow": true,
              "children": [
                {
                  "id": "joint-helicopter-command",
                  "code": "1.5.1",
                  "label": "Joint Helicopter Command",
                  "theme": "section",
                  "badge": "rot_wing_coy.svg",
                  "icon": "JHC.png",
                  "select": {
                    "any": ["JHC_IC", "JHC_2IC", "JHC"],
                    "sort": "rankPriority"
                  },
                  "layout": {
                    "type": "column",
                    "align": "center"
                  },
                  "alwaysShow": true
                },
                {
                  "id": "7-royal-horse-artillery",
                  "code": "1.5.2",
                  "label": "7 Royal Horse Artillery",
                  "theme": "section",
                  "icon": "7RHA.png",
                  "hideNode": true,
                  "select": {
                    "any": [""],
                    "sort": "rankPriority"
                  },
                  "layout": {
                    "type": "column",
                    "align": "center"
                  },
                  "alwaysShow": true,
                  "children": [
                    {
                      "id": "battery",
                      "code": "1.5.2.1",
                      "label": "Battery",
                      "theme": "section",
                      "badge": "ab_art_batt.svg",
                      "icon": "",
                      "select": {
                        "any": ["7RHA_IC", "7RHA_2IC", "7RHA"],
                        "sort": "rankPriority"
                      },
                      "layout": {
                        "type": "column",
                        "align": "center"
                      },
                      "alwaysShow": true
                    },
                    {
                      "id": "fst",
                      "code": "1.5.2.2",
                      "label": "Fire Support Team",
                      "theme": "section",
                      "badge": "ab_fst.svg",
                      "icon": "",
                      "select": {
                        "any": ["FST_IC", "FST_2IC", "FST"],
                        "sort": "rankPriority"
                      },
                      "layout": {
                        "type": "column",
                        "align": "center"
                      },
                      "alwaysShow": true
                    }
                  ]
                },
                {
                  "id": "military-intelligence",
                  "code": "1.5.3",
                  "label": "Military Intelligence",
                  "theme": "section",
                  "badge": "mi_ft.svg",
                  "icon": "MI.png",
                  "select": {
                    "any": ["MI_IC", "MI_2IC", "MI"],
                    "sort": "rankPriority"
                  },
                  "layout": {
                    "type": "column",
                    "align": "center"
                  },
                  "alwaysShow": true
                }
              ]
            }
          ]
        },
        {
          "id": "hq",
          "code": "2",
          "label": "HQ",
          "theme": "company",
          "labelFontSize": "9",
          "badge": "adm_pl.svg",
          "icon": "",
          "select": {
            "any": [
              "Coy_IC",
              "Coy_2IC",
              "CSM",
              "REME_IC",
              "RRO_IC",
              "RLC_IC",
              "3LSR_IC",
              "ITC_IC",
              "1_Platoon_IC",
              "4_Platoon_IC",
              "Attachments_IC"
            ],
            "sort": "rankPriority"
          },
          "layout": {
            "type": "column",
            "align": "center"
          },
          "alwaysShow": true,
          "children": [
            {
              "id": "reme",
              "code": "2.1",
              "label": "REME",
              "theme": "section",
              "badge": "reme_sec.svg",
              "icon": "REME.png",
              "select": {
                "any": ["REME_IC", "REME_2IC", "REME"],
                "sort": "rankPriority"
              },
              "layout": {
                "type": "column",
                "align": "center"
              },
              "alwaysShow": true
            },
            {
              "id": "rro",
              "code": "2.2",
              "label": "RRO",
              "theme": "section",
              "badge": "rro_sec.svg",
              "select": {
                "any": ["RRO_IC", "RRO_2IC", "RRO"],
                "sort": "rankPriority"
              },
              "layout": {
                "type": "column",
                "align": "center"
              },
              "alwaysShow": true,
              "children": [
                {
                  "id": "media",
                  "code": "2.2.1",
                  "label": "Media",
                  "theme": "section",
                  "badge": "media_sec.svg",
                  "select": {
                    "any": ["Media_IC", "Media_2IC", "Media"],
                    "sort": "rankPriority"
                  },
                  "layout": {
                    "type": "column",
                    "align": "center"
                  },
                  "alwaysShow": true
                }
              ]
            },
            {
              "id": "rlc",
              "code": "2.3",
              "label": "RLC",
              "theme": "section",
              "badge": "rlc_sec.svg",
              "icon": "RLC.png",
              "select": {
                "any": ["RLC_IC", "RLC_2IC", "RLC"],
                "sort": "rankPriority"
              },
              "layout": {
                "type": "column",
                "align": "center"
              },
              "alwaysShow": true
            },
            {
              "id": "3lsr",
              "code": "2.4",
              "label": "3LSR",
              "theme": "section",
              "badge": "3lsr_sec.svg",
              "icon": "RLC.png",
              "select": {
                "any": ["3LSR_IC", "3LSR_2IC", "3LSR"],
                "sort": "rankPriority"
              },
              "layout": {
                "type": "column",
                "align": "center"
              },
              "alwaysShow": true
            },
            {
              "id": "itc",
              "code": "2.5",
              "label": "ITC",
              "theme": "section",
              "badge": "itc_sec.svg",
              "icon": "ITC.png",
              "select": {
                "any": ["ITC_IC", "ITC_2IC", "ITC"],
                "sort": "rankPriority"
              },
              "layout": {
                "type": "column",
                "align": "center"
              },
              "alwaysShow": true
            }
          ]
        }
      ]
    }
  JSON

  DEFAULT_RANK_PRIORITY = %w[
    Major
    Squadron_Leader
    Captain
    Flight_Lieutenant
    Lieutenant
    Flying_Officer
    Second_Lieutenant
    Pilot_Officer
    Acting_Second_Lieutenant
    Warrant_Officer_Class_2
    Colour_Sergeant
    Staff_Sergeant
    Flight_Sergeant_Aircrew
    Sergeant
    Sergeant_Aircrew
    Acting_Sergeant
    Corporal
    Bombardier
    Acting_Corporal
    Acting_Bombardier
    Lance_Corporal
    Lance_Bombardier
    Acting_Lance_Corporal
    Acting_Lance_Bombardier
    Private
    Gunner
    Recruit
  ].map(&:freeze).freeze

  SETTING_DEFAULTS = {
    orbat_cache_ttl: 60,
    orbat_json: DEFAULT_CONFIGURATION,
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
      legacy_rank_priority = false

      if config.key?("groupPriority")
        group_priority = Array(config["groupPriority"]).map(&:to_s)
      else
        group_priority = Array(config["rankPriority"]).map(&:to_s)
        legacy_rank_priority = true
      end

      rank_priority_groups =
        if !legacy_rank_priority && config.key?("rankPriority")
          Array(config["rankPriority"]).map(&:to_s)
        else
          Array(config["rankGroups"]).map(&:to_s)
        end

      rank_priority_groups = DEFAULT_RANK_PRIORITY if rank_priority_groups.blank?

      group_names = collect_group_names(config.fetch("nodes", []))
      group_names.concat(group_priority)
      group_names.concat(rank_priority_groups)
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
        group_priority: group_priority,
        rank_priority: rank_priority_groups,
        rank_index: build_rank_index(rank_priority_groups, group_priority),
        display: display,
        hide_hidden_groups: setting(:orbat_hide_hidden_groups) ? true : false,
        errors: [],
        missing_groups: Set.new,
      }
    end

    def build_rank_index(rank_priority_groups, group_priority)
      index_map = {}

      rank_priority_groups.each_with_index do |name, index|
        index_map[name] = index
      end

      offset = rank_priority_groups.length

      group_priority.each_with_index do |name, index|
        index_map[name] ||= offset + index
      end

      index_map
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
          users.sort_by { |user| [best_rank_index(user, context), user.username_lower] }
        else
          users.sort_by { |user| [best_rank_index(user, context), user.username_lower] }
        end

      sorted = sorted.first(limit) if limit.present?

      sorted.map { |user| serialize_user(user, context) }
    end

    def best_rank_index(user, context)
      Array(context[:user_groups][user.id])
        .map { |name| context[:rank_index][name] }
        .compact
        .min || Float::INFINITY
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

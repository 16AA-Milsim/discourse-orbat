# name: discourse-orbat
# version: 0.9.3
# about: 16AA ORBAT plugin for Discourse
# authors: OpenAI & Darojax

# frozen_string_literal: true

# define namespace before requiring service
module ::Orbat
  PLUGIN_NAME = "discourse-orbat"
end
require_relative "lib/orbat/service"

register_asset "stylesheets/common/orbat.scss"
register_svg_icon "save"
register_svg_icon "history"
enabled_site_setting :orbat_enabled
add_admin_route "orbat_admin.nav_title", "orbat"

after_initialize do
  register_user_custom_field_type(::Orbat::Service::JOIN_DATE_FIELD, :string, max_length: 10)
  add_to_serializer(:admin_detailed_user, :orbat_join_date) do
    object.custom_fields[::Orbat::Service::JOIN_DATE_FIELD]
  end

  on(:group_user_created)  { ::Orbat::Service.clear_cache }
  on(:group_user_destroyed){ ::Orbat::Service.clear_cache }
  on(:user_added_to_group) { ::Orbat::Service.clear_cache }
  on(:user_removed_from_group) { ::Orbat::Service.clear_cache }
  on(:user_badge_granted) { ::Orbat::Service.clear_cache }
  on(:user_badge_revoked) { ::Orbat::Service.clear_cache }
  on(:user_created) { ::Orbat::Service.clear_cache }
  on(:user_updated) { ::Orbat::Service.clear_cache }
  on(:user_destroyed) { ::Orbat::Service.clear_cache }
  on(:group_created) { ::Orbat::Service.clear_cache }
  on(:group_updated) { ::Orbat::Service.clear_cache }
  on(:group_destroyed) { ::Orbat::Service.clear_cache }

  on(:site_setting_changed) do |name, _old_value, _new_value|
    if %i[
      orbat_json
      orbat_cache_ttl
      orbat_hide_hidden_groups
      orbat_exclusive_groups
      orbat_exclusive_groups_passthrough
      orbat_enabled
      orbat_admin_only
    ].include?(name.to_sym)
      ::Orbat::Service.clear_cache
    end
  end

  module ::Orbat
    class PublicController < ::ApplicationController
      requires_login false
      before_action :ensure_orbat_visible

      def index
        render html: "", layout: "application"
      end

      def data
        payload = ::Orbat::Service.cached_tree
        render_json_dump(payload.merge("errors" => []))
      end

      private

      def ensure_orbat_visible
        raise Discourse::NotFound unless SiteSetting.orbat_enabled

        return unless SiteSetting.orbat_admin_only
        return if current_user&.admin?

        raise Discourse::NotFound
      end
    end

    class AdminController < ::Admin::AdminController
      requires_plugin ::Orbat::PLUGIN_NAME

      def show
        configuration = SiteSetting.orbat_json
        render_json_dump(
          configuration: configuration,
          tree: ::Orbat::Service.preview(configuration),
        )
      end

      def preview
        configuration = params.require(:configuration)
        render_json_dump(::Orbat::Service.preview(configuration))
      rescue ActionController::ParameterMissing => e
        render_json_error(e.message)
      rescue => e
        Rails.logger.error(
          "[orbat] preview failed: #{e.class}: #{e.message}\n#{e.backtrace&.join("\n")}",
        )
        render_json_error(e.message)
      end

      def restore
        default_configuration = SiteSetting.defaults[:orbat_json].presence ||
          ::Orbat::Service::SETTING_DEFAULTS[:orbat_json]

        if default_configuration.blank?
          render_json_error(I18n.t("orbat_admin.errors.missing_default"), status: 422)
          return
        end

        SiteSetting.orbat_json = default_configuration
        ::Orbat::Service.clear_cache

        render_json_dump(
          configuration: default_configuration,
          tree: ::Orbat::Service.cached_tree,
        )
      rescue => e
        Rails.logger.error(
          "[orbat] restore default failed: #{e.class}: #{e.message}\n#{e.backtrace&.join("\n")}",
        )
        render_json_error(e.message)
      end
    end

    class AdminUsersController < ::Admin::AdminController
      requires_plugin ::Orbat::PLUGIN_NAME

      def update_join_date
        user = User.find(params[:id])
        guardian.ensure_can_edit!(user)

        join_date = params[:join_date].presence
        if join_date
          parsed = Date.iso8601(join_date) rescue nil
          unless parsed
            render_json_error(I18n.t("orbat_admin.errors.invalid_join_date"), status: 422)
            return
          end
          user.custom_fields[::Orbat::Service::JOIN_DATE_FIELD] = parsed.iso8601
        else
          user.custom_fields.delete(::Orbat::Service::JOIN_DATE_FIELD)
        end

        user.save_custom_fields
        ::Orbat::Service.clear_cache
        render_json_dump(join_date: user.custom_fields[::Orbat::Service::JOIN_DATE_FIELD])
      rescue ActiveRecord::RecordNotFound
        raise Discourse::NotFound
      end
    end
  end


  Discourse::Application.routes.append do
    get "/orbat" => "orbat/public#index", constraints: { format: :html }
    get "/orbat.json" => "orbat/public#data"
    get "/admin/plugins/orbat" => "admin/plugins#index"
    get "/admin/plugins/orbat/config.json" => "orbat/admin#show"
    post "/admin/plugins/orbat/preview" => "orbat/admin#preview"
    post "/admin/plugins/orbat/restore" => "orbat/admin#restore"
    put "/admin/users/:id/orbat-join-date" => "orbat/admin_users#update_join_date"
  end
end
